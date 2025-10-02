/**
 * porcion.movements.service.js
 * Servicio simple para guardar movimientos de porciones en tabla porcion_historial
 */

const { sequelize, Sequelize } = require('../config/database');
const errorManager = require('./error.manager');
const logger = require('../utilitarios/logger');

class PorcionMovementsService {
    
    /**
     * Guarda un movimiento de porción simple
     * @param {Object} datos - Datos del movimiento
     */
    static async guardarMovimientoPorcion(datos) {
        try {
            const query = `
                INSERT INTO porcion_historial (
                    tipo_movimiento,
                    fecha,
                    hora,
                    cantidad,
                    idusuario,
                    idporcion,
                    idsede,
                    estado,
                    stock_total,
                    fecha_date,
                    idtipo_movimiento_stock,
                    idpedido,
                    iditem
                ) VALUES (?, NOW(), TIME(NOW()), ?, ?, ?, ?, ?, ?, DATE(NOW()), ?, ?, ?)
            `;
            
            const resultado = await sequelize.query(query, {
                replacements: [
                    datos.tipo_movimiento || 'VENTA',
                    datos.cantidad,
                    datos.idusuario,
                    datos.idporcion,
                    datos.idsede,
                    datos.estado || 'CONFIRMADO',
                    datos.stock_total || 0,
                    datos.idtipo_movimiento_stock || 3, // VENTA por defecto
                    datos.idpedido || null,
                    datos.iditem
                ],
                type: Sequelize.QueryTypes.INSERT
            });
            
            return resultado[0]; // ID del movimiento insertado
            
        } catch (error) {
            errorManager.logError({
                incidencia: {
                    message: `Error guardando movimiento porción: ${error.message}`,
                    data: { datos }
                },
                origen: 'PorcionMovementsService.guardarMovimientoPorcion'
            });
            
            // No hacer throw, solo registrar error
            logger.error({ error, datos }, 'Error guardando movimiento porción');
            return null;
        }
    }
    
    /**
     * Guarda movimiento de VENTA de porción
     */
    static async guardarMovimientoVentaPorcion(pedidoDetalle, pedidoInfo, porcionData) {
        return await this.guardarMovimientoPorcion({
            tipo_movimiento: 'VENTA',
            cantidad: pedidoDetalle.cantidad,
            idusuario: pedidoInfo.idusuario,
            idporcion: porcionData.idporcion,
            idsede: pedidoInfo.idsede,
            estado: 'CONFIRMADO',
            stock_total: porcionData.stock_actual || 0,
            idtipo_movimiento_stock: 3, // VENTA
            idpedido: pedidoInfo.idpedido,
            iditem: pedidoDetalle.iditem
        });
    }
    
    /**
     * Guarda movimiento de ENTRADA de porción
     */
    static async guardarMovimientoEntradaPorcion(datos) {
        return await this.guardarMovimientoPorcion({
            ...datos,
            tipo_movimiento: 'ENTRADA',
            idtipo_movimiento_stock: 1 // ENTRADA
        });
    }
    
    /**
     * Guarda movimiento de SALIDA de porción
     */
    static async guardarMovimientoSalidaPorcion(datos) {
        return await this.guardarMovimientoPorcion({
            ...datos,
            tipo_movimiento: 'SALIDA',
            idtipo_movimiento_stock: 2 // SALIDA
        });
    }
    
    /**
     * Guarda movimientos de todas las porciones de un pedido
     */
    static async guardarMovimientosPedidoPorciones(pedidoDetalle, pedidoInfo) {
        const movimientos = [];
        
        try {
            // Si tiene subitems seleccionados (porciones)
            if (pedidoDetalle.subitems_selected_array && pedidoDetalle.subitems_selected_array.length > 0) {
                
                for (const subitem of pedidoDetalle.subitems_selected_array) {
                    if (subitem.selected && subitem.idporcion) {
                        
                        const movimiento = await this.guardarMovimientoVentaPorcion(
                            pedidoDetalle,
                            pedidoInfo,
                            {
                                idporcion: subitem.idporcion,
                                stock_actual: subitem.cantidad || 0
                            }
                        );
                        
                        if (movimiento) {
                            movimientos.push(movimiento);
                        }
                    }
                }
            }
            
            return movimientos;
            
        } catch (error) {
            errorManager.logError({
                incidencia: {
                    message: `Error guardando movimientos de porciones del pedido: ${error.message}`,
                    data: { pedidoDetalle, pedidoInfo }
                },
                origen: 'PorcionMovementsService.guardarMovimientosPedidoPorciones'
            });
            
            return movimientos; // Retornar los que se pudieron guardar
        }
    }
}

module.exports = PorcionMovementsService;
