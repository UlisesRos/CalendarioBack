const jwt = require('jsonwebtoken');
const User = require('../models/User');


const authenticate = async (req, res, next) => {

    const token = req.headers['authorization']?.split(' ')[1]; //Obtener el token
    if(!token) return res.status(401).json({ msg: 'No se proporcionó token'});

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById( decoded.userId).select('username userlastname useremail role diasentrenamiento usertelefono pago metodopago fechaPago descuento diasrestantes historialPagos');
        if(!user) return res.status(404).json({ msg: 'Usuario no encontrado'});

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ msg: 'Token no valido' })
    }
}

module.exports = authenticate