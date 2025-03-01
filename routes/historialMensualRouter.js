const express = require('express');
const { guardarHistorialMensual, obtenerHistorialMensual } = require('../controllers/historialMensualController');

const router = express.Router();

// Ruta para guardar el historial mensual
router.post('/historial', guardarHistorialMensual);

// Ruta para obtener el historial mensual
router.get('/historial', obtenerHistorialMensual);

module.exports = router;

