const mongoose = require('mongoose');
const User = require('../models/User');

async function registrarPago(userId, monto, metodo) {
    try {
        // Verifica que el userId sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('ID de usuario no válido');
        }

        // Busca al usuario en la base de datos
        const usuario = await User.findById(userId);

        // Si el usuario no existe, lanza un error
        if (!usuario) {
            throw new Error('Usuario no encontrado');
        }

        // Obtiene la fecha actual y la formatea
        const currentDate = new Date();
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        const formattedDate = currentDate.toLocaleDateString('es-AR', options);

        console.log('Usuario:', usuario);
        console.log('Fecha de pago:', formattedDate);
        console.log('Monto:', monto);
        console.log('Método de pago:', metodo);

        // Actualiza los campos del usuario
        usuario.fechaPago = formattedDate; // Actualiza la última fecha de pago
        usuario.pago = true; // Marca el pago como realizado
        usuario.metodopago = metodo; // Guarda el método de pago

        // Agrega el pago al historial de pagos
        usuario.historialPagos.push({
            fecha: new Date(),
            monto,
            metodo,
        });

        // Guarda los cambios en la base de datos
        await usuario.save();
        console.log('Pago registrado con éxito');
    } catch (error) {
        console.error('Error registrando el pago:', error.message);
        throw error; // Propaga el error para que la función que llama pueda manejarlo
    }
}

module.exports = registrarPago;