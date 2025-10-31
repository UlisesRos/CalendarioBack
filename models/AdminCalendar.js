const mongoose = require('mongoose');

const adminCalendarSchema = new mongoose.Schema({
    lunes: {
        mañana: {
            7: [String],
            8: [String],
            9: [String],
            10: [String],
            11: [String],
            12: [String],
        },
        tarde: {
            13: [String],
            14: [String],
            15: [String],
            16: [String],
            17: [String],
            18: [String],
            19: [String],
            20: [String],
        }
    },
    martes: {
        mañana: {
            7: [String],
            8: [String],
            9: [String],
            10: [String],
            11: [String],
            12: [String],
        },
        tarde: {
            13: [String],
            14: [String],
            15: [String],
            16: [String],
            17: [String],
            18: [String],
            19: [String],
            20: [String],
        }
    },
    miércoles: {
        mañana: {
            7: [String],
            8: [String],
            9: [String],
            10: [String],
            11: [String],
            12: [String],
        },
        tarde: {
            13: [String],
            14: [String],
            15: [String],
            16: [String],
            17: [String],
            18: [String],
            19: [String],
            20: [String],
        }
    },
    jueves: {
        mañana: {
            7: [String],
            8: [String],
            9: [String],
            10: [String],
            11: [String],
            12: [String],
        },
        tarde: {
            13: [String],
            14: [String],
            15: [String],
            16: [String],
            17: [String],
            18: [String],
            19: [String],
            20: [String],
        }
    },
    viernes: {
        mañana: {
            7: [String],
            8: [String],
            9: [String],
            10: [String],
            11: [String],
            12: [String],
        },
        tarde: {
            13: [String],
            14: [String],
            15: [String],
            16: [String],
            17: [String],
            18: [String],
            19: [String],
            20: [String],
        }
    },
    sábado: {
        mañana: {
            9: [String],
            10: [String],
            11: [String],
            12: [String],
        }
    },
}, { versionKey: false });

adminCalendarSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v
        return ret
    }
})

const AdminCalendar = mongoose.model('AdminCalendar', adminCalendarSchema);
module.exports = AdminCalendar
