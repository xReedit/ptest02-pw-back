/**
 * purga.job.js
 *
 * Limpieza diaria de las tablas que solo guardan informacion util del dia y hoy pesan 3 GB:
 *
 *   print_server_detalle     ~117k filas / 1410 MB   (detalle_json, 12 KB por fila)
 *   usuario_bitacora_cierre  ~101k filas / 1677 MB   (detalle_cierre, 16 KB por fila)
 *   pedido_preview           ~389 filas /    3 MB    (no mueve la aguja, va por completitud)
 *
 * APAGADO POR DEFECTO. Se enciende con la variable de entorno PURGA_DIARIA:
 *   sin definir / '0' -> el cron no se programa, no se toca la base
 *   'dry'             -> cuenta lo que borraria y lo loguea, NO borra
 *   '1'               -> borra de verdad
 *
 * Tambien se puede correr a mano:  node service/purga.job.js        (dry-run)
 *                                  node service/purga.job.js --real (borra)
 *
 * Que NO hace y por que:
 *
 * - No borra filas de usuario_bitacora_cierre, solo vacia detalle_cierre. registro_pago apunta
 *   ahi (idusuario_bitacora_cierre, migracion 030) y bdphp/api.php ?route=get-cierres-turno
 *   arma con eso el resumen que detecta el doble cierre de caja, para CUALQUIER fecha que elija
 *   el dueno. Borrar la fila rompe esa auditoria y deja pagos apuntando a un cierre inexistente.
 *   El peso esta en el longtext, no en la fila: vaciarlo libera el 98% y no pierde nada que se
 *   consulte (los impresores ya toleran el detalle vacio, ver print/client/cuadre-caja.txt:105).
 *
 * - No borra pedido_preview del dia. service/repartidor.socket.hooks.js la usa como marca
 *   "este pedido vino del chatbot" para avisar por WhatsApp cuando sale el delivery; un pedido
 *   de las 23:50 entregado a las 00:30 se quedaria sin aviso.
 *
 * - No reemplaza al DELETE que ya corre al cerrar caja (bdphp/log.php:2593). Ese solo limpia la
 *   sede del cajero que cierra; lo que queda es de sedes que no cierran nunca.
 *
 * El espacio NO vuelve al disco solo: despues del primer barrido hay que correr una vez
 *   OPTIMIZE TABLE print_server_detalle;  OPTIMIZE TABLE usuario_bitacora_cierre;
 * en madrugada (reconstruye solo lo que quedo, que ya es poco).
 */

let cron;
try {
    cron = require('node-cron');
} catch (e) {
    // node-cron no instalado, el job no se iniciara
}
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const logger = require('../utilitarios/logger');

const CONFIG = {
    CRON_SCHEDULE: '0 4 * * *',   // 4:00 AM, despues del cleanup de stock y de los locales que cierran 03:00
    TIMEZONE: 'America/Lima',

    DIAS_IMPRESION: 7,            // comandas, comprobantes, pruebas
    DIAS_CUADRE_CAJA: 10,         // idprint_server_estructura = 4, se reimprime desde indicadores
    DIAS_PREVIEW: 7,
    DIAS_DETALLE_CIERRE: 15,      // solo vacia el longtext, la fila queda

    LOTE: 2000,                   // filas por sentencia
    PAUSA_MS: 200,                // respiro entre lotes (hay replica escuchando el binlog)
    TOPE_MS: 10 * 60 * 1000       // tope por corrida; lo que falte sigue la noche siguiente
};

const ESTRUCTURA_CUADRE_CAJA = 4;

// La primera corrida arrastra ~100k filas. El tope de tiempo la parte en varias noches sin que
// el job quede colgado horas sobre la base.
// ponytail: si alguna vez hace falta que el backfill entre en una sola noche, se sube TOPE_MS a
// mano para esa corrida en vez de agregarle un modo mas al job.

const modo = () => {
    const v = (process.env.PURGA_DIARIA || '').toLowerCase();
    if (v === '1' || v === 'true') return 'real';
    if (v === 'dry') return 'dry';
    return 'off';
};

const pausa = (ms) => new Promise(r => setTimeout(r, ms));

const select = async (sql, replacements) =>
    sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

/** Filas afectadas por un DELETE/UPDATE (ejecutarConsulta devuelve true/false, no sirve para el loop). */
const afectadas = async (sql, replacements) => {
    const res = await sequelize.query(sql, { replacements, type: QueryTypes.RAW });
    return (res && res[0] && res[0].affectedRows) || 0;
};

/**
 * Id de corte: el id mas chico que todavia esta DENTRO de la retencion. Todo lo menor se purga.
 *
 * Se mira solo la cola de la tabla (ORDER BY id DESC LIMIT ventana) en vez de filtrar por fecha
 * sobre toda la tabla: no hay indice por fecha y un escaneo completo de 1.4 GB cada noche no se
 * justifica. Si la ventana quedara corta el corte sale conservador (purga de menos, nunca de
 * mas), por eso se le da varias veces el volumen diario real.
 *
 * ponytail: cuando las tablas esten chicas conviene un indice por fecha y esto se vuelve un
 * MIN(id) directo con WHERE fecha >= corte.
 */
const idDeCorte = async (tabla, pk, colFecha, dias, ventana) => {
    const filas = await select(
        `SELECT MIN(x.${pk}) AS corte FROM (
             SELECT ${pk}, ${colFecha} FROM ${tabla} ORDER BY ${pk} DESC LIMIT ${ventana}
         ) x WHERE x.${colFecha} >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [dias]);
    const corte = filas && filas[0] && filas[0].corte;
    return corte ? Number(corte) : null;
};

/**
 * Repite la sentencia por lotes hasta que no quede nada, se acabe el tiempo, o en dry-run.
 * Devuelve las filas tocadas (en dry-run, las que se tocarian).
 */
const porLotes = async (etiqueta, sqlLote, sqlContar, params, real, hasta) => {
    if (!real) {
        const filas = await select(sqlContar, params);
        return Number((filas && filas[0] && filas[0].n) || 0);
    }

    let total = 0;
    for (;;) {
        if (Date.now() > hasta) {
            logger.warn(`⏸️ [Purga] ${etiqueta}: tope de tiempo alcanzado, sigue manana (filas:${total})`);
            break;
        }
        const n = await afectadas(sqlLote, params);
        total += n;
        if (n < CONFIG.LOTE) break;
        await pausa(CONFIG.PAUSA_MS);
    }
    return total;
};

const purgarImpresion = async (real, hasta) => {
    // ~1.2k filas/dia: 60k de ventana son ~48 dias de margen sobre una retencion de 10
    const corte7 = await idDeCorte('print_server_detalle', 'idprint_server_detalle', 'fecha_hora_dt', CONFIG.DIAS_IMPRESION, 60000);
    const corte10 = await idDeCorte('print_server_detalle', 'idprint_server_detalle', 'fecha_hora_dt', CONFIG.DIAS_CUADRE_CAJA, 60000);
    if (!corte7 || !corte10) return { comandas: 0, cuadres: 0 };

    // Las filas viejas con fecha_hora_dt NULL (anteriores a esa columna) caen solas: estan por
    // debajo del corte, que se calcula sobre la cola de la tabla.
    const comandas = await porLotes('impresion',
        `DELETE FROM print_server_detalle
          WHERE idprint_server_detalle < ? AND idprint_server_estructura <> ?
          LIMIT ${CONFIG.LOTE}`,
        `SELECT COUNT(*) AS n FROM print_server_detalle
          WHERE idprint_server_detalle < ? AND idprint_server_estructura <> ?`,
        [corte7, ESTRUCTURA_CUADRE_CAJA], real, hasta);

    const cuadres = await porLotes('cuadre-caja',
        `DELETE FROM print_server_detalle
          WHERE idprint_server_detalle < ? AND idprint_server_estructura = ?
          LIMIT ${CONFIG.LOTE}`,
        `SELECT COUNT(*) AS n FROM print_server_detalle
          WHERE idprint_server_detalle < ? AND idprint_server_estructura = ?`,
        [corte10, ESTRUCTURA_CUADRE_CAJA], real, hasta);

    return { comandas, cuadres };
};

const purgarPreview = async (real, hasta) =>
    // tiene idx_created_at, aca si se filtra por fecha directo
    porLotes('pedido_preview',
        `DELETE FROM pedido_preview WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT ${CONFIG.LOTE}`,
        `SELECT COUNT(*) AS n FROM pedido_preview WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [CONFIG.DIAS_PREVIEW], real, hasta);

const vaciarDetalleCierre = async (real, hasta) => {
    // ~40 filas/dia: 20k de ventana son mas de un ano de margen
    const corte = await idDeCorte('usuario_bitacora_cierre', 'idusuario_bitacora_cierre', 'fecha_hora', CONFIG.DIAS_DETALLE_CIERRE, 20000);
    if (!corte) return 0;

    return porLotes('detalle_cierre',
        `UPDATE usuario_bitacora_cierre SET detalle_cierre = NULL
          WHERE idusuario_bitacora_cierre < ? AND detalle_cierre IS NOT NULL
          LIMIT ${CONFIG.LOTE}`,
        `SELECT COUNT(*) AS n FROM usuario_bitacora_cierre
          WHERE idusuario_bitacora_cierre < ? AND detalle_cierre IS NOT NULL`,
        [corte], real, hasta);
};

/** Corrida completa. real=false solo cuenta. */
const ejecutarPurga = async (real) => {
    const inicio = Date.now();
    const hasta = inicio + CONFIG.TOPE_MS;
    logger.debug(`🧹 [Purga] Iniciando (${real ? 'BORRANDO' : 'dry-run, no borra'})`);

    try {
        const impresion = await purgarImpresion(real, hasta);
        const previews = await purgarPreview(real, hasta);
        const cierres = await vaciarDetalleCierre(real, hasta);

        const resumen = {
            impresionBorradas: impresion.comandas,
            cuadreCajaBorradas: impresion.cuadres,
            previewBorradas: previews,
            detalleCierreVaciados: cierres,
            segundos: Math.round((Date.now() - inicio) / 1000),
            real
        };
        logger.debug(resumen, `✅ [Purga] ${real ? 'Completada' : 'Simulacion completada'}`);
        return { success: true, ...resumen };

    } catch (error) {
        logger.error({ error: error.message }, '❌ [Purga] Error ejecutando la purga');
        return { success: false, error: error.message };
    }
};

let jobInstance = null;

const iniciarJob = () => {
    const m = modo();

    if (m === 'off') {
        logger.debug('⏸️ [Purga] Deshabilitada (PURGA_DIARIA sin definir). Para activarla: PURGA_DIARIA=dry y luego PURGA_DIARIA=1');
        return null;
    }
    if (!cron) {
        logger.debug('⏸️ [Purga] node-cron no instalado, job no iniciado');
        return null;
    }
    if (jobInstance) {
        logger.warn('⚠️ [Purga] Job ya esta corriendo');
        return jobInstance;
    }

    jobInstance = cron.schedule(CONFIG.CRON_SCHEDULE, async () => {
        await ejecutarPurga(m === 'real');
    }, { scheduled: true, timezone: CONFIG.TIMEZONE });

    // A diferencia del cleanup de stock, aca NO se ejecuta al arrancar: un reinicio al mediodia
    // no tiene por que ponerse a borrar 100k filas con el local lleno.
    logger.debug({ schedule: CONFIG.CRON_SCHEDULE, modo: m }, '✅ [Purga] Job programado');
    return jobInstance;
};

const detenerJob = () => {
    if (jobInstance) {
        jobInstance.stop();
        jobInstance = null;
        logger.debug('🛑 [Purga] Job detenido');
    }
};

module.exports = { ejecutarPurga, iniciarJob, detenerJob, CONFIG };

// Corrida a mano: dry-run salvo --real
if (require.main === module) {
    const real = process.argv.includes('--real');
    ejecutarPurga(real)
        .then(r => { console.log(r); process.exit(r.success ? 0 : 1); })
        .catch(e => { console.error(e); process.exit(1); });
}
