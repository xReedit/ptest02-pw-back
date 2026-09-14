// routesYape.js — rutas de la integración con el verificador de pagos Yape/Plin.
// Toda la lógica está en controllers/yapeIntegracion.js.

let express = require('express');
let routerYape = express.Router();

const yape = require('../controllers/yapeIntegracion');
const auth = require('../middleware/autentificacion');

// Entrante: yapehub confirma un pago → emitimos al room de la sede.
// Auth por firma HMAC (dentro del handler), no por token.
routerYape.post('/confirmacion', yape.confirmacion);

// Saliente: el admin del POS vincula el verificador con su sede.
// Auth normal del POS: el token trae idorg/idsede.
routerYape.post('/vincular', auth.verificarToken, yape.vincular);

module.exports = routerYape;
