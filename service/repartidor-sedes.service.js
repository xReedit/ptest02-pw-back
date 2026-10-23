/**
 * repartidor-sedes.service.js
 * "Sedes que atiende" un repartidor = su sede de casa (repartidor.idsede_suscrito) ∪ repartidor_sede_atiende.
 * Las sedes extra solo cuentan si son de la misma org que la casa y están operables (estado = 0, sin bloqueo ni baja,
 * misma regla que sede-estado.service.js). La casa siempre cuenta: con una sola sede todo queda igual que antes.
 * Repartidor global (idsede_suscrito NULL/0) → [].
 * Plan: restobar/plan/REPARTIDOR-MULTISEDE-PLAN.md (Tarea 8).
 */
const QueryServiceV1 = require('./query.service.v1');

const SQL_SEDES_QUE_ATIENDE = `SELECT r.idsede_suscrito AS idsede FROM repartidor r
		WHERE r.idrepartidor = ? AND COALESCE(r.idsede_suscrito, 0) > 0
	UNION
	SELECT s.idsede FROM repartidor r
		INNER JOIN repartidor_sede_atiende rsa ON rsa.idrepartidor = r.idrepartidor
		INNER JOIN sede casa ON casa.idsede = r.idsede_suscrito
		INNER JOIN sede s ON s.idsede = rsa.idsede AND s.idorg = casa.idorg
		LEFT JOIN sede_estado se ON se.idsede_estado = (SELECT MAX(x.idsede_estado) FROM sede_estado x WHERE x.idsede = s.idsede)
		WHERE r.idrepartidor = ? AND s.estado = 0
		  AND IFNULL(se.is_bloqueado, '0') = '0' AND IFNULL(se.is_baja, '0') = '0'`;

/** idsede[] sin repetidos; [] si es global o no existe. */
async function sedesQueAtiende(idrepartidor) {
	const rows = await QueryServiceV1.ejecutarConsulta(SQL_SEDES_QUE_ATIENDE, [idrepartidor, idrepartidor], 'SELECT', 'sedesQueAtiende');
	return Array.from(new Set((rows || []).map(r => Number(r.idsede)).filter(id => id > 0)));
}

/** repartidor.* activos (estado = 0) cuya casa es idsede o que la atienden por la tabla. */
async function repartidoresDeSede(idsede) {
	const rows = await QueryServiceV1.ejecutarConsulta(
		`SELECT r.* FROM repartidor r
		WHERE r.estado = 0 AND (r.idsede_suscrito = ?
			OR r.idrepartidor IN (SELECT rsa.idrepartidor FROM repartidor_sede_atiende rsa WHERE rsa.idsede = ?))`,
		[idsede, idsede], 'SELECT', 'repartidoresDeSede');
	return rows || [];
}

module.exports = { sedesQueAtiende, repartidoresDeSede };
