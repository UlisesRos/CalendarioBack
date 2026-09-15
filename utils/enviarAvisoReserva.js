const User = require('../models/User');
const { sendEmailHTML } = require('./mailer');

// ============================================================================
// Mail para el usuario que pasó de la lista de reserva a tener lugar confirmado
// ============================================================================

const URL_FRONTEND_DEFAULT = 'https://calendario-fuerza-integral.vercel.app';
const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';
const DIA_A_NUMERO = { lunes: 1, martes: 2, 'miércoles': 3, jueves: 4, viernes: 5, 'sábado': 6 };
// El calendario se reinicia los sábados a las 15hs UTC (12hs de Argentina):
// desde ese momento todos los horarios corresponden a la semana siguiente.
const REINICIO_SABADO_MINUTOS = 12 * 60;

const escaparHtml = (texto) => String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const capitalizar = (texto) => String(texto ?? '')
    .trim()
    .split(/\s+/)
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');

const momentoEnArgentina = (fecha) => {
    const partes = new Intl.DateTimeFormat('en-US', {
        timeZone: ZONA_HORARIA,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(fecha);
    const valor = (tipo) => partes.find((parte) => parte.type === tipo)?.value;
    const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { diaSemana: dias[valor('weekday')], minutos: Number(valor('hour')) * 60 + Number(valor('minute')) };
};

// ¿La clase de esta semana ya empezó? (no tiene sentido avisar de un lugar en una clase pasada)
const claseYaEmpezo = (day, hour, fecha = new Date()) => {
    const diaClase = DIA_A_NUMERO[day];
    const horaClase = Number(hour);
    if (!diaClase || !Number.isFinite(horaClase)) return false;

    const { diaSemana, minutos } = momentoEnArgentina(fecha);
    if (diaSemana === 0) return false;
    if (diaSemana === 6 && minutos >= REINICIO_SABADO_MINUTOS) return false;
    if (diaClase !== diaSemana) return diaClase < diaSemana;
    return minutos >= horaClase * 60;
};

const armarMail = ({ nombre, day, shift, hour, urlCalendario }) => {
    const dia = capitalizar(day);
    const turno = shift === 'tarde' ? 'tarde' : 'mañana';
    const asunto = `¡Se liberó un lugar! Ya tenés turno el ${day} a las ${hour}:00 hs`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<body style="margin:0;padding:0;background:#f4f6f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f5;padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr>
            <td style="background:#1a202c;padding:22px 28px;">
              <p style="margin:0;color:#68D391;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Fuerza Base Integral</p>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 28px 8px;">
              <h1 style="margin:0 0 14px;color:#1a202c;font-size:22px;line-height:1.3;">¡Hola ${escaparHtml(nombre)}! Ya tenés tu lugar</h1>
              <p style="margin:0 0 18px;color:#4a5568;font-size:15px;line-height:1.6;">
                Se liberó un lugar en un horario donde estabas en la <strong>lista de reserva</strong> y, como eras la primera persona en la fila, ya quedó confirmado para vos.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fff4;border:1px solid #9ae6b4;border-radius:10px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 4px;color:#276749;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Tu turno confirmado</p>
                    <p style="margin:0;color:#1a202c;font-size:20px;font-weight:bold;">${escaparHtml(dia)} · ${escaparHtml(hour)}:00 hs</p>
                    <p style="margin:4px 0 0;color:#4a5568;font-size:14px;">Turno ${escaparHtml(turno)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 6px;">
              <a href="${escaparHtml(urlCalendario)}" style="display:inline-block;background:#68D391;color:#1a202c;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 26px;border-radius:10px;">Ver mi calendario</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 30px;">
              <p style="margin:0;color:#718096;font-size:13px;line-height:1.6;">
                Si al final no podés ir, entrá a la app y liberá tu lugar para que lo aproveche otra persona que esté esperando.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    return { asunto, html };
};

/**
 * Avisa por mail al usuario que pasó de reserva a confirmado.
 * Nunca lanza errores: un problema con el mail no debe afectar al calendario.
 */
const enviarAvisoReserva = async ({ userId, day, shift, hour }) => {
    try {
        if (claseYaEmpezo(day, hour)) {
            console.log(`Reserva promovida en ${day} ${hour}:00 hs, pero la clase ya empezó: no se envía mail.`);
            return false;
        }

        const usuario = await User.findById(userId).select('username userlastname useremail').lean();
        if (!usuario?.useremail) {
            console.warn(`No se encontró el mail del usuario ${userId} para avisarle que entró desde la reserva.`);
            return false;
        }

        const urlCalendario = `${process.env.FRONTEND_URL || URL_FRONTEND_DEFAULT}/calendario`;
        const { asunto, html } = armarMail({
            nombre: capitalizar(usuario.username),
            day,
            shift,
            hour,
            urlCalendario,
        });

        await sendEmailHTML(usuario.useremail, asunto, html);
        return true;
    } catch (error) {
        console.error('Error enviando el aviso de reserva promovida:', error?.message || error);
        return false;
    }
};

module.exports = enviarAvisoReserva;
module.exports.claseYaEmpezo = claseYaEmpezo;
module.exports.armarMail = armarMail;
