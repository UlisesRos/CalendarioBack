const User = require('../models/User');

const DIA_INICIO_PAGO = 1;
const DIA_FIN_PAGO = 10;

const ingresoController = async (req, res) => {
    const { documento } = req.body;

    // Validar que el documento esté presente
    if (!documento) {
        return res.status(400).json({ msg: 'El campo documento es requerido' });
    }

    try {
        const currentDate = new Date();
        const currentDay = currentDate.getDate();
        const user = await User.findOne({ documento }, 'username userlastname ultimoIngreso pago diasrestantes diasentrenamiento');

        if (!user) {
            return res.status(404).json({ msg: 'Usuario no encontrado' });
        }

        // Verificar si el cliente ya ingresó hoy
        if (user.ultimoIngreso) {
            const lastIngresoDate = new Date(user.ultimoIngreso);
            if (lastIngresoDate.toDateString() === currentDate.toDateString()) {
                return res.status(400).json({
                    msg: 'Ya has ingresado hoy',
                    username: user.username,
                    userlastname: user.userlastname,
                    yaIngresadoHoy: true
                });
            }
        }

        // Verificar si el cliente ha pagado (fuera del rango del 1 al 10)
        if (currentDay < DIA_INICIO_PAGO || currentDay > DIA_FIN_PAGO) {
            if (!user.pago) {
                return res.status(400).json({
                    msg: 'El cliente no ha pagado',
                    username: user.username,
                    userlastname: user.userlastname
                });
            }
        }

        // Verificar días restantes
        if (user.diasrestantes <= 0) {
            return res.status(400).json({
                msg: 'El cliente no tiene días disponibles',
                username: user.username,
                userlastname: user.userlastname
            });
        }

        // Actualizar el último ingreso y reducir los días restantes
        user.diasrestantes -= 1;
        user.ultimoIngreso = currentDate;
        await user.save();

        res.status(200).json({
            msg: 'Verificación exitosa',
            diasRestantes: user.diasrestantes,
            diasEntrenamiento: user.diasentrenamiento,
            username: user.username,
            userlastname: user.userlastname,
            yaIngresadoHoy: false
        });

    } catch (error) {
        res.status(500).json({ mensaje: "Error al verificar el cliente", error });
    }
}

module.exports = ingresoController;