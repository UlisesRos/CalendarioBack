const mongoose = require('mongoose');

const calendarSchema = new mongoose.Schema({
    lunes: {
        mañana: {
            8: [String],
            9: [String],
            10: [String],
            11: [String]
        },
        tarde: {
            16: [String],
            17: [String],
            18: [String],
            19: [String]
        }
    },
    martes: {
        mañana: {
            8: [String],
            9: [String],
            10: [String],
            11: [String]
        },
        tarde: {
            16: [String],
            17: [String],
            18: [String],
            19: [String]
        }
    },
    miércoles: {
        mañana: {
            8: [String],
            9: [String],
            10: [String],
            11: [String]
        },
        tarde: {
            16: [String],
            17: [String],
            18: [String],
            19: [String]
        }
    },
    jueves: {
        mañana: {
            8: [String],
            9: [String],
            10: [String],
            11: [String]
        },
        tarde: {
            16: [String],
            17: [String],
            18: [String],
            19: [String]
        }
    },
    viernes: {
        mañana: {
            8: [String],
            9: [String],
            10: [String],
            11: [String]
        },
        tarde: {
            16: [String],
            17: [String],
            18: [String],
            19: [String]
        }
    },
    sábado: {
        mañana: {
            930: [String],
            1030: [String],
            1130: [String]
        }
    },
}, { versionKey: false });

calendarSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v
        return ret
    }
})

const Calendar = mongoose.model('Calendar', calendarSchema);
module.exports = Calendar
