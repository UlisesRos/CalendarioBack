// Tests de la regla "un solo horario por día".
// No usan base de datos: se reemplazan las llamadas a Mongo por versiones en memoria.
// Ejecutar con:  node --test tests/unHorarioPorDia.test.js

const test = require('node:test');
const { mock } = require('node:test');
const assert = require('node:assert/strict');

// Igual que en bajas.test.js: el MONGO_URI real nunca llega a este proceso
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/tests-sin-conexion';

const Calendar = require('../models/Calendar');
const Reserva = require('../models/Reserva');
const User = require('../models/User');
const ScheduleRestriction = require('../models/ScheduleRestriction');
const { inscribirUsuario, quitarDelHorario } = require('../utils/reservas');

// Lunes 5/10/2026 en hora argentina (UTC-3)
const LUNES = (hora, minuto = 0) => Date.UTC(2026, 9, 5, hora + 3, minuto);

const conReloj = async (ms, fn) => {
    mock.timers.enable({ apis: ['Date'], now: ms });
    try {
        return await fn();
    } finally {
        mock.timers.reset();
    }
};

const leerRuta = (obj, ruta) => ruta.split('.').reduce((acc, k) => acc?.[k], obj);
const copiar = (v) => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------------------
// Calendario, reservas y usuarios en memoria (sólo lo que usa utils/reservas.js)
// ---------------------------------------------------------------------------
const armarEscenario = ({ calendario, reservas = [], usuarios = [] }) => {
    const cal = { _id: 'cal1', ...copiar(calendario) };
    let lista = reservas.map((r, i) => ({ _id: `r${i + 1}`, createdAt: new Date(1000 + i), ...r }));
    let siguienteId = lista.length + 1;
    const porId = new Map(usuarios.map((u) => [String(u._id), u]));

    const coincide = (r, filtro) => Object.entries(filtro).every(([k, v]) => {
        if (k === '$nor') return !v.some((sub) => coincide(r, sub));
        if (k === '_id' && v && typeof v === 'object' && '$ne' in v) return String(r._id) !== String(v.$ne);
        return String(r[k]) === String(v);
    });
    const ordenadas = () => [...lista].sort((a, b) => a.createdAt - b.createdAt);

    const originales = {
        findOne: Calendar.collection.findOne,
        updateOne: Calendar.collection.updateOne,
        calFindOne: Calendar.findOne,
        rFind: Reserva.find,
        rFindOne: Reserva.findOne,
        rFindOneAndDelete: Reserva.findOneAndDelete,
        rDeleteOne: Reserva.deleteOne,
        rDeleteMany: Reserva.deleteMany,
        rCount: Reserva.countDocuments,
        rCreate: Reserva.create,
        uFindById: User.findById,
        srFindOne: ScheduleRestriction.findOne,
    };

    Calendar.collection.findOne = async () => copiar(cal);
    Calendar.collection.updateOne = async (filtro, update) => {
        const [ruta, nuevo] = Object.entries(update.$set)[0];
        if (JSON.stringify(leerRuta(cal, ruta)) !== JSON.stringify(filtro[ruta])) return { matchedCount: 0 };
        const [d, s, h] = ruta.split('.');
        cal[d][s][h] = copiar(nuevo);
        return { matchedCount: 1 };
    };
    Calendar.findOne = () => Promise.resolve(copiar(cal));

    Reserva.find = (filtro) => ({ sort: () => ({ lean: async () => ordenadas().filter((r) => coincide(r, filtro)) }) });
    Reserva.findOne = (filtro) => ({ lean: async () => ordenadas().find((r) => coincide(r, filtro)) || null });
    Reserva.findOneAndDelete = (filtro) => ({
        lean: async () => {
            const r = ordenadas().find((x) => coincide(x, filtro));
            if (r) lista = lista.filter((x) => x !== r);
            return r || null;
        },
    });
    Reserva.deleteOne = async (filtro) => {
        const r = lista.find((x) => coincide(x, filtro));
        if (r) lista = lista.filter((x) => x !== r);
        return { deletedCount: r ? 1 : 0 };
    };
    Reserva.deleteMany = async (filtro) => {
        const antes = lista.length;
        lista = lista.filter((x) => !coincide(x, filtro));
        return { deletedCount: antes - lista.length };
    };
    Reserva.countDocuments = async (filtro) => {
        const { $or, ...resto } = filtro;
        return lista.filter((r) => coincide(r, resto) && (!$or || $or.some((c) =>
            (c.createdAt?.$lt && r.createdAt < c.createdAt.$lt) ||
            (c._id?.$lt && +r.createdAt === +c.createdAt && String(r._id) < String(c._id.$lt))
        ))).length;
    };
    Reserva.create = async (datos) => {
        const r = { _id: `r${siguienteId++}`, createdAt: new Date(5000 + siguienteId), ...datos };
        lista.push(r);
        return r;
    };

    User.findById = (id) => ({ select: () => ({ lean: async () => porId.get(String(id)) || null }) });
    ScheduleRestriction.findOne = () => ({ lean: async () => null });

    return {
        cal,
        reservas: () => lista,
        restaurar: () => {
            Calendar.collection.findOne = originales.findOne;
            Calendar.collection.updateOne = originales.updateOne;
            Calendar.findOne = originales.calFindOne;
            Reserva.find = originales.rFind;
            Reserva.findOne = originales.rFindOne;
            Reserva.findOneAndDelete = originales.rFindOneAndDelete;
            Reserva.deleteOne = originales.rDeleteOne;
            Reserva.deleteMany = originales.rDeleteMany;
            Reserva.countDocuments = originales.rCount;
            Reserva.create = originales.rCreate;
            User.findById = originales.uFindById;
            ScheduleRestriction.findOne = originales.srFindOne;
        },
    };
};

const juan = { _id: 'u1', username: 'Juan', userlastname: 'Perez', role: 'user', pago: true };
const pepa = { _id: 'u2', username: 'Pepa', userlastname: 'Lopez', role: 'user', pago: true };
const admin = { _id: 'adm', username: 'Uli', userlastname: 'Admin', role: 'admin', pago: true };

const calendarioBase = () => ({
    lunes: {
        mañana: { 9: [null, null], 10: [null, null] },
        tarde: { 18: [null, null], 19: [null, null] },
    },
    martes: {
        mañana: { 9: [null, null] },
        tarde: { 18: [null, null] },
    },
});

const esUnHorarioPorDia = (hora) => (error) => {
    assert.equal(error.code, 'UN_HORARIO_POR_DIA');
    assert.equal(error.status, 409, 'nunca 401: el front desloguea ante un 401');
    assert.equal(error.extra.horarioExistente.hour, hora);
    assert.match(error.message, /más de un horario en el mismo día/);
    return true;
};

// ---------------------------------------------------------------------------
test('primer horario del día: se inscribe normalmente', async () => {
    const esc = armarEscenario({ calendario: calendarioBase(), usuarios: [juan] });
    try {
        const r = await conReloj(LUNES(8), () => inscribirUsuario({ usuario: juan, day: 'lunes', shift: 'tarde', hour: '18' }));
        assert.equal(r.estado, 'confirmado');
        assert.deepEqual(esc.cal.lunes.tarde[18], ['juan perez', null]);
    } finally {
        esc.restaurar();
    }
});

test('segundo horario el mismo día (otro turno o misma franja): se rechaza sin modificar nada', async () => {
    const cal = calendarioBase();
    cal.lunes.mañana[9] = ['juan perez', null];
    const esc = armarEscenario({ calendario: cal, usuarios: [juan] });
    try {
        await assert.rejects(
            () => conReloj(LUNES(8), () => inscribirUsuario({ usuario: juan, day: 'lunes', shift: 'tarde', hour: '18' })),
            esUnHorarioPorDia('9')
        );
        await assert.rejects(
            () => conReloj(LUNES(8), () => inscribirUsuario({ usuario: juan, day: 'lunes', shift: 'mañana', hour: 10 })),
            esUnHorarioPorDia('9')
        );
        assert.deepEqual(esc.cal.lunes.tarde[18], [null, null]);
        assert.deepEqual(esc.cal.lunes.mañana[10], [null, null]);
    } finally {
        esc.restaurar();
    }
});

test('otro día de la semana sí se puede', async () => {
    const cal = calendarioBase();
    cal.lunes.mañana[9] = ['juan perez', null];
    const esc = armarEscenario({ calendario: cal, usuarios: [juan] });
    try {
        const r = await conReloj(LUNES(8), () => inscribirUsuario({ usuario: juan, day: 'martes', shift: 'tarde', hour: '18' }));
        assert.equal(r.estado, 'confirmado');
    } finally {
        esc.restaurar();
    }
});

test('el mismo horario sigue respondiendo YA_INSCRIPTO (no el cartel nuevo)', async () => {
    const cal = calendarioBase();
    cal.lunes.tarde[18] = ['juan perez', null];
    const esc = armarEscenario({ calendario: cal, usuarios: [juan] });
    try {
        await assert.rejects(
            () => conReloj(LUNES(8), () => inscribirUsuario({ usuario: juan, day: 'lunes', shift: 'tarde', hour: '18' })),
            (error) => error.code === 'YA_INSCRIPTO'
        );
    } finally {
        esc.restaurar();
    }
});

test('tampoco puede anotarse en la reserva de otro horario del mismo día', async () => {
    const cal = calendarioBase();
    cal.lunes.mañana[9] = ['juan perez', null];
    cal.lunes.tarde[18] = ['a', 'b'];
    const esc = armarEscenario({ calendario: cal, usuarios: [juan] });
    try {
        await assert.rejects(
            () => conReloj(LUNES(8), () => inscribirUsuario({ usuario: juan, day: 'lunes', shift: 'tarde', hour: '18', aceptaReserva: true })),
            esUnHorarioPorDia('9')
        );
        assert.equal(esc.reservas().length, 0);
    } finally {
        esc.restaurar();
    }
});

test('estar en reserva no cuenta: puede confirmarse en otro horario y esa reserva se descarta', async () => {
    const cal = calendarioBase();
    cal.lunes.tarde[18] = ['a', 'b'];
    const esc = armarEscenario({
        calendario: cal,
        usuarios: [juan],
        reservas: [
            { day: 'lunes', shift: 'tarde', hour: '18', user: 'u1', nombre: 'juan perez' },
            { day: 'martes', shift: 'tarde', hour: '18', user: 'u1', nombre: 'juan perez' },
        ],
    });
    try {
        const r = await conReloj(LUNES(8), () => inscribirUsuario({ usuario: juan, day: 'lunes', shift: 'tarde', hour: '19' }));
        assert.equal(r.estado, 'confirmado');
        assert.equal(r.reservasDescartadas, 1);
        // La del martes no se toca
        assert.deepEqual(esc.reservas().map((x) => x.day), ['martes']);
    } finally {
        esc.restaurar();
    }
});

test('al liberarse un lugar, la reserva de alguien ya anotado ese día se saltea y entra el siguiente', async () => {
    const cal = calendarioBase();
    cal.lunes.mañana[9] = ['juan perez', null];
    cal.lunes.tarde[18] = ['pepa lopez', 'otro'];
    const esc = armarEscenario({
        calendario: cal,
        usuarios: [juan, pepa, { _id: 'u3', username: 'Caro', userlastname: 'Diaz', role: 'user', pago: true }],
        reservas: [
            // Juan quedó en reserva antes de que existiera la regla (dato viejo)
            { day: 'lunes', shift: 'tarde', hour: '18', user: 'u1', nombre: 'juan perez' },
            { day: 'lunes', shift: 'tarde', hour: '18', user: 'u3', nombre: 'caro diaz' },
        ],
    });
    const log = console.log;
    console.log = () => {};
    try {
        const r = await conReloj(LUNES(8), () => quitarDelHorario({
            solicitante: admin, day: 'lunes', shift: 'tarde', hour: '18', index: 0, nombre: 'pepa lopez',
        }));
        assert.deepEqual(r.promovidos, ['caro diaz']);
        assert.deepEqual(esc.cal.lunes.tarde[18], ['caro diaz', 'otro']);
        assert.equal(esc.reservas().length, 0);
    } finally {
        console.log = log;
        esc.restaurar();
    }
});

test('el admin está exento de la regla', async () => {
    const cal = calendarioBase();
    cal.lunes.mañana[9] = ['uli admin', null];
    const esc = armarEscenario({ calendario: cal, usuarios: [admin] });
    try {
        const r = await conReloj(LUNES(8), () => inscribirUsuario({ usuario: admin, day: 'lunes', shift: 'tarde', hour: '18' }));
        assert.equal(r.estado, 'confirmado');
    } finally {
        esc.restaurar();
    }
});

test('dos pedidos simultáneos a horarios distintos del mismo día: sólo entra uno', async () => {
    const esc = armarEscenario({ calendario: calendarioBase(), usuarios: [juan] });
    try {
        const resultados = await conReloj(LUNES(8), () => Promise.allSettled([
            inscribirUsuario({ usuario: juan, day: 'lunes', shift: 'mañana', hour: '9' }),
            inscribirUsuario({ usuario: juan, day: 'lunes', shift: 'tarde', hour: '18' }),
        ]));
        assert.equal(resultados.filter((r) => r.status === 'fulfilled').length, 1);
        assert.equal(resultados.find((r) => r.status === 'rejected').reason.code, 'UN_HORARIO_POR_DIA');
    } finally {
        esc.restaurar();
    }
});

// ---------------------------------------------------------------------------
// Mover el turno dentro del mismo día
// ---------------------------------------------------------------------------
test('mover turno: el origen no cuenta y el servidor lo libera (sin sumar baja)', async () => {
    const cal = calendarioBase();
    cal.lunes.tarde[18] = ['juan perez', null];
    const esc = armarEscenario({ calendario: cal, usuarios: [juan] });
    const originalBaja = User.findOneAndUpdate;
    let bajasRegistradas = 0;
    User.findOneAndUpdate = () => { bajasRegistradas++; return { lean: async () => null }; };
    try {
        const r = await conReloj(LUNES(8), () => inscribirUsuario({
            usuario: juan, day: 'lunes', shift: 'tarde', hour: '19', moviendoDesde: { shift: 'tarde', hour: 18 },
        }));
        assert.equal(r.estado, 'confirmado');
        assert.equal(r.movimiento.liberado, true);
        assert.deepEqual(esc.cal.lunes.tarde[18], [null, null]);
        assert.deepEqual(esc.cal.lunes.tarde[19], ['juan perez', null]);
        assert.equal(bajasRegistradas, 0);
    } finally {
        User.findOneAndUpdate = originalBaja;
        esc.restaurar();
    }
});

test('mover turno: si además tiene un tercer horario ese día, se rechaza igual', async () => {
    const cal = calendarioBase();
    cal.lunes.tarde[18] = ['juan perez', null];
    cal.lunes.mañana[9] = ['juan perez', null]; // dato viejo: dos horarios el mismo día
    const esc = armarEscenario({ calendario: cal, usuarios: [juan] });
    try {
        await assert.rejects(
            () => conReloj(LUNES(8), () => inscribirUsuario({
                usuario: juan, day: 'lunes', shift: 'tarde', hour: '19', moviendoDesde: { shift: 'tarde', hour: '18' },
            })),
            esUnHorarioPorDia('9')
        );
        assert.deepEqual(esc.cal.lunes.tarde[18], ['juan perez', null]);
    } finally {
        esc.restaurar();
    }
});

test('mover turno a 15 minutos de la clase de origen: se rechaza antes de anotarlo en el destino', async () => {
    const cal = calendarioBase();
    cal.lunes.tarde[18] = ['juan perez', null];
    const esc = armarEscenario({ calendario: cal, usuarios: [juan] });
    try {
        await assert.rejects(
            () => conReloj(LUNES(17, 50), () => inscribirUsuario({
                usuario: juan, day: 'lunes', shift: 'tarde', hour: '19', moviendoDesde: { shift: 'tarde', hour: '18' },
            })),
            (error) => error.code === 'BAJA_BLOQUEADA' && error.status === 403
        );
        assert.deepEqual(esc.cal.lunes.tarde[18], ['juan perez', null]);
        assert.deepEqual(esc.cal.lunes.tarde[19], [null, null]);
    } finally {
        esc.restaurar();
    }
});

test('moviendoDesde con datos inválidos responde HORARIO_INVALIDO', async () => {
    const esc = armarEscenario({ calendario: calendarioBase(), usuarios: [juan] });
    try {
        await assert.rejects(
            () => inscribirUsuario({ usuario: juan, day: 'lunes', shift: 'tarde', hour: '19', moviendoDesde: { shift: 'noche', hour: 'x' } }),
            (error) => error.code === 'HORARIO_INVALIDO'
        );
    } finally {
        esc.restaurar();
    }
});
