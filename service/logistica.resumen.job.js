// Logistica: resumen del dia por WhatsApp. Cada hora en punto le avisa al POS (restobar
// bdphp/abastecimiento/resumen_auto.php), que decide a que empresas les toca, redacta y envia por
// /chatbot/emitir. APAGADO sin LOGISTICA_RESUMEN_URL y LOGISTICA_CRON_KEY en el entorno.
// ponytail: un solo proceso (pm2 instances:1); con varias instancias el POS igual evita el doble envio.
const cron = require('node-cron');
const logger = require('../utilitarios/logger');

let job = null;

const avisar = async () => {
	try {
		const r = await fetch(process.env.LOGISTICA_RESUMEN_URL, {
			method: 'POST',
			headers: { 'x-api-key': process.env.LOGISTICA_CRON_KEY },
			signal: AbortSignal.timeout(120000),
		});
		const j = await r.json().catch(() => null);
		if (!r.ok || !j || !j.success) { logger.error({ status: r.status, error: j && j.error }, 'logistica-resumen: el POS respondio error'); return; }
		if (j.data.length) { logger.info({ envios: j.data }, 'logistica-resumen: enviados'); }
	} catch (err) {
		logger.error({ err: err.message }, 'logistica-resumen: no se pudo llamar al POS');
	}
};

const iniciarJob = () => {
	if (job || !process.env.LOGISTICA_RESUMEN_URL || !process.env.LOGISTICA_CRON_KEY) { return job; }
	job = cron.schedule('0 * * * *', avisar, { timezone: 'America/Lima' });
	return job;
};

module.exports = { iniciarJob, avisar };
