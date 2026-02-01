const express = require('express')
const { postPreference, registrarPagos, notificacionPago } = require('../controllers/paymentController');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

/**
 * Rutas de Mercado Pago
 */

// Ruta para crear una preferencia de pago (requiere autenticación)
// El usuario envía sus datos y se crea el link de pago
router.post('/create_preference', authenticate, postPreference);

// Ruta para registrar un pago después de la redirección (NO requiere autenticación)
// Se llama cuando el usuario regresa desde Mercado Pago y los datos vienen en la URL
router.post('/registrarpago', registrarPagos);

// Webhook de Mercado Pago (NO requiere autenticación porque MP lo llama directamente)
// Mercado Pago notifica automáticamente al backend cuando hay un pago confirmado
router.post('/webhook', notificacionPago);

module.exports = router