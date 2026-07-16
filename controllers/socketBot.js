const logger = require('../utilitarios/logger');
const config = require('../_config');
const QueryServiceV1 = require('../service/query.service.v1');
const fetch = require("node-fetch");

// URL del webhook de n8n (configurar en variables de entorno)
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/whatsapp-pedidos';

/**
 * socketBot - Puente entre cliente WhatsApp y n8n
 * 
 * Eventos:
 * - bot-send-message: Cliente WhatsApp envia mensaje del usuario → se reenvía a n8n → respuesta de vuelta
 * - bot-response-message: Respuesta de n8n enviada al cliente WhatsApp
 * - bot-list-number-blocked: Frontend envia lista de números bloqueados al cliente WhatsApp
 */
const connection = async function (dataCliente, socket, io) {
    const roomMensajeria = `mensajeria_${dataCliente.roomId}`;
    const idsede = dataCliente.idsede || dataCliente.roomId;

    logger.debug({ roomMensajeria, socketId: socket.id, idsede }, '🤖 [Bot] Cliente WhatsApp conectado');

    // El socket ya fue unido al room en sockets.js

    // Verificar si la sede tiene chatbot habilitado y enviar números bloqueados
    try {
        const sedeRows = await QueryServiceV1.ejecutarConsulta(
            'SELECT show_chatbot, chatbot_run FROM sede WHERE idsede = ?',
            [idsede], 'SELECT', 'socketBot-showChatbot'
        );

        const showChatbot = sedeRows?.[0]?.show_chatbot;
        const chatbotRun = sedeRows?.[0]?.chatbot_run;
        logger.debug({ idsede, showChatbot, chatbotRun }, '🤖 [Bot] show_chatbot de la sede');

        if (parseInt(showChatbot) === 1) {
            const bloqueados = await QueryServiceV1.ejecutarConsulta(
                'SELECT telefono, info FROM chatbot_num_bloqueados WHERE idsede = ? AND estado = 0',
                [idsede], 'SELECT', 'socketBot-numBloqueados'
            );

            logger.debug({ idsede, total: bloqueados.length }, '🤖 [Bot] Números bloqueados enviados al cliente');
            socket.emit('bot-list-number-blocked', { idsede, bloqueados });

            socket.emit('bot-init-variables', { showChatbot, chatbotRun });
        }
    } catch (error) {
        logger.error({ error: error.message, idsede }, '🤖 [Bot] Error consultando chatbot/bloqueados');
    }

    // --- Evento: bot-send-message ---
    // Cliente WhatsApp recibe mensaje de un usuario y lo envia aquí
    // Lo reenviamos a n8n y esperamos la respuesta
    socket.on('bot-send-message', async (data) => {
        try {
            logger.debug({ data, roomMensajeria }, '🤖 [Bot] Mensaje recibido del cliente WhatsApp');

            // Enviar mensaje al frontend
            logger.debug({ data: data.whatsapp_message_received }, '🤖 [Bot] Enviando mensaje al frontend');
            socket.to(roomMensajeria).emit('bot-send-message-front-end', data.whatsapp_message_received);

            const response = await fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data.whatsapp_message_received),
                timeout: 30000
            });

            if (!response.ok) {
                throw new Error(`n8n respondió con status ${response.status}`);
            }

            const n8nResponse = await response.json();

            logger.debug({ n8nResponse, 'roomMensajeria': roomMensajeria }, '🤖 [Bot] Respuesta recibida de n8n');

            // Respuesta vacía = el bot decidió no contestar (un 👍/"gracias" sin
            // nada pendiente). NO emitimos: el cliente Baileys no filtra mensajes
            // vacíos y mandaría un WhatsApp en blanco. Así se corta el ping-pong
            // de cortesías sin tocar el cliente (que se actualiza a mano por local).
            const mensajeBot = n8nResponse && n8nResponse.response;
            if (!mensajeBot || !String(mensajeBot).trim()) {
                logger.debug({ roomMensajeria }, '🤖 [Bot] respuesta vacía, el bot eligió no contestar (no se emite)');
                return;
            }

            // Enviar respuesta de vuelta al cliente WhatsApp
            io.to(roomMensajeria).emit('bot-response-message', {
                success: true,
                whatsapp_message_received: data.whatsapp_message_received,
                message: mensajeBot
            });

        } catch (error) {
            logger.error({ error: error.message, phone: data?.phone }, '🤖 [Bot] Error procesando mensaje');

            socket.emit('bot-response-message', {
                success: false,
                phone: data?.phone,
                error: 'Error al procesar mensaje: ' + error.message
            });
        }
    });

    // --- Evento: bot-list-number-blocked ---
    // Frontend envia lista de números bloqueados para que el cliente WhatsApp los ignore
    socket.on('bot-list-number-blocked', (data) => {
        try {
            logger.debug({ data, roomMensajeria }, '🤖 [Bot] Lista de números bloqueados recibida');

            // Reenviar a todos los sockets en el room de mensajería (excepto el emisor)
            socket.to(roomMensajeria).emit('bot-list-number-blocked', data);

        } catch (error) {
            logger.error({ error: error.message }, '🤖 [Bot] Error enviando lista de bloqueados');
        }
    });

    // --- Disconnect ---
    socket.on('disconnect', (reason) => {
        logger.debug({ reason, roomMensajeria, socketId: socket.id }, '🤖 [Bot] Cliente WhatsApp desconectado');
    });


    socket.on('ping-mensajeria', async (data) => {
        const roomMensajeria = `mensajeria_${data.roomId}`;
        const pingId = `${roomMensajeria}_${Date.now()}`;

        logger.debug({ roomMensajeria }, 'Connectando ping a roomMensajeria');

        let responded = false;

        // Escuchar el evento 'pong' que el cliente emite como evento separado
        const onPong = (responseData) => {
            if (responded) return;
            responded = true;

            logger.debug({ responseData }, 'Respuesta pong recibida de mensajeria');
            const isWspConectado = responseData.whatsappConnected || false;
            socket.emit('pong-mensajeria', {
                pingId,
                success: isWspConectado,
                conectado: isWspConectado,
                instalado: true,
                whatsapp: responseData.whatsapp || null
            });
        };

        // Escuchar 'pong' en todos los sockets del room
        const socketsInRoom = await io.in(roomMensajeria).allSockets();
        socketsInRoom.forEach(socketId => {
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket && targetSocket.id !== socket.id) {
                targetSocket.once('pong', onPong);
            }
        });

        // Emitir ping al room
        socket.to(roomMensajeria).emit('ping', { pingId });

        // Timeout: si no responde en 5s
        setTimeout(() => {
            if (!responded) {
                responded = true;
                // Limpiar listeners
                socketsInRoom.forEach(socketId => {
                    const targetSocket = io.sockets.sockets.get(socketId);
                    if (targetSocket) targetSocket.off('pong', onPong);
                });
                logger.debug({ roomMensajeria }, 'Timeout ping mensajeria - sin respuesta');
                socket.to(roomMensajeria).emit('pong-mensajeria', { pingId, success: false, conectado: false, instalado: false });
            }
        }, 5000);
    });


    // Frontend envia actualización de números bloqueados al cliente WhatsApp
    socket.on('bot-update-number-blocked', (data) => {
        const roomMensajeria = `mensajeria_${data.roomId}`;
        logger.debug({ data, roomMensajeria }, '🤖 [Bot] Frontend envió actualización de números bloqueados');
        io.to(roomMensajeria).emit('bot-update-number-blocked', data);
        // socket.emit('bot-update-number-blocked', data);
    });

    // ecuchar cuando se pone run o stop al chatbot
    socket.on('run-chatbot', (data) => {
        const roomMensajeria = `mensajeria_${data.roomId}`;
        logger.debug({ data, roomMensajeria }, '🤖 [Bot] Frontend envió comando para ejecutar chatbot');
        io.to(roomMensajeria).emit('run-chatbot', data);
        // socket.emit('run-chatbot', data);
    });
};

module.exports = {
    connection
};