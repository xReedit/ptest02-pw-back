const { to, ReE, ReS } = require('../service/uitl.service');
const crypto = require('crypto');
const logger = require('../utilitarios/logger');

// Función para validar la firma
function validarFirmaWebhook(payload, signature, secretKey) {
    const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(JSON.stringify(payload))
        .digest('hex');

    const receivedSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex')
    );
}

const setWebhookCobranza = async function (req, res) {
    const signature = req.headers['x-webhook-signature'];
    const secretKey = 'nddOIgt3WccekkutYXmaHMze57bFvdxM'; // El mismo que registraste

    // Validar firma si existe
    if (signature && secretKey) {
        if (!validarFirmaWebhook(req.body, signature, secretKey)) {
            logger.error('❌ Firma inválida - posible ataque');
            return res.status(401).json({ error: 'Firma inválida' });
        }
        logger.debug('✅ Firma validada correctamente');
    }

    // Procesar webhook
    logger.debug('🎯 Webhook válido recibido:', req.body);
    res.status(200).json({ success: true });
}
module.exports.setWebhookCobranza = setWebhookCobranza;
