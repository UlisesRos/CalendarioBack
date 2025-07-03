const mongoose = require('mongoose');

const nutricionTurnSchema = new mongoose.Schema({
    fecha: { type: String, required: true },
    hora: { type: String, required: true }, 
    usuario: {
        nombre: String,
        email: String,
        celular: String,
    },
    profe: { type: String, required: true }
});

module.exports = mongoose.model('NutricionTurn', nutricionTurnSchema);
