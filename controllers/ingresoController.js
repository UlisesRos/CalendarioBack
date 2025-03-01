const User = require('../models/User');

const ingresoController = async (req, res) => {
    const { documento } = req.body;

    try {
        const currentDate = new Date();
        const currentDay = currentDate.getDate(); // Extraemos el día del mes
        const user = await User.findOne({ documento });

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
                    yaIngresadoHoy: true // Nuevo campo para indicar que ya ingresó hoy
                });
            }
        }

        // Si estamos fuera del rango del 1 al 10, verifica si el cliente ha pagado
        if (currentDay < 1 || currentDay > 10) {
            if (!user.pago) {
                return res.status(400).json({
                    msg: 'El cliente no ha pagado',
                    username: user.username,
                    userlastname: user.userlastname
                });
            }
        }

        const diasRestantes = user.diasrestantes;

        if (diasRestantes <= 0) {
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
            yaIngresadoHoy: false // Nuevo campo para indicar que no ha ingresado hoy
        });

    } catch (error) {
        res.status(500).json({ mensaje: "Error al verificar el cliente", error });
    }
}

module.exports = ingresoController