const User = require('../models/User');

// ============================================================================
// Bajas de turnos: bloqueo cercano a la clase + contador mensual de avisos
// ----------------------------------------------------------------------------
//  1) Una persona no puede borrarse de su turno desde 15 minutos antes de que
//     empiece la clase hasta que termina (los admins quedan exentos).
//  2) Cada baja voluntaria se cuenta por mes. Desde la octava se muestran
//     avisos en el frontend. El contador NO bloquea ni modifica nada: sólo
//     informa. Se reinicia solo cada mes (se guarda con el mes en que se hizo).
// ============================================================================

const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

const MINUTOS_BLOQUEO_ANTES = 15;      // desde cuándo antes de la clase no se puede borrar
const DURACION_CLASE_MIN = 60;         // hasta cuándo, después de empezar, sigue sin poderse
const LIMITE_BAJAS_MENSUALES = 10;
const PRIMER_AVISO_BAJAS = 8;          // la 8ª y la 9ª baja muestran advertencia; la 10ª el límite

// Igual que en utils/enviarAvisoReserva.js: el calendario se reinicia los sábados
// a las 15 hs UTC (12 hs de Argentina) y desde ahí los horarios son de la semana
// siguiente, así que un turno de "sábado" ya no está "cerca" pasado ese momento.
const REINICIO_SABADO_MINUTOS = 12 * 60;

const DIAS_EN_INGLES = {
    Sunday: 'domingo',
    Monday: 'lunes',
    Tuesday: 'martes',
    Wednesday: 'miércoles',
    Thursday: 'jueves',
    Friday: 'viernes',
    Saturday: 'sábado',
};

const formateadorArgentina = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

// Día de la semana, minutos desde las 00:00 y mes ('2026-10') en hora argentina
const ahoraEnArgentina = (ms = Date.now()) => {
    const partes = {};
    formateadorArgentina.formatToParts(new Date(ms)).forEach((parte) => {
        partes[parte.type] = parte.value;
    });

    return {
        dia: DIAS_EN_INGLES[partes.weekday],
        minutos: Number(partes.hour) * 60 + Number(partes.minute) + Number(partes.second) / 60,
        periodo: `${partes.year}-${partes.month}`,
    };
};

const INDICE_DIA = { domingo: 0, lunes: 1, martes: 2, 'miércoles': 3, jueves: 4, viernes: 5, 'sábado': 6 };
const MINUTOS_POR_SEMANA = 7 * 24 * 60;

// Minutos transcurridos desde el último reinicio semanal (sábado 12 hs de Argentina).
// Un horario de "sábado" cae al final del ciclo: es el sábado siguiente, antes del reinicio.
const posicionEnLaSemana = (indiceDia, minutosDelDia, { esClase = false } = {}) => {
    const diasDesdeSabado = (indiceDia - 6 + 7) % 7;
    const posicion = diasDesdeSabado * 24 * 60 + minutosDelDia - REINICIO_SABADO_MINUTOS;
    // Una clase justo a las 12 del sábado coincide con el reinicio: pertenece al ciclo que termina
    return (esClase ? posicion <= 0 : posicion < 0) ? posicion + MINUTOS_POR_SEMANA : posicion;
};

// ¿La clase de esta semana ya terminó? Las bajas de clases pasadas no liberan lugar para
// nadie, así que no suman al contador mensual.
const claseYaTermino = ({ day, hour }, ms = Date.now()) => {
    const diaClase = INDICE_DIA[day];
    const horaClase = Number(hour);
    if (diaClase === undefined || !Number.isInteger(horaClase)) return false;

    const ahora = ahoraEnArgentina(ms);
    const posicionAhora = posicionEnLaSemana(INDICE_DIA[ahora.dia], ahora.minutos);
    const posicionClase = posicionEnLaSemana(diaClase, horaClase * 60, { esClase: true });
    return posicionAhora >= posicionClase + DURACION_CLASE_MIN;
};

// ¿Está demasiado cerca la clase como para borrarse?
// Devuelve { bloqueado, enCurso, minutosParaInicio }.
const estadoBloqueoBaja = ({ day, hour }, ms = Date.now()) => {
    const horaClase = Number(hour);
    if (!Number.isInteger(horaClase)) return { bloqueado: false };

    const ahora = ahoraEnArgentina(ms);
    if (ahora.dia !== day) return { bloqueado: false };
    if (day === 'sábado' && ahora.minutos >= REINICIO_SABADO_MINUTOS) return { bloqueado: false };

    const minutosParaInicio = horaClase * 60 - ahora.minutos; // negativo: la clase ya empezó
    if (minutosParaInicio > MINUTOS_BLOQUEO_ANTES || minutosParaInicio <= -DURACION_CLASE_MIN) {
        return { bloqueado: false };
    }

    return {
        bloqueado: true,
        enCurso: minutosParaInicio <= 0,
        minutosParaInicio: Math.max(0, Math.ceil(minutosParaInicio)),
    };
};

// 'advertencia' (8ª y 9ª baja), 'limite' (10ª en adelante) o null
const nivelDeAviso = (cantidad) => {
    if (cantidad >= LIMITE_BAJAS_MENSUALES) return 'limite';
    if (cantidad >= PRIMER_AVISO_BAJAS) return 'advertencia';
    return null;
};

const resumenDeBajas = (cantidad) => ({
    cantidad,
    limite: LIMITE_BAJAS_MENSUALES,
    restantes: Math.max(0, LIMITE_BAJAS_MENSUALES - cantidad),
    aviso: nivelDeAviso(cantidad),
});

// ---------------------------------------------------------------------------
// Suma una baja al mes en curso del usuario y devuelve el resumen actualizado.
// Es atómico (varias bajas simultáneas no se pisan) y nunca lanza: si algo falla
// devuelve null, para que un problema del contador jamás impida cancelar un turno.
// ---------------------------------------------------------------------------
const registrarBaja = async (usuarioId, ms = Date.now()) => {
    const { periodo } = ahoraEnArgentina(ms);
    const opciones = { new: true, projection: { bajasMensuales: 1 } };

    try {
        for (let intento = 0; intento < 3; intento++) {
            // Mismo mes: se suma
            let usuario = await User.findOneAndUpdate(
                { _id: usuarioId, 'bajasMensuales.periodo': periodo },
                { $inc: { 'bajasMensuales.cantidad': 1 } },
                opciones
            ).lean();

            // Mes nuevo o primera baja: el contador arranca en 1 (reinicio mensual)
            if (!usuario) {
                usuario = await User.findOneAndUpdate(
                    { _id: usuarioId, 'bajasMensuales.periodo': { $ne: periodo } },
                    { $set: { bajasMensuales: { periodo, cantidad: 1 } } },
                    opciones
                ).lean();
            }

            if (usuario?.bajasMensuales) return resumenDeBajas(usuario.bajasMensuales.cantidad);
        }
        return null;
    } catch (error) {
        console.error('No se pudo registrar la baja del mes:', error?.message || error);
        return null;
    }
};

module.exports = {
    ZONA_HORARIA,
    MINUTOS_BLOQUEO_ANTES,
    DURACION_CLASE_MIN,
    LIMITE_BAJAS_MENSUALES,
    PRIMER_AVISO_BAJAS,
    ahoraEnArgentina,
    estadoBloqueoBaja,
    claseYaTermino,
    nivelDeAviso,
    resumenDeBajas,
    registrarBaja,
};
