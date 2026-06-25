const mongoose = require('mongoose');

const closedScheduleSchema = new mongoose.Schema({
    day: {
        type: String,
        required: true,
        enum: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    },
    closedDay: {
        type: Boolean,
        default: false,
    },
    // Formato: ["tarde.18", "mañana.9"] - shift.hour
    closedHours: {
        type: [String],
        default: [],
    },
    reason: {
        type: String,
        default: '',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
}, { versionKey: false });

closedScheduleSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        return ret;
    }
});

const ClosedSchedule = mongoose.model('ClosedSchedule', closedScheduleSchema);
module.exports = ClosedSchedule;
