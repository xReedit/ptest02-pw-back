// /v3/pedido-por-confirmar — carta QR: pedido espera confirmacion de mozo/caja (sede unica, no holding)
const express = require('express');
const crypto = require('crypto');
const auth = require('../middleware/autentificacion');
const authCliente = require('../middleware/autentificacion.cliente');
const { ReE } = require('../service/uitl.service');
const rateLimit = require('../service/rate-limit');
const api = require('../controllers/apiPedidoPorConfirmar');

const router = express.Router();

const secretoValido = (valor) => {
	const secreto = process.env.PEDIDO_CONFIRMAR_SECRET || '';
	if (!secreto || typeof valor !== 'string') { return false; }
	const a = Buffer.from(valor), b = Buffer.from(secreto);
	return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Caja (POS legacy) llama via bdphp/log_pedido_confirmar.php con el secreto y los datos de su sesion.
// Mozo llama con su JWT. Ambos dejan req.accion = { idsede, idusuario, origen }.
const mozoOCaja = (req, res, next) => {
	if (req.headers['x-ppc-secret'] !== undefined) {
		if (!secretoValido(req.headers['x-ppc-secret'])) { return ReE(res, 'no autorizado', 401); }
		const idsede = parseInt(req.headers['x-ppc-idsede']);
		if (!idsede) { return ReE(res, 'falta sede', 400); }
		req.accion = { idsede, idusuario: parseInt(req.headers['x-ppc-idusuario']) || null, origen: 'CAJA' };
		return next();
	}
	return auth.verificarToken(req, res, () => {
		const u = req.usuariotoken || {};
		req.accion = { idsede: parseInt(u.idsede), idusuario: parseInt(u.idusuario) || null, origen: 'MOZO' };
		return next();
	});
};

router.get('/config/:idsede', api.getConfig);
// ponytail: limites por IP holgados: los clientes de un local suelen compartir el wifi (misma IP)
router.post('/guardar', rateLimit(30, 60000), authCliente.exigirCliente(), api.guardar);
router.get('/estado/:id', rateLimit(300, 60000), authCliente.exigirCliente(), api.getEstado);
router.post('/recordar/:id', rateLimit(30, 60000), authCliente.exigirCliente(), api.recordar);
router.get('/pendientes', mozoOCaja, api.getPendientes);
router.get('/formas-pago', mozoOCaja, api.getFormasPago);
router.post('/confirmados', mozoOCaja, api.getConfirmados);
router.post('/confirmar', mozoOCaja, api.confirmar);
router.post('/anular', mozoOCaja, api.anular);

module.exports = router;
