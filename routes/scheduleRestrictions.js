const express = require('express');
const mongoose = require('mongoose');
const routerRestricciones = express.Router();
const ScheduleRestriction = require('../models/ScheduleRestriction');
const User = require('../models/User');
const Calendar = require('../models/Calendar');
const AdminCalendar = require('../models/AdminCalendar');
const Reserva = require('../models/Reserva');
const isAdmin = require('../middleware/isAdmin');
const { quitarNombreDelHorario } = require('../utils/reservas');
const authenticate = require('../middleware/authenticate');
const {
    MODOS_VALIDOS,
    getFullName,
    normalizeSlots,
    isSlotBlockedFor,
} = require('../utils/scheduleRestrictions');

// ============================================================================
// RESTRICCIONES DE HORARIOS POR USUARIO
// ============================================================================

const esLaPersona = (persona, nombreCompleto) =>
    typeof persona === 'string' && persona.trim().toLowerCase() === nombreCompleto;

// Horarios prohibidos para la restricción en los que la persona está anotada
const buscarTurnosRestringidos = (calendario, restriction, nombreCompleto) => {
    const encontrados = [];

    Object.keys(calendario).forEach((day) => {
        const dataDia = calendario[day];
        if (!dataDia || typeof dataDia !== 'object' || Array.isArray(dataDia)) return;

        Object.keys(dataDia).forEach((shift) => {
            const dataTurno = dataDia[shift];
            if (!dataTurno || typeof dataTurno !== 'object' || Array.isArray(dataTurno)) return;

            Object.keys(dataTurno).forEach((hour) => {
                const lugares = dataTurno[hour];
                if (!Array.isArray(lugares)) return;
                if (!isSlotBlockedFor(restriction, day, shift, hour)) return;
                if (lugares.some((persona) => esLaPersona(persona, nombreCompleto))) {
                    encontrados.push({ day, shift, hour, lugares });
                }
            });
        });
    });

    return encontrados;
};

// ---------------------------------------------------------------------------
// Quita al usuario de los turnos que le quedaron restringidos.
// Recorre el calendario (semanal o base) y pone en null los lugares ocupados
// por esa persona dentro de horarios que ahora tiene prohibidos.
// ---------------------------------------------------------------------------
const limpiarTurnosRestringidos = async (Model, restriction) => {
    const nombreCompleto = (restriction.nombreCompleto || '').trim().toLowerCase();
    if (!nombreCompleto) return [];

    const calendario = await Model.findOne().lean();
    if (!calendario) return [];

    const encontrados = buscarTurnosRestringidos(calendario, restriction, nombreCompleto);
    const cambios = {};
    encontrados.forEach(({ day, shift, hour, lugares }) => {
        cambios[`${day}.${shift}.${hour}`] = lugares.map((persona) => (esLaPersona(persona, nombreCompleto) ? null : persona));
    });

    if (Object.keys(cambios).length > 0) {
        await Model.collection.updateOne({ _id: calendario._id }, { $set: cambios });
    }

    return encontrados.map(({ day, shift, hour }) => ({ day, shift, hour }));
};

// ---------------------------------------------------------------------------
// Igual que la anterior pero para el calendario semanal: se quita horario por
// horario con escritura atómica (no pisa inscripciones simultáneas) y cada
// lugar liberado lo ocupa la primera persona de la lista de reserva.
// ---------------------------------------------------------------------------
const liberarTurnosSemanalesRestringidos = async (restriction) => {
    const nombreCompleto = (restriction.nombreCompleto || '').trim().toLowerCase();
    if (!nombreCompleto) return [];

    const calendario = await Calendar.findOne().lean();
    if (!calendario) return [];

    const liberados = [];
    for (const { day, shift, hour } of buscarTurnosRestringidos(calendario, restriction, nombreCompleto)) {
        try {
            if (await quitarNombreDelHorario({ day, shift, hour }, nombreCompleto)) liberados.push({ day, shift, hour });
        } catch (error) {
            console.error(`No se pudo liberar ${day} ${shift} ${hour} por la restricción:`, error.message);
        }
    }
    return liberados;
};

// Quita las reservas del usuario en horarios que la restricción le prohíbe
const quitarReservasRestringidas = async (restriction, userId) => {
    const reservas = await Reserva.find({ user: userId }).lean();
    const bloqueadas = reservas
        .filter((reserva) => isSlotBlockedFor(restriction, reserva.day, reserva.shift, reserva.hour))
        .map((reserva) => reserva._id);

    if (bloqueadas.length > 0) await Reserva.deleteMany({ _id: { $in: bloqueadas } });
    return bloqueadas.length;
};

// Evita errores 500 cuando llega un id con formato inválido
const esIdValido = (id) => mongoose.Types.ObjectId.isValid(id);

// ---------------------------------------------------------------------------
// Restricción del usuario logueado (la usa el calendario del usuario)
// ---------------------------------------------------------------------------
routerRestricciones.get('/api/schedule-restrictions/me', authenticate, async (req, res) => {
    try {
        // Los admins no tienen restricciones
        if (req.user.role === 'admin') {
            return res.json({ tieneRestriccion: false, mode: null, slots: [], reason: '' });
        }

        const restriction = await ScheduleRestriction.findOne({ user: req.user._id });

        if (!restriction || restriction.activo === false || !restriction.slots?.length) {
            return res.json({ tieneRestriccion: false, mode: null, slots: [], reason: '' });
        }

        res.json({
            tieneRestriccion: true,
            mode: restriction.mode,
            slots: restriction.slots,
            reason: restriction.reason || '',
        });
    } catch (error) {
        console.error('Error obteniendo la restricción del usuario:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// Listado completo de restricciones (Admin)
// ---------------------------------------------------------------------------
routerRestricciones.get('/api/schedule-restrictions', isAdmin, async (req, res) => {
    try {
        const restricciones = await ScheduleRestriction.find()
            .populate('user', 'username userlastname useremail documento')
            .sort({ updatedAt: -1 });

        res.json(restricciones);
    } catch (error) {
        console.error('Error listando las restricciones:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// Restricción de un usuario puntual (Admin)
// ---------------------------------------------------------------------------
routerRestricciones.get('/api/schedule-restrictions/user/:userId', isAdmin, async (req, res) => {
    try {
        if (!esIdValido(req.params.userId)) return res.json(null);

        const restriction = await ScheduleRestriction.findOne({ user: req.params.userId })
            .populate('user', 'username userlastname useremail documento');

        if (!restriction) return res.json(null);
        res.json(restriction);
    } catch (error) {
        console.error('Error obteniendo la restricción del usuario:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// Crear o actualizar la restricción de un usuario (Admin)
// ---------------------------------------------------------------------------
routerRestricciones.post('/api/schedule-restrictions', isAdmin, async (req, res) => {
    const { userId, mode, slots, reason, activo, limpiarTurnos } = req.body || {};

    try {
        if (!userId || !esIdValido(userId)) {
            return res.status(400).json({ error: 'Tenés que elegir un usuario.' });
        }

        if (!MODOS_VALIDOS.includes(mode)) {
            return res.status(400).json({ error: 'El tipo de restricción no es válido.' });
        }

        const usuario = await User.findById(userId).select('username userlastname role');
        if (!usuario) {
            return res.status(404).json({ error: 'El usuario no existe.' });
        }

        if (usuario.role === 'admin') {
            return res.status(400).json({ error: 'No se pueden restringir los horarios de un administrador.' });
        }

        const slotsLimpios = normalizeSlots(slots);
        if (slotsLimpios.length === 0) {
            return res.status(400).json({ error: 'Seleccioná al menos un horario para guardar la restricción.' });
        }

        const restriction = await ScheduleRestriction.findOneAndUpdate(
            { user: userId },
            {
                $set: {
                    user: userId,
                    nombreCompleto: getFullName(usuario),
                    mode,
                    slots: slotsLimpios,
                    reason: (reason || '').trim(),
                    activo: activo === undefined ? true : !!activo,
                    updatedAt: new Date(),
                },
                $setOnInsert: { createdAt: new Date() },
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).populate('user', 'username userlastname useremail documento');

        // Si la restricción quedó activa, liberamos los turnos que el usuario
        // ya tenía reservados y ahora le quedan prohibidos
        let turnosLiberados = [];
        if (restriction.activo) {
            // Las reservas en horarios que ahora le quedan prohibidos se quitan siempre
            // (una reserva no es un turno tomado, así que no depende de "limpiarTurnos")
            await quitarReservasRestringidas(restriction, userId);
        }

        if (restriction.activo && limpiarTurnos !== false) {
            const [semanal, base] = await Promise.all([
                liberarTurnosSemanalesRestringidos(restriction),
                limpiarTurnosRestringidos(AdminCalendar, restriction),
            ]);
            turnosLiberados = semanal;

            if (semanal.length > 0 || base.length > 0) {
                const calendarioActualizado = await Calendar.findOne();
                if (req.io) req.io.emit('updateCalendar', calendarioActualizado);
            }
        }

        res.status(200).json({
            message: 'Restricción guardada correctamente.',
            data: restriction,
            turnosLiberados,
        });
    } catch (error) {
        console.error('Error guardando la restricción:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// Activar / pausar una restricción sin perder la configuración (Admin)
// ---------------------------------------------------------------------------
routerRestricciones.patch('/api/schedule-restrictions/:id/toggle', isAdmin, async (req, res) => {
    try {
        if (!esIdValido(req.params.id)) return res.status(404).json({ error: 'Restricción no encontrada.' });

        const restriction = await ScheduleRestriction.findById(req.params.id);
        if (!restriction) return res.status(404).json({ error: 'Restricción no encontrada.' });

        restriction.activo = !restriction.activo;
        restriction.updatedAt = new Date();
        await restriction.save();

        // Al reactivarla, las reservas en horarios prohibidos dejan de tener sentido
        if (restriction.activo) await quitarReservasRestringidas(restriction, restriction.user);

        await restriction.populate('user', 'username userlastname useremail documento');

        res.status(200).json({
            message: restriction.activo ? 'Restricción activada.' : 'Restricción pausada.',
            data: restriction,
        });
    } catch (error) {
        console.error('Error cambiando el estado de la restricción:', error);
        res.status(500).json({ error: error.message });
    }
});

// ---------------------------------------------------------------------------
// Eliminar la restricción de un usuario (Admin)
// ---------------------------------------------------------------------------
routerRestricciones.delete('/api/schedule-restrictions/:id', isAdmin, async (req, res) => {
    try {
        if (!esIdValido(req.params.id)) return res.status(404).json({ error: 'Restricción no encontrada.' });

        const eliminada = await ScheduleRestriction.findByIdAndDelete(req.params.id);
        if (!eliminada) return res.status(404).json({ error: 'Restricción no encontrada.' });

        res.status(200).json({ message: 'Restricción eliminada. El usuario puede anotarse en cualquier horario.' });
    } catch (error) {
        console.error('Error eliminando la restricción:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = { routerRestricciones, limpiarTurnosRestringidos };
