// Tests de los permisos de /api/auth: listar, editar y borrar usuarios es sólo para admin,
// y el listado nunca devuelve los hashes de contraseña.
// No usan base de datos: se reemplaza la ejecución de las consultas de Mongoose por una
// versión en memoria (las consultas sí se arman con Mongoose real, así que la proyección
// .select(...) que se verifica es la que de verdad viajaría a Mongo).
// Ejecutar con:  node --test tests/authAdmin.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

// Valores de prueba: este test no lee el .env ni se conecta a ninguna base
process.env.JWT_SECRET = 'secreto-solo-para-tests';
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/tests-sin-conexion';

// authController importa utils/mailer, que hace require('dotenv').config() y leería el .env real
// (con la base de producción). Se lo reemplaza en la caché de módulos antes de cargar las rutas.
const mailerPath = require.resolve('../utils/mailer');
const mailerFalso = new Module(mailerPath);
mailerFalso.filename = mailerPath;
mailerFalso.loaded = true;
mailerFalso.exports = { sendEmail: async () => {} };
require.cache[mailerPath] = mailerFalso;

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const authRoutes = require('../routes/authRoutes');
const authenticate = require('../middleware/authenticate');
const isAdmin = require('../middleware/isAdmin');

// ---------------------------------------------------------------------------
// Datos de prueba
// ---------------------------------------------------------------------------
const CLAVE = 'Clave1234';
const hashDeClave = bcrypt.hashSync(CLAVE, 4);

const armarBD = () => new Map([
    ['a1', { _id: 'a1', username: 'ana', userlastname: 'admin', useremail: 'ana@test.com', userpassword: hashDeClave, userpaswordc: 'hash-c-ana', role: 'admin', pago: true, diasentrenamiento: 3, usertelefono: 1111 }],
    ['u1', { _id: 'u1', username: 'juan', userlastname: 'perez', useremail: 'juan@test.com', userpassword: hashDeClave, userpaswordc: 'hash-c-juan', role: 'user', pago: false, diasentrenamiento: 2, usertelefono: 2222 }],
    ['u2', { _id: 'u2', username: 'maria', userlastname: 'gomez', useremail: 'maria@test.com', userpassword: 'hash-maria', userpaswordc: 'hash-c-maria', role: 'user', pago: true, diasentrenamiento: 5, usertelefono: 3333 }],
]);

const sinHashes = (doc) => {
    const { userpassword, userpaswordc, ...resto } = doc;
    return resto;
};

const tokenDe = (usuario, secreto = process.env.JWT_SECRET) =>
    jwt.sign({ userId: usuario._id, role: usuario.role }, secreto, { expiresIn: '1h' });

// ---------------------------------------------------------------------------
// Emulación en memoria de la ejecución de consultas (find / findOne / findOneAndDelete)
// ---------------------------------------------------------------------------
const emularMongo = (bd) => {
    const original = mongoose.Query.prototype.exec;
    const operaciones = [];
    const guardados = [];

    const aplicarProyeccion = (doc, proyeccion) => {
        const valores = Object.values(proyeccion);
        if (valores.some((v) => v === 1)) {
            const incluidos = Object.keys(proyeccion).filter((k) => proyeccion[k] === 1);
            return Object.fromEntries(Object.entries(doc).filter(([k]) => k === '_id' || incluidos.includes(k)));
        }
        return Object.fromEntries(Object.entries(doc).filter(([k]) => proyeccion[k] !== 0));
    };

    mongoose.Query.prototype.exec = async function () {
        const filtro = this.getFilter();
        // Proyección final que Mongoose le mandaría al driver (resuelve los prefijos "-" de select).
        // _optionsForExec es interna de Mongoose 8.x: es lo mismo que usa _find antes de consultar.
        const proyeccion = { ...(this._optionsForExec().projection || {}) };
        operaciones.push({ op: this.op, filtro, proyeccion });

        switch (this.op) {
            case 'find':
                return [...bd.values()].map((doc) => aplicarProyeccion(doc, proyeccion));

            case 'findOne': {
                const doc = filtro.useremail
                    ? [...bd.values()].find((u) => u.useremail === filtro.useremail)
                    : bd.get(String(filtro._id));
                if (!doc) return null;
                if (Object.keys(proyeccion).length > 0) return aplicarProyeccion(doc, proyeccion);
                // Sin proyección: documento "editable" para updateUser
                return {
                    ...doc,
                    historialPagos: [],
                    save: async function () { guardados.push({ ...this }); },
                };
            }

            case 'findOneAndDelete': {
                const doc = bd.get(String(filtro._id));
                if (!doc) return null;
                bd.delete(String(filtro._id));
                return doc;
            }

            default:
                throw new Error(`Operación no emulada: ${this.op}`);
        }
    };

    return { operaciones, guardados, restaurar: () => { mongoose.Query.prototype.exec = original; } };
};

// ---------------------------------------------------------------------------
// Servidor express con el router real, escuchando en un puerto local efímero
// ---------------------------------------------------------------------------
const conEscenario = async (fn) => {
    const bd = armarBD();
    const mongo = emularMongo(bd);

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    const server = await new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const base = `http://127.0.0.1:${server.address().port}/api/auth`;

    const pedir = async (metodo, ruta, { token, body } = {}) => {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        if (body) headers['Content-Type'] = 'application/json';
        const res = await fetch(base + ruta, { method: metodo, headers, body: body ? JSON.stringify(body) : undefined });
        const texto = await res.text();
        let json = null;
        try { json = JSON.parse(texto); } catch { /* respuesta sin JSON */ }
        return { status: res.status, body: json };
    };

    try {
        return await fn({ bd, mongo, pedir });
    } finally {
        mongo.restaurar();
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    }
};

const RUTAS_ADMIN = [
    ['GET', '/users'],
    ['PUT', '/userupdate/u2'],
    ['DELETE', '/userdelete/u2'],
];
const cuerpoPara = (metodo) => (metodo === 'PUT' ? { body: { username: 'hackeado' } } : {});

// ---------------------------------------------------------------------------
// Forma del router (que nadie saque un middleware sin que un test se entere)
// ---------------------------------------------------------------------------
test('router: users, userupdate y userdelete pasan por authenticate y luego isAdmin', () => {
    const handlersDe = (ruta, metodo) => authRoutes.stack
        .filter((l) => l.route && l.route.path === ruta && l.route.methods[metodo])
        .map((l) => l.route.stack.map((s) => s.handle));

    for (const [ruta, metodo] of [['/users', 'get'], ['/userupdate/:id', 'put'], ['/userdelete/:id', 'delete']]) {
        const rutas = handlersDe(ruta, metodo);
        assert.equal(rutas.length, 1, `${metodo} ${ruta} existe una sola vez`);
        const [primero, segundo, controlador] = rutas[0];
        assert.equal(rutas[0].length, 3, `${metodo} ${ruta} tiene authenticate, isAdmin y el controlador`);
        assert.equal(primero, authenticate, `${metodo} ${ruta}: primero authenticate`);
        assert.equal(segundo, isAdmin, `${metodo} ${ruta}: después isAdmin`);
        assert.equal(typeof controlador, 'function');
    }
});

test('router: registro, login y recuperación de contraseña siguen siendo públicos', () => {
    for (const [ruta, metodo] of [['/register', 'post'], ['/login', 'post'], ['/forgot-password', 'post'], ['/reset-password/:token', 'post']]) {
        const capas = authRoutes.stack.filter((l) => l.route && l.route.path === ruta && l.route.methods[metodo]);
        assert.equal(capas.length, 1, `${metodo} ${ruta} existe`);
        assert.equal(capas[0].route.stack.length, 1, `${metodo} ${ruta} no tiene middlewares de autenticación`);
    }
});

// ---------------------------------------------------------------------------
// Sin sesión: antes se podía borrar/editar sin token
// ---------------------------------------------------------------------------
test('sin token: las tres rutas responden 401 y no tocan ningún dato', async () => {
    await conEscenario(async ({ bd, mongo, pedir }) => {
        for (const [metodo, ruta] of RUTAS_ADMIN) {
            const r = await pedir(metodo, ruta, cuerpoPara(metodo));
            assert.equal(r.status, 401, `${metodo} ${ruta}`);
        }
        assert.equal(mongo.operaciones.length, 0, 'ni siquiera se consultó la base');
        assert.equal(mongo.guardados.length, 0);
        assert.ok(bd.has('u2'), 'el usuario sigue existiendo');
    });
});

test('token inválido (firmado con otro secreto): 401 y no se toca ningún dato', async () => {
    await conEscenario(async ({ bd, mongo, pedir }) => {
        const falso = tokenDe({ _id: 'a1', role: 'admin' }, 'otro-secreto');
        for (const [metodo, ruta] of RUTAS_ADMIN) {
            const r = await pedir(metodo, ruta, { token: falso, ...cuerpoPara(metodo) });
            assert.equal(r.status, 401, `${metodo} ${ruta}`);
        }
        assert.equal(mongo.operaciones.length, 0);
        assert.ok(bd.has('u2'));
    });
});

// ---------------------------------------------------------------------------
// Usuario común logueado: 403 (no 401, para que el front no lo desloguee)
// ---------------------------------------------------------------------------
test('usuario común: las tres rutas responden 403 y no se lista, edita ni borra nada', async () => {
    await conEscenario(async ({ bd, mongo, pedir }) => {
        const token = tokenDe(bd.get('u1'));
        for (const [metodo, ruta] of RUTAS_ADMIN) {
            const r = await pedir(metodo, ruta, { token, ...cuerpoPara(metodo) });
            assert.equal(r.status, 403, `${metodo} ${ruta} debe ser 403 y no 401`);
            assert.match(r.body.msg, /No eres admin/);
        }
        // Lo único que se consultó es el usuario del propio token (authenticate)
        assert.ok(mongo.operaciones.every((o) => o.op === 'findOne' && o.filtro._id === 'u1'));
        assert.equal(mongo.guardados.length, 0, 'nadie fue editado');
        assert.ok(bd.has('u2'), 'nadie fue borrado');
    });
});

// ---------------------------------------------------------------------------
// Admin: sigue funcionando todo
// ---------------------------------------------------------------------------
test('admin: GET /users devuelve todos los usuarios sin hashes y con el resto de los campos intactos', async () => {
    await conEscenario(async ({ bd, mongo, pedir }) => {
        const esperado = [...bd.values()].map(sinHashes);
        const r = await pedir('GET', '/users', { token: tokenDe(bd.get('a1')) });

        assert.equal(r.status, 200);
        assert.deepEqual(r.body, esperado);
        for (const u of r.body) {
            assert.equal('userpassword' in u, false);
            assert.equal('userpaswordc' in u, false);
        }

        const consulta = mongo.operaciones.find((o) => o.op === 'find');
        assert.deepEqual(consulta.proyeccion, { userpassword: 0, userpaswordc: 0 }, 'sólo se excluyen los hashes');
    });
});

test('admin: PUT /userupdate/:id edita al usuario', async () => {
    await conEscenario(async ({ bd, mongo, pedir }) => {
        const r = await pedir('PUT', '/userupdate/u1', {
            token: tokenDe(bd.get('a1')),
            body: { username: 'juan carlos', usertelefono: 4444, pago: false },
        });

        assert.equal(r.status, 200);
        assert.equal(r.body.username, 'juan carlos');
        assert.equal(r.body.usertelefono, 4444);
        assert.equal(mongo.guardados.length, 1);
        assert.equal(mongo.guardados[0]._id, 'u1');
        assert.equal(mongo.guardados[0].username, 'juan carlos');
    });
});

test('admin: DELETE /userdelete/:id borra al usuario; un id inexistente da 404', async () => {
    await conEscenario(async ({ bd, pedir }) => {
        const token = tokenDe(bd.get('a1'));

        const ok = await pedir('DELETE', '/userdelete/u2', { token });
        assert.equal(ok.status, 200);
        assert.equal(ok.body.msg, 'Usuario eliminado correctamente');
        assert.equal(bd.has('u2'), false);

        const noExiste = await pedir('DELETE', '/userdelete/u2', { token });
        assert.equal(noExiste.status, 404);
        assert.match(noExiste.body.msg, /Usuario no encontrado/);
    });
});

// ---------------------------------------------------------------------------
// Lo que usan los clientes comunes no cambia
// ---------------------------------------------------------------------------
test('usuario común: GET /user (su propio perfil) sigue funcionando', async () => {
    await conEscenario(async ({ bd, pedir }) => {
        const r = await pedir('GET', '/user', { token: tokenDe(bd.get('u1')) });
        assert.equal(r.status, 200);
        assert.equal(r.body._id, 'u1');
        assert.equal(r.body.username, 'juan');
        assert.equal('userpassword' in r.body, false, 'authenticate nunca selecciona el hash');
    });
});

test('login sin token sigue funcionando y el token lleva el rol', async () => {
    await conEscenario(async ({ pedir }) => {
        const admin = await pedir('POST', '/login', { body: { useremail: 'ana@test.com', userpassword: CLAVE } });
        assert.equal(admin.status, 200);
        assert.equal(jwt.verify(admin.body.token, process.env.JWT_SECRET).role, 'admin');

        const comun = await pedir('POST', '/login', { body: { useremail: 'juan@test.com', userpassword: CLAVE } });
        assert.equal(comun.status, 200);
        assert.equal(jwt.verify(comun.body.token, process.env.JWT_SECRET).role, 'user');

        const mala = await pedir('POST', '/login', { body: { useremail: 'juan@test.com', userpassword: 'incorrecta' } });
        assert.equal(mala.status, 400);
    });
});

test('un token real de login de admin abre las tres rutas de admin', async () => {
    await conEscenario(async ({ pedir }) => {
        const login = await pedir('POST', '/login', { body: { useremail: 'ana@test.com', userpassword: CLAVE } });
        const token = login.body.token;

        assert.equal((await pedir('GET', '/users', { token })).status, 200);
        assert.equal((await pedir('PUT', '/userupdate/u1', { token, body: { username: 'x', pago: false } })).status, 200);
        assert.equal((await pedir('DELETE', '/userdelete/u1', { token })).status, 200);
    });
});
