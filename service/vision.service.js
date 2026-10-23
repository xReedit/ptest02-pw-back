// vision.service.js — lectura de cuentas para el puente /vision/v1 (Cámaras IA).
//
// El servidor Go decide "sin atención" y "cuenta abierta" con esto, así que una
// cuenta abierta es EXACTAMENTE la de Control de pedidos (bdphp/log.php):
//   bandera = call lastIdPedidoSede(idsede, 1)          (case 50701)
//   abierta = p.idpedido >= bandera AND p.idsede = ? AND p.estado IN (0,1)   (case 507)
//             y con algún ítem vivo, como el mapa de mesas (procedure_refresh_mesas_501)
// Diferencias a propósito (test/vision.contrato507.test.js las fija):
//   - sin filtro de mesa: trae la sede entera y el Go agrupa con ClaveMesa (choque 2:
//     507 arma p.nummesa=<m> sin comillas y una mesa alfanumérica rompe su SQL);
//   - no baja la bandera para ver cuentas viejas (choque 3): el puente no tiene tarjeta.
// lastIdPedidoSede modo 1 puede recalcular y escribir pedido_correlativos de la sede,
// igual que abrir Control de pedidos; el Go cachea 20 s por sede.
//
// Falla cerrado (F2-R12): toda consulta LANZA ante un error de SQL y el controlador
// responde 500. No se usa QueryServiceV1.ejecutarConsulta: devuelve [] ante un error,
// y un "sin cuentas" / "sin pedidos" falso haría alertar "sin atención" al Go.

const { sequelize, QueryTypes } = require('../config/database');
const logger = require('../utilitarios/logger');

// Tope por consulta: el cliente Go abandona a los 5 s. Sequelize 6 no pasa `timeout`
// a mysql2, así que se corta aquí; MySQL puede seguir con la consulta, pero el puente
// responde 500 (falla cerrado) en vez de contestar tarde.
const TOPE_MS = 5000;
// Plazo total de leerCuentas (4 consultas en serie), el mismo que el del Go: cada
// consulta tiene a lo más lo que queda y, vencido, la siguiente no se lanza (I4: con
// MySQL lento no se le apilan lecturas que nadie va a esperar). Mismo error → 500.
const PLAZO_TOTAL_MS = TOPE_MS;

const sinRespuesta = (sql) => new Error(`consulta sin respuesta en ${TOPE_MS} ms: ${sql.trim().slice(0, 60)}`);

function conTope(promesa, sql, ms = TOPE_MS) {
    let reloj;
    const tope = new Promise((_, rechazar) => {
        reloj = setTimeout(() => rechazar(sinRespuesta(sql)), ms);
    });
    return Promise.race([promesa, tope]).finally(() => clearTimeout(reloj));
}

// Tope de la consulta sql si la lectura vence en fin: lo que queda (a lo más TOPE_MS).
// Ya vencida, lanza el mismo error del tope sin lanzar la consulta.
function restante(fin, sql) {
    const ms = Math.min(TOPE_MS, fin - Date.now());
    if (ms <= 0) throw sinRespuesta(sql);
    return ms;
}

// SELECT estricto: lanza si MySQL falla o tarda más de ms (5 s); [] solo si de verdad no hay filas.
function seleccionar(sql, replacements, ms) {
    return conTope(sequelize.query(sql, { replacements, type: QueryTypes.SELECT }), sql, ms);
}

// CALL estricto. Sequelize devuelve [{"0": fila, "1": fila…}, OkPacket]; mismo
// desempaquetado que QueryServiceV1.ejecutarProcedimiento, pero sin tragarse el error.
async function llamar(sql, replacements, ms) {
    const r = await conTope(sequelize.query(sql, { replacements, type: QueryTypes.SELECT }), sql, ms);
    return r && r[0] && typeof r[0] === 'object' ? Object.values(r[0]) : [];
}

const SQL = {
    bandera: 'call lastIdPedidoSede(?, 1)',
    // case 507 (log.php:2101-2110) sin filtro de mesa ni sus joins (son LEFT JOIN por PK:
    // no cambian el conjunto de filas) y, como 507, sin ORDER BY (no empuja al optimizador
    // hacia PRIMARY). Además, como el mapa de mesas (procedure_refresh_mesas_501), solo con
    // algún ítem vivo (pagado=0, estado=0) y el total es lo que falta cobrar de esos ítems:
    // un pedido sin ítems vivos se ve libre en Control de Mesas y caja no lo puede cobrar.
    // Índices (EXPLAIN dev): pedido_idsede_IDX (range) + pedido_detalle_idpedido_IDX (ref).
    cuentas: `SELECT p.idpedido, p.nummesa, p.fecha, p.hora, p.is_from_client_pwa, SUM(pd.ptotal) AS total
        FROM pedido AS p
        INNER JOIN pedido_detalle AS pd ON pd.idpedido = p.idpedido AND pd.pagado = 0 AND pd.estado = 0
        WHERE p.idpedido >= ? AND p.idsede = ? AND p.estado IN (0,1)
        GROUP BY p.idpedido`,
    // Pendientes de confirmar (carta QR). idx_ppc_sede_estado_fecha; caducan a los 30 min,
    // el tope de 1 día solo acota el rango si el job de caducidad está apagado.
    porConfirmar: `SELECT mesa, DATE_FORMAT(fecha_registro, '%Y-%m-%dT%H:%i:%s-05:00') AS creado
        FROM pedido_por_confirmar
        WHERE idsede = ? AND estado = '0' AND fecha_registro >= NOW() - INTERVAL 1 DAY
        ORDER BY fecha_registro`,
    corte: 'SELECT hora_cierre_dia FROM sede_opciones WHERE idsede = ?',
    // Pedidos de la sede desde "desde" (idx_idsede_fecha_hora, migración 069). La mesa se
    // filtra en JS con claveMesa. fecha_hora se guarda en hora local de Lima.
    pedidos: `SELECT p.idpedido, p.nummesa, p.fecha, p.hora, p.is_from_client_pwa, p.total, p.estado,
            (SELECT DATE_FORMAT(MAX(STR_TO_DATE(rp.fecha, '%d/%m/%Y %H:%i:%s')), '%Y-%m-%dT%H:%i:%s-05:00')
               FROM registro_pago_pedido AS rpp
               INNER JOIN registro_pago AS rp ON rp.idregistro_pago = rpp.idregistro_pago
              WHERE rpp.idpedido = p.idpedido) AS pagado_en
        FROM pedido AS p
        WHERE p.idsede = ? AND p.fecha_hora >= ? AND p.estado <> 3
        ORDER BY p.fecha_hora, p.idpedido`,
};

const SIN_MESA = new Set(['', '0']);
const LIMA_MS = -5 * 3600 * 1000; // America/Lima: UTC-5 fijo, sin horario de verano

// Igual que protocolo.ClaveMesa (Go): sin espacios; si solo son dígitos, sin ceros a
// la izquierda ("05" → "5", "0" → "0"); si no, en mayúsculas ("s1-05" → "S1-05").
function claveMesa(s) {
    const c = String(s == null ? '' : s).replace(/\s+/g, '');
    if (!/^\d+$/.test(c)) return c.toUpperCase();
    return c.replace(/^0+/, '') || '0';
}

// pedido.total es varchar con el format() del legacy ("1,234.50"). El Go rechaza
// la sede entera ante un total inválido; uno ilegible (nunca visto) va como 0.
function normalizarTotal(s) {
    const n = Number(String(s == null ? '' : s).replace(/,/g, '').trim());
    if (s == null || !Number.isFinite(n)) {
        logger.warn({ total: s }, '[vision] total ilegible, se manda 0.00');
        return '0.00';
    }
    return n.toFixed(2);
}

const dos = (x) => String(x).padStart(2, '0');

// fecha 'dd/mm/yyyy' (o 'yyyy-mm-dd', que dejan algunos pedidos de app) + hora
// 'HH:MM:SS' → ISO con -05:00. Ilegible → null.
function creadoISO(fecha, hora) {
    const f = String(fecha || '').trim();
    const h = String(hora || '').trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    let d = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    let ymd = d && [d[3], d[2], d[1]];
    if (!ymd) {
        d = f.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        ymd = d && [d[1], d[2], d[3]];
    }
    if (!ymd || !h) return null;
    return `${ymd[0]}-${dos(ymd[1])}-${dos(ymd[2])}T${dos(h[1])}:${h[2]}:${h[3] || '00'}-05:00`;
}

function origenDe(fila) {
    return Number(fila && fila.is_from_client_pwa) === 1 ? 'qr' : 'personal';
}

// sede_opciones.hora_cierre_dia: '0' / vacío / sin fila = '00:00' (igual que la 071).
function corteDia(v) {
    const s = String(v == null ? '' : v).trim();
    const m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?$/);
    if (!m || Number(m[1]) > 23) {
        if (s !== '') logger.warn({ hora_cierre_dia: v }, '[vision] hora_cierre_dia ilegible, se usa 00:00');
        return '00:00';
    }
    return `${dos(m[1])}:${m[2] || '00'}`;
}

// Instante → 'yyyy-mm-dd HH:MM:SS' en hora de Lima (para comparar con pedido.fecha_hora).
function limaLocal(fecha) {
    return new Date(fecha.getTime() + LIMA_MS).toISOString().slice(0, 19).replace('T', ' ');
}

async function leerBandera(idsede, ms) {
    const filas = await llamar(SQL.bandera, [idsede], ms);
    const bandera = filas[0] ? Number(filas[0].idpedido) : NaN;
    // Sin bandera no se puede responder: un "sin cuentas" falso haría alertar al Go.
    if (!Number.isInteger(bandera) || bandera < 0) {
        throw new Error(`lastIdPedidoSede(${idsede}, 1) no devolvió bandera`);
    }
    return bandera;
}

async function leerCuentas(idsede) {
    const fin = Date.now() + PLAZO_TOTAL_MS;
    const bandera = await leerBandera(idsede, restante(fin, SQL.bandera));
    const filas = await seleccionar(SQL.cuentas, [bandera, idsede], restante(fin, SQL.cuentas));
    const ppc = await seleccionar(SQL.porConfirmar, [idsede], restante(fin, SQL.porConfirmar));
    const corte = await seleccionar(SQL.corte, [idsede], restante(fin, SQL.corte));

    const cuentas = filas
        .filter((f) => !SIN_MESA.has(claveMesa(f.nummesa)))
        .map((f) => ({
            idpedido: Number(f.idpedido),
            mesa: String(f.nummesa),
            creado: creadoISO(f.fecha, f.hora),
            origen: origenDe(f),
            total: normalizarTotal(f.total),
        }));

    return {
        corte_dia: corteDia(corte[0] ? corte[0].hora_cierre_dia : null),
        cuentas,
        por_confirmar: ppc.map((p) => ({ mesa: String(p.mesa), creado: p.creado })),
    };
}

// desde: Date (el controlador ya validó que es ≥ ahora − 24 h).
async function leerPedidosMesa(idsede, mesa, desde) {
    const clave = claveMesa(mesa);
    const filas = await seleccionar(SQL.pedidos, [idsede, limaLocal(desde)]);
    const pedidos = filas
        .filter((f) => claveMesa(f.nummesa) === clave)
        .map((f) => {
            const pagado = Number(f.estado) === 2;
            return {
                idpedido: Number(f.idpedido),
                creado: creadoISO(f.fecha, f.hora),
                origen: origenDe(f),
                total: normalizarTotal(f.total),
                pagado,
                pagado_en: pagado && f.pagado_en ? f.pagado_en : null,
            };
        });
    return { pedidos };
}

module.exports = {
    SQL,
    claveMesa,
    normalizarTotal,
    creadoISO,
    origenDe,
    corteDia,
    limaLocal,
    leerCuentas,
    leerPedidosMesa,
};
