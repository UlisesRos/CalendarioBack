const ScheduleRestriction = require('../models/ScheduleRestriction');
const { isSlotBlockedFor } = require('../utils/scheduleRestrictions');

// ============================================================================
// Bloquea la inscripción de un usuario en un horario restringido.
// Se usa después de "authenticate", por lo que req.user es el documento del
// usuario logueado.
// ============================================================================
const checkScheduleRestriction = async (req, res, next) => {
    try {
        // Sin usuario autenticado no hay nada que validar (lo resuelve authenticate)
        if (!req.user) return next();

        // Los admins nunca quedan restringidos
        if (req.user.role === 'admin') return next();

        // PUT /api/calendar siempre inscribe al usuario logueado, así que se valida
        // en todos los casos (el body ya no define a quién se anota).
        const { day, shift, hour } = req.body || {};
        if (!day || !shift || hour === undefined || hour === null) return next();

        // Misma normalización que usa el calendario ("09" -> "9"); si la hora es
        // inválida, la ruta la rechaza después con un 400.
        const horaTexto = String(hour).trim();
        const horaNormalizada = /^\d{1,2}$/.test(horaTexto) ? Number(horaTexto) : horaTexto;

        const restriction = await ScheduleRestriction.findOne({ user: req.user._id });
        if (!isSlotBlockedFor(restriction, day, shift, horaNormalizada)) return next();

        const detalle = restriction.reason ? ` Motivo: ${restriction.reason}` : '';
        return res.status(403).json({
            msg: `No podés inscribirte en ${day} a las ${horaNormalizada}:00 hs porque tenés una restricción de horarios.${detalle}`,
            code: 'SCHEDULE_RESTRICTED',
            mode: restriction.mode,
            reason: restriction.reason || '',
        });
    } catch (error) {
        // Ante un error inesperado no bloqueamos la inscripción del usuario
        console.error('Error verificando la restricción de horarios:', error);
        next();
    }
};

module.exports = checkScheduleRestriction;
