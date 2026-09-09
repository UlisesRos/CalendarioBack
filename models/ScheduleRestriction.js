const mongoose = require('mongoose');

// ============================================================================
// Restricción de horarios por usuario
// ----------------------------------------------------------------------------
// Un documento por usuario. Permite dos modos:
//   - 'allow' : el usuario SÓLO puede anotarse en los horarios de "slots"
//   - 'block' : el usuario NO puede anotarse en los horarios de "slots"
// Cada slot tiene el formato "día.turno.hora" -> "lunes.mañana.9"
// ============================================================================

const scheduleRestrictionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    // Copia del nombre completo en minúsculas (así queda guardado en el calendario)
    nombreCompleto: {
        type: String,
        default: '',
    },
    mode: {
        type: String,
        enum: ['allow', 'block'],
        default: 'block',
    },
    slots: {
        type: [String],
        default: [],
    },
    reason: {
        type: String,
        default: '',
    },
    activo: {
        type: Boolean,
        default: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
}, { versionKey: false });

scheduleRestrictionSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    }
});

const ScheduleRestriction = mongoose.model('ScheduleRestriction', scheduleRestrictionSchema);
module.exports = ScheduleRestriction;
