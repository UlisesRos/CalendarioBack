/**
 * Script de prueba para verificar la configuración de Brevo
 * 
 * INSTRUCCIONES:
 * 1. Asegúrate de tener las variables BREVO_API_KEY, EMAIL_FROM y EMAIL_FROM_NAME en tu .env
 * 2. Ejecuta: node test-brevo.js
 * 3. Verifica que recibas el email de prueba
 */

require('dotenv').config();
const brevo = require('@getbrevo/brevo');

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

console.log(`\n${colors.cyan}===========================================`);
console.log(`🧪 TEST DE CONFIGURACIÓN DE BREVO`);
console.log(`===========================================${colors.reset}\n`);

// Verificar variables de entorno
console.log(`${colors.blue}📋 Verificando variables de entorno...${colors.reset}`);

const requiredEnvVars = ['BREVO_API_KEY', 'EMAIL_FROM', 'EMAIL_FROM_NAME'];
let allEnvVarsPresent = true;

requiredEnvVars.forEach(varName => {
    if (process.env[varName]) {
        console.log(`${colors.green}✅ ${varName}: configurado${colors.reset}`);
    } else {
        console.log(`${colors.red}❌ ${varName}: FALTANTE${colors.reset}`);
        allEnvVarsPresent = false;
    }
});

if (!allEnvVarsPresent) {
    console.log(`\n${colors.red}❌ Error: Faltan variables de entorno necesarias.${colors.reset}`);
    console.log(`${colors.yellow}Por favor agrega las variables faltantes a tu archivo .env${colors.reset}\n`);
    process.exit(1);
}

// Configurar Brevo
console.log(`\n${colors.blue}🔧 Configurando cliente de Brevo...${colors.reset}`);

let apiInstance = new brevo.TransactionalEmailsApi();
let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY;

console.log(`${colors.green}✅ Cliente configurado${colors.reset}`);

// Función para enviar email de prueba
async function testBrevoEmail() {
    console.log(`\n${colors.blue}📧 Enviando email de prueba...${colors.reset}`);
    
    try {
        let sendSmtpEmail = new brevo.SendSmtpEmail();
        
        sendSmtpEmail.sender = {
            name: process.env.EMAIL_FROM_NAME,
            email: process.env.EMAIL_FROM
        };
        
        // ⚠️ CAMBIA ESTO POR TU EMAIL PARA RECIBIR EL EMAIL DE PRUEBA
        const testEmail = process.env.EMAIL_FROM; // Por defecto envía al mismo email
        sendSmtpEmail.to = [{ email: testEmail }];
        
        sendSmtpEmail.subject = '🧪 Test de Brevo - Fuerza Base Integral';
        sendSmtpEmail.htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
                <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <h1 style="color: #80c687; text-align: center;">✅ Brevo Configurado Correctamente</h1>
                    <p style="font-size: 16px; color: #333; line-height: 1.6;">
                        ¡Felicitaciones! Tu integración con Brevo está funcionando perfectamente.
                    </p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #80c687; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #555;">Detalles de la configuración:</h3>
                        <ul style="color: #666;">
                            <li><strong>Servicio:</strong> Brevo (ex-Sendinblue)</li>
                            <li><strong>Remitente:</strong> ${process.env.EMAIL_FROM_NAME}</li>
                            <li><strong>Email:</strong> ${process.env.EMAIL_FROM}</li>
                            <li><strong>Fecha:</strong> ${new Date().toLocaleString('es-AR')}</li>
                        </ul>
                    </div>
                    <p style="font-size: 14px; color: #666; text-align: center; margin-top: 30px;">
                        Este es un email de prueba automático de <strong>Fuerza Base Integral</strong>
                    </p>
                </div>
            </div>
        `;

        const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
        
        console.log(`${colors.green}✅ Email enviado exitosamente!${colors.reset}`);
        console.log(`${colors.cyan}📊 Detalles:${colors.reset}`);
        console.log(`   - Message ID: ${data.messageId}`);
        console.log(`   - Destinatario: ${testEmail}`);
        console.log(`   - Remitente: ${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>`);
        
        console.log(`\n${colors.yellow}📬 Revisa tu bandeja de entrada (o spam) en: ${testEmail}${colors.reset}`);
        
        return true;
        
    } catch (error) {
        console.log(`${colors.red}❌ Error enviando el email${colors.reset}`);
        console.log(`${colors.red}Detalles del error:${colors.reset}`);
        
        if (error.response) {
            console.log(`   - Status: ${error.response.status}`);
            console.log(`   - Mensaje: ${error.response.text || error.response.statusText}`);
        } else {
            console.log(`   - ${error.message}`);
        }
        
        console.log(`\n${colors.yellow}💡 Posibles soluciones:${colors.reset}`);
        console.log(`   1. Verifica que tu BREVO_API_KEY sea correcta`);
        console.log(`   2. Verifica que el email ${process.env.EMAIL_FROM} esté verificado en Brevo`);
        console.log(`   3. Revisa que tu cuenta de Brevo esté activa`);
        console.log(`   4. Consulta: https://developers.brevo.com/\n`);
        
        return false;
    }
}

// Función para verificar la cuenta de Brevo
async function checkBrevoAccount() {
    console.log(`\n${colors.blue}🔍 Verificando información de la cuenta...${colors.reset}`);
    
    try {
        let accountApi = new brevo.AccountApi();
        accountApi.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY;
        
        const account = await accountApi.getAccount();
        
        console.log(`${colors.green}✅ Cuenta verificada${colors.reset}`);
        console.log(`${colors.cyan}📊 Información de la cuenta:${colors.reset}`);
        console.log(`   - Email: ${account.email}`);
        console.log(`   - Nombre: ${account.firstName} ${account.lastName}`);
        console.log(`   - Plan: ${account.plan[0].type}`);
        console.log(`   - Créditos restantes: ${account.plan[0].credits || 'Ilimitados'}`);
        
        return true;
        
    } catch (error) {
        console.log(`${colors.yellow}⚠️  No se pudo verificar la cuenta (pero puede seguir funcionando)${colors.reset}`);
        return false;
    }
}

// Ejecutar pruebas
async function runTests() {
    try {
        // Verificar cuenta
        await checkBrevoAccount();
        
        // Enviar email de prueba
        const success = await testBrevoEmail();
        
        if (success) {
            console.log(`\n${colors.green}╔════════════════════════════════════════╗`);
            console.log(`║   ✅ PRUEBA COMPLETADA EXITOSAMENTE   ║`);
            console.log(`╚════════════════════════════════════════╝${colors.reset}\n`);
            console.log(`${colors.cyan}Próximos pasos:${colors.reset}`);
            console.log(`1. Revisa tu email para confirmar la recepción`);
            console.log(`2. Si todo funciona, tu backend está listo para enviar emails`);
            console.log(`3. Lee MIGRACION_BREVO.md para más información\n`);
        } else {
            console.log(`\n${colors.red}╔════════════════════════════════════════╗`);
            console.log(`║        ❌ PRUEBA FALLIDA               ║`);
            console.log(`╚════════════════════════════════════════╝${colors.reset}\n`);
        }
        
    } catch (error) {
        console.log(`\n${colors.red}❌ Error inesperado: ${error.message}${colors.reset}\n`);
    }
}

// Ejecutar
runTests();