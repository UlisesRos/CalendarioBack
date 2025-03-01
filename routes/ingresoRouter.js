const express = require('express');
const ingresoController = require('../controllers/ingresoController')

const router = express.Router()

// Verificacion de ingreso
router.post('/ingresousuario', ingresoController);

module.exports = router