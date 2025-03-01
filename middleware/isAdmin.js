const jwt = require('jsonwebtoken');

const isAdmin = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(403).json({ msg: 'Acceso denegado: No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            return res.status(403).json({ msg: 'Acceso denegado: No eres admin' });
        }

        req.user = decoded; // Añade los datos del token al request
        next();
    } catch (error) {
        console.error(error);
        res.status(401).json({ msg: 'Token inválido' });
    }
};

module.exports = isAdmin