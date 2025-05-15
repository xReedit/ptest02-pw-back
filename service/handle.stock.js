// controllers/item.controller.js
const ResponseService = require('./query.service');
let ItemService = require('./item.service');
let errorManager = require('./error.manager');
const { ChallengeContext } = require('twilio/lib/rest/verify/v2/service/entity/challenge');

/**
 * Verifica si existen subitems con cantidad en el item
 * @param {Object} item - El item a verificar
 * @returns {Boolean} - true si existen subitems con cantidad, false en caso contrario
 */
const checkExistSubItemsWithCantidad = (item) => {        
    return !item.subitems ? false :
        Array.isArray(item.subitems) ?
            item.subitems.some(subitem => 
                Array.isArray(subitem.opciones) && subitem.opciones.some(opcion => opcion.cantidad !== 'ND')
            ) : false;
};

const updateStock = async (op, item, idsede) => {    
    if (item.isalmacen === 1) {
        console.log('es de almacen');
        const _item = {
            cantidadSumar: item.cantidadSumar,
            idcarta_lista: item.idcarta_lista,
            cantidad_reset: item.cantidad_reset
        };
        const query = `CALL porcedure_pwa_update_cantidad_only_producto(${op}, '${JSON.stringify(_item)}')`;
        return await ResponseService.emitirRespuestaSP(query);
    } else {
        // Verificar si existen subitems con cantidad
        const _existSubItemsWithCantidad = checkExistSubItemsWithCantidad(item);

        // let cantidadUpdate = item.cantidad_reset ? item.cantidad_reset : item.cantidadSumar;

        if (_existSubItemsWithCantidad && item.subitems_selected) {
            try {
                console.log('tiene subitems con cantidad');
                // let _idporcion = '';
                // let _idproducto = '';
                // let _iditem_subitem = '';

                // console.log('el item ==> ', item);

                item.subitems_selected.forEach(subitem => {      
                    // console.log('subitem ==> ', subitem);    
                    // if (subitem.idporcion !== 0) { _idporcion.push(subitem.idporcion) }
                    // if (subitem.idproducto !== 0) { _idproducto.push(subitem.idproducto); }                
                    // _iditem_subitem.push(subitem.iditem_subitem);
                
                
                    const _idporcion = subitem.idporcion !== 0 ? subitem.idporcion : '';
                    const _idproducto = subitem.idproducto !== 0 ? subitem.idproducto : '';
                    const _iditem_subitem = subitem.iditem_subitem !== 0 ? subitem.iditem_subitem : '';
                    // _iditem_subitem = _iditem_subitem.length === 0 ? '' :_iditem_subitem.join(',');
    
                    // if (_idporcion.length + _idproducto.length + _iditem_subitem.length > 0) {
                        const cantSelected = subitem.cantidad_selected || 1;  
                        const cantSumar = item.cantidadSumar * cantSelected;
                        const cantReset = item.cantidad_reset * cantSelected;
    
    
                        const allItems = {
                            idporcion: _idporcion,
                            idproducto: _idproducto,
                            iditem_subitem: _iditem_subitem,
                            iditem: item.iditem,
                            idcarta_lista: item.idcarta_lista,
                            cantidad_reset: cantReset, //item.cantidad_reset,
                            cantidadSumar: cantSumar, //item.cantidadSumar,
                            isporcion: item.isporcion,
                            iditem2: item.iditem2,
                            cantidad: item.cantidad,  
                        };
    
                        ItemService.processAllItemSubitemSeleted(allItems);
                    // }
                });

            } catch (error) {
                const dataError = {
                    incidencia: {
                        message: error.toString(),
                        existSubItemsWithCantidad: _existSubItemsWithCantidad,
                        subitems_selected: item.subitems_selected,
                        data: { item }
                    },
                    origen: 'setItemCarta'
                }
                errorManager.logError(dataError);
                throw error;
            }
        }

        if (item.isporcion === 'SP') {
            console.log('ingresa processItemPorcion');
            return await ItemService.processItemPorcion(item);
        } else {
            console.log('ingresa processItem');            
            if (item.isporcion !== 'ND') {             
                return await ItemService.processItem(item, idsede);
            } else {
                return [{
                    cantidad: item.cantidad,
                    listItemsPorcion: null,
                    listSubItems: null
                }]                
            }
        }
    }
}

module.exports = {
    updateStock,
    checkExistSubItemsWithCantidad
};
