const cron = require('node-cron');
const User = require('../models/User');
const { guardarHistorialMensualAutomatico } = require('../controllers/historialMensualController');
const enviarRecordatorioPago = require('./enviarRecordatorioPago');

const ReinicioMensual = () => {

    // Programar el cron para el primer día de cada mes a las 00:00
    cron.schedule('0 0 1 * *', async () => {
        try {
            console.log('Ejecutando tarea CRON: Reseteo mensual de pagos');
    
            // Actualizar todos los clientes para que `pago` sea `false` y `fechaPago` sea "-"
            await User.updateMany(
                {}, // Aplica a todos los documentos
                { $set: { pago: false, fechaPago: '-' } }
            );
    
            console.log('Pagos reseteados exitosamente.');
        } catch (error) {
            console.error('Error al ejecutar el CRON:', error);
        }
    });

}

const ReinicioHistorialMensual = () => {

    const esUltimoDiaDelMes = () => {
        const hoy = new Date();
        const mañana = new Date(hoy);
        mañana.setDate(hoy.getDate() + 1);
    
        return mañana.getDate() === 1; // Si mañana es el día 1, hoy es el último día del mes
    };

    // Programar la tarea para el último día del mes a las 23:59
    cron.schedule('59 23 28-31 * *', () => {

        if (esUltimoDiaDelMes()) {           
            console.log('Ejecutando tarea programada para guardar el historial mensual...');
            guardarHistorialMensualAutomatico();
        } else {
            console.log('Hoy no es el último día del mes. No se ejecuta la tarea del historial mensual.');
        }
        
    });

}

const enviarRecordatorioPagoMensual = () => {

    // Programar el cron para el día 10 de cada mes a las 9:00 AM
    cron.schedule('0 9 11 * *', () => {
        console.log('Ejecutando recordatorio de pago...');
        enviarRecordatorioPago();
    }, {
        timezone: 'America/Argentina/Buenos_Aires' // Ajuste de zona horaria
    });

};

module.exports = { ReinicioMensual, ReinicioHistorialMensual, enviarRecordatorioPagoMensual };
