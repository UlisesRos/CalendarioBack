const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = `${process.env.EMAIL_FROM_NAME || 'Fuerza Base Integral'} <${process.env.EMAIL_FROM}>`;

const sendEmail = async (to, subject, text, html = null) => {
    const { data, error } = await resend.emails.send({
        from: FROM,
        to: [to],
        subject,
        text,
        html: html || text.replace(/\n/g, '<br>'),
    });

    if (error) {
        console.error('❌ Error enviando el correo con Resend:', error);
        throw error;
    }

    console.log('✅ Email enviado exitosamente:', { messageId: data.id, to });
    return data;
};

const sendEmailHTML = async (to, subject, htmlContent) => {
    const { data, error } = await resend.emails.send({
        from: FROM,
        to: [to],
        subject,
        html: htmlContent,
    });

    if (error) {
        console.error('❌ Error enviando el correo HTML con Resend:', error);
        throw error;
    }

    console.log('✅ Email HTML enviado exitosamente:', { messageId: data.id, to });
    return data;
};

module.exports = { sendEmail, sendEmailHTML };
