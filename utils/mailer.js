const brevo = require('@getbrevo/brevo');
require('dotenv').config();

// Configurar la API de Brevo
let apiInstance = new brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY;

// ============================================
// TEMPLATE HTML BASE
// ============================================
const emailBaseTemplate = (title, content) => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 0; text-align: center;">
                <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #80c687 0%, #5fa967 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                                💪 Fuerza Base Integral
                            </h1>
                        </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            ${content}
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 20px 30px; background-color: #f8f9fa; text-align: center; border-radius: 0 0 10px 10px;">
                            <p style="margin: 0; color: #666; font-size: 12px; line-height: 1.5;">
                                <strong>Fuerza Base Integral</strong><br>
                                Rosario, Santa Fe, Argentina<br>
                                <a href="https://www.instagram.com/fuerza.baseintegral/" style="color: #80c687; text-decoration: none;">Instagram</a> | 
                                <a href="https://wa.me/3416948109" style="color: #80c687; text-decoration: none;">WhatsApp</a>
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

/**
 * Convierte texto plano a HTML con formato básico
 * Detecta saltos de línea, negritas, listas, etc.
 */
const textToHTML = (text) => {
    if (!text) return '';
    
    // Convertir saltos de línea dobles a párrafos
    let html = text.split('\n\n').map(paragraph => {
        paragraph = paragraph.trim();
        if (!paragraph) return '';
        
        // Detectar si es una lista (líneas que empiezan con -, *, •, números)
        const lines = paragraph.split('\n');
        const isList = lines.every(line => 
            /^[\-\*\•]\s/.test(line.trim()) || /^\d+[\.\)]\s/.test(line.trim())
        );
        
        if (isList) {
            const listItems = lines.map(line => {
                const content = line.replace(/^[\-\*\•\d+\.\)]\s*/, '').trim();
                return `<li style="margin-bottom: 8px;">${content}</li>`;
            }).join('');
            return `<ul style="color: #555; line-height: 1.8; padding-left: 20px;">${listItems}</ul>`;
        }
        
        // Párrafo normal
        return `<p style="font-size: 16px; color: #555; line-height: 1.6; margin: 15px 0;">${paragraph.replace(/\n/g, '<br>')}</p>`;
    }).join('');
    
    // Detectar y resaltar textos entre ** o *texto* como negritas
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
    
    return html;
};

/**
 * Envía un email utilizando Brevo con template HTML automático
 * @param {string} to - Email del destinatario
 * @param {string} subject - Asunto del email
 * @param {string} text - Contenido en texto plano (se convertirá a HTML automáticamente)
 */
const sendEmail = async (to, subject, text) => {
    try {
        // Preparar el email
        let sendSmtpEmail = new brevo.SendSmtpEmail();
        
        sendSmtpEmail.sender = {
            name: process.env.EMAIL_FROM_NAME || 'Fuerza Base Integral',
            email: process.env.EMAIL_FROM
        };
        
        sendSmtpEmail.to = [{ email: to }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.textContent = text; // Versión texto plano para clientes que no soportan HTML
        
        // Convertir texto a HTML con formato
        const htmlContent = textToHTML(text);
        
        // Aplicar el template profesional
        sendSmtpEmail.htmlContent = emailBaseTemplate(subject, htmlContent);

        // Enviar el email
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log('✅ Email enviado exitosamente:', {
            messageId: data.messageId,
            to: to,
            subject: subject
        });
        return data;
        
    } catch (error) {
        console.error('❌ Error enviando el correo con Brevo:', error);
        
        // Mostrar más detalles del error
        if (error.response) {
            console.error('Detalles del error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                body: error.response.body
            });
        }
        
        throw error;
    }
};

/**
 * Envía un email con HTML personalizado completo
 * Usa esto cuando quieras control total del HTML
 * @param {string} to - Email del destinatario
 * @param {string} subject - Asunto del email
 * @param {string} htmlContent - Contenido HTML completo
 */
const sendEmailHTML = async (to, subject, htmlContent) => {
    try {
        let sendSmtpEmail = new brevo.SendSmtpEmail();
        
        sendSmtpEmail.sender = {
            name: process.env.EMAIL_FROM_NAME || 'Fuerza Base Integral',
            email: process.env.EMAIL_FROM
        };
        
        sendSmtpEmail.to = [{ email: to }];
        sendSmtpEmail.subject = subject;
        
        // Aplicar el template base al HTML proporcionado
        sendSmtpEmail.htmlContent = emailBaseTemplate(subject, htmlContent);

        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log('✅ Email HTML enviado exitosamente:', {
            messageId: data.messageId,
            to: to,
            subject: subject
        });
        return data;
        
    } catch (error) {
        console.error('❌ Error enviando el correo HTML con Brevo:', error);
        
        if (error.response) {
            console.error('Detalles del error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                body: error.response.body
            });
        }
        
        throw error;
    }
};

/**
 * TEMPLATES ESPECÍFICOS PARA CASOS COMUNES
 * Estos generan el HTML interno (el contenido), 
 * luego se envuelven automáticamente con el template base
 */

// Template para confirmación de turno de gimnasio
const templateTurnoGimnasio = (nombre, dia, turno, hora) => `
    <h2 style="color: #333; margin-top: 0;">¡Turno Confirmado! ✅</h2>
    <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Hola <strong>${nombre}</strong>,
    </p>
    <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Tu turno ha sido confirmado exitosamente:
    </p>
    <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #80c687; margin: 25px 0; border-radius: 5px;">
        <table style="width: 100%;">
            <tr>
                <td style="padding: 8px 0;"><strong>📅 Día:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${dia}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0;"><strong>🌅 Turno:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${turno}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0;"><strong>🕐 Hora:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${hora}:00 hs</td>
            </tr>
        </table>
    </div>
    <p style="font-size: 14px; color: #666; line-height: 1.6;">
        Te esperamos en el gimnasio. ¡No olvides traer tu botella de agua! 💧
    </p>
`;

// Template para confirmación de turno de nutrición
const templateTurnoNutricion = (nombre, fecha, hora, nutricionista) => `
    <h2 style="color: #333; margin-top: 0;">Turno de Nutrición Confirmado 🥗</h2>
    <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Hola <strong>${nombre}</strong>,
    </p>
    <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Tu turno con nuestro servicio de nutrición ha sido confirmado:
    </p>
    <div style="background-color: #e8f5e9; padding: 20px; border-left: 4px solid #4caf50; margin: 25px 0; border-radius: 5px;">
        <table style="width: 100%;">
            <tr>
                <td style="padding: 8px 0;"><strong>👩‍⚕️ Nutricionista:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${nutricionista}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0;"><strong>📅 Fecha:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${fecha}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0;"><strong>🕐 Hora:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${hora}</td>
            </tr>
        </table>
    </div>
    <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0; font-size: 14px; color: #856404;">
            <strong>📋 Recordatorio:</strong> Si es tu primera consulta, te recomendamos llevar estudios médicos recientes si los tienes disponibles.
        </p>
    </div>
`;

// Template para recordatorio de pago
const templateRecordatorioPago = (nombre, monto, diasEntrenamiento) => `
    <h2 style="color: #333; margin-top: 0;">Recordatorio de Pago 💳</h2>
    <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Hola <strong>${nombre}</strong>,
    </p>
    <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Este es un recordatorio amistoso sobre tu cuota mensual pendiente:
    </p>
    <div style="background-color: #fff3cd; padding: 20px; border-left: 4px solid #ffc107; margin: 25px 0; border-radius: 5px;">
        <table style="width: 100%;">
            <tr>
                <td style="padding: 8px 0;"><strong>💰 Monto:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-size: 20px; color: #80c687;"><strong>$${monto.toLocaleString('es-AR')}</strong></td>
            </tr>
            <tr>
                <td style="padding: 8px 0;"><strong>📅 Días:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${diasEntrenamiento} días/semana</td>
            </tr>
        </table>
    </div>
    <div style="text-align: center; margin: 30px 0;">
        <a href="https://calendario-fuerza-integral.vercel.app/pagos" style="display: inline-block; background-color: #80c687; color: white; padding: 15px 40px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
            Pagar Ahora
        </a>
    </div>
    <p style="font-size: 14px; color: #666; line-height: 1.6;">
        También puedes realizar transferencias bancarias a nuestro alias: <strong>fzabaseintegral</strong>
    </p>
`;

// Template para confirmación de pago
const templateConfirmacionPago = (nombre, monto, metodoPago, fecha) => `
    <h2 style="color: #333; margin-top: 0;">¡Pago Recibido! ✅</h2>
    <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Hola <strong>${nombre}</strong>,
    </p>
    <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Confirmamos que hemos recibido tu pago exitosamente:
    </p>
    <div style="background-color: #e8f5e9; padding: 20px; border-left: 4px solid #4caf50; margin: 25px 0; border-radius: 5px;">
        <table style="width: 100%;">
            <tr>
                <td style="padding: 8px 0;"><strong>💰 Monto:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-size: 20px; color: #4caf50;"><strong>$${monto.toLocaleString('es-AR')}</strong></td>
            </tr>
            <tr>
                <td style="padding: 8px 0;"><strong>💳 Método:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${metodoPago}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0;"><strong>📅 Fecha:</strong></td>
                <td style="padding: 8px 0; text-align: right;">${fecha}</td>
            </tr>
        </table>
    </div>
    <p style="font-size: 16px; color: #555; line-height: 1.6;">
        Tu estado de pago ha sido actualizado y ya puedes disfrutar de todos nuestros servicios este mes.
    </p>
    <p style="font-size: 14px; color: #666; line-height: 1.6;">
        ¡Gracias por ser parte de Fuerza Base Integral! 💪
    </p>
`;

module.exports = { 
    sendEmail, 
    sendEmailHTML,
    // Exportar templates para uso directo si se necesita
    templates: {
        turnoGimnasio: templateTurnoGimnasio,
        turnoNutricion: templateTurnoNutricion,
        recordatorioPago: templateRecordatorioPago,
        confirmacionPago: templateConfirmacionPago
    }
};