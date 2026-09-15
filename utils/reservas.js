const mongoose = require('mongoose');
const Calendar = require('../models/Calendar');
const Reserva = require('../models/Reserva');
const User = require('../models/User');
const ScheduleRestriction = require('../models/ScheduleRestriction');
const { debeAbonarParaInscribirse } = require('../middleware/checkPaymentRestriction');
const { DIAS_VALIDOS, TURNOS_VALIDOS, getFullName, isSlotBlockedFor } = require('./scheduleRestrictions');
const enviarAvisoReserva = require('./enviarAvisoReserva');

// ============================================================================
// Inscripciones del calendario semanal + lista de reserva
// ----------------------------------------------------------------------------
// Toda la lógica de "¿hay lugar o va a reserva?" se resuelve en el servidor.
// Cada escritura sobre un horario es un compare-and-set: sólo se guarda si el
// horario sigue igual a como se leyó. Si otra persona lo modificó en el medio,
// se vuelve a leer y se reintenta. Así dos inscripciones simultáneas nunca se
// pisan entre sí.
// ============================================================================

const MAX_RESERVAS = 3;
const MAX_REINTENTOS = 8;

class CalendarError extends Error {
    constructor(status, code, msg, extra = {}) {
        super(msg);
        this.status = status;
        this.code = code;
        this.extra = extra;
    }
}

const normalizarNombre = (valor) => (typeof valor === 'string' ? valor.trim().toLowerCase() : '');

// Valida día/turno/hora y devuelve la hora con el mismo formato que las claves del calendario ("9", "10"...)
const validarHorario = (day, shift, hour) => {
    const hora = String(hour ?? '').trim();
    if (!DIAS_VALIDOS.includes(day) || !TURNOS_VALIDOS.includes(shift) || !/^\d{1,2}$/.test(hora) || Number(hora) > 23) {
        throw new CalendarError(400, 'HORARIO_INVALIDO', 'Día, turno u hora inválidos.');
    }
    return { day, shift, hour: String(Number(hora)) };
};

const rutaHorario = ({ day, shift, hour }) => `${day}.${shift}.${hour}`;
const filtroHorario = ({ day, shift, hour }) => ({ day, shift, hour });
const claveHorario = ({ day, shift, hour }) => `${day}.${shift}.${hour}`;

// ---------------------------------------------------------------------------
// Candado por horario: las operaciones sobre un mismo horario (inscribir, dar
// de baja, promover) se ejecutan de a una dentro del servidor. Evita, por
// ejemplo, que dos personas ocupen a la vez el último lugar de reserva.
// El compare-and-set de cada escritura sigue funcionando como segunda barrera.
// ---------------------------------------------------------------------------
const colasPorHorario = new Map();

const conCandado = (slot, operacion) => {
    const clave = claveHorario(slot);
    const anterior = colasPorHorario.get(clave) || Promise.resolve();
    const resultado = anterior.then(operacion);
    const cola = resultado.catch(() => {});
    colasPorHorario.set(clave, cola);
    cola.then(() => {
        if (colasPorHorario.get(clave) === cola) colasPorHorario.delete(clave);
    });
    return resultado;
};

const leerHorario = async (slot) => {
    const doc = await Calendar.collection.findOne({}, { projection: { [rutaHorario(slot)]: 1 } });
    if (!doc) throw new CalendarError(404, 'CALENDARIO_NO_ENCONTRADO', 'El calendario no está disponible.');

    const horario = doc[slot.day]?.[slot.shift]?.[slot.hour];
    if (!Array.isArray(horario)) {
        throw new CalendarError(400, 'HORARIO_INVALIDO', 'Ese horario no existe en el calendario.');
    }
    return { calendarId: doc._id, horario };
};

// Compare-and-set: guarda `nuevo` sólo si el horario sigue siendo exactamente `anterior`
const reemplazarHorario = async (calendarId, slot, anterior, nuevo) => {
    const ruta = rutaHorario(slot);
    const { matchedCount } = await Calendar.collection.updateOne(
        { _id: calendarId, [ruta]: anterior },
        { $set: { [ruta]: nuevo } }
    );
    return matchedCount === 1;
};

const formatearReserva = (reserva) => ({ id: String(reserva._id), nombre: reserva.nombre });

const listarReservasDeHorario = async (slot) => {
    const reservas = await Reserva.find(filtroHorario(slot)).sort({ createdAt: 1, _id: 1 }).lean();
    return reservas.map(formatearReserva);
};

// { "lunes.mañana.10": [{ id, nombre }, ...] } en orden de llegada
const listarTodasLasReservas = async () => {
    const reservas = await Reserva.find({}).sort({ createdAt: 1, _id: 1 }).lean();
    return reservas.reduce((acc, reserva) => {
        const clave = claveHorario(reserva);
        if (!acc[clave]) acc[clave] = [];
        acc[clave].push(formatearReserva(reserva));
        return acc;
    }, {});
};

const obtenerEstadoHorario = async (slot) => {
    const [{ horario }, reservas] = await Promise.all([leerHorario(slot), listarReservasDeHorario(slot)]);
    return { horario, reservas };
};

const posicionEnReserva = async (reserva) => {
    const anteriores = await Reserva.countDocuments({
        ...filtroHorario(reserva),
        $or: [
            { createdAt: { $lt: reserva.createdAt } },
            { createdAt: reserva.createdAt, _id: { $lt: reserva._id } },
        ],
    });
    return anteriores + 1;
};

// Momento del último vaciado total de reservas (reinicio semanal o manual)
let ultimoVaciadoTotal = 0;

// Vuelve a insertar una reserva con su _id y fecha originales (conserva su lugar en la fila)
const restaurarReserva = async (reserva) => {
    // Si en el medio se reinició el calendario, esa reserva era de la semana anterior
    if (new Date(reserva.createdAt).getTime() <= ultimoVaciadoTotal) return;
    try {
        await Reserva.collection.insertOne(reserva);
    } catch (error) {
        // Si el usuario ya se volvió a anotar en el medio, no hay nada que restaurar
        if (error?.code !== 11000) throw error;
    }
};

const puedeOcuparElLugar = async (reserva) => {
    const [usuario, restriccion] = await Promise.all([
        User.findById(reserva.user).select('role pago').lean(),
        ScheduleRestriction.findOne({ user: reserva.user }).lean(),
    ]);

    let motivo = null;
    if (!usuario) motivo = 'el usuario ya no existe';
    else if (debeAbonarParaInscribirse(usuario)) motivo = 'tiene la cuota impaga';
    else if (usuario.role !== 'admin' && isSlotBlockedFor(restriccion, reserva.day, reserva.shift, reserva.hour)) {
        motivo = 'tiene ese horario restringido';
    }

    if (motivo) {
        console.log(`Reserva de ${reserva.nombre} en ${reserva.day} ${reserva.hour}:00 hs descartada: ${motivo}.`);
        return false;
    }
    return true;
};

// ---------------------------------------------------------------------------
// Completa los lugares libres del horario con las reservas, por orden de llegada.
// Devuelve las reservas que pasaron a estar confirmadas.
// (Uso interno: se llama con el candado del horario ya tomado)
// ---------------------------------------------------------------------------
const promoverSinCandado = async (slot) => {
    const promovidas = [];
    let conflictos = 0;

    while (conflictos < MAX_REINTENTOS) {
        let lectura;
        try {
            lectura = await leerHorario(slot);
        } catch (error) {
            if (error instanceof CalendarError) break;
            throw error;
        }

        const { calendarId, horario } = lectura;
        const libre = horario.indexOf(null);
        if (libre === -1) break;

        // Se "reclama" la reserva más antigua de forma atómica, para que dos
        // procesos en paralelo nunca promuevan a la misma persona.
        const reserva = await Reserva.findOneAndDelete(filtroHorario(slot), { sort: { createdAt: 1, _id: 1 } }).lean();
        if (!reserva) break;

        // Si por algún motivo ya estaba dentro del horario, sólo se descarta la reserva
        if (horario.some((persona) => normalizarNombre(persona) === reserva.nombre)) continue;

        // Se aplican las mismas reglas que al inscribirse: si hoy no podría anotarse
        // (cuota impaga o restricción de horarios), pierde la reserva y sigue la próxima
        if (!(await puedeOcuparElLugar(reserva))) continue;

        const nuevo = [...horario];
        nuevo[libre] = reserva.nombre;

        if (await reemplazarHorario(calendarId, slot, horario, nuevo)) {
            promovidas.push(reserva);
        } else {
            // El horario cambió entre la lectura y la escritura: la reserva vuelve a su lugar y se reintenta
            await restaurarReserva(reserva);
            conflictos++;
        }
    }

    return promovidas;
};

// Aviso por mail a quienes pasaron de reserva a confirmados (no bloquea la respuesta HTTP)
const notificarPromociones = (promovidas, { excluirUsuarioId } = {}) => {
    promovidas
        .filter((reserva) => !excluirUsuarioId || String(reserva.user) !== String(excluirUsuarioId))
        .forEach((reserva) => {
            enviarAvisoReserva({
                userId: reserva.user,
                day: reserva.day,
                shift: reserva.shift,
                hour: reserva.hour,
            }).catch((error) => console.error('Error avisando a la reserva promovida:', error?.message || error));
        });
};

// ---------------------------------------------------------------------------
// Inscribe al usuario en el horario. Si está completo y el usuario aceptó,
// lo anota en la lista de reserva.
// ---------------------------------------------------------------------------
const inscribirUsuario = async ({ usuario, day, shift, hour, aceptaReserva = false }) => {
    const slot = validarHorario(day, shift, hour);
    const nombre = getFullName(usuario);
    if (!nombre) throw new CalendarError(400, 'USUARIO_SIN_NOMBRE', 'Tu usuario no tiene nombre cargado.');

    const conSlot = (error) => Object.assign(error, { slot });

    return conCandado(slot, async () => {
        // Si quedaron lugares libres con gente esperando, las reservas entran primero
        const promovidasPrevias = await promoverSinCandado(slot);
        notificarPromociones(promovidasPrevias, { excluirUsuarioId: usuario._id });
        if (promovidasPrevias.some((reserva) => String(reserva.user) === String(usuario._id))) {
            return { estado: 'confirmado', slot };
        }

        for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
            const { calendarId, horario } = await leerHorario(slot);

            if (horario.some((persona) => normalizarNombre(persona) === nombre)) {
                throw conSlot(new CalendarError(409, 'YA_INSCRIPTO', 'Ya estás inscripto en este horario.'));
            }

            const libre = horario.indexOf(null);
            if (libre !== -1) {
                const nuevo = [...horario];
                nuevo[libre] = nombre;
                if (!(await reemplazarHorario(calendarId, slot, horario, nuevo))) continue;

                // Si estaba en la reserva de este horario, ya no la necesita
                await Reserva.deleteOne({ ...filtroHorario(slot), user: usuario._id });
                return { estado: 'confirmado', slot };
            }

            // ── Horario completo ──
            const existente = await Reserva.findOne({ ...filtroHorario(slot), user: usuario._id }).lean();
            if (existente) {
                const posicion = await posicionEnReserva(existente);
                throw conSlot(new CalendarError(409, 'YA_EN_RESERVA', `Ya estás en la reserva de este horario (posición ${posicion}).`, { posicion }));
            }

            const ocupadas = await Reserva.countDocuments(filtroHorario(slot));
            if (ocupadas >= MAX_RESERVAS) {
                throw conSlot(new CalendarError(409, 'RESERVA_COMPLETA', 'El horario y sus lugares de reserva están completos. Probá con otro horario.'));
            }

            if (!aceptaReserva) {
                throw conSlot(new CalendarError(409, 'HORARIO_COMPLETO', 'El horario está completo.', {
                    reservasOcupadas: ocupadas,
                    maxReservas: MAX_RESERVAS,
                }));
            }

            let reserva;
            try {
                reserva = await Reserva.create({ ...filtroHorario(slot), user: usuario._id, nombre });
            } catch (error) {
                // Doble click / pedido duplicado: se vuelve a evaluar y responde YA_EN_RESERVA
                if (error?.code === 11000) continue;
                throw error;
            }

            // Dos personas pueden haber tomado el último lugar de reserva al mismo tiempo
            if ((await posicionEnReserva(reserva)) > MAX_RESERVAS) {
                await Reserva.deleteOne({ _id: reserva._id });
                throw conSlot(new CalendarError(409, 'RESERVA_COMPLETA', 'El horario y sus lugares de reserva están completos. Probá con otro horario.'));
            }

            // Si se liberó un lugar mientras se anotaba, la reserva entra enseguida
            const promovidas = await promoverSinCandado(slot);
            notificarPromociones(promovidas, { excluirUsuarioId: usuario._id });
            if (promovidas.some((r) => String(r._id) === String(reserva._id))) {
                return { estado: 'confirmado', slot };
            }

            return { estado: 'reserva', posicion: await posicionEnReserva(reserva), slot };
        }

        throw conSlot(new CalendarError(409, 'CONFLICTO', 'El horario cambió mientras te anotabas. Intentá de nuevo.'));
    });
};

// ---------------------------------------------------------------------------
// Quita a una persona del horario y hace entrar a la primera reserva.
//  - Usuario común: sólo puede quitarse a sí mismo.
//  - Admin: puede quitar a cualquiera (se identifica por nombre + posición).
// ---------------------------------------------------------------------------
const quitarDelHorario = async ({ solicitante, day, shift, hour, index, nombre }) => {
    const slot = validarHorario(day, shift, hour);
    const esAdmin = solicitante?.role === 'admin';
    const buscado = esAdmin ? normalizarNombre(nombre) : getFullName(solicitante);
    const indice = Number.isInteger(index) ? index : (typeof index === 'string' && /^\d+$/.test(index) ? Number(index) : -1);
    const conSlot = (error) => Object.assign(error, { slot });

    if (!esAdmin && normalizarNombre(nombre) && normalizarNombre(nombre) !== buscado) {
        throw conSlot(new CalendarError(403, 'SIN_PERMISO', 'Sólo un administrador puede quitar a otras personas del horario.'));
    }

    return conCandado(slot, async () => {
        let removido = null;
        for (let intento = 0; intento < MAX_REINTENTOS && !removido; intento++) {
            const { calendarId, horario } = await leerHorario(slot);

            let objetivo = -1;
            if (buscado) {
                // Se prioriza la posición indicada, pero si la persona cambió de lugar se la busca por nombre
                objetivo = normalizarNombre(horario[indice]) === buscado
                    ? indice
                    : horario.findIndex((persona) => normalizarNombre(persona) === buscado);
            } else if (esAdmin && indice >= 0 && indice < horario.length && horario[indice] !== null) {
                objetivo = indice;
            }

            if (objetivo === -1) {
                throw conSlot(esAdmin
                    ? new CalendarError(409, 'YA_NO_ESTA', 'Esa persona ya no está en este horario.')
                    : new CalendarError(404, 'NO_INSCRIPTO', 'No estás inscripto en este horario.'));
            }

            const nuevo = [...horario];
            nuevo[objetivo] = null;
            if (await reemplazarHorario(calendarId, slot, horario, nuevo)) removido = horario[objetivo];
        }

        if (!removido) {
            throw conSlot(new CalendarError(409, 'CONFLICTO', 'El horario cambió mientras se procesaba. Intentá de nuevo.'));
        }

        const promovidas = await promoverSinCandado(slot);
        notificarPromociones(promovidas);

        return { removido, promovidos: promovidas.map((reserva) => reserva.nombre), slot };
    });
};

// ---------------------------------------------------------------------------
// Quita una reserva. El usuario sólo puede quitar las propias; el admin, cualquiera.
// ---------------------------------------------------------------------------
const quitarReserva = async ({ solicitante, reservaId }) => {
    if (!mongoose.Types.ObjectId.isValid(reservaId)) {
        throw new CalendarError(404, 'RESERVA_NO_ENCONTRADA', 'La reserva ya no existe.');
    }

    const reserva = await Reserva.findById(reservaId).lean();
    if (!reserva) throw new CalendarError(404, 'RESERVA_NO_ENCONTRADA', 'La reserva ya no existe.');

    const slot = { day: reserva.day, shift: reserva.shift, hour: reserva.hour };
    if (solicitante?.role !== 'admin' && String(reserva.user) !== String(solicitante?._id)) {
        throw Object.assign(new CalendarError(403, 'SIN_PERMISO', 'Sólo podés quitar tus propias reservas.'), { slot });
    }

    const { deletedCount } = await conCandado(slot, () => Reserva.deleteOne({ _id: reserva._id }));
    if (!deletedCount) {
        // Justo antes se liberó un lugar y la reserva pasó a estar confirmada
        throw Object.assign(new CalendarError(409, 'RESERVA_NO_ENCONTRADA', 'Esa reserva ya no está en la lista: puede que haya entrado al horario.'), { slot });
    }
    return { removido: reserva.nombre, slot };
};

// ---------------------------------------------------------------------------
// Quita a una persona (por nombre) de un horario del calendario semanal y
// completa el lugar con la reserva. Lo usa el panel de restricciones.
// ---------------------------------------------------------------------------
const quitarNombreDelHorario = (slotEntrada, nombre) => {
    const slot = validarHorario(slotEntrada.day, slotEntrada.shift, slotEntrada.hour);
    const buscado = normalizarNombre(nombre);

    return conCandado(slot, async () => {
        let removido = false;
        for (let intento = 0; intento < MAX_REINTENTOS; intento++) {
            const { calendarId, horario } = await leerHorario(slot);
            if (!horario.some((persona) => normalizarNombre(persona) === buscado)) break;

            const nuevo = horario.map((persona) => (normalizarNombre(persona) === buscado ? null : persona));
            if (await reemplazarHorario(calendarId, slot, horario, nuevo)) {
                removido = true;
                break;
            }
        }

        if (removido) notificarPromociones(await promoverSinCandado(slot));
        return removido;
    });
};

// Completa los lugares libres de un horario con su lista de reserva (uso externo, toma el candado)
const promoverReservas = (slot) => conCandado(slot, () => promoverSinCandado(slot));

// Vacía las listas de reserva (todas o las que coincidan con el filtro)
const limpiarReservas = (filtro = {}) => {
    if (Object.keys(filtro).length === 0) ultimoVaciadoTotal = Date.now();
    return Reserva.deleteMany(filtro);
};

module.exports = {
    MAX_RESERVAS,
    CalendarError,
    validarHorario,
    claveHorario,
    listarTodasLasReservas,
    obtenerEstadoHorario,
    promoverReservas,
    notificarPromociones,
    inscribirUsuario,
    quitarDelHorario,
    quitarReserva,
    quitarNombreDelHorario,
    limpiarReservas,
};
