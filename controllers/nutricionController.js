const { format, parseISO } = require('date-fns');
const { es } = require('date-fns/locale');
const NutricionTurn = require('../models/NutricionTurn');
const { sendEmail } = require('../utils/mailer');

// Obtener todos los turnos de nutrición
const getAllNutricionTurns = async (req, res) => {
    try {
        const turnos = await NutricionTurn.find();
        res.json(turnos);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener turnos' });
    }
};

//Obtener turno del usuario
const turnUser = async (req, res) => {
    const { email } = req.query;

    try {
        const turnos = await NutricionTurn.find({ 'usuario.email':email });
        res.status(200).json(turnos);
    } catch (err) {
        res.status(500).json({ message: 'Error al buscar turnos del usuario' });
    }

}

// Reservar un turno de nutrición
const addNutricionTurn = async (req, res) => {
    const { fecha, hora, usuario } = req.body;

    try {
        // Verificamos si ya tiene un turno ese día
        const yaTieneTurno = await NutricionTurn.findOne({
            'usuario.email': usuario.email,
            fecha
        });

        if (yaTieneTurno) {
            return res.status(400).json({ message: 'Ya tenés un turno reservado ese día.' });
        }

        // Verificar si ya existe ese turno
        const existente = await NutricionTurn.findOne({ fecha, hora });
        if (existente) {
            return res.status(400).json({ message: 'Turno no disponible' });
        }

        const dayName = format(parseISO(fecha), 'EEEE', { locale: es }).toLowerCase();
        let profe = '';
        if (dayName === 'martes' || dayName === 'miércoles') {
            profe = 'Julieta Martini';
        } else if (dayName === 'jueves') {
            profe = 'Florencia Bertaña';
        }

        // Guardar Turno
        const nuevoTurno = new NutricionTurn({ fecha, hora, usuario, profe });
        await nuevoTurno.save();

        // Formatear fecha en estilo: Martes 27 de mayo de 2025
        const fechaFormateada = format(parseISO(fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

        // Enviar email de confirmación
        const textoUsuario = `Hola ${usuario.nombre}, tu turno de Nutricion ha sido reservado para el ${fechaFormateada} a las ${hora}.`;
        await sendEmail(usuario.email, 'Confirmación de turno de nutrición en Fuerza Base Integral', textoUsuario);

        if(profe === 'Julieta Martini'){
            const textoJuli = `${usuario.nombre} reservo un turno para la fecha: ${fechaFormateada} a las ${hora}.`;
            await sendEmail('julietamartini49@gmail.com', `Nuevo turno de Nutricion para ${profe}`, textoJuli)
        } else if(profe === 'Florencia Bertaña'){
            const textoFlor = `${usuario.nombre} reservo un turno para la fecha: ${fechaFormateada} a las ${hora}.`;
            await sendEmail('florenciabertana@gmail.com', `Nuevo turno de Nutricion para ${profe}`, textoFlor)
        }

        res.json({ message: 'Turno reservado con éxito' });

    } catch (error) {
        res.status(500).json({ message: 'Error al reservar turno' });
    }
};

// Cancelar un turno de nutrición
const deleteTurn = async (req, res) => {
    const { fecha, hora } = req.body;

    try {
        // Buscar el turno primero para obtener los datos del usuario
        const turno = await NutricionTurn.findOne({ fecha, hora });

        if (!turno) {
        return res.status(404).json({ message: 'Turno no encontrado' });
        }

        const dayName = format(parseISO(fecha), 'EEEE', { locale: es }).toLowerCase();
        let profe = '';
        if (dayName === 'martes' || dayName === 'miércoles') {
            profe = 'Julieta Martini';
        } else if (dayName === 'jueves') {
            profe = 'Florencia Bertaña';
        }

        // Eliminar el turno
        await NutricionTurn.deleteOne({ fecha, hora });

        // Formatear fecha en estilo: Martes 27 de mayo de 2025
        const fechaFormateada = format(parseISO(fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });

        // Enviar email de cancelación al usuario
        const { nombre, email } = turno.usuario;
        const textoUsuario = `Hola ${nombre}, lamentamos informarte que tu turno de Nutricion del día ${fechaFormateada} a las ${hora} ha sido cancelado por el administrador.`;
        await sendEmail(email, 'Cancelación de turno de nutrición', textoUsuario);

        if(profe === 'Julieta Martini'){
            const textoJuli = `${nombre} cancelo el turno de la fecha: ${fechaFormateada} a las ${hora}.`;
            await sendEmail('julietamartini49@gmail.com', `Cancelacion de turno de Nutricion para ${profe}`, textoJuli)
        } else if(profe === 'Florencia Bertaña'){
            const textoFlor = `${nombre} cancelo el turno de la fecha: ${fechaFormateada} a las ${hora}.`;
            await sendEmail('florenciabertana@gmail.com', `Cancelacion de turno de Nutricion para ${profe}`, textoFlor)
        }

        res.status(200).json({ message: 'Turno cancelado correctamente' });
    } catch (err) {
        console.error('Error al cancelar turno:', err);
        res.status(500).json({ message: 'Error del servidor al cancelar turno' });
    }
};

module.exports = {
    getAllNutricionTurns,
    addNutricionTurn,
    deleteTurn,
    turnUser
};
