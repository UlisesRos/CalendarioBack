const express = require('express')
const { postPreference, registrarPagos, notificacionPago } = require('../controllers/paymentController');


const router = express.Router();

// Ruta de preferencia de pago
router.post('/create_preference', postPreference);

// Ruta de actualizacion de fecha de pago y envio de mail
router.post('/registrarpago', registrarPagos)

// Ruta para manejar la notificacion de pago
router.post('/notificacion', notificacionPago)

module.exports = router