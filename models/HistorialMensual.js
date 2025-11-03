const mongoose = require('mongoose');

const HistorialMensualSchema = new mongoose.Schema({
    mes: {
        type: String,
        require: true
    }, // Formato: 'YYYY-MM'
    importeIngresado: {
        type: Number,
        require: true
    },
    importeNoIngresado: {
        type: Number,
        require: true
    },
    cantidadClientes: {
        type: Number,
        require: true
    },
    clientesActivos: [{
        nombre: { type: String, required: true },
        apellido: { type: String, required: true }
    }],
    clientesSinPagar: [{
        nombre: { type: String, required: true },
        apellido: { type: String, required: true }
    }] 
});

module.exports = mongoose.model('HistorialMensual', HistorialMensualSchema);