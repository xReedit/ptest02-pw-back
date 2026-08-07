/**
 * producto.movements.service.js
 *
 * Registra movimientos de stock de PRODUCTOS de almacen en producto_historial,
 * espejo de porcion.movements/registrarHistorialPorcion para porciones.
 *
 * Motivo: los descuentos de producto_stock no dejaban rastro en tiempo real
 * (solo filas agregadas "POR DIA" que reconstruye procedure_producto_historial),
 * asi que un faltante de bebidas era indiagnosticable (caso aguas Cazador 04-08-2026).
 *
 * Todos los origenes (control de pedidos, punto de venta, app mozo) convergen en
 * el backend via socket `itemModificado`, por eso registrar aqui cubre los tres.
 *
 * Regla: NUNCA lanza error — el registro de historial no puede romper una venta.
 */

const { sequelize, Sequelize } = require('../config/database');
const logger = require('../utilitarios/logger');

// ponytail: si la migracion 018 (idpedido/stock_total) no esta aplicada aun,
// se hace fallback al esquema legacy; se recuerda para no reintentar cada vez.
let columnasExtendidas = true;

/**
 * Registra un movimiento de producto en producto_historial.
 * Llamar DESPUES de actualizar producto_stock (stock_total = stock resultante).
 *
 * @param {Object} datos
 * @param {number} datos.idproductoStock - idproducto_stock afectado
 * @param {number} datos.cantidad - delta aplicado (negativo = venta, positivo = devolucion)
 * @param {number} datos.idsede
 * @param {number} [datos.idusuario]
 * @param {number|null} [datos.idpedido]
 * @param {string} [datos.tipoMovimiento] - por defecto VENTA / VENTA DEVOLUCION segun signo
 * @param {Object} [transaction] - transaccion Sequelize (opcional)
 * @returns {Promise<boolean>} true si registro, false si omitido o fallo
 */
async function registrarMovimientoProducto(datos, transaction = null) {
    const { idproductoStock, cantidad, idsede, idusuario, idpedido } = datos;

    try {
        if (!idproductoStock || !cantidad || isNaN(cantidad)) {
            return false; // sin producto o delta 0: nada que registrar
        }

        const tipoMovimiento = datos.tipoMovimiento
            || (cantidad < 0 ? 'VENTA' : 'VENTA DEVOLUCION');

        // Resolver idproducto/idalmacen/stock: producto_historial se consulta por
        // (idproducto, idalmacen), no por idproducto_stock (ver procedure_producto_historial)
        const [ps] = await sequelize.query(
            'SELECT idproducto, idalmacen, stock FROM producto_stock WHERE idproducto_stock = ?',
            {
                replacements: [idproductoStock],
                type: Sequelize.QueryTypes.SELECT,
                transaction
            }
        );

        if (!ps) {
            logger.warn({ idproductoStock }, '⚠️ [producto.movements] producto_stock no encontrado');
            return false;
        }

        // cantidad en magnitud + tipo con el signo (igual que porcion_historial)
        const baseCols = 'tipo_movimiento, fecha, hora, cantidad, idusuario, idsede, idproducto, idalmacen, estado';
        const baseVals = "?, DATE_FORMAT(NOW(), '%Y-%m-%d'), DATE_FORMAT(NOW(), '%h:%i %p'), ?, ?, ?, ?, ?, '0'";
        const baseRepl = [
            tipoMovimiento,
            String(Math.abs(cantidad)),
            idusuario || 1,
            idsede || 1,
            ps.idproducto,
            ps.idalmacen
        ];

        const insertar = (cols, vals, repl) => sequelize.query(
            `INSERT INTO producto_historial (${cols}) VALUES (${vals})`,
            { replacements: repl, type: Sequelize.QueryTypes.INSERT, transaction }
        );

        if (columnasExtendidas) {
            try {
                await insertar(
                    `${baseCols}, idpedido, stock_total`,
                    `${baseVals}, ?, ?`,
                    [...baseRepl, idpedido || null, String(ps.stock)]
                );
                return true;
            } catch (e) {
                const code = e?.original?.code || e?.parent?.code;
                if (code !== 'ER_BAD_FIELD_ERROR') throw e;
                columnasExtendidas = false; // migracion 018 pendiente
                logger.warn('⚠️ [producto.movements] Sin columnas idpedido/stock_total (aplicar migracion 018); usando esquema legacy');
            }
        }

        await insertar(baseCols, baseVals, baseRepl);
        return true;

    } catch (error) {
        logger.error({ error: error.message, datos }, '❌ [producto.movements] Error registrando movimiento');
        return false; // nunca romper el flujo de venta
    }
}

module.exports = { registrarMovimientoProducto };
