const HistorialMensual = require('../models/HistorialMensual');
const User = require('../models/User.js');
const { PRECIOS, DESCUENTO } = require('../utils/precios.js');

// Guardar Historial Mensual
const guardarHistorialMensual = async (req, res) => {
    const { mes, importeIngresado, importeNoIngresado, cantidadClientes, clientesActivos, clientesSinPagar } = req.body;

    try {
        const nuevoHistorial = new HistorialMensual({
            mes,
            importeIngresado,
            importeNoIngresado,
            cantidadClientes,
            clientesActivos,
            clientesSinPagar
        });

        await nuevoHistorial.save();
        res.status(201).json({
            mensaje: 'Historial mensual guardado correctamente'
        });
    } catch (error) {
        console.error('Error al guardar el historial mensual:', error);
        res.status(500).json({
            mensaje: 'Error al guardar el historial mensual'
        });
    }
};

// Obtener el historial mensual
const obtenerHistorialMensual = async (req, res) => {
    try {
        
        const historial = await HistorialMensual.find().sort({ mes: -1 });
        res.status(200).json(historial);

    } catch (error) {
        console.error('Error al obtener el historial mensual:', error);
        res.status(500).json({
            mensaje: 'Error al obtener el historial mensual'
        });
    };
};

const guardarHistorialMensualAutomatico = async () => {

    const currentDate = new Date();
    const mesActual = `${String(currentDate.getMonth() + 1).padStart(2, '0')}-${currentDate.getFullYear()}`; 

    try {
        // Verificar si ya existe un historial para el mes actual
        const historialExistente = await HistorialMensual.findOne({ mes: mesActual });

        if (historialExistente) {
            console.log(`El historial para el mes ${mesActual} ya existe. No se guardará nuevamente.`);
            return;
        }

        // Obtener todos los usuarios
        const usuarios = await User.find({ role: { $ne: 'admin' } }); // Excluye a los administradores

        // Calcular los datos mensuales
        let importeIngresado = 0;
        let importeNoIngresado = 0;
        const clientesSinPagar = [];
        const clientesActivos = []; // Ahora será un array de objetos

        usuarios.forEach(user => {
            const monto = PRECIOS[user.diasentrenamiento] || 0;
            const montoConDescuento = user.descuento ? monto - monto * DESCUENTO : monto;

            if (user.pago) {
                importeIngresado += montoConDescuento;
                // Agregar el cliente activo con nombre y apellido
                clientesActivos.push({ 
                    nombre: user.username, 
                    apellido: user.userlastname 
                });
            } else {
                importeNoIngresado += montoConDescuento;
                clientesSinPagar.push({ 
                    nombre: user.username, 
                    apellido: user.userlastname 
                });
            }
        });

        const cantidadClientes = usuarios.length;

        // Guardar el historial en la base de datos
        const nuevoHistorial = new HistorialMensual({
            mes: mesActual,
            importeIngresado,
            importeNoIngresado,
            cantidadClientes,
            clientesActivos, // Ahora es un array de objetos
            clientesSinPagar
        });

        await nuevoHistorial.save();
        console.log(`Historial mensual guardado para el mes: ${mesActual}`);
    } catch (error) {
        console.error('Error guardando el historial mensual:', error);
    };
    
}

module.exports = {
    guardarHistorialMensual,
    obtenerHistorialMensual,
    guardarHistorialMensualAutomatico
};