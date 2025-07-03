const cron = require('node-cron');
const User = require('../models/User');
const { format, isBefore, subMonths, parseISO } = require('date-fns');
const { es } = require('date-fns/locale');
const NutricionTurn = require('../models/NutricionTurn')
const { guardarHistorialMensualAutomatico } = require('../controllers/historialMensualController');
const enviarRecordatorioPago = require('./enviarRecordatorioPago');
const { sendEmail } = require('../utils/mailer');

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

    cron.schedule('0 0 1 * *', async () => {
        try {
            const hoy = new Date();
            const limite = subMonths(hoy, 2); // fecha 2 meses atrás

            // Traer todos los turnos viejos
            const turnosAntiguos = await NutricionTurn.find();

            const turnosAEliminar = turnosAntiguos.filter(t =>
            isBefore(parseISO(t.fecha), limite)
            );

            if (turnosAEliminar.length > 0) {
                const bulkOps = turnosAEliminar.map(t => ({
                    deleteOne: { filter: { fecha: t.fecha, hora: t.hora } }
            }));

            await NutricionTurn.bulkWrite(bulkOps);
                console.log(`[LIMPIEZA] ${bulkOps.length} turnos eliminados automáticamente.`);
            } else {
                console.log('[LIMPIEZA] No hay turnos viejos para eliminar.');
            }
        } catch (err) {
            console.error('[LIMPIEZA] Error al eliminar turnos viejos:', err);
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

const recordatorioTurnoNutricion = () => {
    
    // RECORDAR UN DIA ANTES EL TURNO DE NUTRICION
    cron.schedule('0 8 * * *', async () => {
    try {
        const mañana = addDays(new Date(), 1);

        const turnos = await NutricionTurn.find();
        const turnosDeMañana = turnos.filter(t => {
            const fechaTurno = parseISO(t.fecha);
            return isSameDay(fechaTurno, mañana);
        });

        for (const t of turnosDeMañana) {
            sendEmail(
                t.usuario.email,
                '⏰ Recordatorio de Turno de Nutrición',
                `Hola ${t.usuario.nombre}, te recordamos que tenés un turno mañana ${format(parseISO(t.fecha), "EEEE d 'de' MMMM", { locale: es })} a las ${t.hora}.`
            );
        }

        console.log(`[RECORDATORIO] ${turnosDeMañana.length} mails enviados.`);
    } catch (err) {
        console.error('Error enviando recordatorios:', err);
    }
});
}

module.exports = { ReinicioMensual, ReinicioHistorialMensual, enviarRecordatorioPagoMensual, recordatorioTurnoNutricion };
