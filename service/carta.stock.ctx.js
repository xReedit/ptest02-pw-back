/**
 * carta.stock.ctx.js
 *
 * Contexto de auditoria para movimientos de carta_lista (migracion 021).
 * El trigger carta_lista_historial_au registra TODO cambio de carta_lista.cantidad;
 * estas variables de sesion (@stk_ctx_*) le pasan tipo/pedido/usuario cuando el
 * escritor es este backend. Sin contexto, el trigger infiere el tipo por signo.
 *
 * Solo se setea dentro de una transaccion (misma conexion garantizada por el
 * pool). Sin transaccion NO se setea nada: el trigger igual registra el
 * movimiento, solo que sin metadata.
 *
 * Regla: NUNCA lanza error — la auditoria no puede romper una venta.
 */

const { sequelize } = require('../config/database');
const logger = require('../utilitarios/logger');

/**
 * Deriva el tipo de movimiento para el historial de carta.
 * RECUPERA se evalua ANTES que esReset: una recuperacion llega con cantidad_reset > 0,
 * asi que con el orden inverso la rama RECUPERA era codigo muerto y toda devolucion
 * se etiquetaba RESET. `op` puede llegar como numero o string segun el flujo.
 * @returns {string|null} null si no hay operacion identificable (el trigger infiere)
 */
function derivarTipoMovimiento({ esReset, fromMonitor, delta, op }) {
    if (fromMonitor) return 'MONITOR';
    if (op !== undefined && op !== null && String(op).toUpperCase().includes('RECUPERA')) return 'RECUPERA';
    if (esReset) return 'RESET';
    if (delta < 0) return 'VENTA';
    if (delta > 0) return 'DEVOLUCION';
    return null;
}

/** Setea el contexto en la conexion de la transaccion. */
async function setStockCtx({ tipo, idpedido, idusuario }, transaction) {
    if (!transaction) return false; // sin conexion fija el SET puede caer en otra conexion del pool
    try {
        await sequelize.query(
            'SET @stk_ctx_tipo = ?, @stk_ctx_idpedido = ?, @stk_ctx_idusuario = ?',
            { replacements: [tipo || null, idpedido || null, idusuario || null], transaction }
        );
        return true;
    } catch (error) {
        logger.warn({ error: error.message }, '⚠️ [carta.stock.ctx] No se pudo setear contexto');
        return false;
    }
}

/**
 * Limpia el contexto. CRITICO: las variables @ viven en la CONEXION, no en la
 * transaccion — un ROLLBACK NO las revierte. Si no se limpian, la conexion vuelve
 * al pool (compartido por todas las sedes) con el idpedido/idusuario de otro
 * restaurante y el siguiente escritor que no setee contexto los hereda.
 * Por eso los llamadores DEBEN invocarla en un `finally`.
 */
async function clearStockCtx(transaction) {
    if (!transaction) return;
    try {
        await sequelize.query(
            'SET @stk_ctx_tipo = NULL, @stk_ctx_idpedido = NULL, @stk_ctx_idusuario = NULL',
            { transaction }
        );
    } catch (error) {
        logger.warn({ error: error.message }, '⚠️ [carta.stock.ctx] No se pudo limpiar contexto');
    }
}

/**
 * Ejecuta `fn` con el contexto seteado y lo limpia SIEMPRE, incluso si `fn` lanza.
 * Es la unica forma correcta de usar el contexto: envuelve el UPDATE de carta_lista.
 */
async function conStockCtx(ctx, transaction, fn) {
    await setStockCtx(ctx, transaction);
    try {
        return await fn();
    } finally {
        await clearStockCtx(transaction);
    }
}

module.exports = { derivarTipoMovimiento, setStockCtx, clearStockCtx, conStockCtx };
