const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        require: true
    },
    userlastname: {
        type: String,
        require: true
    },
    useremail: {
        type: String,
        require: true,
        unique: true
    },
    documento: {
        type: String,
        unique: true,
        require: true
    },
    userpassword: {
        type: String,
        require: true
    },
    userpaswordc: {
        type: String,
        require: true
    },
    role: {
        type: String,
        default: 'user'
    },
    diasentrenamiento: {
        type: Number,
        require: true
    },
    diasrestantes: {
        type: Number,
        default: 0
    },
    usertelefono: {
        type: Number,
        require: true
    },
    pago: {
        type: Boolean,
        default: false
    },
    metodopago: {
        type: String,
        default: 'MP'
    },
    fechaPago: {
        type: String,
        default: '-'
    },
    descuento: {
        type: String,
        require: false
    },
    ultimoIngreso: {
        type: Date
    },
    historialPagos: [
        {
            fecha: {
                type: Date,
                default: Date.now()
            },
            monto: {
                type: Number,
                require: true
            },
            metodo: {
                type: String,
                default: 'MP'
            }
        }
    ]
},
{
    timestamps: {
        createdAt: 'created_at',
        updatedAt: false
    },
    versionKey: false
});

const User = mongoose.model('User', UserSchema);

module.exports = User;