const brevo = require('@getbrevo/brevo');
require('dotenv').config();

// El cliente de Brevo se crea de forma perezosa (lazy) para que, si falta
// alguna variable de entorno, sólo falle el envío de mails puntual y NO
// se caiga todo el servidor al arrancar (antes, con Resend, faltaba
// RESEND_API_KEY y `new Resend(...)` tiraba una excepción al cargar este
// archivo, lo que podía tumbar server.js entero apenas se requería
// authController.js).
let apiInstance = null;

const getApiInstance = () => {
    if (!process.env.BREVO_API_KEY) {
        throw new Error('Falta configurar BREVO_API_KEY en las variables de entorno.');
    }
    if (!process.env.EMAIL_FROM) {
        throw new Error('Falta configurar EMAIL_FROM en las variables de entorno.');
    }

    if (!apiInstance) {
        apiInstance = new brevo.TransactionalEmailsApi();
        apiInstance.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY;
    }

    return apiInstance;
};

const buildSender = () => ({
    name: process.env.EMAIL_FROM_NAME || 'Fuerza Base Integral',
    email: process.env.EMAIL_FROM,
});

/**
 * Envía un email utilizando Brevo (ex-Sendinblue)
 * @param {string} to - Email del destinatario
 * @param {string} subject - Asunto del email
 * @param {string} text - Contenido en texto plano
 * @param {string} html - Contenido en HTML (opcional)
 */
const sendEmail = async (to, subject, text, html = null) => {
    try {
        const instance = getApiInstance();

        let sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = buildSender();
        sendSmtpEmail.to = [{ email: to }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.textContent = text;
        // Si se proporciona HTML, usarlo; si no, convertir saltos de línea a <br>
        sendSmtpEmail.htmlContent = html || text.replace(/\n/g, '<br>');

        const data = await instance.sendTransacEmail(sendSmtpEmail);
        console.log('✅ Email enviado exitosamente:', { messageId: data.messageId, to });
        return data;
    } catch (error) {
        console.error('❌ Error enviando el correo con Brevo:', error?.response?.text || error.message || error);
        throw error;
    }
};

/**
 * Envía un email con formato HTML mejorado
 * Útil para emails con mejor presentación visual
 */
const sendEmailHTML = async (to, subject, htmlContent) => {
    try {
        const instance = getApiInstance();

        let sendSmtpEmail = new brevo.SendSmtpEmail();
        sendSmtpEmail.sender = buildSender();
        sendSmtpEmail.to = [{ email: to }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = htmlContent;

        const data = await instance.sendTransacEmail(sendSmtpEmail);
        console.log('✅ Email HTML enviado exitosamente:', { messageId: data.messageId, to });
        return data;
    } catch (error) {
        console.error('❌ Error enviando el correo HTML con Brevo:', error?.response?.text || error.message || error);
        throw error;
    }
};

module.exports = { sendEmail, sendEmailHTML };
