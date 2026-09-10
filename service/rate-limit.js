const { ReE } = require('./uitl.service');

// Limitador simple por IP para rutas sin autenticar (pasarela de pago).
// ponytail: en memoria por proceso; pasar a redis si hay varias instancias
const MAX_CLAVES = 5000;

module.exports = (max, windowMs) => {
	const visitas = new Map();

	// El ultimo salto de x-forwarded-for es el que agrega nuestro nginx, o sea el peer real;
	// los saltos anteriores los puede inventar el cliente para saltarse el limite.
	// ponytail: cabecera confiable solo detras del proxy propio; app.set('trust proxy') queda para cuando app.js este libre
	const ipReal = (req) => {
		const reenviada = req.headers && req.headers['x-forwarded-for'];
		if (typeof reenviada === 'string' && reenviada.trim() !== '') {
			const saltos = reenviada.split(',').map((p) => p.trim()).filter((p) => p !== '');
			if (saltos.length > 0) { return saltos[saltos.length - 1]; }
		}
		return req.ip;
	};

	return (req, res, next) => {
		const ahora = Date.now();
		const clave = ipReal(req);

		const previas = (visitas.get(clave) || []).filter((t) => ahora - t < windowMs);

		if (previas.length >= max) {
			visitas.set(clave, previas);
			return ReE(res, 'Demasiadas solicitudes', 429);
		}

		previas.push(ahora);
		visitas.set(clave, previas);

		// se descartan las IPs cuya ventana ya vencio para no crecer sin limite
		if (visitas.size > MAX_CLAVES) {
			for (const [ip, marcas] of visitas) {
				if (!marcas.some((t) => ahora - t < windowMs)) { visitas.delete(ip); }
			}
			// si todas siguen vigentes, se sueltan las mas antiguas (el Map conserva el orden de insercion)
			while (visitas.size > MAX_CLAVES) {
				visitas.delete(visitas.keys().next().value);
			}
		}

		return next();
	};
};
