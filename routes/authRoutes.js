const express = require('express');
const { register, login, getUser, getUsers, deleteUser, updateUser, forgotPassword, resetPassword } = require('../controllers/authController')
const authenticate = require('../middleware/authenticate');
const isAdmin = require('../middleware/isAdmin');

const router = express.Router()

//Creacion de Rutas
// Ruta de registro
router.post('/register', register);

// Ruta de login
router.post('/login', login);

// Mostrar el usuario Registrado
router.get('/user', authenticate, getUser)

// Mostrar todos los usuarios (sólo admin)
router.get('/users', authenticate, isAdmin, getUsers)

// Eliminar usuario (sólo admin)
router.delete('/userdelete/:id', authenticate, isAdmin, deleteUser)

// Actualizar usuario (sólo admin)
router.put('/userupdate/:id', authenticate, isAdmin, updateUser)

// Restablecer contraseña
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

module.exports = router;