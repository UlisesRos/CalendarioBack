const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { calcularPrecio } = require('../utils/precios');
const { sendEmail } = require('../utils/mailer');

// Registro del Usuario Nuevo
const register = async (req, res) => {
    const { username, userlastname, useremail, usertelefono, diasentrenamiento, userpassword, userpasswordc, documento, descuento } = req.body;

    try {

        // Validar que los campos obligatorios estén presentes
        if (!username || !userlastname || !useremail || !userpassword || !userpasswordc || !diasentrenamiento || !usertelefono || !documento) {
            return res.status(400).json({ msg: 'Todos los campos son obligatorios.' });
        }

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ useremail });
        if (existingUser) {
            return res.status(400).json({ msg: 'El usuario ya esta registrado!' });
        }

        // Validacion de la contraseña (debe tener al menos una mayúscula, un número y ser de 8 caracteres o más)
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!passwordRegex.test(userpassword)) {
            return res.status(400).json({
                msg: 'La contraseña debe tener al menos 8 caracteres, incluyendo una mayúscula y un número.',
            });
        }

        // Verificar si las contraseñas coinciden
        if (userpassword !== userpasswordc) {
            return res.status(400).json({ msg: 'Las contraseñas no coinciden.' });
        }

        // Encriptar la contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(userpassword, salt);

        // Crear un nuevo usuario
        const newUser = new User({
            username,
            userlastname,
            useremail,
            diasentrenamiento,
            usertelefono,
            documento,
            descuento,
            userpassword: hashedPassword,
            role: 'user',
            pago: false,
            metodopago: 'MP',
            fechaPago: '-',
            diasrestantes: diasentrenamiento
        });

        // Guardar en la base de datos
        await newUser.save();

        // Crear y firmar el token de autenticación
        const payload = { userId: newUser._id, role: newUser.role };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

        res.status(201).json({ token });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Error en el servidor');
    }
};

const generateToken = (user) => {
    const payload = {
        userId: user._id,
        role: user.role // Incluye el rol en el payload
    };

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Login del Usuario
const login = async (req, res) => {
    const { useremail, userpassword } = req.body;

    const usuario = useremail.toLowerCase();

    try {
        // Verificar si el usuario existe
        const user = await User.findOne({ useremail: usuario });
        if (!user) {
            return res.status(400).json({ msg: 'Credenciales inválidas' });
        }

        // Comparar contraseñas
        const isMatch = await bcrypt.compare(userpassword, user.userpassword);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Credenciales inválidas' });
        }

        // Generar el token con el rol
        const token = generateToken(user);

        res.status(200).json({ token });
    } catch (error) {
        console.error(error.message);
        res.status(500).send('Error en el servidor');
    }
};

// Obtener el usuario que esta con la sesion iniciada
const getUser = async (req, res) => {
    try {
        if(!req.user) return res.status(404).json({ msg: 'Usuario no encontrado'});
        res.json(req.user)
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al obtener el usuario' });
    }
};

//Obtener todos los usuarios
const getUsers = async (req, res) => {
    try {
        const users = await User.find()
        res.json(users)
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al obtener los usuarios' });
    }
};

//Eliminar Usuario
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deleteUser = await User.findByIdAndDelete(id)

        if(!deleteUser) {
            return res.status(404).json({ msg: 'Usuario no encontrado '})
        }

        res.status(200).json({ msg: 'Usuario eliminado correctamente', deleteUser })

    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error al eliminar el usuario'})
    }
}

// Editar Usuario
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        const { pago, fechaPago, metodopago, username, userlastname, usertelefono, diasentrenamiento } = req.body;

        // Editar los campos del usuario
        user.username = username || user.username;
        user.userlastname = userlastname || user.userlastname;
        user.usertelefono = usertelefono || user.usertelefono;
        user.diasentrenamiento = diasentrenamiento || user.diasentrenamiento;
        user.fechaPago = fechaPago || user.fechaPago;

        // Si el pago es true, agregar o actualizar el historial de pagos
        if (pago) {
            const ahora = new Date();
            const mesActual = ahora.getMonth(); // Mes actual (0-11)
            const anioActual = ahora.getFullYear(); // Año actual

            // Buscar si ya existe un pago en el mes actual
            const pagoExistenteIndex = user.historialPagos.findIndex((pago) => {
                const fechaPago = new Date(pago.fecha);
                return fechaPago.getMonth() === mesActual && fechaPago.getFullYear() === anioActual;
            });

            // Crear el nuevo pago basado en los días de entrenamiento
            const nuevoPago = {
                fecha: ahora,
                monto: calcularPrecio(user.diasentrenamiento, user.descuento),
                metodo: metodopago || 'Efectivo/Transf',
            };

            // Reemplazar el pago existente o agregar uno nuevo
            if (pagoExistenteIndex !== -1) {
                user.historialPagos[pagoExistenteIndex] = nuevoPago; // Reemplazar el pago existente
            } else {
                user.historialPagos.push(nuevoPago); // Agregar un nuevo pago
            }
        } else {
            // Si el pago es false, eliminar el registro del mes actual si existe
            const ahora = new Date();
            const mesActual = ahora.getMonth();
            const anioActual = ahora.getFullYear();

            user.historialPagos = user.historialPagos.filter((pago) => {
                const fechaPago = new Date(pago.fecha);
                return !(fechaPago.getMonth() === mesActual && fechaPago.getFullYear() === anioActual);
            });
        }

        // Actualizar los campos del usuario
        user.pago = pago;
        user.fechaPago = pago ? fechaPago : null;
        user.metodopago = pago ? metodopago : null;

        await user.save();
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ msg: 'Error al actualizar el usuario', error });
    }
};

// Endpoint para solicitar restablecimiento de contraseña
const forgotPassword = async (req, res) => {
    const { useremail } = req.body;

    try {
        // Verificar si el usuario existe
        const user = await User.findOne({ useremail });
        if (!user) {
            return res.status(400).json({ msg: 'Usuario no encontrado' });
        }

        // Generar un token JWT para restablecer la contraseña
        const resetToken = jwt.sign(
            { userId: user._id }, // Payload: ID del usuario
            process.env.JWT_SECRET, // Secreto para firmar el token
            { expiresIn: '1h' } // Expira en 1 hora
        );

        // Guardar el token en el usuario (opcional, para validaciones adicionales)
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hora
        await user.save();

        // Enviar correo electrónico con el token
        const resetUrl = `https://calendario-fuerza-integral.vercel.app/resetpasswordform?token=${resetToken}`;
        const emailText = `Para restablecer tu contraseña, haz clic en el siguiente enlace: ${resetUrl}`;

        sendEmail(user.useremail, 'Restablecer Contraseña', emailText);

        res.status(200).json({ msg: 'Se ha enviado un correo electrónico con instrucciones para restablecer tu contraseña.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ msg: 'Error en el servidor' });
    }
};

// Endpoint para restablecer la contraseña
const resetPassword = async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    try {
        // Verificar y decodificar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Buscar al usuario por el ID en el token
        const user = await User.findById(decoded.userId);
        if (!user) {
            return res.status(400).json({ msg: 'Usuario no encontrado' });
        }

        // Validar que el token no haya expirado (opcional, ya que JWT lo hace automáticamente)
        if (user.resetPasswordExpires && user.resetPasswordExpires < Date.now()) {
            return res.status(400).json({ msg: 'El token ha expirado' });
        }

        // Validar la nueva contraseña
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
        if (!passwordRegex.test(newPassword)) {
            return res.status(400).json({
                msg: 'La contraseña debe tener al menos 8 caracteres, incluyendo una mayúscula y un número.',
            });
        }

        // Encriptar la nueva contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Actualizar la contraseña y limpiar el token
        user.userpassword = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;

        await user.save();

        res.status(200).json({ msg: 'Contraseña restablecida correctamente.' });
    } catch (error) {
        console.error(error);
        if (error.name === 'TokenExpiredError') {
            return res.status(400).json({ msg: 'El token ha expirado' });
        }
        res.status(500).json({ msg: 'Error en el servidor' });
    }
};

module.exports = { login, register, getUser, getUsers, deleteUser, updateUser, forgotPassword, resetPassword };
