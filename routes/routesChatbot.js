let express = require("express");
let routerChatbot = express.Router();

const chatbotEmitir = require('../controllers/chatbotEmitir');

// Canal de salida del chatbot: le permite iniciar conversación con un cliente
// (ver controllers/chatbotEmitir.js). Protegido con x-api-key.
routerChatbot.post('/emitir', chatbotEmitir.verificarApiKey, chatbotEmitir.emitir);

module.exports = routerChatbot;
