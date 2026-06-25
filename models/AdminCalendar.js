const mongoose = require('mongoose');

// Se usa Schema.Types.Mixed para que los turnos (mañana/tarde) acepten
// cualquier clave de hora dinámica (no solo las predefinidas).
const adminCalendarSchema = new mongoose.Schema({
    lunes: {
        mañana: { type: mongoose.Schema.Types.Mixed, default: {} },
        tarde:  { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    martes: {
        mañana: { type: mongoose.Schema.Types.Mixed, default: {} },
        tarde:  { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    miércoles: {
        mañana: { type: mongoose.Schema.Types.Mixed, default: {} },
        tarde:  { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    jueves: {
        mañana: { type: mongoose.Schema.Types.Mixed, default: {} },
        tarde:  { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    viernes: {
        mañana: { type: mongoose.Schema.Types.Mixed, default: {} },
        tarde:  { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    sábado: {
        mañana: { type: mongoose.Schema.Types.Mixed, default: {} },
        tarde:  { type: mongoose.Schema.Types.Mixed, default: {} },
    },
}, { strict: false, versionKey: false });

adminCalendarSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v
        return ret
    }
})

const AdminCalendar = mongoose.model('AdminCalendar', adminCalendarSchema);
module.exports = AdminCalendar
