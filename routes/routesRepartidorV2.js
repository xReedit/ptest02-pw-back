/**
 * Rutas de la app de repartidores 2.0: /v3/repartidor2/*  (montadas desde routes/v3.js).
 * Todas exigen token. Los endpoints anteriores /v3/repartidor/* no se tocan.
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/autentificacion');
const v2 = require('../controllers/apiRepartidorV2');

router.use(auth.verificarToken);

router.get('/mi-estado', v2.getMiEstado);
router.get('/entregados', v2.getEntregados);
router.post('/set-asignar-pedido', v2.setAsignarPedido);
router.post('/set-fin-pedido-entregado', v2.setFinPedidoEntregado);
router.post('/set-pedido-delivery-cancelado', v2.setPedidoCanceladoRepartidor);
router.post('/asignarme-pedido', v2.asignarmePedido);
router.post('/set-efectivo-mano', v2.setEfectivoMano);

// Hooks de socket del repartidor (disconnect + aviso de estado). Se enganchan después de que app.js cree io.
setImmediate(() => require('../service/repartidor.socket.hooks').attach());

module.exports = router;
