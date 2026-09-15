const mongoose = require('mongoose');

// ============================================================================
// Lista de reserva (espera) de un horario del calendario semanal.
// ----------------------------------------------------------------------------
// Cuando un horario está completo, el usuario puede anotarse como reserva.
// Estar en reserva NO habilita a entrenar: si alguien se baja del horario,
// entra automáticamente la reserva más antigua (orden de llegada).
// ============================================================================
const reservaSchema = new mongoose.Schema({
    day:    { type: String, required: true },
    shift:  { type: String, required: true },
    hour:   { type: String, required: true },
    user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Nombre con el que el usuario entra al calendario (username + apellido en minúsculas)
    nombre: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

// Orden de llegada dentro de cada horario
reservaSchema.index({ day: 1, shift: 1, hour: 1, createdAt: 1, _id: 1 });
// Un usuario no puede estar dos veces en la reserva del mismo horario
reservaSchema.index({ day: 1, shift: 1, hour: 1, user: 1 }, { unique: true });

const Reserva = mongoose.model('Reserva', reservaSchema);
module.exports = Reserva;
