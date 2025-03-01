const { MercadoPagoConfig, Preference } = require('mercadopago');
const registrarPago = require('../utils/registrarPago');
const { calcularPrecio } = require('../utils/precios');

// Configura las credenciales de MercadoPago con tu access_token
const client = new MercadoPagoConfig({ accessToken: 'APP_USR-5519142242762207-120814-588c69600a489014acf9cb2565a43730-2081952221' });

// Crear preferencia de pago
const postPreference = async (req, res) => {
    const { days, name, lastname, descuento, userId } = req.body;

    try {
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
                    },
                ],
                back_urls: {
                    success: `https://calendario-fuerza-integral.vercel.app//payment-success?userId=${userId}&monto=${amount}&metodo=MP`, // URL para pagos exitosos
                    failure: `https://calendario-fuerza-integral.vercel.app//payment-failed?userId=${userId}&monto=${amount}&metodo=MP`,  // URL para pagos fallidos
                    pending: `https://calendario-fuerza-integral.vercel.app//payment-pending?userId=${userId}&monto=${amount}&metodo=MP`, // URL para pagos pendientes
                },
                auto_return: 'approved', // Redirige automáticamente al usuario si el pago es aprobado
            },
        });

        console.log('Respuesta de MercadoPago:', response);

        if (response && response.id) {
            return res.status(200).json({
                id: response.id,
                init_point: response.init_point,
            });
        } else {
            throw new Error('La respuesta de MercadoPago no contiene un ID válido');
        }
    } catch (error) {
        console.error('Error al crear la preferencia:', error);
        res.status(500).json({ error: 'Error al procesar el pago' });
    }
};

const registrarPagos = async (req, res) => {
    const { userId, monto, metodo } = req.body;

    console.log('Datos recibidos:', { userId, monto, metodo });

    try {
        // Verifica que los datos necesarios estén presentes
        if (!userId || !monto || !metodo) {
            return res.status(400).json({ error: 'Faltan datos necesarios' });
        }

        // Llama a la función registrarPago para registrar el pago
        await registrarPago(userId, monto, metodo);

        // Si todo va bien, envía una respuesta exitosa
        res.status(200).json({ msg: 'Pago registrado con éxito' });
    } catch (error) {
        console.error('Error en registrarPagos:', error);
        res.status(500).json({ error: error.message });
    }
};

const notificacionPago = async (req, res) => {
    const { id } = req.body; 

    try {
        // Verifica el estado del pago usando el SDK de MercadoPago
        const payment = await client.payment.findById(id);
        console.log(payment);

        if (payment && payment.status === 'approved') {
            const { userId, monto, metodo } = payment.metadata;
            await registrarPago(userId, monto, metodo);
            res.status(200).send('Notificación procesada');
        } else {
            res.status(400).send('Pago no aprobado o datos faltantes');
        }
    } catch (error) {
        console.error('Error en la notificación:', error);
        res.status(500).send('Error procesando la notificación');
    }
};


module.exports = { postPreference, registrarPagos, notificacionPago };