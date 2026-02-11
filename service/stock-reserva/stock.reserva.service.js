/**
 * stock.reserva.service.js
 * 
 * Servicio orquestador de reservas de stock - Refactorizado con SOLID
 * 
 * Principios aplicados:
 *   - Single Responsibility: Solo orquesta, delega a módulos especializados
 *   - Open/Closed: Extensible mediante nuevos tipos en config
 *   - Dependency Inversion: Depende de abstracciones (Repository, Services)
 * 
 * Flujo:
 *   Mozo agrega item → reservarItem() → stock real intacto
 *   Mozo quita item  → liberarItem()  → stock real intacto  
 *   Mozo confirma    → confirmarItem() → stock real se descuenta
 *   Cleanup nocturno → resetReservasInactivas() → reservas huérfanas a 0
 */

const { sequelize } = require('../../config/database');
const logger = require('../../utilitarios/logger');
const CONFIG = require('./reserva.config');
const ReservaRepository = require('./reserva.repository');
const ItemAnalyzer = require('./item.analyzer');
const RecetaService = require('./receta.service');

class StockReservaService {

    // ==================== MÉTODO PRINCIPAL ====================

    /**
     * Procesar item según la acción (reservar/liberar)
     * Punto de entrada único desde handle.stock.v1.js
     * 
     * @param {Object} item - Item del carrito
     * @param {number} idsede - ID de la sede
     * @returns {Promise<Object>} Resultado compatible con código existente
     */
    static async procesarItem(item, idsede) {
        const accion = ItemAnalyzer.determinarAccion(item);
        
        logger.debug({ 
            iditem: item.iditem, 
            accion, 
            sumar: item.sumar,
            cantidadSumar: item.cantidadSumar 
        }, '📦 [StockReserva] Procesando item');

        switch (accion) {
            case 'reservar':
                return this.reservarItem(item, idsede);
            case 'liberar':
                return this.liberarItem(item, idsede);
            case 'resetear':
                return this.resetearItem(item, idsede);
            default:
                return this._respuestaVacia(item);
        }
    }

    /**
     * RESERVAR ITEM COMPLETO
     * Analiza el item y reserva todos sus componentes
     */
    static async reservarItem(item, idsede) {
        const reservas = [];
        
        try {
            // Analizar item
            const itemInfo = ItemAnalyzer.analizar(item);
            const subitems = ItemAnalyzer.extraerSubitems(item);

            logger.debug({
                iditem: itemInfo.iditem,
                isSP: itemInfo.isSP,
                isND: itemInfo.isND,
                tieneSubitems: itemInfo.tieneSubitems,
                cantidad: itemInfo.cantidad
            }, '📦 [StockReserva] Analizando item para reserva');

            // Expandir a componentes de stock
            const componentes = await RecetaService.expandirAComponentes(itemInfo, subitems);

            // Reservar cada componente
            for (const comp of componentes) {
                const res = await ReservaRepository.agregar(comp.tipo, comp.id, comp.cantidad, idsede);
                if (res.success && !res.skipped) {
                    reservas.push(comp);
                }
            }

            // Obtener listItemsPorcion si es SP
            let listItemsPorcion = [];
            if (itemInfo.isSP) {
                const iditem = item.iditem2 || item.iditem;
                listItemsPorcion = await ReservaRepository.getListItemsPorcionDisponible(iditem, idsede);
            }

            // Obtener stock disponible del componente principal
            const stockDisponible = await this._getStockDisponiblePrincipal(componentes, idsede);

            logger.debug({
                totalReservas: reservas.length,
                listItemsPorcionCount: listItemsPorcion.length,
                stockDisponible,
                esAlmacen: itemInfo.esAlmacen
            }, '✅ [StockReserva] Reservas completadas');

            return this._respuestaExitosa(item, reservas, listItemsPorcion, stockDisponible);

        } catch (error) {
            logger.error({ error: error.message, iditem: item.iditem }, '❌ [StockReserva] Error reservando');
            return this._respuestaError(item, error, reservas);
        }
    }

    /**
     * LIBERAR RESERVA DE ITEM COMPLETO
     * Inverso de reservarItem
     */
    static async liberarItem(item, idsede) {
        const liberaciones = [];
        
        try {
            const itemInfo = ItemAnalyzer.analizar(item);
            const subitems = ItemAnalyzer.extraerSubitems(item);

            // Expandir a componentes
            const componentes = await RecetaService.expandirAComponentes(itemInfo, subitems);

            // Liberar cada componente
            for (const comp of componentes) {
                await ReservaRepository.quitar(comp.tipo, comp.id, comp.cantidad, idsede);
                liberaciones.push(comp);
            }

            // Obtener listItemsPorcion actualizado si es SP
            let listItemsPorcion = [];
            if (itemInfo.isSP) {
                const iditem = item.iditem2 || item.iditem;
                listItemsPorcion = await ReservaRepository.getListItemsPorcionDisponible(iditem, idsede);
            }

            // Obtener stock disponible del componente principal
            const stockDisponible = await this._getStockDisponiblePrincipal(componentes, idsede);

            return this._respuestaExitosa(item, liberaciones, listItemsPorcion, stockDisponible);

        } catch (error) {
            logger.error({ error: error.message }, '❌ [StockReserva] Error liberando');
            return this._respuestaError(item, error, liberaciones);
        }
    }

    /**
     * LÓGICA COMÚN para resetear y confirmar items.
     * Extrae componentes con la cantidad correcta y ejecuta la operación indicada.
     * 
     * @param {Object} item - Item del pedido
     * @param {string|number} idsede - ID de la sede
     * @param {string} modo - 'resetear' (solo quita reserva) o 'confirmar' (quita reserva + descuenta stock real)
     * @param {Object} metadata - Datos adicionales
     */
    static async _procesarItemConCantidad(item, idsede, modo = 'resetear', metadata = {}) {
        const operaciones = [];
        let transaction = null;

        try {
            // Determinar la cantidad según el modo
            const cantidad = modo === 'confirmar'
                ? Math.abs(parseFloat(item.cantidad_seleccionada) || 1)
                : Math.abs(parseFloat(item.cantidad_reset) || 0);

            if (cantidad === 0) {
                return this._respuestaVacia(item);
            }

            logger.debug({
                iditem: item.iditem,
                cantidad,
                modo,
                isporcion: item.isporcion
            }, `� [StockReserva] ${modo === 'confirmar' ? 'Confirmando' : 'Reseteando'} item`);

            // Crear item modificado con la cantidad correcta
            const itemModificado = {
                ...item,
                cantidadSumar: cantidad
            };

            const itemInfo = ItemAnalyzer.analizar(itemModificado);
            itemInfo.cantidad = cantidad;

            const subitems = ItemAnalyzer.extraerSubitems(item);
            const componentes = await RecetaService.expandirAComponentes(itemInfo, subitems);

            if (!componentes || componentes.length === 0) {
                return this._respuestaVacia(item);
            }

            logger.debug({
                componentesCount: componentes.length,
                componentes: componentes.map(c => ({ tipo: c.tipo, id: c.id, cantidad: c.cantidad }))
            }, `📦 [StockReserva] Componentes a ${modo}`);

            // Si es confirmar, usar transacción atómica
            if (modo === 'confirmar') {
                transaction = await sequelize.transaction();
            }

            // Ejecutar operación sobre cada componente
            for (const comp of componentes) {
                let res;
                if (modo === 'confirmar') {
                    // Quita reserva + descuenta stock real
                    res = await ReservaRepository.confirmar(comp.tipo, comp.id, comp.cantidad, idsede, transaction);
                } else {
                    // Solo quita reserva
                    res = await ReservaRepository.quitar(comp.tipo, comp.id, comp.cantidad, idsede);
                }

                if (res.success) {
                    operaciones.push({ ...comp, cantidadProcesada: comp.cantidad });
                }
            }

            if (transaction) {
                await transaction.commit();
            }

            // Obtener listItemsPorcion actualizado si es SP
            let listItemsPorcion = [];
            if (itemInfo.isSP) {
                const iditem = item.iditem2 || item.iditem;
                listItemsPorcion = await ReservaRepository.getListItemsPorcionDisponible(iditem, idsede);
            }

            // Obtener stock disponible del componente principal
            const stockDisponible = await this._getStockDisponiblePrincipal(componentes, idsede);

            logger.debug({
                modo,
                totalProcesados: operaciones.length,
                stockDisponible
            }, `✅ [StockReserva] ${modo} completado`);

            return this._respuestaExitosa(item, operaciones, listItemsPorcion, stockDisponible);

        } catch (error) {
            if (transaction) {
                try { await transaction.rollback(); } catch (rbErr) {
                    logger.error({ error: rbErr.message }, '❌ [StockReserva] Error en rollback');
                }
            }
            logger.error({ error: error.message, iditem: item?.iditem, modo }, `❌ [StockReserva] Error en ${modo}`);
            return this._respuestaError(item, error, operaciones);
        }
    }

    /**
     * RESETEAR RESERVAS DE ITEM COMPLETO (cancelación de pedido)
     * Libera la cantidad indicada en cantidad_reset
     * Solo quita de stock_reserva, NO toca el stock real
     */
    static async resetearItem(item, idsede) {
        return this._procesarItemConCantidad(item, idsede, 'resetear');
    }

    /**
     * CONFIRMAR ITEM (descuenta stock real + quita reserva)
     * Se llama cuando el pedido se confirma.
     * Usa cantidad_seleccionada como cantidad a descontar.
     * Misma lógica que resetearItem pero además descuenta stock real.
     */
    static async confirmarItem(item, idsede, metadata = {}) {
        return this._procesarItemConCantidad(item, idsede, 'confirmar', metadata);
    }

    /**
     * CONFIRMAR PEDIDO COMPLETO (descuenta stock real de todos los items)
     * Extrae items de la estructura del pedido (p_body.tipoconsumo[].secciones[].items[])
     * y confirma cada uno con confirmarItem.
     * 
     * @param {Object|Array} pBody - p_body del pedido (objeto con tipoconsumo) o array plano de items
     * @param {string|number} idsede - ID de la sede
     * @param {Object} metadata - Datos adicionales (idpedido, idusuario, etc.)
     */
    static async confirmarPedido(pBody, idsede, metadata = {}) {
        try {
            const items = ItemAnalyzer.extraerItemsDelPedido(pBody);

            if (items.length === 0) {
                return { success: true, skipped: true, reason: 'Sin items para confirmar' };
            }

            logger.debug({
                idsede,
                totalItems: items.length,
                idpedido: metadata.idpedido
            }, '📦 [StockReserva] Confirmando pedido completo');

            const resultados = [];
            let errores = 0;

            for (const item of items) {
                try {
                    if (parseFloat(item.cantidad_seleccionada) === 0) continue;

                    const resultado = await this.confirmarItem(item, idsede, metadata);
                    resultados.push({ iditem: item.iditem, ...resultado });

                    if (!resultado.success) {
                        errores++;
                        logger.warn({ iditem: item.iditem, error: resultado.error }, '⚠️ [StockReserva] Error confirmando item');
                    }
                } catch (itemError) {
                    errores++;
                    logger.error({ iditem: item?.iditem, error: itemError.message }, '❌ [StockReserva] Error confirmando item del pedido');
                    resultados.push({ iditem: item?.iditem, success: false, error: itemError.message });
                }
            }

            logger.debug({
                idsede, totalItems: items.length, confirmados: items.length - errores, errores, idpedido: metadata.idpedido
            }, '✅ [StockReserva] Confirmación de pedido completada');

            return { success: errores === 0, resultados, totalConfirmados: items.length - errores, errores };

        } catch (error) {
            logger.error({ error: error.message, idsede, idpedido: metadata.idpedido }, '❌ [StockReserva] Error general confirmando pedido');
            return { success: false, error: error.message };
        }
    }

    // ==================== MÉTODOS DE CONSULTA ====================

    /**
     * Obtener stock disponible (real - reservado)
     */
    static async getStockDisponible(tipo, id, idsede) {
        return ReservaRepository.getStockDisponible(tipo, id, idsede);
    }

    /**
     * Obtener cantidad reservada
     */
    static async getCantidadReservada(tipo, id, idsede) {
        return ReservaRepository.getCantidadReservada(tipo, id, idsede);
    }

    /**
     * Reset de reservas inactivas (cleanup nocturno)
     */
    static async resetReservasInactivas(minutos = CONFIG.CLEANUP_MINUTOS_INACTIVIDAD) {
        const result = await ReservaRepository.resetInactivas(minutos);
        
        logger.debug({
            minutos,
            registrosReseteados: result.registrosReseteados
        }, '🧹 [StockReserva] Cleanup completado');

        return result;
    }

    // ==================== MÉTODOS AUXILIARES ====================

    /**
     * Verificar si el sistema de reservas está disponible
     * La activación real se verifica por sede con sedeUsaReservas(idsede)
     */
    static isEnabled() {
        return true;
    }

    /**
     * Obtener stock vendible del componente principal
     * Considera cantidadReceta: stock disponible / cantidadReceta
     * Prioridad: porción > producto > producto_almacen > carta_lista
     * @param {Array} componentes - Componentes expandidos
     * @param {string} idsede - ID de sede
     */
    static async _getStockDisponiblePrincipal(componentes, idsede) {
        if (!componentes || componentes.length === 0) {
            return null;
        }

        // Buscar primera porción
        const porcion = componentes.find(c => c.tipo === 'porcion');
        if (porcion) {
            const cantidadReceta = porcion.cantidadReceta || 1;
            const stock = await ReservaRepository.getStockDisponible('porcion', porcion.id, idsede, cantidadReceta);
            logger.debug({
                tipo: 'porcion',
                id: porcion.id,
                cantidadReceta,
                stockVendible: stock.stockVendible
            }, '📊 [StockReserva] Stock vendible del componente principal');
            return stock.stockVendible;
        }

        // Buscar primer producto
        const producto = componentes.find(c => c.tipo === 'producto');
        if (producto) {
            const cantidadReceta = producto.cantidadReceta || 1;
            const stock = await ReservaRepository.getStockDisponible('producto', producto.id, idsede, cantidadReceta);
            logger.debug({
                tipo: 'producto',
                id: producto.id,
                cantidadReceta,
                stockVendible: stock.stockVendible
            }, '📊 [StockReserva] Stock vendible del componente principal');
            return stock.stockVendible;
        }

        // Buscar producto_almacen (misma lógica que porciones - stock en producto_stock)
        const almacen = componentes.find(c => c.tipo === 'producto_almacen');
        if (almacen) {
            const cantidadReceta = almacen.cantidadReceta || 1;
            const stock = await ReservaRepository.getStockDisponible('producto_almacen', almacen.id, idsede, cantidadReceta);
            logger.debug({
                tipo: 'producto_almacen',
                id: almacen.id,
                cantidadReceta,
                stockVendible: stock.stockVendible
            }, '📊 [StockReserva] Stock vendible producto almacén');
            return stock.stockVendible;
        }

        // Buscar carta_lista (items regulares)
        const carta = componentes.find(c => c.tipo === 'carta_lista');
        if (carta) {
            const stock = await ReservaRepository.getStockDisponible('carta_lista', carta.id, idsede, 1);
            return stock.stockVendible;
        }

        return null;
    }

    /**
     * Respuesta exitosa en formato compatible
     * @param {Object} item - Item original
     * @param {Array} operaciones - Operaciones realizadas
     * @param {Array} listItemsPorcion - Lista de items con stock
     * @param {number|null} stockDisponible - Stock disponible del componente principal
     */
    static _respuestaExitosa(item, operaciones, listItemsPorcion = [], stockDisponible = null) {
        return {
            success: true,
            operaciones,
            cantidad: stockDisponible !== null ? stockDisponible : item.cantidad,
            listItemsPorcion: JSON.stringify(listItemsPorcion),
            listSubItems: []
        };
    }

    /**
     * Respuesta de error en formato compatible
     */
    static _respuestaError(item, error, operaciones = []) {
        return {
            success: false,
            error: error.message,
            operaciones,
            cantidad: item.cantidad || 0,
            listItemsPorcion: '[]',
            listSubItems: []
        };
    }

    /**
     * Respuesta vacía (sin operación)
     */
    static _respuestaVacia(item) {
        return {
            success: true,
            operaciones: [],
            cantidad: item.cantidad,
            listItemsPorcion: '[]',
            listSubItems: []
        };
    }
}

module.exports = StockReservaService;
