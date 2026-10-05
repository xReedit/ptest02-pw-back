/**
 * sede-estado.service.js
 * Regla única: una sede se puede usar solo si la sede y su org están activas (estado = 0)
 * y su ÚLTIMA fila de sede_estado no está bloqueada ni dada de baja (sin fila = activa).
 * La misma regla vive en el legacy (bdphp/_sede_estado.php) y en restobar-consola (sedes.ts).
 */
const QueryServiceV1 = require('./query.service.v1');

const MENSAJE_SEDE_BLOQUEADA = 'Servicio suspendido para esta sede. Comunícate con Papaya.';
const TTL_MS = 60 * 1000; // ponytail: caché en memoria por proceso; un bloqueo tarda hasta 60 s en notarse

const SQL = `SELECT 1 AS ok
        FROM sede s
        INNER JOIN org o ON o.idorg = s.idorg
        LEFT JOIN sede_estado se ON se.idsede_estado = (SELECT MAX(x.idsede_estado) FROM sede_estado x WHERE x.idsede = s.idsede)
        WHERE s.idsede = ? AND s.estado = 0 AND o.estado = 0
          AND IFNULL(se.is_bloqueado, '0') = '0' AND IFNULL(se.is_baja, '0') = '0'`;

const cache = new Map(); // idsede -> { ok, hasta }

/** true = la sede se puede usar. Ante un error de BD no se bloquea a nadie (fail-open) y no se cachea. */
async function sedeHabilitada(idsede) {
        const id = Number(idsede);
        if (!Number.isInteger(id) || id <= 0) return true; // tokens sin sede (repartidor, etc.)
        const c = cache.get(id);
        if (c && c.hasta > Date.now()) return c.ok;
        try {
                const rows = await QueryServiceV1.ejecutarConsulta(SQL, [id], 'SELECT', 'sedeHabilitada');
                const ok = Array.isArray(rows) && rows.length > 0;
                cache.set(id, { ok, hasta: Date.now() + TTL_MS });
                return ok;
        } catch (err) {
                return true;
        }
}

module.exports = { sedeHabilitada, MENSAJE_SEDE_BLOQUEADA, SQL_SEDE_HABILITADA: SQL };
