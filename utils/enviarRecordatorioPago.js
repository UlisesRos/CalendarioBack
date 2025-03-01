const { sendEmail } = require('./mailer');
const User = require('../models/User'); 

const enviarRecordatorioPago = async () => {
    try {
        const usuariosMorosos = await User.find({ role: { $ne: 'admin' }, pago: false }); // Buscar usuarios que no pagaron

        if (usuariosMorosos.length === 0) {
            console.log('No hay usuarios pendientes de pago.');
            return;
        }

        for (const usuario of usuariosMorosos) {
            const asunto = 'Recordatorio de Pago - Cuota Mensual';
            const mensaje = `Hola ${usuario.username} ${usuario.userlastname},\n\nEste es un recordatorio de que aún no has realizado el pago de tu cuota mensual. Por favor, realiza el pago lo antes posible para evitar inconvenientes.\n\nGracias.\n\nFuerza Base Integral.`;

            await sendEmail(usuario.useremail, asunto, mensaje);
            console.log(`Correo enviado a ${usuario.useremail}`);
        }

    } catch (error) {
        console.error('Error al enviar recordatorios de pago:', error);
    }
};

module.exports = enviarRecordatorioPago;
