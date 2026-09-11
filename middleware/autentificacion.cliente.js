// Autenticacion del CLIENTE (consumidor). Archivo aparte de autentificacion.js a
// proposito: otro secreto (SEED_CLIENTE), otro tipo de token y un despliegue gradual.
//
// app.js esta bloqueado (trabajo de Yape sin commitear), asi que esto NO se monta como
// middleware global: se aplica por ruta en routes/v3.js y, para el socket, dentro de
// socketsOn en controllers/sockets.js via salaCliente().
const jwt = require('jsonwebtoken');
const { ReE } = require('../service/uitl.service');
const logger = require('../utilitarios/logger');
const tokenCliente = require('../service/token.cliente');
const SEED = require('../_config').SEED;

const MODOS = ['off', 'log', 'enforce'];

// off      = no se mira nada (comportamiento anterior al sprint 5)
// log      = se verifica y se avisa, pero SIEMPRE deja pasar (modo de despliegue)
// enforce  = 401 si falta o es invalido, 403 si el idcliente no coincide
const modo = () => {
	const valor = String(process.env.AUTH_CLIENTE_MODO || 'log').trim().toLowerCase();
	return MODOS.indexOf(valor) !== -1 ? valor : 'log';
};

// Falla cerrado: en enforce sin secreto NINGUN cliente podria autenticarse y todas las
// rutas responderian 401. Es preferible que el proceso no arranque a servir un 401 masivo.
if (modo() === 'enforce' && !process.env.SEED_CLIENTE) {
	throw new Error('AUTH_CLIENTE_MODO=enforce requiere SEED_CLIENTE en el entorno');
}

const aEntero = (valor) => {
	const n = Number(valor);
	return Number.isInteger(n) && n > 0 ? n : 0;
};

const tokenDeLaCabecera = (req) => {
	const cabecera = req && req.headers ? req.headers.authorization : null;
	if (typeof cabecera !== 'string') { return ''; }
	return cabecera.trim();
};

// La misma PWA sirve al cliente y al comercio/mozo. get-direccion-cliente y
// cliente/new-direccion los llama tambien el comercio con el idcliente del cliente que
// atiende (seleccionar-direccion.component.ts:29, agregar-direccion.component.ts:277,
// dialog-direccion-cliente-delivery.component.ts:277 con isFromComercio). Ese trafico
// trae el JWT de colaborador firmado con SEED: se deja pasar sin comparar idcliente,
// exactamente como hoy. Sin esta salida, enforce romperia la toma de pedidos del comercio.
const esColaborador = (token) => {
	if (!token || !SEED) { return false; }
	try {
		// algorithms fijo a HS256: es el unico que firma login.js (jwt.sign por defecto) y
		// asi ningun token con otro alg en la cabecera puede colarse como colaborador.
		const decode = jwt.verify(token.replace(/^Bearer[ ]+/i, ''), SEED, { algorithms: ['HS256'] });
		return !!(decode && decode.usuario);
	} catch (error) {
		return false;
	}
};

const idClienteDelBody = (req) => {
	const cuerpo = (req && req.body) ? req.body : {};
	const consulta = (req && req.query) ? req.query : {};
	if (cuerpo.idcliente !== undefined && cuerpo.idcliente !== null) { return aEntero(cuerpo.idcliente); }
	if (consulta.idcliente !== undefined && consulta.idcliente !== null) { return aEntero(consulta.idcliente); }
	return 0;
};

// Fabrica del middleware. opciones.idcliente permite leer el id de otro lugar del body:
// user-account-remove manda { user: {...} } y calificar-servicio manda { dataCalificacion: {...} }.
const exigirCliente = (opciones) => {
	const config = opciones || {};
	const leerIdcliente = typeof config.idcliente === 'function' ? config.idcliente : idClienteDelBody;

	return (req, res, next) => {
		const modoActual = modo();
		if (modoActual === 'off') { return next(); }

		const token = tokenDeLaCabecera(req);
		const ruta = req.originalUrl || req.url || '';
		const pedido = aEntero(leerIdcliente(req));

		if (esColaborador(token)) { return next(); }

		const verificado = tokenCliente.verificar(token);

		if (!verificado) {
			// Nunca se loguea el token, solo el motivo y el idcliente pedido.
			logger.warn({ ruta, motivo: token ? 'token invalido' : 'sin token', idcliente: pedido }, 'auth cliente');
			if (modoActual === 'enforce') { return ReE(res, 'no autorizado', 401); }
			return next();
		}

		if (pedido > 0 && pedido !== verificado.idcliente) {
			logger.warn({ ruta, motivo: 'idcliente no coincide', idcliente: pedido, idclienteToken: verificado.idcliente }, 'auth cliente');
			if (modoActual === 'enforce') { return ReE(res, 'no autorizado', 403); }
			return next();
		}

		// Fuente de verdad para los handlers que quieran dejar de confiar en req.body.idcliente.
		req.cliente = { idcliente: verificado.idcliente };
		return next();
	};
};

// Decide a que sala cliente_<id> puede unirse un socket. idcliente 0 = no se une a ninguna.
// Es una funcion pura para poder probarla sin levantar socket.io.
const salaCliente = (token, idclientePedido) => {
	const modoActual = modo();
	const pedido = aEntero(idclientePedido);
	if (modoActual === 'off') { return { idcliente: pedido, motivo: null }; }

	const verificado = tokenCliente.verificar(token);
	if (verificado && (pedido === 0 || pedido === verificado.idcliente)) {
		return { idcliente: verificado.idcliente, motivo: null };
	}

	const motivo = !token ? 'sin token' : (!verificado ? 'token invalido' : 'idcliente no coincide');
	if (modoActual === 'enforce') { return { idcliente: 0, motivo }; }
	return { idcliente: pedido, motivo };
};

module.exports = {
	verificarTokenCliente: exigirCliente(),
	exigirCliente,
	salaCliente,
	modo,
	esColaborador,
	tokenDeLaCabecera,
	idClienteDelBody
};
