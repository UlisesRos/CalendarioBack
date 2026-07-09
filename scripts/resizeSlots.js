/**
 * Script de migración: reduce los slots de cada turno de 10 → 8 personas.
 * Actualiza las colecciones AdminCalendar y Calendar en MongoDB.
 *
 * Uso: node scripts/resizeSlots.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const NUEVA_CAPACIDAD = 8;

const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const TURNOS = ['mañana', 'tarde'];

async function resizarColeccion(coleccion, nombre) {
    const doc = await coleccion.findOne({});
    if (!doc) {
        console.log(`⚠️  Colección "${nombre}" no encontrada, saltando.`);
        return;
    }

    const updates = {};
    let cantidadActualizada = 0;

    for (const dia of DIAS) {
        const diaData = doc[dia];
        if (!diaData) continue;

        for (const turno of TURNOS) {
            const turnoData = diaData[turno];
            if (!turnoData) continue;

            for (const hora of Object.keys(turnoData)) {
                const array = turnoData[hora];
                if (!Array.isArray(array)) continue;
                if (array.length <= NUEVA_CAPACIDAD) continue;

                const perdidos = array.slice(NUEVA_CAPACIDAD).filter(v => v !== null);
                if (perdidos.length > 0) {
                    console.warn(`  ⚠️  ${nombre} ${dia} ${turno} ${hora}:00 — se perderían: ${perdidos.join(', ')}`);
                }

                updates[`${dia}.${turno}.${hora}`] = array.slice(0, NUEVA_CAPACIDAD);
                cantidadActualizada++;
            }
        }
    }

    if (Object.keys(updates).length === 0) {
        console.log(`✅ "${nombre}" ya tiene ${NUEVA_CAPACIDAD} slots o menos. Sin cambios.`);
        return;
    }

    await coleccion.collection.updateOne({ _id: doc._id }, { $set: updates });
    console.log(`✅ "${nombre}" actualizado: ${cantidadActualizada} horarios reducidos a ${NUEVA_CAPACIDAD} slots.`);
}

async function main() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Conectado a MongoDB.\n');

    const AdminCalendar = require('../models/AdminCalendar');
    const Calendar = require('../models/Calendar');

    await resizarColeccion(AdminCalendar, 'AdminCalendar');
    await resizarColeccion(Calendar, 'Calendar');

    await mongoose.disconnect();
    console.log('\nMigración completada. Desconectado de MongoDB.');
}

main().catch(err => {
    console.error('Error durante la migración:', err);
    process.exit(1);
});
