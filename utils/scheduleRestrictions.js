// ============================================================================
// Helpers para las restricciones de horarios por usuario
// ----------------------------------------------------------------------------
// Un "slot" es la combinación día.turno.hora  ->  "lunes.mañana.9"
// Los modos posibles de una restricción son:
//   - 'allow' : el usuario SÓLO puede anotarse en los slots de la lista
//   - 'block' : el usuario NO puede anotarse en los slots de la lista
// ============================================================================

const DIAS_VALIDOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const TURNOS_VALIDOS = ['mañana', 'tarde'];
const MODOS_VALIDOS = ['allow', 'block'];

// Arma la clave de un slot de forma consistente en todo el proyecto
const buildSlotKey = (day, shift, hour) => `${day}.${shift}.${String(hour).trim()}`;

// Nombre con el que el usuario queda guardado dentro del calendario
const getFullName = (user) => {
    if (!user) return '';
    return `${user.username || ''} ${user.userlastname || ''}`.trim().toLowerCase();
};

// Valida y limpia la lista de slots que llega desde el panel de administración
const normalizeSlots = (slots) => {
    if (!Array.isArray(slots)) return [];

    const limpios = slots
        .filter((slot) => typeof slot === 'string')
        .map((slot) => slot.trim())
        .filter((slot) => {
            const partes = slot.split('.');
            if (partes.length !== 3) return false;

            const [day, shift, hour] = partes;
            if (!DIAS_VALIDOS.includes(day)) return false;
            if (!TURNOS_VALIDOS.includes(shift)) return false;

            const hourNum = Number(hour);
            return Number.isInteger(hourNum) && hourNum >= 0 && hourNum <= 23;
        })
        .map((slot) => {
            const [day, shift, hour] = slot.split('.');
            return buildSlotKey(day, shift, Number(hour));
        });

    return [...new Set(limpios)];
};

// Indica si una restricción está vigente (existe, está activa y tiene slots cargados)
const isRestrictionActive = (restriction) => {
    if (!restriction) return false;
    if (restriction.activo === false) return false;
    if (!MODOS_VALIDOS.includes(restriction.mode)) return false;
    return Array.isArray(restriction.slots) && restriction.slots.length > 0;
};

// Núcleo de la lógica: ¿este usuario tiene bloqueado este horario?
const isSlotBlockedFor = (restriction, day, shift, hour) => {
    if (!isRestrictionActive(restriction)) return false;

    const slotKey = buildSlotKey(day, shift, hour);
    const incluido = restriction.slots.includes(slotKey);

    // 'allow' -> sólo los de la lista están permitidos
    // 'block' -> los de la lista son los prohibidos
    return restriction.mode === 'allow' ? !incluido : incluido;
};

module.exports = {
    DIAS_VALIDOS,
    TURNOS_VALIDOS,
    MODOS_VALIDOS,
    buildSlotKey,
    getFullName,
    normalizeSlots,
    isRestrictionActive,
    isSlotBlockedFor,
};
