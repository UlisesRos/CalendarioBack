const express = require('express');
const cron = require('node-cron')
const routerAdm = express.Router();
const ModalContent = require('../models/ModalContent')
const AdminCalendar = require('../models/AdminCalendar');
const Calendar = require('../models/Calendar');

const initialAdminCalendar = {
    lunes: {
        mañana: {
            8: ["isabel c","belu s","joaco m","hugo d","nanci g","javier r","miriam p"],
            9: ["valen o","lu s","ale p","beti f","mauri l",null],
            10: ["ro b","ailen m","facu a","omar b",null,null],
            11: ["bruno",null,null,null,null,null]
        },
        tarde: {
            16: ["jor p","dona r","irina r","mayra n","marian g","cuervo",null],
            17: ["clari s","ale a","ale g","facu a",null,null,null],
            18: ["franco s","alicia n","belu a","damian o","maela g","eze s"],
            19: ["rama r","maia b","mariano f","uli","mica p",null],
        }
    },
    martes: {
        mañana: {
            8: ["joaco m","agos p","juan jose f","pato c",null,null,null],
            9: ["marina m","sabri v","lu w","flor p","mayra n","martina g"],
            10: ["adri f","marian m","betty j",null,null,null],
            11: ["dani r",null,null, null, null, null]
        },
        tarde: {
            16: ["dani e","ziu r","malvi r","liliana v","rocio g",null,null],
            17: ["guille sc","irina r","elba g",null,null,null,null],
            18: ["frances","sofi f","eve v",null,null,null],
            19: ["lucas k",null,null,null,null,null]
        }
    },
    miércoles: {
        mañana: {
            8: ["daniela a","belu s","isabel c","nanci g","romi m",null,null],
            9: ["beti f","valen o","lu s","mauri l","yaz w",null],
            10: ["ro b","flor b","ailen m","omar b",null,null],
            11: ["dani r",null,null,null,null,null]
        },
        tarde: {
            16: ["irina r","fati d","mayra n","cande b","marian g",null,null],
            17: ["clari s","ale a","ale g","cuervo","facu a",null,null],
            18: ["maela g","eze s","vero t","franco s","bruno",null],
            19: ["rama r","maia b","uli","mica p",null,null],
        }
    },
    jueves: {
        mañana: {
            8: ["joaco m","javier r",null,null,null,null,null],
            9: ["marina m","ale p","flor p","martina g","sabri v",null],
            10: ["dani e","facu a","marian m",null,null,null],
            11: [null,null,null,null,null,null]
        },
        tarde: {
            16: ["dona r","jor p","mayra n","ziomara r","malvi r",null,null],
            17: ["agos p","facu a","rocio g","liliana v","elba","guille sc","pato c"],
            18: ["frances","belu a","irina r",null,null,null],
            19: ["mariano f","flor m","lucas k","sofi f","eve v",null],
        }
    },
    viernes: {
        mañana: {
            8: ["juan jose f","miriam p","daniela a","isabel c","romi m","belu s","hugo d"],
            9: ["martina g","yaz w","lu w","beti f","nanci g","mauri l"],
            10: ["ro b","dani r","adri f","flor b","ailen m",null],
            11: [null,null,null,null,null,null]
        },
        tarde: {
            16: ["jor p","marian g","mayra n","cande b","dona r","irina r",null],
            17: ["ale g","bruno","liliana v","rocio g","damian o","irina r",null],
            18: ["alicia n","eze s","maela g","vero t", null,null],
            19: ["maia b","rama r","mica p","uli",null,null],
        }
    },
    sábado: {
        mañana: {
            930: ["yaz w","fatima d","dani r","flor p","licha r",null],
            1030: ["lu s","marian m","eve v","sofia f",null,null],
            1130: ["flor m",null,null,null,null,null,null]
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