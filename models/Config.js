const mongoose = require('mongoose');

const ConfigSchema = new mongoose.Schema({
    precios: {
        1: { type: Number, required: true },
        2: { type: Number, required: true },
        3: { type: Number, required: true },
        4: { type: Number, required: true },
        5: { type: Number, required: true },
    },
    descuento: { type: Number, required: true, default: 0.1 }
});

module.exports = mongoose.model('Config', ConfigSchema);
