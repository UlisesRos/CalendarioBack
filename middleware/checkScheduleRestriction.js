const ScheduleRestriction = require('../models/ScheduleRestriction');
const { isSlotBlockedFor, getFullName } = require('../utils/scheduleRestrictions');

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

        const { day, shift, hour, updatedHour } = req.body || {};
        if (!day || !shift || hour === undefined || hour === null) return next();

        // Sólo validamos cuando el usuario se está agregando a sí mismo.
        // Si su nombre no aparece en el horario enviado, no es una inscripción.
        const nombreCompleto = getFullName(req.user);
        if (Array.isArray(updatedHour)) {
            const seEstaAnotando = updatedHour.some(
                (persona) => typeof persona === 'string' && persona.trim().toLowerCase() === nombreCompleto
            );
            if (!seEstaAnotando) return next();
        }

        const restriction = await ScheduleRestriction.findOne({ user: req.user._id });
        if (!isSlotBlockedFor(restriction, day, shift, hour)) return next();

        const detalle = restriction.reason ? ` Motivo: ${restriction.reason}` : '';
        return res.status(403).json({
            msg: `No podés inscribirte en ${day} a las ${hour}:00 hs porque tenés una restricción de horarios.${detalle}`,
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
