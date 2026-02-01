const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const registrarPago = require('../utils/registrarPago');
const { calcularPrecio } = require('../utils/precios');
const { verifyWebhookSignature } = require('../utils/verifyWebhook');
const User = require('../models/User');

// Configura las credenciales de MercadoPago con tu access_token desde .env
const client = new MercadoPagoConfig({ 
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN 
});

// Crear preferencia de pago
const postPreference = async (req, res) => {
    const { days, name, lastname, descuento, userId } = req.body;

    try {
        // Validar que userId sea válido
        if (!userId) {
            return res.status(400).json({ error: 'userId es requerido' });
        }

        // Calcular el monto del pago
        const amount = calcularPrecio(days, descuento);

        // Validar el monto
        if (amount <= 0) {
            return res.status(400).json({ error: 'Días de entrenamiento inválidos o monto no válido' });
        }

        // Crear la preferencia con el cliente de MercadoPago
        const preference = new Preference(client);
        const response = await preference.create({
            body: {
                items: [
                    {
                        title: `Pago de entrenamiento por ${days} días para ${name} ${lastname}`,
                        quantity: 1,
                        unit_price: amount,
                        currency_id: 'ARS',
                    },
                ],
                back_urls: {
                    success: `${process.env.FRONTEND_URL || 'https://calendario-fuerza-integral.vercel.app'}/payment-success?userId=${userId}&monto=${amount}&metodo=MP`,
                    failure: `${process.env.FRONTEND_URL || 'https://calendario-fuerza-integral.vercel.app'}/payment-failed?userId=${userId}&monto=${amount}&metodo=MP`,
                    pending: `${process.env.FRONTEND_URL || 'https://calendario-fuerza-integral.vercel.app'}/payment-pending?userId=${userId}&monto=${amount}&metodo=MP`,
                },
                auto_return: 'approved',
                metadata: {
                    userId: userId,
                    amount: amount,
                    metodo: 'MP',
                    dias: days
                }
            },
        });

        console.log('✅ Preferencia de MercadoPago creada:', response.id);

        if (response && response.id) {
            return res.status(200).json({
                id: response.id,
                init_point: response.init_point,
            });
        } else {
            throw new Error('La respuesta de MercadoPago no contiene un ID válido');
        }
    } catch (error) {
        console.error('❌ Error al crear la preferencia:', error.message);
        res.status(500).json({ error: 'Error al procesar el pago', details: error.message });
    }
};

const registrarPagos = async (req, res) => {
    const { userId, monto, metodo } = req.body;

    console.log('� ENTRADA EN registrarPagos');
    console.log('📝 Datos recibidos para registro de pago:', { userId, monto, metodo });
    console.log('📋 Body completo:', req.body);

    try {
        // Verifica que los datos necesarios estén presentes
        if (!userId || !monto || !metodo) {
            console.error('❌ Faltan datos:', { userId: !!userId, monto: !!monto, metodo: !!metodo });
            return res.status(400).json({ error: 'Faltan datos necesarios (userId, monto, metodo)', received: { userId, monto, metodo } });
        }

        // Validar que monto sea un número positivo
        if (typeof monto !== 'number' || monto <= 0) {
            console.error('❌ Monto inválido:', { tipo: typeof monto, valor: monto });
            return res.status(400).json({ error: 'El monto debe ser un número positivo', receivedType: typeof monto });
        }

        console.log('✅ Datos validados, llamando a registrarPago...');
        // Llama a la función registrarPago para registrar el pago
        const resultado = await registrarPago(userId, monto, metodo);

        console.log('✅ Pago registrado con éxito en BD');
        // Si todo va bien, envía una respuesta exitosa
        res.status(200).json({ 
            msg: 'Pago registrado con éxito',
            pago: resultado
        });
    } catch (error) {
        console.error('❌ Error en registrarPagos:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: error.message });
    }
};

const notificacionPago = async (req, res) => {
    const { id, type, action, data } = req.body; 

    try {
        console.log('🔔 Webhook recibido de Mercado Pago:', { id, type, action });

        // Verificar que sea una notificación de pago
        if (type !== 'payment' || action !== 'payment.approved') {
            console.log('⚠️ Webhook ignorado (no es pago aprobado)');
            return res.status(200).send('Notificación procesada (no es pago aprobado)');
        }

        // El ID es el payment ID de Mercado Pago
        const paymentId = data.id;

        if (!paymentId) {
            return res.status(400).json({ error: 'Payment ID faltante en el webhook' });
        }

        // Obtener detalles del pago desde Mercado Pago
        const payment = new Payment(client);
        const paymentData = await payment.get(paymentId);

        console.log('💳 Datos del pago obtenidos:', {
            id: paymentData.id,
            status: paymentData.status,
            metadata: paymentData.metadata
        });

        // Verificar que el pago esté aprobado
        if (paymentData.status !== 'approved') {
            console.log('⚠️ Pago no aprobado, estado:', paymentData.status);
            return res.status(200).send('Pago no aprobado');
        }

        // Extraer userId del metadata del pago
        const userId = paymentData.metadata?.userId;
        const monto = paymentData.transaction_amount;
        const metodo = 'MP';

        if (!userId) {
            console.error('❌ userId no encontrado en metadata del pago');
            return res.status(400).json({ error: 'userId no encontrado en metadata' });
        }

        // Verificar que el pago no haya sido procesado ya (idempotencia)
        const usuario = await User.findById(userId);
        if (!usuario) {
            console.error('❌ Usuario no encontrado:', userId);
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Buscar si ya existe este pago en el historial
        const pagoExistente = usuario.historialPagos.find(
            p => p.monto === monto && 
            new Date(p.fecha).toDateString() === new Date().toDateString()
        );

        if (pagoExistente) {
            console.log('ℹ️ Pago ya registrado, evitando duplicado');
            return res.status(200).json({ msg: 'Pago ya registrado' });
        }

        // Registrar el pago
        await registrarPago(userId, monto, metodo);

        console.log('✅ Pago registrado exitosamente desde webhook');
        res.status(200).json({ msg: 'Notificación procesada correctamente' });

    } catch (error) {
        console.error('❌ Error en la notificación:', error.message);
        res.status(500).json({ error: 'Error procesando la notificación', details: error.message });
    }
};


module.exports = { postPreference, registrarPagos, notificacionPago };
module.exports = { postPreference, registrarPagos, notificacionPago };