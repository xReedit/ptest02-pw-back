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

            logger.debug({
                totalReservas: reservas.length,
                listItemsPorcionCount: listItemsPorcion.length
            }, '✅ [StockReserva] Reservas completadas');

            return this._respuestaExitosa(item, reservas, listItemsPorcion);

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

            return this._respuestaExitosa(item, liberaciones, listItemsPorcion);

        } catch (error) {
            logger.error({ error: error.message }, '❌ [StockReserva] Error liberando');
            return this._respuestaError(item, error, liberaciones);
        }
    }

    /**
     * CONFIRMAR RESERVAS DE ITEM (descuenta stock real)
     * Se llama cuando el pedido se confirma
     */
    static async confirmarItem(item, idsede, metadata = {}) {
        const confirmaciones = [];
        
        try {
            const itemInfo = ItemAnalyzer.analizar(item);
            const subitems = ItemAnalyzer.extraerSubitems(item);

            // Expandir a componentes
            const componentes = await RecetaService.expandirAComponentes(itemInfo, subitems);

            // Confirmar cada componente (descuenta stock real + resta reserva)
            for (const comp of componentes) {
                const res = await ReservaRepository.confirmar(comp.tipo, comp.id, comp.cantidad, idsede);
                if (res.success) {
                    confirmaciones.push({ ...comp, stockNuevo: res.stockNuevo });
                }
            }

            return { success: true, confirmaciones };

        } catch (error) {
            logger.error({ error: error.message }, '❌ [StockReserva] Error confirmando');
            return { success: false, error: error.message, confirmaciones };
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
        
        logger.info({
            minutos,
            registrosReseteados: result.registrosReseteados
        }, '🧹 [StockReserva] Cleanup completado');

        return result;
    }

    // ==================== MÉTODOS AUXILIARES ====================

    /**
     * Verificar si el sistema de reservas está activo
     */
    static isEnabled() {
        return CONFIG.USE_RESERVAS;
    }

    /**
     * Respuesta exitosa en formato compatible
     */
    static _respuestaExitosa(item, operaciones, listItemsPorcion = []) {
        return {
            success: true,
            operaciones,
            cantidad: item.cantidad,
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
