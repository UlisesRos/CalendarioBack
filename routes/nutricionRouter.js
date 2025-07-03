const express = require('express');
const router = express.Router();
const { getAllNutricionTurns, addNutricionTurn, deleteTurn, turnUser } = require('../controllers/nutricionController');

// Obtener todos los turnos de nutrición
router.get('/', getAllNutricionTurns);

// Obtener Turno del usuario
router.get('/mis-turnos', turnUser)

// Anotar un turno de nutrición
router.post('/reservar', addNutricionTurn);

// Cancelar un turno de nutrición
router.delete('/cancelar', deleteTurn);

module.exports = router;