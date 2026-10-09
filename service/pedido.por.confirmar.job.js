// Caduca los pedidos por confirmar con mas de 30 min (quedan en BD con estado 3 para auditoria).
// ponytail: un solo proceso (pm2 instances:1), igual que idempotencia.js
const cron = require('node-cron');
const logger = require('../utilitarios/logger');
const ppc = require('./pedido.por.confirmar.service');

let job = null;

const iniciarJob = () => {
	if (job || process.env.PEDIDO_CONFIRMAR_JOB === '0') { return job; }
	job = cron.schedule('* * * * *', async () => {
		try {
			const n = await ppc.caducarVencidos();
			if (n) { logger.info({ caducados: n }, 'pedido-por-confirmar: caducados'); }
		} catch (err) {
			// sin la migracion aplicada la tabla no existe: se registra y se sigue
			logger.error({ err: err.message }, 'pedido-por-confirmar: error en job de caducidad');
		}
	});
	return job;
};

module.exports = { iniciarJob };
