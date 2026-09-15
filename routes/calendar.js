const express = require('express');
const router = express.Router();
const Calendar = require('../models/Calendar');
const authenticate = require('../middleware/authenticate');
const checkPaymentRestriction = require('../middleware/checkPaymentRestriction');
const checkScheduleRestriction = require('../middleware/checkScheduleRestriction');
const {
    MAX_RESERVAS,
    CalendarError,
    listarTodasLasReservas,
    obtenerEstadoHorario,
    inscribirUsuario,
    quitarDelHorario,
    quitarReserva,
} = require('../utils/reservas');

const initialCalendar = {
    lunes: {
        mañana: {
            7: [null,null,null,null,null,null,null],
            8: ["isabel c","belu s","joaco m","hugo d","nanci g","javier r","miriam p"],
            9: ["valen o","lu s","ale p","beti f","mauri l",null],
            10: ["ro b","ailen m","facu a","omar b",null,null],
            11: ["bruno",null,null,null,null,null],
            12: [null,null,null,null,null,null]
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
            9: [null,null,null,null,null,null,null,null],
            10: [null,null,null,null,null,null,null,null],
            11: [null,null,null,null,null,null,null,null],
            12: [null,null,null,null,null,null,null,null],
        }
    }
}

// Respuesta de error uniforme. Si el error corresponde a un horario, se adjunta
// su estado actual para que el frontend se sincronice sin recargar todo.
const responderError = async (res, error, contexto) => {
    if (error instanceof CalendarError) {
        let estadoHorario = {};
        if (error.slot) {
            try {
                estadoHorario = await obtenerEstadoHorario(error.slot);
            } catch {
                // Sin estado: el frontend vuelve a pedir el calendario completo
            }
        }
        return res.status(error.status).json({ code: error.code, msg: error.message, ...error.extra, ...estadoHorario });
    }

    console.error(contexto, error);
    return res.status(500).json({ error: error.message, msg: 'Ocurrió un error inesperado. Intentá de nuevo.' });
};

// Obtener el calendario completo
router.get('/api/calendar', async ( req, res ) => {
    try {
        const calendar = await Calendar.findOne();
        res.json(calendar)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
});

// Obtener todas las listas de reserva: { "lunes.mañana.10": [{ id, nombre }] }
router.get('/api/calendar/reservas', async ( req, res ) => {
    try {
        const reservas = await listarTodasLasReservas();
        res.json({ maxReservas: MAX_RESERVAS, reservas });
    } catch (error) {
        responderError(res, error, 'Error listando las reservas:');
    }
});

// Inscribir al usuario logueado en un horario.
// Si está completo y el usuario lo aceptó (aceptaReserva: true) queda en la lista de reserva.
router.put('/api/calendar', authenticate, checkPaymentRestriction, checkScheduleRestriction, async ( req, res ) => {
    const { day, shift, hour, aceptaReserva } = req.body || {};
    try {
        const resultado = await inscribirUsuario({
            usuario: req.user,
            day,
            shift,
            hour,
            aceptaReserva: aceptaReserva === true,
        });
        const estadoHorario = await obtenerEstadoHorario(resultado.slot);

        res.status(200).json({
            estado: resultado.estado,
            posicion: resultado.posicion,
            maxReservas: MAX_RESERVAS,
            ...estadoHorario,
        });
    } catch (error) {
        responderError(res, error, 'Error inscribiendo en el calendario:');
    }
})

// Quitar a una persona de un horario (sin restricción de pago — pueden cancelar aunque adeuden).
// El usuario sólo puede quitarse a sí mismo; el admin puede quitar a cualquiera.
// Si había reservas, entra automáticamente la primera y se le avisa por mail.
router.put('/api/calendar/remove', authenticate, async ( req, res ) => {
    const { day, shift, hour, index, nombre } = req.body || {};
    try {
        const resultado = await quitarDelHorario({ solicitante: req.user, day, shift, hour, index, nombre });
        const estadoHorario = await obtenerEstadoHorario(resultado.slot);

        Calendar.findOne()
            .then((updateCalendar) => req.io.emit('updateCalendar', updateCalendar))
            .catch(() => {});

        res.status(200).json({
            removido: resultado.removido,
            promovidos: resultado.promovidos,
            ...estadoHorario,
        });
    } catch (error) {
        responderError(res, error, 'Error quitando a la persona del calendario:');
    }
})

// Quitar una reserva (el usuario las propias; el admin cualquiera)
router.delete('/api/calendar/reservas/:id', authenticate, async ( req, res ) => {
    try {
        const resultado = await quitarReserva({ solicitante: req.user, reservaId: req.params.id });
        const estadoHorario = await obtenerEstadoHorario(resultado.slot);

        res.status(200).json({ removido: resultado.removido, ...estadoHorario });
    } catch (error) {
        responderError(res, error, 'Error quitando la reserva:');
    }
})

// Función para inicializar el calendario en MongoDB si no existe
async function initializeCalendar() {
    const calendarExists = await Calendar.findOne();
    if (!calendarExists) {
        const calendar = new Calendar(initialCalendar);
        await calendar.save();
        console.log('Initial calendar se guardo en MongoDB.');
    } else {
        console.log('Inital calendar ya existe en MongoDB.');
    }
}

module.exports = { router, initializeCalendar };
