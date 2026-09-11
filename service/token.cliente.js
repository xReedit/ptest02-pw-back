// Token de sesion del CLIENTE (consumidor de la PWA / app nativa).
//
// Secreto propio SEED_CLIENTE, distinto de SEED (colaboradores): un token de cliente
// nunca puede pasar por verificarToken de autentificacion.js ni al reves. El campo
// tipo documenta ademas la intencion.
//
// No se persiste ni se refresca: cada punto donde el backend establece la identidad
// (register-cliente-login, verificar-codigo-sms, ack de nuevoPedido) vuelve a emitirlo.
const jwt = require('jsonwebtoken');

const TIPO = 'cliente';
const DIAS_VIGENCIA = 180;
const VIGENCIA = `${DIAS_VIGENCIA}d`;

// Se lee en cada llamada y no al cargar el modulo: asi las pruebas pueden cambiar el
// secreto y un arranque sin la variable no queda cacheado para siempre.
const semilla = () => process.env.SEED_CLIENTE || '';

const esIdValido = (valor) => {
	const id = Number(valor);
	return Number.isInteger(id) && id > 0;
};

const emitir = (idcliente) => {
	if (!esIdValido(idcliente)) { return null; }
	if (!semilla()) { return null; }
	return jwt.sign({ idcliente: Number(idcliente), tipo: TIPO }, semilla(), { expiresIn: VIGENCIA });
};

// Acepta el token con y sin prefijo 'Bearer ' porque verificarToken de colaborador
// (autentificacion.js:9) lee la cabecera cruda y conviene un solo estilo en la app.
const verificar = (token) => {
	if (typeof token !== 'string') { return null; }
	const limpio = token.trim().replace(/^Bearer[ ]+/i, '');
	if (limpio === '' || !semilla()) { return null; }

	try {
		// algorithms fijo: sin esta lista jsonwebtoken acepta cualquier HS* de la cabecera
		// del propio token, asi que un HS512 firmado con la misma semilla pasaria igual.
		const decode = jwt.verify(limpio, semilla(), { algorithms: ['HS256'] });
		if (!decode || decode.tipo !== TIPO) { return null; }
		if (!esIdValido(decode.idcliente)) { return null; }
		return { idcliente: Number(decode.idcliente) };
	} catch (error) {
		// Firma mala, token vencido o basura: para el llamador es lo mismo, no hay sesion.
		return null;
	}
};

// Copia de las filas de un procedimiento con tokenCliente en la primera, cuando esa
// fila trae un idcliente usable. Nunca muta el arreglo ni la fila originales.
const conTokenCliente = (filas) => {
	if (!Array.isArray(filas) || filas.length === 0) { return filas; }

	const primera = filas[0];
	if (!primera || typeof primera !== 'object') { return filas; }

	const token = emitir(primera.idcliente);
	if (!token) { return filas; }

	return [Object.assign({}, primera, { tokenCliente: token })].concat(filas.slice(1));
};

module.exports = { emitir, verificar, conTokenCliente, semilla, TIPO, VIGENCIA, DIAS_VIGENCIA };
