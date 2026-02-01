const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Registra un pago de un usuario con idempotencia
 * Evita procesar el mismo pago dos veces si llega duplicado
 */
async function registrarPago(userId, monto, metodo) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
        // Verifica que el userId sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('ID de usuario no válido');
        }

        // Busca al usuario en la base de datos
        const usuario = await User.findById(userId).session(session);

        // Si el usuario no existe, lanza un error
        if (!usuario) {
            throw new Error('Usuario no encontrado');
        }

        // Obtiene la fecha actual y la formatea
        const currentDate = new Date();
        const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
        const formattedDate = currentDate.toLocaleDateString('es-AR', options);

        console.log('👤 Usuario:', usuario.username);
        console.log('📅 Fecha de pago:', formattedDate);
        console.log('💰 Monto:', monto);
        console.log('🔧 Método de pago:', metodo);

        // IDEMPOTENCIA: Verificar si ya existe un pago registrado hoy
        const pagoDeHoy = usuario.historialPagos.find(p => {
            const fechaPago = new Date(p.fecha);
            return fechaPago.toDateString() === currentDate.toDateString();
        });

        if (pagoDeHoy) {
            console.log('ℹ️ Ya existe un pago registrado hoy, evitando duplicado');
            await session.abortTransaction();
            session.endSession();
            return usuario;
        }

        // Actualiza los campos del usuario
        usuario.fechaPago = formattedDate;
        usuario.pago = true;
        usuario.metodopago = metodo;

        // Agrega el pago al historial de pagos
        usuario.historialPagos.push({
            fecha: new Date(),
            monto,
            metodo,
        });

        // Guarda los cambios en la base de datos
        const usuarioActualizado = await usuario.save({ session });
        
        await session.commitTransaction();
        session.endSession();

        console.log('✅ Pago registrado exitosamente');
        return usuarioActualizado;

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        
        console.error('❌ Error registrando el pago:', error.message);
        throw error;
    }
}

module.exports = registrarPago;