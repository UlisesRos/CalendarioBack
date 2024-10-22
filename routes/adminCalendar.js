const express = require('express');
const cron = require('node-cron')
const routerAdm = express.Router();
const ModalContent = require('../models/ModalContent')
const AdminCalendar = require('../models/AdminCalendar');
const Calendar = require('../models/Calendar');

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
            930: [null,null,null,null,null,null,null,null,null,null],
            1030: [null,null,null,null,null,null,null,null,null,null],
            1130: [null,null,null,null,null,null,null,null,null,null],
        }
    }
}

// Obtener el calendario completo
routerAdm.get('/api/admincalendar', async ( req, res ) => {
    try {
        const admincalendar = await AdminCalendar.findOne();
        res.json(admincalendar)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

// Actualizar o crear un horario en el calendario
routerAdm.put('/api/admincalendar', async ( req, res ) => {
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
routerAdm.put('/api/admincalendar/remove', async ( req, res ) => {
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
routerAdm.put('/api/admincalendar/reset', async ( req, res ) => {
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
    } catch (error) {
        console.error('Error al reiniciar el calendaro', error)
    }
})

// FUNCION PARA EL MODAL DE NOVEDADES
routerAdm.get('/api/get-modal-content', async ( req, res ) => {
    try {
        const modalContent = await ModalContent.findOne({})
        res.json(modalContent)
    } catch (error) {
        res.status(500).send('Error al cargar el modal de novedades')
    }
})

routerAdm.post('/api/save-modal-content', async ( req, res ) => {
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

module.exports = { routerAdm, initializeAdminCalendar };