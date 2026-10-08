// Tests del bloqueo de bajas cercanas a la clase y del contador mensual.
// No usan base de datos: se reemplazan las llamadas a Mongo por versiones en memoria.
// Ejecutar con:  node --test tests/bajas.test.js

const test = require('node:test');
const { mock } = require('node:test');
const assert = require('node:assert/strict');

// utils/mailer.js carga el .env con dotenv, que no pisa variables ya definidas: con esto el
// MONGO_URI real nunca llega a este proceso (igual los tests no se conectan a ninguna base)
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/tests-sin-conexion';

const User = require('../models/User');
const Calendar = require('../models/Calendar');
const Reserva = require('../models/Reserva');
const {
    ahoraEnArgentina,
    estadoBloqueoBaja,
    claseYaTermino,
    nivelDeAviso,
    resumenDeBajas,
    registrarBaja,
} = require('../utils/bajas');
const { quitarDelHorario, CalendarError } = require('../utils/reservas');

// Argentina es UTC-3 todo el año: 17:45 en Argentina = 20:45 UTC
const ar = (anio, mes, dia, hora, minuto = 0, segundo = 0) => Date.UTC(anio, mes - 1, dia, hora + 3, minuto, segundo);

// Lunes 5/10/2026 (el 7/10/2026 es miércoles)
const LUNES = (hora, minuto = 0, segundo = 0) => ar(2026, 10, 5, hora, minuto, segundo);
const SABADO = (hora, minuto = 0, segundo = 0) => ar(2026, 10, 10, hora, minuto, segundo);

// ---------------------------------------------------------------------------
// Hora argentina
// ---------------------------------------------------------------------------
test('ahoraEnArgentina: día, minutos y mes en hora argentina', () => {
    const a = ahoraEnArgentina(LUNES(17, 45, 30));
    assert.equal(a.dia, 'lunes');
    assert.equal(a.minutos, 17 * 60 + 45 + 0.5);
    assert.equal(a.periodo, '2026-10');
});

test('ahoraEnArgentina: la medianoche es 00 (no 24) y el cambio de mes respeta Argentina', () => {
    const ultimoSegundo = ahoraEnArgentina(ar(2026, 10, 31, 23, 59, 59));
    assert.equal(ultimoSegundo.periodo, '2026-10');
    assert.equal(ultimoSegundo.dia, 'sábado');

    const primerSegundo = ahoraEnArgentina(ar(2026, 11, 1, 0, 0, 0));
    assert.equal(primerSegundo.periodo, '2026-11');
    assert.equal(primerSegundo.dia, 'domingo');
    assert.equal(primerSegundo.minutos, 0);

    // El mes cambia a las 03:00 UTC (00:00 de Argentina), no a las 00:00 UTC
    assert.equal(ahoraEnArgentina(Date.UTC(2026, 10, 1, 2, 59, 59)).periodo, '2026-10');
    assert.equal(ahoraEnArgentina(Date.UTC(2026, 10, 1, 3, 0, 0)).periodo, '2026-11');
});

// ---------------------------------------------------------------------------
// Ventana de bloqueo: 15 minutos antes hasta que termina la clase
// ---------------------------------------------------------------------------
test('estadoBloqueoBaja: límites exactos de la ventana (clase de las 18)', () => {
    const slot = { day: 'lunes', hour: '18' };

    assert.equal(estadoBloqueoBaja(slot, LUNES(10, 0)).bloqueado, false, 'a la mañana se puede');
    assert.equal(estadoBloqueoBaja(slot, LUNES(17, 44, 59)).bloqueado, false, '15:01 antes todavía se puede');

    const justo = estadoBloqueoBaja(slot, LUNES(17, 45, 0));
    assert.equal(justo.bloqueado, true, 'a los 15 minutos exactos ya no');
    assert.equal(justo.enCurso, false);
    assert.equal(justo.minutosParaInicio, 15);

    const casi = estadoBloqueoBaja(slot, LUNES(17, 59, 30));
    assert.equal(casi.bloqueado, true);
    assert.equal(casi.minutosParaInicio, 1);

    const empezo = estadoBloqueoBaja(slot, LUNES(18, 0, 0));
    assert.equal(empezo.bloqueado, true);
    assert.equal(empezo.enCurso, true);
    assert.equal(empezo.minutosParaInicio, 0);

    assert.equal(estadoBloqueoBaja(slot, LUNES(18, 59, 59)).bloqueado, true, 'durante la clase sigue bloqueado');
    assert.equal(estadoBloqueoBaja(slot, LUNES(19, 0, 0)).bloqueado, false, 'terminada la clase ya no');
});

test('estadoBloqueoBaja: sólo aplica el mismo día de la semana', () => {
    const slot = { day: 'lunes', hour: '18' };
    const martes = ar(2026, 10, 6, 17, 50);
    assert.equal(estadoBloqueoBaja(slot, martes).bloqueado, false);
    // Otro turno del mismo día, lejos de la clase
    assert.equal(estadoBloqueoBaja({ day: 'lunes', hour: '8' }, LUNES(17, 50)).bloqueado, false);
});

test('estadoBloqueoBaja: el sábado tras el reinicio de las 12 hs los turnos son de la semana siguiente', () => {
    assert.equal(estadoBloqueoBaja({ day: 'sábado', hour: '12' }, SABADO(11, 50)).bloqueado, true);
    assert.equal(estadoBloqueoBaja({ day: 'sábado', hour: '12' }, SABADO(12, 0)).bloqueado, false);
    assert.equal(estadoBloqueoBaja({ day: 'sábado', hour: '12' }, SABADO(12, 30)).bloqueado, false);
    assert.equal(estadoBloqueoBaja({ day: 'sábado', hour: '11' }, SABADO(11, 30)).bloqueado, true);
    assert.equal(estadoBloqueoBaja({ day: 'sábado', hour: '9' }, SABADO(8, 50)).bloqueado, true);
});

test('estadoBloqueoBaja: datos inválidos nunca bloquean', () => {
    assert.equal(estadoBloqueoBaja({ day: 'lunes', hour: 'abc' }, LUNES(17, 50)).bloqueado, false);
    assert.equal(estadoBloqueoBaja({ day: 'domingo', hour: '18' }, LUNES(17, 50)).bloqueado, false);
});

// ---------------------------------------------------------------------------
// ¿La clase de esta semana ya terminó? (no suma al contador de bajas)
// ---------------------------------------------------------------------------
test('claseYaTermino: el mismo día, recién cuando termina la clase', () => {
    const slot = { day: 'lunes', hour: '18' };
    assert.equal(claseYaTermino(slot, LUNES(16, 0)), false);
    assert.equal(claseYaTermino(slot, LUNES(18, 30)), false, 'en curso todavía no terminó');
    assert.equal(claseYaTermino(slot, LUNES(18, 59, 59)), false);
    assert.equal(claseYaTermino(slot, LUNES(19, 0, 0)), true);
});

test('claseYaTermino: días anteriores de la semana sí, posteriores no', () => {
    const miercoles = ar(2026, 10, 7, 10);
    assert.equal(claseYaTermino({ day: 'lunes', hour: '18' }, miercoles), true);
    assert.equal(claseYaTermino({ day: 'martes', hour: '8' }, miercoles), true);
    assert.equal(claseYaTermino({ day: 'miércoles', hour: '8' }, miercoles), true);
    assert.equal(claseYaTermino({ day: 'miércoles', hour: '18' }, miercoles), false);
    assert.equal(claseYaTermino({ day: 'jueves', hour: '8' }, miercoles), false);
    assert.equal(claseYaTermino({ day: 'sábado', hour: '9' }, miercoles), false);
});

test('claseYaTermino: el domingo y tras el reinicio del sábado todo es de la semana siguiente', () => {
    const domingo = ar(2026, 10, 11, 10);
    assert.equal(claseYaTermino({ day: 'lunes', hour: '7' }, domingo), false);
    assert.equal(claseYaTermino({ day: 'sábado', hour: '9' }, domingo), false);

    // Sábado antes de las 12: lo de lunes a viernes ya pasó; las clases del propio sábado, según su hora
    assert.equal(claseYaTermino({ day: 'viernes', hour: '19' }, SABADO(11, 0)), true);
    assert.equal(claseYaTermino({ day: 'sábado', hour: '10' }, SABADO(11, 0)), true);
    assert.equal(claseYaTermino({ day: 'sábado', hour: '12' }, SABADO(11, 30)), false, 'en curso');

    // Sábado desde las 12 (reinicio): todo vuelve a ser futuro
    assert.equal(claseYaTermino({ day: 'lunes', hour: '18' }, SABADO(12, 30)), false);
    assert.equal(claseYaTermino({ day: 'sábado', hour: '9' }, SABADO(12, 30)), false);
    assert.equal(claseYaTermino({ day: 'sábado', hour: '12' }, SABADO(12, 30)), false);
});

test('claseYaTermino: datos inválidos no cuentan como terminada', () => {
    assert.equal(claseYaTermino({ day: 'lunes', hour: 'abc' }, LUNES(19, 0)), false);
    assert.equal(claseYaTermino({ day: 'domingo2', hour: '18' }, LUNES(19, 0)), false);
});

// ---------------------------------------------------------------------------
// Niveles de aviso
// ---------------------------------------------------------------------------
test('nivelDeAviso: 1-7 sin cartel, 8 y 9 advertencia, 10 en adelante límite', () => {
    for (let n = 1; n <= 7; n++) assert.equal(nivelDeAviso(n), null, `baja ${n}`);
    assert.equal(nivelDeAviso(8), 'advertencia');
    assert.equal(nivelDeAviso(9), 'advertencia');
    assert.equal(nivelDeAviso(10), 'limite');
    assert.equal(nivelDeAviso(11), 'limite');
    assert.equal(nivelDeAviso(25), 'limite');
});

test('resumenDeBajas: cupos restantes nunca negativos', () => {
    assert.deepEqual(resumenDeBajas(8), { cantidad: 8, limite: 10, restantes: 2, aviso: 'advertencia' });
    assert.deepEqual(resumenDeBajas(9), { cantidad: 9, limite: 10, restantes: 1, aviso: 'advertencia' });
    assert.deepEqual(resumenDeBajas(10), { cantidad: 10, limite: 10, restantes: 0, aviso: 'limite' });
    assert.deepEqual(resumenDeBajas(12), { cantidad: 12, limite: 10, restantes: 0, aviso: 'limite' });
});

// ---------------------------------------------------------------------------
// Emulación en memoria de User.findOneAndUpdate (sólo lo que usa registrarBaja)
// ---------------------------------------------------------------------------
const emularUsuarios = (usuarios) => {
    const original = User.findOneAndUpdate;
    const llamadas = [];

    User.findOneAndUpdate = (filtro, update) => {
        llamadas.push({ filtro, update });
        const ejecutar = async () => {
            const doc = usuarios.get(String(filtro._id));
            if (!doc) return null;

            const periodoFiltro = filtro['bajasMensuales.periodo'];
            const periodoDoc = doc.bajasMensuales?.periodo;
            const coincide = periodoFiltro !== null && typeof periodoFiltro === 'object' && '$ne' in periodoFiltro
                ? periodoDoc !== periodoFiltro.$ne
                : periodoDoc === periodoFiltro;
            if (!coincide) return null;

            if (update.$inc) doc.bajasMensuales.cantidad += update.$inc['bajasMensuales.cantidad'];
            if (update.$set) doc.bajasMensuales = { ...update.$set.bajasMensuales };
            return { _id: doc._id, bajasMensuales: { ...doc.bajasMensuales } };
        };
        return { lean: ejecutar };
    };

    return { llamadas, restaurar: () => { User.findOneAndUpdate = original; } };
};

test('registrarBaja: cuenta mes a mes y se reinicia solo al cambiar el mes', async () => {
    const usuarios = new Map([['u1', { _id: 'u1' }]]);
    const emulador = emularUsuarios(usuarios);
    try {
        const octubre = ar(2026, 10, 12, 10);
        for (let n = 1; n <= 12; n++) {
            const r = await registrarBaja('u1', octubre);
            assert.equal(r.cantidad, n);
            assert.equal(r.aviso, n >= 10 ? 'limite' : n >= 8 ? 'advertencia' : null);
        }

        // Primer segundo de noviembre (hora argentina): vuelve a empezar
        const noviembre = await registrarBaja('u1', ar(2026, 11, 1, 0, 0, 0));
        assert.equal(noviembre.cantidad, 1);
        assert.equal(noviembre.aviso, null);
        assert.equal(usuarios.get('u1').bajasMensuales.periodo, '2026-11');

        // Y octubre no puede "revivir" en el contador de noviembre
        const seguidas = await registrarBaja('u1', ar(2026, 11, 20, 9));
        assert.equal(seguidas.cantidad, 2);
    } finally {
        emulador.restaurar();
    }
});

test('registrarBaja: bajas simultáneas no se pisan', async () => {
    const usuarios = new Map([['u1', { _id: 'u1' }]]);
    const emulador = emularUsuarios(usuarios);
    try {
        const momento = ar(2026, 10, 12, 10);
        const resultados = await Promise.all(Array.from({ length: 6 }, () => registrarBaja('u1', momento)));
        const cantidades = resultados.map((r) => r.cantidad).sort((a, b) => a - b);
        assert.deepEqual(cantidades, [1, 2, 3, 4, 5, 6]);
    } finally {
        emulador.restaurar();
    }
});

test('registrarBaja: ante un error devuelve null y no lanza', async () => {
    const original = User.findOneAndUpdate;
    const errorOriginal = console.error;
    console.error = () => {};
    User.findOneAndUpdate = () => { throw new Error('Mongo caído'); };
    try {
        assert.equal(await registrarBaja('u1'), null);
    } finally {
        User.findOneAndUpdate = original;
        console.error = errorOriginal;
    }
});

test('registrarBaja: usuario inexistente devuelve null', async () => {
    const emulador = emularUsuarios(new Map());
    try {
        assert.equal(await registrarBaja('nadie'), null);
    } finally {
        emulador.restaurar();
    }
});

// ---------------------------------------------------------------------------
// quitarDelHorario completo (calendario en memoria)
// ---------------------------------------------------------------------------
const armarEscenario = ({ horario = ['juan perez', 'ana gomez', null, null] } = {}) => {
    const calendario = { _id: 'cal1', lunes: { tarde: { 18: [...horario] } } };
    const usuarios = new Map([
        ['u1', { _id: 'u1' }],
        ['admin', { _id: 'admin' }],
    ]);

    const originales = {
        findOne: Calendar.collection.findOne,
        updateOne: Calendar.collection.updateOne,
        findOneAndDelete: Reserva.findOneAndDelete,
    };

    Calendar.collection.findOne = async () => ({ _id: calendario._id, lunes: { tarde: { 18: [...calendario.lunes.tarde[18]] } } });
    Calendar.collection.updateOne = async (filtro, update) => {
        const esperado = JSON.stringify(filtro['lunes.tarde.18']);
        if (JSON.stringify(calendario.lunes.tarde[18]) !== esperado) return { matchedCount: 0 };
        calendario.lunes.tarde[18] = [...update.$set['lunes.tarde.18']];
        return { matchedCount: 1 };
    };
    // Sin lista de reserva
    Reserva.findOneAndDelete = () => ({ lean: async () => null });

    const emuladorUsuarios = emularUsuarios(usuarios);

    return {
        calendario,
        usuarios,
        restaurar: () => {
            Calendar.collection.findOne = originales.findOne;
            Calendar.collection.updateOne = originales.updateOne;
            Reserva.findOneAndDelete = originales.findOneAndDelete;
            emuladorUsuarios.restaurar();
        },
    };
};

const juan = { _id: 'u1', username: 'Juan', userlastname: 'Perez', role: 'user' };
const admin = { _id: 'admin', username: 'Ana', userlastname: 'Admin', role: 'admin' };
const pedido = { day: 'lunes', shift: 'tarde', hour: '18', index: 0 };

const conReloj = async (ms, fn) => {
    mock.timers.enable({ apis: ['Date'], now: ms });
    try {
        return await fn();
    } finally {
        mock.timers.reset();
    }
};

test('quitarDelHorario: con tiempo de sobra se borra y suma al contador', async () => {
    const esc = armarEscenario();
    try {
        const r = await conReloj(LUNES(16, 0), () => quitarDelHorario({ solicitante: juan, ...pedido }));
        assert.equal(r.removido, 'juan perez');
        assert.equal(esc.calendario.lunes.tarde[18][0], null);
        assert.equal(r.bajas.cantidad, 1);
        assert.equal(r.bajas.aviso, null);
    } finally {
        esc.restaurar();
    }
});

test('quitarDelHorario: a 15 minutos de la clase se rechaza y no se modifica nada', async () => {
    const esc = armarEscenario();
    try {
        await assert.rejects(
            conReloj(LUNES(17, 45), () => quitarDelHorario({ solicitante: juan, ...pedido })),
            (error) => {
                assert.ok(error instanceof CalendarError);
                assert.equal(error.status, 403);
                assert.equal(error.code, 'BAJA_BLOQUEADA');
                assert.equal(error.extra.enCurso, false);
                assert.equal(error.extra.minutosParaInicio, 15);
                assert.deepEqual(error.slot, { day: 'lunes', shift: 'tarde', hour: '18' });
                return true;
            }
        );
        assert.equal(esc.calendario.lunes.tarde[18][0], 'juan perez', 'sigue anotado');
        assert.equal(esc.usuarios.get('u1').bajasMensuales, undefined, 'no suma al contador');
    } finally {
        esc.restaurar();
    }
});

test('quitarDelHorario: con la clase en curso también se rechaza', async () => {
    const esc = armarEscenario();
    try {
        await assert.rejects(
            conReloj(LUNES(18, 20), () => quitarDelHorario({ solicitante: juan, ...pedido })),
            (error) => error.code === 'BAJA_BLOQUEADA' && error.extra.enCurso === true
        );
        assert.equal(esc.calendario.lunes.tarde[18][0], 'juan perez');
    } finally {
        esc.restaurar();
    }
});

test('quitarDelHorario: el admin puede quitar a cualquiera en cualquier momento y no suma bajas', async () => {
    const esc = armarEscenario();
    try {
        const r = await conReloj(LUNES(17, 50), () => quitarDelHorario({
            solicitante: admin, day: 'lunes', shift: 'tarde', hour: '18', index: 1, nombre: 'ana gomez',
        }));
        assert.equal(r.removido, 'ana gomez');
        assert.equal(r.bajas, undefined);
        assert.equal(esc.calendario.lunes.tarde[18][1], null);
    } finally {
        esc.restaurar();
    }
});

test('quitarDelHorario: mover turno no suma al contador pero respeta el bloqueo', async () => {
    const esc = armarEscenario();
    try {
        const r = await conReloj(LUNES(16, 0), () => quitarDelHorario({ solicitante: juan, ...pedido, esMovimiento: true }));
        assert.equal(r.removido, 'juan perez');
        assert.equal(r.bajas, undefined);
        assert.equal(esc.usuarios.get('u1').bajasMensuales, undefined);
    } finally {
        esc.restaurar();
    }

    const esc2 = armarEscenario();
    try {
        await assert.rejects(
            conReloj(LUNES(17, 50), () => quitarDelHorario({ solicitante: juan, ...pedido, esMovimiento: true })),
            (error) => error.code === 'BAJA_BLOQUEADA' && /mover/.test(error.message)
        );
        assert.equal(esc2.calendario.lunes.tarde[18][0], 'juan perez');
    } finally {
        esc2.restaurar();
    }
});

test('quitarDelHorario: quien no está anotado recibe NO_INSCRIPTO, no el bloqueo', async () => {
    const esc = armarEscenario({ horario: ['ana gomez', null, null, null] });
    try {
        await assert.rejects(
            conReloj(LUNES(17, 50), () => quitarDelHorario({ solicitante: juan, ...pedido })),
            (error) => error.code === 'NO_INSCRIPTO' && error.status === 404
        );
    } finally {
        esc.restaurar();
    }
});

test('quitarDelHorario: si el contador falla, la baja igual se concreta', async () => {
    const esc = armarEscenario();
    const errorOriginal = console.error;
    console.error = () => {};
    User.findOneAndUpdate = () => { throw new Error('Mongo caído'); };
    try {
        const r = await conReloj(LUNES(16, 0), () => quitarDelHorario({ solicitante: juan, ...pedido }));
        assert.equal(r.removido, 'juan perez');
        assert.equal(r.bajas, null);
        assert.equal(esc.calendario.lunes.tarde[18][0], null);
    } finally {
        console.error = errorOriginal;
        esc.restaurar();
    }
});

test('quitarDelHorario: borrarse de una clase que ya terminó se concreta pero no suma al contador', async () => {
    for (const ahora of [LUNES(19, 5), ar(2026, 10, 7, 10)]) {
        const esc = armarEscenario();
        try {
            const r = await conReloj(ahora, () => quitarDelHorario({ solicitante: juan, ...pedido }));
            assert.equal(r.removido, 'juan perez');
            assert.equal(r.bajas, undefined);
            assert.equal(esc.usuarios.get('u1').bajasMensuales, undefined);
            assert.equal(esc.calendario.lunes.tarde[18][0], null);
        } finally {
            esc.restaurar();
        }
    }
});

test('quitarDelHorario: el mensaje del bloqueo distingue "por empezar" de "en curso"', async () => {
    const esc = armarEscenario();
    try {
        await assert.rejects(
            conReloj(LUNES(17, 50), () => quitarDelHorario({ solicitante: juan, ...pedido })),
            (error) => /falta muy poco para que empiece/.test(error.message)
        );
        await assert.rejects(
            conReloj(LUNES(18, 10), () => quitarDelHorario({ solicitante: juan, ...pedido })),
            (error) => /ya está en curso/.test(error.message)
        );
    } finally {
        esc.restaurar();
    }
});

test('quitarDelHorario: las bajas 8, 9 y 10 devuelven el aviso correspondiente', async () => {
    const esc = armarEscenario();
    try {
        esc.usuarios.get('u1').bajasMensuales = { periodo: '2026-10', cantidad: 7 };
        const avisos = [];
        for (let i = 0; i < 4; i++) {
            esc.calendario.lunes.tarde[18][0] = 'juan perez';
            const r = await conReloj(LUNES(16, 0), () => quitarDelHorario({ solicitante: juan, ...pedido }));
            avisos.push([r.bajas.cantidad, r.bajas.aviso]);
        }
        assert.deepEqual(avisos, [[8, 'advertencia'], [9, 'advertencia'], [10, 'limite'], [11, 'limite']]);
    } finally {
        esc.restaurar();
    }
});
