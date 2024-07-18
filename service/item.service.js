// services/item.service.js

const ResponseService = require('../service/query.service');
const errorManager = require('../service/error.manager');

class ItemService {
    static async processItem(item, idsede) {
        let result = [{
            cantidad: null,
            listItemsPorcion: null,
            listSubItems: null
        }];

        const _item = {
            iditem: item.iditem,
            idcarta_lista: item.idcarta_lista,
            cantidad_reset: item.cantidad_reset,
            cantidadSumar: item.cantidadSumar,
            isporcion: item.isporcion,
            iditem2: item.iditem2        
        }

        let updatedItem;    
        try {     
            updatedItem = await ResponseService.emitirRespuestaSP(`call procedure_stock_item('${JSON.stringify(_item)}', ${idsede})`);    
            result[0].cantidad = updatedItem[0].cantidad;
            return result;
        } catch (error) {
            const sqlQuery = `call procedure_stock_item('${JSON.stringify(_item)}', ${idsede})`;
            const dataError = {
                incidencia: {
                    message: error,
                    data: {
                        item_process: _item,                    
                        query: sqlQuery,
                        res_query: updatedItem
                    }
                },
                origen: 'processItem'            
            }
            errorManager.logError(dataError);
            console.error('processItem====', error);
            throw error;
        }
    }

    static async processItemPorcion(item) {
        let result = [{
            cantidad: null,
            listItemsPorcion: null,
            listSubItems: null
        }];

        const _idItemUpdate = item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem;

        let updatedItem; 
        let _itemProcessPorcion = {};
        try { 
            _itemProcessPorcion = {
                iditem: item.iditem,
                idcarta_lista: item.idcarta_lista,
                cantidad_reset: item.cantidad_reset,
                cantidadSumar: item.cantidadSumar,
                isporcion: item.isporcion,
                iditem2: item.iditem2        
            }      
            
            console.log('_itemProcessPorcion', _itemProcessPorcion);
            
            updatedItem = await ResponseService.emitirRespuestaSP(`call procedure_stock_item_porcion('${JSON.stringify(_itemProcessPorcion)}')`);    
            result[0].listItemsPorcion = updatedItem[0].listItemsPorcion;
            const listItemsJson = JSON.parse(updatedItem[0].listItemsPorcion)
        
            const itemCantidad = listItemsJson.filter(i => i.iditem == _idItemUpdate);
            result[0].cantidad = itemCantidad[0].cantidad;            
            return result;
        } catch (error) {
            const sqlQuery = `call procedure_stock_item_porcion('${JSON.stringify(_itemProcessPorcion)}')`;

            const dataError = {
                incidencia: {
                    message: error,
                    data: {
                        item_process: _itemProcessPorcion,
                        query: sqlQuery,
                        res_query: updatedItem
                    }
                },
                origen: 'processItemPorcion'
            }
            errorManager.logError(dataError);
            console.error('processItemPorcion====', error);
            throw error;
        }
    }

    static async processAllItemSubitemSeleted(allItems) {
        let updatedItem;
        try {        
            updatedItem = await ResponseService.emitirRespuestaSP(`call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`);
            console.log('updatedItem', updatedItem);
            return updatedItem;
        } catch (error) {
            const sqlQuery = `call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`;

            const dataError = {
                incidencia: {
                    message: error,
                    data: {
                        item_process: allItems,                    
                        query: sqlQuery,
                        res_query: updatedItem
                    }
                },
                origen: 'processAllItemSubitemSeleted'            
            }
            errorManager.logError(dataError);
            console.error('processAllItemSubitemSeleted====', error);        
            throw error;

        }
    }
}

module.exports = ItemService;
