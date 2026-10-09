// HTTP de pedido por confirmar. La logica esta en service/pedido.por.confirmar.service.js
const { ReE, ReS } = require('../service/uitl.service');
const logger = require('../utilitarios/logger');
const ppc = require('../service/pedido.por.confirmar.service');

const responder = (res, r) => (r.ok ? ReS(res, r) : ReE(res, r.error, r.status || 400));

const conError = (fn) => async (req, res) => {
	try {
		return await fn(req, res);
	} catch (err) {
		logger.error({ err: err.message, ruta: req.originalUrl }, 'pedido-por-confirmar');
		return ReE(res, 'Error procesando el pedido, intente de nuevo', 500);
	}
};

// GET config/:idsede
const getConfig = conError(async (req, res) => ReS(res, { data: await ppc.getConfigSede(req.params.idsede) }));

// POST guardar  body: dataSend (el mismo objeto que la app emitiria en nuevoPedido)
const guardar = conError(async (req, res) => responder(res, await ppc.guardar(req.body, req.cliente?.idcliente)));

// GET estado/:id
const getEstado = conError(async (req, res) => {
	const data = await ppc.getEstado(req.params.id);
	return data ? ReS(res, { data }) : ReE(res, 'no encontrado', 404);
});

// POST recordar/:id  el cliente vuelve a llamar al personal
const recordar = conError(async (req, res) => responder(res, await ppc.recordar(req.params.id)));

// GET pendientes
const getPendientes = conError(async (req, res) => ReS(res, { data: await ppc.getPendientes(req.accion.idsede) }));

// POST confirmados  body: { ids: [idpedido...] }
const getConfirmados = conError(async (req, res) => ReS(res, { data: await ppc.getConfirmados(req.accion.idsede, req.body?.ids) }));

// GET formas-pago
const getFormasPago = conError(async (req, res) => ReS(res, { data: await ppc.getFormasPago(req.accion.idsede) }));

// POST confirmar  body: { id, pagos? }  pagos = salida de app-forma-pago { methods: [...] }
const confirmar = conError(async (req, res) =>
	responder(res, await ppc.confirmar(req.body?.id, req.body?.pagos, req.accion)));

// POST anular  body: { id, motivo }
const anular = conError(async (req, res) =>
	responder(res, await ppc.anular(req.body?.id, req.body?.motivo, req.accion)));

module.exports = { getConfig, guardar, getEstado, recordar, getPendientes, getConfirmados, getFormasPago, confirmar, anular };
