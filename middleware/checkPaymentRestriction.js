// ¿El usuario tiene la inscripción bloqueada por no haber pagado?
// La restricción aplica a partir del día 12 del mes y nunca a los admins.
const debeAbonarParaInscribirse = (user, fecha = new Date()) => {
    if (!user || user.role === 'admin') return false;
    if (fecha.getDate() < 12) return false;
    return !user.pago;
};

const checkPaymentRestriction = (req, res, next) => {
    // Bloquear si el pago está pendiente
    if (debeAbonarParaInscribirse(req.user)) {
        return res.status(403).json({
            msg: 'Tu cuota del mes no está abonada. No podés inscribirte en el calendario.',
            code: 'PAYMENT_REQUIRED'
        });
    }

    next();
};

module.exports = checkPaymentRestriction;
module.exports.debeAbonarParaInscribirse = debeAbonarParaInscribirse;
