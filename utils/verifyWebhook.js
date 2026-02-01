/**
 * Verifica la validez de un webhook de Mercado Pago
 * En producción, puedes validar la firma del webhook
 * Por ahora, hacemos validación básica de estructura
 */

const verifyWebhookSignature = (body) => {
    // Validación básica de estructura
    if (!body || typeof body !== 'object') {
        return { valid: false, error: 'Cuerpo del webhook inválido' };
    }

    // Verificar que tenga los campos esperados
    if (!body.id || !body.action || !body.data) {
        return { valid: false, error: 'Campos requeridos faltantes en el webhook' };
    }

    return { valid: true };
};

module.exports = { verifyWebhookSignature };
