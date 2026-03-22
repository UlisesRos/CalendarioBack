const express = require('express');
const cron = require('node-cron')
const routerAdm = express.Router();
const ModalContent = require('../models/ModalContent')
const AdminCalendar = require('../models/AdminCalendar');
const ClosedSchedule = require('../models/ClosedSchedule');
const User = require('../models/User')
const Calendar = require('../models/Calendar');
const isAdmin = require('../middleware/isAdmin')

const initialAdminCalendar = {
    lunes: {
        mañana: {
            7: [null,null,null,null,null,null,null,null,null,null],
            8: [null,null,null,null,null,null,null,null,null,null],
            9: [null,null,null,null,null,null,null,null,null,null],
            10: [null,null,null,null,null,null,null,null,null,null],
            11: [null,null,null,null,null,null,null,null,null,null],
            12: [null,null,null,null,null,null,null,null,null,null],
        },
        tarde: {
            13: [null,null,null,null,null,null,null,null,null,null],
            14: [null,null,null,null,null,null,null,null,null,null],
            15: [null,null,null,null,null,null,null,null,null,null],
            16: [null,null,null,null,null,null,null,null,null,null],
            17: [null,null,null,null,null,null,null,null,null,null],
            18: [null,null,null,null,null,null,null,null,null,null],
            19: [null,null,null,null,null,null,null,null,null,null],
            20: [null,null,null,null,null,null,null,null,null,null],
        }
    },
    martes: {
        mañana: {
            7: [null,null,null,null,null,null,null,null,null,null],
            8: [null,null,null,null,null,null,null,null,null,null],
            9: [null,null,null,null,null,null,null,null,null,null],
            10: [null,null,null,null,null,null,null,null,null,null],
            11: [null,null,null,null,null,null,null,null,null,null],
            12: [null,null,null,null,null,null,null,null,null,null],
        },
        tarde: {
            13: [null,null,null,null,null,null,null,null,null,null],
            14: [null,null,null,null,null,null,null,null,null,null],
            15: [null,null,null,null,null,null,null,null,null,null],
            16: [null,null,null,null,null,null,null,null,null,null],
            17: [null,null,null,null,null,null,null,null,null,null],
            18: [null,null,null,null,null,null,null,null,null,null],
            19: [null,null,null,null,null,null,null,null,null,null],
            20: [null,null,null,null,null,null,null,null,null,null],
        }
    },
    miércoles: {
        mañana: {
            7: [null,null,null,null,null,null,null,null,null,null],
            8: [null,null,null,null,null,null,null,null,null,null],
            9: [null,null,null,null,null,null,null,null,null,null],
            10: [null,null,null,null,null,null,null,null,null,null],
            11: [null,null,null,null,null,null,null,null,null,null],
            12: [null,null,null,null,null,null,null,null,null,null],
        },
        tarde: {
            13: [null,null,null,null,null,null,null,null,null,null],
            14: [null,null,null,null,null,null,null,null,null,null],
            15: [null,null,null,null,null,null,null,null,null,null],
            16: [null,null,null,null,null,null,null,null,null,null],
            17: [null,null,null,null,null,null,null,null,null,null],
            18: [null,null,null,null,null,null,null,null,null,null],
            19: [null,null,null,null,null,null,null,null,null,null],
            20: [null,null,null,null,null,null,null,null,null,null],
        }
    },
    jueves: {
        mañana: {
            7: [null,null,null,null,null,null,null,null,null,null],
            8: [null,null,null,null,null,null,null,null,null,null],
            9: [null,null,null,null,null,null,null,null,null,null],
            10: [null,null,null,null,null,null,null,null,null,null],
            11: [null,null,null,null,null,null,null,null,null,null],
            12: [null,null,null,null,null,null,null,null,null,null],
        },
        tarde: {
            13: [null,null,null,null,null,null,null,null,null,null],
            14: [null,null,null,null,null,null,null,null,null,null],
            15: [null,null,null,null,null,null,null,null,null,null],
            16: [null,null,null,null,null,null,null,null,null,null],
            17: [null,null,null,null,null,null,null,null,null,null],
            18: [null,null,null,null,null,null,null,null,null,null],
            19: [null,null,null,null,null,null,null,null,null,null],
            20: [null,null,null,null,null,null,null,null,null,null],
        }
    },
    viernes: {
        mañana: {
            7: [null,null,null,null,null,null,null,null,null,null],
            8: [null,null,null,null,null,null,null,null,null,null],
            9: [null,null,null,null,null,null,null,null,null,null],
            10: [null,null,null,null,null,null,null,null,null,null],
            11: [null,null,null,null,null,null,null,null,null,null],
            12: [null,null,null,null,null,null,null,null,null,null],
        },
        tarde: {
            13: [null,null,null,null,null,null,null,null,null,null],
            14: [null,null,null,null,null,null,null,null,null,null],
            15: [null,null,null,null,null,null,null,null,null,null],
            16: [null,null,null,null,null,null,null,null,null,null],
            17: [null,null,null,null,null,null,null,null,null,null],
            18: [null,null,null,null,null,null,null,null,null,null],
            19: [null,null,null,null,null,null,null,null,null,null],
            20: [null,null,null,null,null,null,null,null,null,null],
        }
    },
    sábado: {
        mañana: {
            9: [null,null,null,null,null,null,null,null,null,null],
            10: [null,null,null,null,null,null,null,null,null,null],
            11: [null,null,null,null,null,null,null,null,null,null],
            12: [null,null,null,null,null,null,null,null,null,null],
        }
    }
}

// Obtener el calendario completo
routerAdm.get('/api/admincalendar', isAdmin, async ( req, res ) => {
    try {
        const admincalendar = await AdminCalendar.findOne();
        res.json(admincalendar)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

// Actualizar o crear un horario en el calendario
routerAdm.put('/api/admincalendar', isAdmin, async ( req, res ) => {
    const { day, shift, hour, updatedHour } = req.body;
    try {
        await AdminCalendar.updateOne({}, { $set: { [`${day}.${shift}.${hour}`]: updatedHour } });
        res.status(200).send('AdminCalendar updated');

    } catch (err) {
        console.error(err)
        res.status(500).json({ error: err.message })
    }
})

// Eliminar un usuario del calendario
routerAdm.put('/api/admincalendar/remove', isAdmin, async ( req, res ) => {
    const { day, shift, hour, index } = req.body;
    try {
        //traigo el calendario completo
        const admincalendar = await AdminCalendar.findOne();

        // verifico que este calendario existe
        if(!admincalendar){
            return res.status(404).json({ error: 'Calendario no funciona'}) 
        }

        if (!admincalendar[day] || !admincalendar[day][shift] || !admincalendar[day][shift][hour]) {
            return res.status(400).json({ error: 'Dia, hora o fecha invalida' });
        }

        // Elimina la persona del horario específico
        const updatedHour = [...admincalendar[day][shift][hour]];
        updatedHour[index] = null;

        // Guarda el cambio en la base de datos
        await AdminCalendar.updateOne({}, { $set: { [`${day}.${shift}.${hour}`]: updatedHour } });

        const adminupdateCalendar = await AdminCalendar.findOne();
        req.io.emit('admincalendarUpdate', adminupdateCalendar)

        res.status(200).send('Persona Removida')
    } catch (error) {
        res.status(500).json({ error: error.message})
    }
})

// Reiniciar el calendario
routerAdm.put('/api/admincalendar/reset', isAdmin, async ( req, res ) => {
    try {
        const adminCalendar = await AdminCalendar.findOne()
        if (!adminCalendar) {
            return res.status(404).json({ message: 'Admin calendar not found' });
        }

        // Crear una copia del calendario del admin, excluyendo el campo _id
        const adminCalendarData = { ...adminCalendar._doc };
        delete adminCalendarData._id;

        // Sobrescribir el calendario con el valor inicial del adminCalendar
        await Calendar.updateOne({}, {$set: { ...adminCalendarData }})
        res.status(200).send('Calendario Reseteado con exito!')
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message })
    }
})

// Reiniciar el calendario cada sabado a las 15hs
cron.schedule('0 15 * * 6', async () => {
    try {
        const user = await User.find();
        const adminCalendar = await AdminCalendar.findOne()

        if (!adminCalendar) {
            return res.status(404).json({ message: 'Admin calendar not found' });
        }

        // Crear una copia del calendario del admin, excluyendo el campo _id
        const adminCalendarData = { ...adminCalendar._doc };
        delete adminCalendarData._id;

        // Sobrescribir el calendario con el valor inicial del adminCalendar
        await Calendar.updateOne({}, {$set: { ...adminCalendarData }})
        console.log('Calendario Reseteado con exito el sabado a las 15hs!')

         // Restablecer los días de entrenamiento a su valor inicial
        user.forEach(async (usuario) => {
            const diasIniciales = usuario.diasentrenamiento;
            usuario.diasrestantes = diasIniciales;
            await usuario.save();
        });

        console.log("Días de entrenamiento restablecidos exitosamente.");
    } catch (error) {
        console.error('Error al reiniciar el calendaro / Error al restablecer los dias de entrenamiento', error)
    }
})

// FUNCION PARA EL MODAL DE NOVEDADES
routerAdm.get('/api/get-modal-content', async ( req, res ) => {
    try {
        const modalContent = await ModalContent.findOne({})
        res.json(modalContent || {})
    } catch (error) {
        res.status(500).send('Error al cargar el modal de novedades')
    }
})

routerAdm.post('/api/save-modal-content', isAdmin, async ( req, res ) => {
    const { title, subtitle, link, image, description } = req.body;

    try {
        await ModalContent.updateOne({}, { title, subtitle, link, image, description }, { upsert: true });
        res.status(200).send('Contenido del modal cuardado correctamente');
    } catch (error) {
        res.status(500).send('Error al guardar el contenido del modal', error)
    }
})

// Función para inicializar el calendario en MongoDB si no existe
async function initializeAdminCalendar() {
    const calendarExists = await AdminCalendar.findOne();
    if (!calendarExists) {
        const admincalendar = new AdminCalendar(initialAdminCalendar);
        await admincalendar.save();
        console.log('Initial Admincalendar se guardo en MongoDB.');
    } else {
        console.log('Initial AdminCalendar ya existe en MongoDB.');
    }
}

// =========================================
// CLOSED SCHEDULES - DIAS/HORARIOS CERRADOS
// =========================================

// Obtener todos los cierres activos (Admin)
routerAdm.get('/api/closed-schedules', isAdmin, async (req, res) => {
    try {
        const schedules = await ClosedSchedule.find().sort({ createdAt: -1 });
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta pública para usuarios (sin auth) - Calendario del usuario
routerAdm.get('/api/closed-schedules/public', async (req, res) => {
    try {
        const schedules = await ClosedSchedule.find();
        res.json(schedules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Crear un cierre (día completo o horas específicas)
routerAdm.post('/api/closed-schedules', isAdmin, async (req, res) => {
    const { day, closedDay, closedHours, reason } = req.body;
    try {
        // Si ya hay un cierre para ese día, lo actualizamos
        const existing = await ClosedSchedule.findOne({ day });
        if (existing) {
            existing.closedDay = closedDay ?? existing.closedDay;
            existing.closedHours = closedHours ?? existing.closedHours;
            existing.reason = reason ?? existing.reason;
            existing.createdAt = new Date();
            await existing.save();
            return res.status(200).json({ message: 'Cierre actualizado correctamente', data: existing });
        }
        const newClosure = new ClosedSchedule({ day, closedDay, closedHours, reason });
        await newClosure.save();
        res.status(201).json({ message: 'Cierre creado correctamente', data: newClosure });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar un cierre (reabrir día u horario)
routerAdm.delete('/api/closed-schedules/:id', isAdmin, async (req, res) => {
    try {
        const deleted = await ClosedSchedule.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Cierre no encontrado' });
        res.status(200).json({ message: 'Cierre eliminado. Horario reabierto.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// GESTIÓN DE HORARIOS PERMANENTES
// ==========================================

// Agregar una hora permanentemente al AdminCalendar (y al Calendar actual)
routerAdm.post('/api/schedule/add-hour', isAdmin, async (req, res) => {
    const { day, shift, hour } = req.body;
    const hourKey = `${day}.${shift}.${hour}`;
    const slots = [null, null, null, null, null, null, null, null, null, null]; // 10 slots por defecto

    try {
        // Usamos lean() para obtener el documento como JS plano (sin filtro del schema)
        const adminCal = await AdminCalendar.findOne().lean();
        if (!adminCal) return res.status(404).json({ error: 'AdminCalendar no existe' });

        // Verificar que no exista ya la hora
        const alreadyExists = adminCal[day]?.[shift]?.[hour] !== undefined;
        if (alreadyExists) {
            return res.status(400).json({ error: `La hora ${hour}:00 ya existe en ${day} - ${shift}` });
        }

        // Guardamos usando updateOne con $set — funciona directo sobre MongoDB sin filtros de schema
        await AdminCalendar.collection.updateOne(
            { _id: adminCal._id },
            { $set: { [hourKey]: slots } }
        );
        await Calendar.collection.updateOne(
            {},
            { $set: { [hourKey]: slots } }
        );

        res.status(200).json({ message: `Hora ${hour}:00 agregada a ${day} - ${shift}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar una hora permanentemente del AdminCalendar (y del Calendar actual)
routerAdm.delete('/api/schedule/remove-hour', isAdmin, async (req, res) => {
    const { day, shift, hour } = req.body;
    const hourKey = `${day}.${shift}.${hour}`;

    try {
        await AdminCalendar.updateOne({}, { $unset: { [hourKey]: '' } });
        await Calendar.updateOne({}, { $unset: { [hourKey]: '' } });

        res.status(200).json({ message: `Hora ${hour}:00 eliminada de ${day} - ${shift}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = { routerAdm, initializeAdminCalendar };