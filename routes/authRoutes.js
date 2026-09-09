const express = require('express');
const { register, login, getUser, getUsers, deleteUser, updateUser, forgotPassword, resetPassword } = require('../controllers/authController')
const authenticate = require('../middleware/authenticate');

const router = express.Router()

//Creacion de Rutas
// Ruta de registro
router.post('/register', register);

// Ruta de login
router.post('/login', login);

// Mostrar el usuario Registrado
router.get('/user', authenticate, getUser)

// Mostrar todos los usuarios
router.get('/users', authenticate, getUsers)

// Eliminar usuario
router.delete('/userdelete/:id', deleteUser)

// Actualizar usuario
router.put('/userupdate/:id', updateUser)

// Restablecer contraseña
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

module.exports = router;