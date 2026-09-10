const { ReE } = require('./uitl.service');

// Limitador simple por IP para rutas sin autenticar (pasarela de pago).
// ponytail: en memoria por proceso; pasar a redis si hay varias instancias
module.exports = (max, windowMs) => {
	const visitas = new Map();

	return (req, res, next) => {
		const ahora = Date.now();
		const clave = req.ip;

		const previas = (visitas.get(clave) || []).filter((t) => ahora - t < windowMs);

		if (previas.length >= max) {
			visitas.set(clave, previas);
			return ReE(res, 'Demasiadas solicitudes', 429);
		}

		previas.push(ahora);
		visitas.set(clave, previas);

		// se descartan las IPs cuya ventana ya vencio para no crecer sin limite
		if (visitas.size > 5000) {
			for (const [ip, marcas] of visitas) {
				if (!marcas.some((t) => ahora - t < windowMs)) { visitas.delete(ip); }
			}
		}

		return next();
	};
};
