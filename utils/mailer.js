const brevo = require('@getbrevo/brevo');
require('dotenv').config();

// Configurar la API de Brevo
let apiInstance = new brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY;

/**
 * Envía un email utilizando Brevo (ex-Sendinblue)
 * @param {string} to - Email del destinatario
 * @param {string} subject - Asunto del email
 * @param {string} text - Contenido en texto plano
 * @param {string} html - Contenido en HTML (opcional)
 */
const sendEmail = async (to, subject, text, html = null) => {
    try {
        // Preparar el email
        let sendSmtpEmail = new brevo.SendSmtpEmail();
        
        sendSmtpEmail.sender = {
            name: process.env.EMAIL_FROM_NAME || 'Fuerza Base Integral',
            email: process.env.EMAIL_FROM
        };
        
        sendSmtpEmail.to = [{ email: to }];
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.textContent = text;
        
        // Si se proporciona HTML, usarlo; si no, convertir texto a HTML básico
        if (html) {
            sendSmtpEmail.htmlContent = html;
        } else {
            // Convertir saltos de línea a <br> para mejor visualización
            sendSmtpEmail.htmlContent = text.replace(/\n/g, '<br>');
        }

        // Enviar el email
        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log('✅ Email enviado exitosamente:', {
            messageId: data.messageId,
            to: to
        });
        return data;
        
    } catch (error) {
        console.error('❌ Error enviando el correo con Brevo:', error);
        throw error;
    }
};

/**
 * Envía un email con formato HTML mejorado
 * Útil para emails con mejor presentación visual
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
        sendSmtpEmail.htmlContent = htmlContent;

        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log('✅ Email HTML enviado exitosamente:', {
            messageId: data.messageId,
            to: to
        });
        return data;
        
    } catch (error) {
        console.error('❌ Error enviando el correo HTML con Brevo:', error);
        throw error;
    }
};

module.exports = { sendEmail, sendEmailHTML };