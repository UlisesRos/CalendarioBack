const checkPaymentRestriction = (req, res, next) => {
    // Los admins no tienen restricción de pago
    if (req.user.role === 'admin') return next();

    const dayOfMonth = new Date().getDate();

    // La restricción aplica únicamente a partir del día 12
    if (dayOfMonth < 12) return next();

    // Bloquear si el pago está pendiente
    if (!req.user.pago) {
        return res.status(403).json({
            msg: 'Tu cuota del mes no está abonada. No podés inscribirte en el calendario.',
            code: 'PAYMENT_REQUIRED'
        });
    }

    next();
};

module.exports = checkPaymentRestriction;
