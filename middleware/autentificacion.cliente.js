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

// Sin SEED no se puede verificar NINGUN token de colaborador: esColaborador devolveria
// false siempre y, en enforce, el comercio dejaria de poder tomar pedidos por el cliente.
// No se lanza (SEED es de otro subsistema y romperia arranques que hoy funcionan), pero
// tiene que verse en el log. Nunca se imprime el valor.
if (!SEED) {
	logger.warn({ modo: modo() }, 'auth cliente: falta SEED, ningun token de colaborador podra validarse');
}

const aEntero = (valor) => {
	const n = Number(valor);
	return Number.isInteger(n) && n > 0 ? n : 0;
};

// Un idcliente "presente pero raro" ('99abc', ['99','15'], {}, 0, '') NO es lo mismo que
// un idcliente ausente: lo primero es un intento de saltarse la comparacion (basta con
// mandar basura para que el middleware no compare nada), lo segundo es una ruta que
// simplemente no manda idcliente. Por eso se clasifica en tres estados y solo el AUSENTE
// se salta la comparacion.
const AUSENTE = 'ausente';
const INVALIDO = 'invalido';
const VALIDO = 'valido';

const clasificarIdcliente = (valor) => {
	if (valor === undefined || valor === null) { return { estado: AUSENTE, idcliente: 0 }; }
	// objetos y arreglos (query strings repetidos: ?idcliente=99&idcliente=15) nunca son un id
	if (typeof valor !== 'number' && typeof valor !== 'string') { return { estado: INVALIDO, idcliente: 0 }; }
	const texto = String(valor).trim();
	if (!/^[0-9]+$/.test(texto)) { return { estado: INVALIDO, idcliente: 0 }; }
	const n = Number(texto);
	if (!Number.isInteger(n) || n <= 0) { return { estado: INVALIDO, idcliente: 0 }; }
	return { estado: VALIDO, idcliente: n };
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

// Devuelve el valor CRUDO (sin convertir) para que el llamador pueda distinguir
// "no vino" de "vino algo que no sirve". La precedencia es por presencia de la clave: si
// el body trae idcliente manda el body, aunque su valor sea invalido; asi nadie se salta
// la comparacion mandando basura en el body y el id real en el query.
const idClienteDelBody = (req) => {
	const cuerpo = (req && req.body) ? req.body : {};
	const consulta = (req && req.query) ? req.query : {};
	if (cuerpo.idcliente !== undefined && cuerpo.idcliente !== null) { return cuerpo.idcliente; }
	if (consulta.idcliente !== undefined && consulta.idcliente !== null) { return consulta.idcliente; }
	return undefined;
};

// Fabrica del middleware. opciones.idcliente permite leer el id de otro lugar del body:
// user-account-remove manda { user: {...} } y calificar-servicio manda { dataCalificacion: {...} }.
// El extractor devuelve el valor crudo y undefined cuando de verdad no hay nada.
const exigirCliente = (opciones) => {
	const config = opciones || {};
	const leerIdcliente = typeof config.idcliente === 'function' ? config.idcliente : idClienteDelBody;

	return (req, res, next) => {
		const modoActual = modo();
		if (modoActual === 'off') { return next(); }

		const token = tokenDeLaCabecera(req);
		const ruta = req.originalUrl || req.url || '';
		const pedido = clasificarIdcliente(leerIdcliente(req));

		if (esColaborador(token)) { return next(); }

		const verificado = tokenCliente.verificar(token);

		if (!verificado) {
			// Nunca se loguea el token, solo el motivo y el idcliente pedido.
			logger.warn({ ruta, motivo: token ? 'token invalido' : 'sin token', idcliente: pedido.idcliente }, 'auth cliente');
			if (modoActual === 'enforce') { return ReE(res, 'no autorizado', 401); }
			return next();
		}

		// Un id invalido cuenta como que NO coincide: si se tratara como ausente, mandar
		// idcliente: '99abc' seria suficiente para que no se compare nada.
		if (pedido.estado === INVALIDO || (pedido.estado === VALIDO && pedido.idcliente !== verificado.idcliente)) {
			const motivo = pedido.estado === INVALIDO ? 'idcliente invalido' : 'idcliente no coincide';
			logger.warn({ ruta, motivo, idcliente: pedido.idcliente, idclienteToken: verificado.idcliente }, 'auth cliente');
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
