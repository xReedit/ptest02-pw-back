/**
 * receta.service.js
 * 
 * Servicio para obtener recetas de items
 * Principio SOLID:
 *   - Single Responsibility: Solo obtención de recetas
 *   - Dependency Inversion: Abstrae la dependencia de StockPorcionService
 */

const logger = require('../../utilitarios/logger');
const ReservaRepository = require('./reserva.repository');

// Lazy load de StockPorcionService para evitar dependencias circulares
let StockPorcionService = null;

const getStockPorcionService = () => {
    if (!StockPorcionService) {
        try {
            StockPorcionService = require('../stock.porcion.service');
        } catch (e) {
            logger.warn('StockPorcionService no disponible');
        }
    }
    return StockPorcionService;
};

class RecetaService {

    /**
     * Obtener receta de un item (porciones y productos)
     * @param {number} iditem 
     * @returns {Promise<Array>} Lista de ingredientes con {idporcion, idproducto_stock, cantidad_receta}
     */
    static async obtenerRecetaItem(iditem) {
        try {
            const service = getStockPorcionService();
            if (!service) {
                logger.warn({ iditem }, '⚠️ [RecetaService] StockPorcionService no disponible');
                return [];
            }

            const receta = await service._obtenerRecetaItem(iditem, null);
            return receta || [];
        } catch (error) {
            logger.error({ error: error.message, iditem }, '❌ [RecetaService] Error obteniendo receta');
            return [];
        }
    }

    /**
     * Obtener ingredientes de una subreceta
     * @param {number} idsubreceta 
     * @returns {Promise<Array>}
     */
    static async obtenerIngredientesSubreceta(idsubreceta) {
        return ReservaRepository.getIngredientesSubreceta(idsubreceta);
    }

    /**
     * Expande un item a sus componentes de stock (receta + subitems)
     * @param {Object} itemInfo - Información analizada del item
     * @param {Array} subitems - Subitems extraídos
     * @returns {Promise<Array>} Lista de {tipo, id, cantidad, descripcion}
     */
    static async expandirAComponentes(itemInfo, subitems) {
        const componentes = [];

        // 1. Si es SP → expandir receta
        if (itemInfo.isSP) {
            const iditem = itemInfo.iditem;
            const receta = await this.obtenerRecetaItem(iditem);
            
            for (const ing of receta) {
                const cantidadReceta = parseFloat(ing.cantidad_receta || 1);
                const cantidadIng = cantidadReceta * itemInfo.cantidad;

                if (ing.idporcion && ing.idporcion > 0) {
                    componentes.push({
                        tipo: 'porcion',
                        id: ing.idporcion,
                        cantidad: cantidadIng,
                        cantidadReceta: cantidadReceta, // Para calcular stock disponible
                        descripcion: ing.porcion_descripcion || ''
                    });
                }

                if (ing.idproducto_stock && ing.idproducto_stock > 0) {
                    componentes.push({
                        tipo: 'producto',
                        id: ing.idproducto_stock,
                        cantidad: cantidadIng,
                        cantidadReceta: cantidadReceta,
                        descripcion: ''
                    });
                }
            }
        }

        // 2. Expandir subitems
        for (const subitem of subitems) {
            const cantidadSubitem = itemInfo.cantidad * subitem.cantidad_selected;
            // Para subitems, cantidadReceta es cantidad_selected (descuenta)
            const cantidadRecetaSubitem = subitem.cantidad_selected || 1;

            if (subitem.idporcion > 0) {
                componentes.push({
                    tipo: 'porcion',
                    id: subitem.idporcion,
                    cantidad: cantidadSubitem,
                    cantidadReceta: cantidadRecetaSubitem,
                    descripcion: subitem.des
                });
            }

            if (subitem.idproducto > 0) {
                componentes.push({
                    tipo: 'producto',
                    id: subitem.idproducto,
                    cantidad: cantidadSubitem,
                    cantidadReceta: cantidadRecetaSubitem,
                    descripcion: subitem.des
                });
            }

            // Expandir subreceta
            if (subitem.idsubreceta > 0) {
                const ingredientes = await this.obtenerIngredientesSubreceta(subitem.idsubreceta);
                
                for (const ing of ingredientes) {
                    const cantidadRecetaIng = parseFloat(ing.cantidad || 1);
                    const cantidadIng = cantidadRecetaIng * cantidadSubitem;

                    if (ing.idporcion && ing.idporcion > 0) {
                        componentes.push({
                            tipo: 'porcion',
                            id: ing.idporcion,
                            cantidad: cantidadIng,
                            cantidadReceta: cantidadRecetaIng * cantidadRecetaSubitem,
                            descripcion: ing.descripcion || '',
                            subreceta: subitem.idsubreceta
                        });
                    }

                    if (ing.idproducto_stock && ing.idproducto_stock > 0) {
                        componentes.push({
                            tipo: 'producto',
                            id: ing.idproducto_stock,
                            cantidad: cantidadIng,
                            cantidadReceta: cantidadRecetaIng * cantidadRecetaSubitem,
                            descripcion: '',
                            subreceta: subitem.idsubreceta
                        });
                    }
                }
            }
        }

        // 3. Si es ALMACÉN → idcarta_lista ES el idproducto_stock
        if (itemInfo.esAlmacen && itemInfo.idcarta_lista) {
            componentes.push({
                tipo: 'producto_almacen',
                id: itemInfo.idcarta_lista, // En almacén, idcarta_lista = idproducto_stock
                cantidad: itemInfo.cantidad,
                cantidadReceta: 1,
                descripcion: 'Producto almacén'
            });
            logger.debug({
                tipo: 'producto_almacen',
                idproducto_stock: itemInfo.idcarta_lista,
                cantidad: itemInfo.cantidad
            }, '📦 [RecetaService] Componente producto almacén');
            return componentes;
        }

        // 4. Si NO es SP y NO es ND → agregar carta_lista
        if (!itemInfo.isSP && !itemInfo.isND && itemInfo.idcarta_lista) {
            componentes.push({
                tipo: 'carta_lista',
                id: itemInfo.idcarta_lista,
                cantidad: itemInfo.cantidad,
                cantidadReceta: 1,
                descripcion: ''
            });
        }

        return componentes;
    }
}

module.exports = RecetaService;
