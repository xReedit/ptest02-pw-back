const { to, ReE, ReS }  = require('../service/uitl.service');
let errorManager = require('../service/error.manager');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');

let handleStock = require('../service/handle.stock.v1');
let logger = require('../utilitarios/logger');

// ✅ IMPORTANTE: Usar instancia centralizada de Sequelize
const { sequelize, QueryTypes } = require('../config/database');
// const { Sequelize } = require('sequelize');
const QueryServiceV1 = require('../service/query.service.v1');

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};


const emitirRespuesta = async (xquery) => {    
    try {
        // return await sequelize.query(xquery, { type: QueryTypes.SELECT });
        const trimmedQuery = xquery.trim().toLowerCase();
        let queryType;
        if (trimmedQuery.startsWith('update')) {
            queryType = QueryTypes.UPDATE;
        } else if (trimmedQuery.startsWith('insert')) {
            queryType = QueryTypes.INSERT;
        } else {
            queryType = QueryTypes.SELECT;
        }
        
        return await sequelize.query(xquery, { type: queryType });
    } catch (err) {
        logger.error(err);
        return false;
    }
};

const emitirRespuesta_RES = async (xquery, res) => {
    try {
        const rows = await sequelize.query(xquery, { type: QueryTypes.SELECT });
        return ReS(res, {
            data: rows
        });
    } catch (error) {
        logger.error(error);
        return false;
    }
};
module.exports.emitirRespuesta_RES = emitirRespuesta_RES;

const emitirRespuestaSP = async (xquery) => {
    try {
        const rows = await sequelize.query(xquery, { type: QueryTypes.SELECT });
        const arr = Object.values(rows[0]);
        return arr;
    } catch (err) {
        logger.error({ error: err, query: xquery }, 'Error en emitirRespuesta');
        return false;
    }
};

const emitirRespuestaSP_RES = async (xquery, res) => {
    try {
        const rows = await sequelize.query(xquery, { type: QueryTypes.SELECT });

        // Convertimos en array ya que viene en object
        const arr = Object.values(rows[0]);

        return ReS(res, {
            data: arr
        });
    } catch (err) {
        return ReE(res, err);
    }
};


const ejecutarQuery = async (query) => {
    const resultado = await emitirRespuesta(query);
    return resultado || [];
};

// const setClienteConectado = function (dataCLiente) {	
//     const idcliente = dataCLiente.idcliente;
//     const socketid = dataCLiente.socketid;
//     if ( idcliente ) {
//     	const read_query = `insert into cliente_socketid (idcliente, socketid, conectado) values (${idcliente}, '${socketid}', '1')  ON DUPLICATE KEY UPDATE socketid = '${socketid}', conectado='1';`;
//     	return emitirRespuesta(read_query);
//     }    
// }
// module.exports.setClienteConectado = setClienteConectado;

const setClienteConectado = async ({ idcliente, socketid }) => {
    if (!idcliente) return false;

    // const query = `
    //     INSERT INTO cliente_socketid (idcliente, socketid, conectado)
    //     VALUES (${idcliente}, '${socketid}', '1')
    //     ON DUPLICATE KEY UPDATE socketid = '${socketid}', conectado = '1';
    // `;

    // return await ejecutarQuery(query);

    // ✅ SEGURO: Prepared statement
    const query = `INSERT INTO cliente_socketid (idcliente, socketid, conectado)
    VALUES (?, ?, '1')
    ON DUPLICATE KEY UPDATE socketid = ?, conectado = '1';`;
    const rows = await QueryServiceV1.ejecutarConsulta(query, [idcliente, socketid], 'INSERT', 'setClienteConectado');
    return rows;
};
module.exports.setClienteConectado = setClienteConectado;


// const setClienteDesconectado = function (dataCLiente) {
//     const idcliente = dataCLiente.idcliente;
//     const socketid = dataCLiente.socketid;
//     if ( idcliente && idcliente != 'undefined') {
//     	const read_query = `update cliente_socketid set conectado='0' where idcliente = '${idcliente}';`;
//     	return emitirRespuesta(read_query);
//     }    
// }
// module.exports.setClienteDesconectado = setClienteDesconectado;

const setClienteDesconectado = async ({ idcliente, socketid }) => {
    if (!idcliente || idcliente === 'undefined') return false;

    // const query = `
    //     UPDATE cliente_socketid
    //     SET conectado = '0'
    //     WHERE idcliente = '${idcliente}';
    // `;

    // return await ejecutarQuery(query);
    const query = `UPDATE cliente_socketid SET conectado = '0' WHERE idcliente = ?;`;
    QueryServiceV1.ejecutarConsulta(query, [idcliente], 'UPDATE', 'setClienteDesconectado');
};
module.exports.setClienteDesconectado = setClienteDesconectado;



// const getSocketIdCliente = async function (listIdCliente) {
// 	// const idcliente = dataCLiente.idcliente;
//     const read_query = `SELECT socketid from cliente_socketid where idcliente in (${listIdCliente})`;
//     return emitirRespuesta(read_query);        
// }
// module.exports.getSocketIdCliente = getSocketIdCliente;


const getSocketIdCliente = async (listIdCliente) => {
    // const query = `
    //     SELECT socketid
    //     FROM cliente_socketid
    //     WHERE idcliente IN (${listIdCliente});
    // `;

    // return await ejecutarQuery(query);
    const query = `SELECT socketid FROM cliente_socketid WHERE idcliente IN (${listIdCliente});`;
    return await QueryServiceV1.ejecutarConsulta(query, [], 'SELECT', 'getSocketIdCliente');    
};
module.exports.getSocketIdCliente = getSocketIdCliente;




// const getObjCarta = async function (dataCLiente) {
// 	console.log( 'getObjCarta data cliente', dataCLiente )
// 	const idorg = dataCLiente.idorg;
//     const idsede = dataCLiente.idsede;           
//     const iscliente = dataCLiente.iscliente == 'true' ? 1 : 0;
//     console.log( 'getObjCarta data cliente iscliente', iscliente );
        
//     const read_query = `call porcedure_pwa_pedido_carta(${idorg},${idsede},${iscliente})`;
//     return emitirRespuestaSP(read_query);        
// }
// module.exports.getObjCarta = getObjCarta;

const getObjCarta = async (dataCliente) => {
    const { idorg, idsede, iscliente } = dataCliente;
    const isClienteValue = iscliente === 'true' ? 1 : 0;

    // const query = `CALL porcedure_pwa_pedido_carta(${idorg}, ${idsede}, ${isClienteValue})`;
    // logger.debug({ query }, 'Obteniendo carta');
    // return await emitirRespuestaSP(query);
    const query = `CALL porcedure_pwa_pedido_carta(?, ?, ?)`;
    return await QueryServiceV1.ejecutarProcedimiento(query, [idorg, idsede, isClienteValue], 'getObjCarta');

};
module.exports.getObjCarta = getObjCarta;



// datos de la sede, impresoras
// const getDataSede = async function (dataCLiente) {	
// 	const idorg = dataCLiente.idorg;
//     const idsede = dataCLiente.idsede;           
        
//     const read_query = `call procedure_pwa_pedido_dataorg(${idorg},${idsede})`;    
//     return emitirRespuestaSP(read_query);    
// }
// module.exports.getDataSede = getDataSede;


// datos de la sede, impresoras
const getDataSede = async (dataCliente) => {
    const { idorg, idsede } = dataCliente;

    // const query = `CALL procedure_pwa_pedido_dataorg(${idorg}, ${idsede})`;
    // return await emitirRespuestaSP(query);
    const query = `CALL procedure_pwa_pedido_dataorg(?, ?)`;
    return await QueryServiceV1.ejecutarProcedimiento(query, [idorg, idsede], 'getDataSede');
};
module.exports.getDataSede = getDataSede;


// const getDataSedeDescuentos = async function (dataCLiente) {  
//     const idorg = dataCLiente.idorg;
//     const idsede = dataCLiente.idsede;           
        
//     const read_query = `call procedure_pwa_sede_descuentos(${idsede})`;    
//     return emitirRespuestaSP(read_query);    
// }
// module.exports.getDataSedeDescuentos = getDataSedeDescuentos;

const getDataSedeDescuentos = async (dataCliente) => {
    const { idsede } = dataCliente;

    // const query = `CALL procedure_pwa_sede_descuentos(${idsede})`;
    // return await emitirRespuestaSP(query);
    const query = `CALL procedure_pwa_sede_descuentos(?)`;
    return await QueryServiceV1.ejecutarProcedimiento(query, [idsede], 'getDataSedeDescuentos');
};
module.exports.getDataSedeDescuentos = getDataSedeDescuentos;


// const getTipoConsumo = async function (dataCLiente) {
// 	const idorg = dataCLiente.idorg;
//     const idsede = dataCLiente.idsede;
//     const read_query = `SELECT idtipo_consumo, descripcion, titulo, idimpresora from tipo_consumo where (idorg=${idorg} and idsede=${idsede}) and estado=0`;
//     return emitirRespuesta(read_query);        
// }
// module.exports.getTipoConsumo = getTipoConsumo;

const getTipoConsumo = async (dataCliente) => {
    const { idorg, idsede } = dataCliente;
    // const query = `
    //     SELECT idtipo_consumo, descripcion, titulo, idimpresora 
    //     FROM tipo_consumo 
    //     WHERE (idorg = ${idorg} AND idsede = ${idsede}) AND estado = 0`;
    // return await emitirRespuesta(query);
    const query = `SELECT idtipo_consumo, descripcion, titulo, idimpresora FROM tipo_consumo WHERE (idorg = ? AND idsede = ?) AND estado = 0`;
    return await QueryServiceV1.ejecutarConsulta(query, [idorg, idsede], 'SELECT', 'getTipoConsumo');
};
module.exports.getTipoConsumo = getTipoConsumo;



// const getReglasCarta = async function (dataCLiente) {
// 	// console.log( 'data cliente', dataCLiente )
// 	const idorg = dataCLiente.idorg;
//     const idsede = dataCLiente.idsede;           
        
//     const read_query = `call procedure_pwa_reglas_carta_subtotales(${idorg},${idsede})`;
//     return emitirRespuestaSP(read_query);           
// }
// module.exports.getReglasCarta = getReglasCarta;


const getReglasCarta = async (dataCliente) => {
    const { idorg, idsede } = dataCliente;
    // const query = `CALL procedure_pwa_reglas_carta_subtotales(${idorg}, ${idsede})`;
    // return await emitirRespuestaSP(query);

    const query = `CALL procedure_pwa_reglas_carta_subtotales(?, ?)`;
    return await QueryServiceV1.ejecutarProcedimiento(query, [idorg, idsede], 'getReglasCarta');
};
module.exports.getReglasCarta = getReglasCarta;



// para el caso de monitor pedidos
const setItemCartaAfter = async function (op, item) {	
    // nos aseguramos de quitar los espacios en blanco
    let read_query = '';
    if ( item.isalmacen.toString() === '1' ) { // si es producto}
        const _item = {cantidadSumar: item.cantidadSumar, idcarta_lista: item.idcarta_lista, cantidad_reset: item.cantidad_reset};
        logger.debug({ item: _item }, 'Actualizando cantidad producto almacén');
        read_query = `call porcedure_pwa_update_cantidad_only_producto(${op},'${JSON.stringify(_item)}')`;
        logger.debug({ query: read_query }, 'Query generada');
    } else {
        var item = JSON.stringify(item).replace(/\\n/g, '')
                                      .replace(/\\'/g, '')
                                      .replace(/\\"/g, '')
                                      .replace(/\\&/g, '')
                                      .replace(/\\r/g, '')
                                      .replace(/\\t/g, '')
                                      .replace(/\\b/g, '')
                                      .replace(/\\f/g, '');               
        // const read_query = `call porcedure_pwa_update_cantidad_item(${op},'${JSON.stringify(item)}')`;

        item = item.replace(/[\r\n]/g, '');
        read_query = `call porcedure_pwa_update_cantidad_item(${op},'${item}')`;
    }
    
    return emitirRespuestaSP(read_query);        
}
module.exports.setItemCartaAfter = setItemCartaAfter;


const setItemCarta = async (op, item, idsede) => {
    return handleStock.updateStock(op, item, idsede);
    
    // if (item.isalmacen === 1) {// si es producto
    //     const _item = {
    //         cantidadSumar: item.cantidadSumar,
    //         idcarta_lista: item.idcarta_lista,
    //         cantidad_reset: item.cantidad_reset
    //     };
    //     const query = `
    //         CALL porcedure_pwa_update_cantidad_only_producto(${op}, '${JSON.stringify(_item)}')`;
    //     return await emitirRespuestaSP(query);
    // } else {

    //     // evaluar si item.subitems es undefined
    //     // console.log('typeof item.subitems ', typeof item.subitems);
    //     // console.log('el item', item);
        
    //     const _existSubItemsWithCantidad = !item.subitems ?  false :
    //         //evalua si existe algun subitem con cantidad diferente a ND en su propiedad opciones.cantidad
    //         // evaluea si item.subitems es un array
    //         typeof item.subitems === 'object' ?
    //         item.subitems.some(subitem => subitem.opciones.some(opcion => opcion.cantidad !== 'ND')) : false; 

    //     // console.log('item.subitems', item.subitems)
    //     // console.log('_existSubItemsWithCantidad', _existSubItemsWithCantidad);

    //     let cantidadUpdate = item.cantidad_reset ? item.cantidad_reset : item.cantidadSumar;

        
    //     try {
            
    //         if ( _existSubItemsWithCantidad && item.subitems_selected) {
    //             // item subitems_selected                        
    //             let _idporcion = [];
    //             let _idproducto = [];
    //             let _iditem_subitem = [];
    
    //             // obtenemos los ids porcion y productos de los subitems seleccionados
    //             item.subitems_selected.forEach(subitem => {          
    //                 // processItemSubitemSeleted(subitem, cantidadUpdate);     
    //                 if (subitem.idporcion !== 0) { _idporcion.push(subitem.idporcion) }
    //                 if (subitem.idproducto !== 0) { _idproducto.push(subitem.idproducto);}                
    //                 _iditem_subitem.push(subitem.iditem_subitem);
    //             })
                
    //             _idporcion = _idporcion.length === 0 ? '' : _idporcion.join(',');
    //             _idproducto = _idproducto.length === 0 ? '' :_idproducto.join(',');
    //             _iditem_subitem = _iditem_subitem.length === 0 ? '' :_iditem_subitem.join(',');
    //             const showProcedureAllItems = _idporcion.length + _idproducto.length + _iditem_subitem.length > 0;
    
    //             if ( showProcedureAllItems ){
    //                 const allItems = {
    //                     idporcion: _idporcion,
    //                     idproducto: _idproducto,
    //                     iditem_subitem: _iditem_subitem,
    //                     iditem: item.iditem,
    //                     idcarta_lista: item.idcarta_lista,
    //                     cantidad_reset: item.cantidad_reset,
    //                     cantidadSumar: item.cantidadSumar,
    //                     isporcion: item.isporcion,
    //                     iditem2: item.iditem2,
    //                     cantidad: item.cantidad,  
    //                 }
        
    //                 processAllItemSubitemSeleted(allItems);
    //             }
    
    //             console.log('_idporcion', _idporcion);
    //             console.log('_idproducto', _idproducto);
    //             console.log('_iditem_subitem', _iditem_subitem);
                
    
    //         }
    //     } catch (error) {
    //         const dataError = {
    //             incidencia: {
    //                 message: error.toString(),
    //                 existSubItemsWithCantidad: _existSubItemsWithCantidad,
    //                 subitems_selected: item.subitems_selected,
    //                 data: {
    //                     item                        
    //                 }
    //             },
    //             origen: 'setItemCarta'
    //         }

    //         errorManager.logError(dataError);
    //     }

                    
    //     // en ingredientes
    //     if ( item.isporcion === 'SP' ) {
    //         // si es porcion
    //         console.log('ingresa processItemPorcion');
    //         return await processItemPorcion(item)
    //     } else {
    //         // si no es porcion
    //         console.log('ingresa processItem');
    //         return await processItem(item, idsede)
    //     }




        // esto hasta el momento venia funcionando mejor
        // if (item.isalmacen === 0 && !_existSubItemsWithCantidad) {            
        // } 
        // else {        
        //     const cleanedItem = JSON.stringify(item)
        //         .replace(/\\n/g, '')
        //         .replace(/\\'/g, '')
        //         .replace(/\\"/g, '')
        //         .replace(/\\&/g, '')
        //         .replace(/\\r/g, '')
        //         .replace(/\\t/g, '')
        //         .replace(/\\b/g, '')
        //         .replace(/\\f/g, '')            
        //         .replace(/[\r\n]/g, '').replace(/'/g, '');
    
        //     const query = `CALL porcedure_pwa_update_cantidad_item(${op}, '${cleanedItem}')`;
        //     return await emitirRespuestaSP(query);
        // }
    
};
module.exports.setItemCarta = setItemCarta;




// const setNuevoPedido = async function (dataCLiente, dataPedido) {
    
// 	// const idorg = dataCLiente.idorg;
//  //    const idsede = dataCLiente.idsede;		              
//  //    const idusuario = dataCLiente.idusuario;		              

//     // tomamos los datos del cliente del pedido y no del socket, puede estar haciendo conflicto
//     // y enviando a otros comercios
//     const _dataCliente = dataPedido.dataUsuario
//     const idorg = _dataCliente.idorg;
//     const idsede = _dataCliente.idsede;                    
//     const idusuario = _dataCliente.idusuario;                      
//     var _json = JSON.stringify(dataPedido).replace(/\\n/g, '')
//                                       .replace(/\\'/g, '')
//                                       .replace(/\\"/g, '')
//                                       .replace(/\\&/g, '')
//                                       .replace(/\\r/g, '')
//                                       .replace(/\\t/g, '')
//                                       .replace(/\\b/g, '')
//                                       .replace(/\\f/g, '');

//     const read_query = `call procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`;
//     return emitirRespuestaSP(read_query);        
// }
// module.exports.setNuevoPedido = setNuevoPedido;

const setNuevoPedido = async (dataCliente, dataPedido) => {
    logger.debug('Guardando nuevo pedido - procedure_pwa_pedido_guardar');    
    const { idorg, idsede, idusuario } = dataPedido.dataUsuario ? dataPedido.dataUsuario : dataCliente;
    logger.debug({ idorg, idsede, idusuario }, 'Datos usuario pedido');




    // Enfoque simplificado para sanitizar JSON
    // 1. Primero limpiamos el objeto para eliminar caracteres problemáticos
    const cleanObject = JSON.parse(JSON.stringify(dataPedido, (key, value) => {
        // Si es un string, limpiamos caracteres problemáticos
        if (typeof value === 'string') {
            return value
                .replace(/[\u0000-\u001F]/g, '') // Eliminar caracteres de control
                .replace(/[\u007F-\u009F]/g, '') // Eliminar caracteres de control adicionales
                .replace(/[\u200B-\u200D\uFEFF]/g, '') // Eliminar caracteres de ancho cero
                .replace(/\n/g, ' ') // Reemplazar saltos de línea por espacios
                .replace(/\r/g, ' ') // Reemplazar retornos de carro por espacios
                .replace(/\t/g, ' ') // Reemplazar tabulaciones por espacios
                .replace(/\f/g, ' '); // Reemplazar form feeds por espacios
        }
        return value;
    }));
    
    // 2. Convertir a JSON y escapar comillas simples para SQL
    let _json = JSON.stringify(cleanObject).replace(/'/g, "\\'"); // Escape single quotes
// Ya no necesitamos estos reemplazos adicionales



    // const query = `CALL procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`;
    const query = `CALL procedure_pwa_pedido_guardar(?, ?, ?, ?)`;
    logger.debug({ idorg, idsede, idusuario }, 'Ejecutando procedure_pwa_pedido_guardar');
    // return await emitirRespuestaSP(query);

    try {
        // return await emitirRespuestaSP(query);
        return await QueryServiceV1.ejecutarProcedimiento(query, [idorg, idsede, idusuario, _json], 'setNuevoPedido');        
    } catch (error) {
        return ReE(res, error);
    }
};
module.exports.setNuevoPedido = setNuevoPedido;




// para evitar pedidos perdidos cuando el socket pierde conexion
// const setNuevoPedido2 = async function (req, res) {
    
//     // const idorg = dataCLiente.idorg;
//  //    const idsede = dataCLiente.idsede;                     
//  //    const idusuario = dataCLiente.idusuario;                   

//     // tomamos los datos del cliente del pedido y no del socket, puede estar haciendo conflicto
//     // y enviando a otros comercios
//     const dataPedido = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;    
//     const _dataCliente = dataPedido.dataUsuario
//     const idorg = _dataCliente.idorg;
//     const idsede = _dataCliente.idsede;                    
//     const idusuario = _dataCliente.idusuario;                      
//     var _json = JSON.stringify(dataPedido).replace(/\\n/g, '')
//                                       .replace(/\\'/g, '')
//                                       .replace(/\\"/g, '')
//                                       .replace(/\\&/g, '')
//                                       .replace(/\\r/g, '')
//                                       .replace(/\\t/g, '')
//                                       .replace(/\\b/g, '')
//                                       .replace(/\\f/g, '');

//     const read_query = `call procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`;
//     // console.log(read_query);
//     emitirRespuestaSP_RES(read_query, res);        


// para evitar pedidos perdidos cuando el socket pierde conexion
const setNuevoPedido2 = async (req, res) => {
    logger.debug('Guardando nuevo pedido 2 - procedure_pwa_pedido_guardar');
    const dataPedido = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const _dataCliente = dataPedido.dataUsuario;
    const { idorg, idsede, idusuario } = _dataCliente;
    
    // Enfoque simplificado para sanitizar JSON
    // 1. Primero limpiamos el objeto para eliminar caracteres problemáticos
    const cleanObject = JSON.parse(JSON.stringify(dataPedido, (key, value) => {
        // Si es un string, limpiamos caracteres problemáticos
        if (typeof value === 'string') {
            return value
                .replace(/[\u0000-\u001F]/g, '') // Eliminar caracteres de control
                .replace(/[\u007F-\u009F]/g, '') // Eliminar caracteres de control adicionales
                .replace(/[\u200B-\u200D\uFEFF]/g, '') // Eliminar caracteres de ancho cero
                .replace(/\n/g, ' ') // Reemplazar saltos de línea por espacios
                .replace(/\r/g, ' ') // Reemplazar retornos de carro por espacios
                .replace(/\t/g, ' ') // Reemplazar tabulaciones por espacios
                .replace(/\f/g, ' '); // Reemplazar form feeds por espacios
        }
        return value;
    }));
    
    // 2. Convertir a JSON y escapar comillas simples para SQL
    const _json = JSON.stringify(cleanObject).replace(/'/g, "\\'");
    
    // const query = `CALL procedure_pwa_pedido_guardar(${idorg}, ${idsede}, ${idusuario},'${_json}')`;
    const query = `CALL procedure_pwa_pedido_guardar(?, ?, ?, ?)`;

    try {
        // return await emitirRespuestaSP_RES(query, res);
        return await QueryServiceV1.ejecutarProcedimiento(query, [idorg, idsede, idusuario, _json], 'setNuevoPedido2');        
    } catch (error) {
        return ReE(res, error);
    }
};
module.exports.setNuevoPedido2 = setNuevoPedido2;
//     const idsede = dataCLiente.idsede;		              
//     const idusuario = dataCLiente.idusuario;		              
//     const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
//     return emitirRespuestaSP(read_query);        
// }
// module.exports.setPrintComanda = setPrintComanda;

const setPrintComanda = async (dataCliente, dataPrint) => {
    const { idorg, idsede, idusuario } = dataCliente;
    // const query = `CALL procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
    // return await emitirRespuestaSP(query);

    const query = `CALL procedure_pwa_print_comanda(?, ?, ?, ?)`;
    return await QueryServiceV1.ejecutarProcedimiento(query, [idorg, idsede, idusuario, JSON.stringify(dataPrint)], 'setPrintComanda');
};
module.exports.setPrintComanda = setPrintComanda;

// const setPrinterOtherDocs = async function (req, res) {
//     const idorg = managerFilter.getInfoToken(req,'idorg');
//     const idsede = managerFilter.getInfoToken(req, 'idsede');
//     const idusuario = managerFilter.getInfoToken(req, 'idusuario');
//     const dataPrint = req.body.dataPrint;
//     const isprecuenta = req.body.isprecuenta || 0;
//     const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}', ${isprecuenta})`;
//     // return emitirRespuestaSP(read_query);        
//     emitirRespuestaSP_RES(read_query, res);

// }
// module.exports.setPrinterOtherDocs = setPrinterOtherDocs;


const setPrinterOtherDocs = async (req, res) => {
    const idorg = managerFilter.getInfoToken(req, 'idorg');
    const idsede = managerFilter.getInfoToken(req, 'idsede');
    const idusuario = managerFilter.getInfoToken(req, 'idusuario');
    const dataPrint = req.body.dataPrint;
    const isprecuenta = req.body.isprecuenta || 0;
    // const query = `CALL procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}', ${isprecuenta})`;
    // return await emitirRespuestaSP_RES(query, res);

    const query = `CALL procedure_pwa_print_comanda(?, ?, ?, ?, ?)`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [idorg, idsede, idusuario, JSON.stringify(dataPrint), isprecuenta], 'setPrinterOtherDocs');
    return ReS(res, {data: rows || [] });
};
module.exports.setPrinterOtherDocs = setPrinterOtherDocs;


// const getLaCuenta = async function (req, res) {
// 	const idorg = req.body.idorg || managerFilter.getInfoToken(req,'idorg');
// 	const idsede = req.body.idsede || managerFilter.getInfoToken(req, 'idsede');
//     const mesa = req.body.mesa ? req.body.mesa : '0';
//     const idpedido = req.body.idpedido ? req.body.idpedido : '';

//     console.log('req.body', req.body)
    
// 	const read_query = `call procedure_bus_pedido_bd_3051(${mesa}, '', '${idpedido}', ${idorg}, ${idsede}, 0, -1);`;	
//     emitirRespuestaSP_RES(read_query, res);

//     // const read_query = `call procedure_pwa_print_comanda(${idorg}, ${idsede}, ${idusuario},'${JSON.stringify(dataPrint)}')`;
//     // return emitirRespuestaSP(read_query);        
// }
// module.exports.getLaCuenta = getLaCuenta;
let debounceTimes = {};
let debounceKeys = [];
const getLaCuenta = async (req, res) => {
    const idorg = req.body.idorg || managerFilter.getInfoToken(req, 'idorg');
    const idsede = req.body.idsede || managerFilter.getInfoToken(req, 'idsede');
    const mesa = req.body.mesa ? req.body.mesa : '0';
    const idpedido = req.body.idpedido ? req.body.idpedido : '';
    
    const key = `${idorg}-${idsede}-${mesa}-${idpedido}`;
    const now = Date.now();
    const lastTime = debounceTimes[key];    

    if (lastTime && now - lastTime < 3000) {
        logger.warn({ key }, 'Solicitud rechazada: menos de 3 segundos desde la última');
        // Si la última solicitud fue hace menos de 2 segundos, no procesar la solicitud
        return res.status(429).json({ error: 'Too Many Requests' });
    }
    debounceTimes[key] = now;
    debounceKeys.push(key);

    // Si debounceTimes tiene más de 60 elementos, eliminar los primeros 40
    if (debounceKeys.length > 60) {
        for (let i = 0; i < 40; i++) {
            const keyToRemove = debounceKeys.shift();
            delete debounceTimes[keyToRemove];
        }
    }

    // const query = `CALL procedure_bus_pedido_bd_3051(${mesa}, '', '${idpedido}', ${idorg}, ${idsede}, 0, -1);`;
    // return await emitirRespuestaSP_RES(query, res);

    const query = `CALL procedure_bus_pedido_bd_3051(?, ?, ?, ?, ?, ?, ?);`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [mesa, '', idpedido, idorg, idsede, 0, -1], 'getLaCuenta');
    return ReS(res, {data: rows || [] });
};
module.exports.getLaCuenta = getLaCuenta;

// la cuenta desde el cliente

const getLaCuentaFromCliente = async function (req, res) {	
	const idsede = req.body.idsede;
    const idcliente = req.body.idcliente;
    const num_mesa = req.body.num_mesa;

	// const read_query = `call procedure_pwa_cuenta_cliente(${idcliente}, ${idsede}, ${num_mesa});`;	
    // return await emitirRespuestaSP_RES(read_query, res); 

    const query = `CALL procedure_pwa_cuenta_cliente(?, ?, ?);`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [idcliente, idsede, num_mesa], 'getLaCuentaFromCliente');
    return ReS(res, {data: rows || [] });
}
module.exports.getLaCuentaFromCliente = getLaCuentaFromCliente;


// la cuenta desde el cliente - solo totales
const getLaCuentaFromClienteTotales = async function (req, res) {	
	const idsede = req.body.idsede;
    const idcliente = req.body.idcliente;
    const num_mesa = req.body.num_mesa;
    const idpedido = req.body.idpedido ? req.body.idpedido : null;

	// const read_query = `call procedure_pwa_cuenta_cliente_totales(${idcliente}, ${idsede}, ${idpedido}, ${num_mesa});`;	
    // return await emitirRespuestaSP_RES(read_query, res); 

    const query = `CALL procedure_pwa_cuenta_cliente_totales(?, ?, ?, ?);`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [idcliente, idsede, idpedido, num_mesa], 'getLaCuentaFromClienteTotales');
    return ReS(res, {data: rows || [] });
}
module.exports.getLaCuentaFromClienteTotales = getLaCuentaFromClienteTotales;

const getLaCuentaFromPedidoTotales = async function (req, res) {
    const idpedido = req.body.idpedido;

	// const read_query = `call procedure_pwa_cuenta_cliente_totales('', '', ${idpedido});`;	
    // return await emitirRespuestaSP_RES(read_query, res); 

    const query = `CALL procedure_pwa_cuenta_cliente_totales(?, ?, ?);`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [idpedido], 'getLaCuentaFromPedidoTotales');
    return ReS(res, {data: rows || [] });
}
module.exports.getLaCuentaFromPedidoTotales = getLaCuentaFromPedidoTotales;


const getConsultaDatosCliente = async function (req, res) {
	// const idorg = managerFilter.getInfoToken(req,'idorg');
	const idsede = managerFilter.getInfoToken(req, 'idsede');
    const onlySede = req.body.only_sede || false;
    const doc = req.body.documento;    
    // const _str_only_sede = onlySede ? ' and idsede = ' + idsede : ''; 
    var read_query = '';

    if ( onlySede ) {
        // read_query = `SELECT * FROM cliente c 
        //                 inner join cliente_sede cs on c.idcliente = cs.idcliente 
        //             where c.estado=0 and c.ruc='${doc}' and cs.idsede = ${idsede} order by nombres limit 1`;
        const query = `SELECT * FROM cliente c 
                        inner join cliente_sede cs on c.idcliente = cs.idcliente 
                    where c.estado=0 and c.ruc=? and cs.idsede = ? order by nombres limit 1`;
        const rows = await QueryServiceV1.ejecutarConsulta(query, [doc, idsede], 'SELECT', 'getConsultaDatosCliente');
        return ReS(res, {data: rows || [] });
    } else {
        // read_query = `SELECT * FROM cliente where estado=0 and ruc='${doc}' order by nombres limit 1`;  
        const query = `SELECT * FROM cliente where estado=0 and ruc=? order by nombres limit 1`; 
        const rows = await QueryServiceV1.ejecutarConsulta(query, [doc], 'SELECT', 'getConsultaDatosCliente');
        return ReS(res, {data: rows || [] });
    }

    // logger.debug({ doc }, 'Buscando cliente por documento');
    // idorg=${idorg}) AND 
	// const read_query = `SELECT * FROM cliente where estado=0 and ruc='${doc}' ${_str_only_sede} order by nombres limit 1`;	
    // return await emitirRespuesta_RES(read_query, res);

    // const query = `SELECT * FROM cliente where estado=0 and ruc='${doc}' ${_str_only_sede} order by nombres limit 1`;	
    
}
module.exports.getConsultaDatosCliente = getConsultaDatosCliente;

const getConsultaDatosClienteNoTk = async function (req, res) {
    // const idorg = managerFilter.getInfoToken(req,'idorg');
    // const idsede = managerFilter.getInfoToken(req, 'idsede');
    const doc = req.body.documento;

    // console.log('doc cliente: ', doc);
    // idorg=${idorg}) AND 
    // const read_query = `SELECT * FROM cliente where estado=0 and ruc='${doc}' order by pwa_id desc, telefono desc limit 1`;    
    // const read_query = `SELECT * FROM cliente where estado=0 and pwa_id='dni|${doc}' and ruc='${doc}' order by pwa_id desc, telefono desc, pwa_code_verification desc limit 1`;    
    // return await emitirRespuesta_RES(read_query, res);

    const query = `SELECT * FROM cliente where estado=0 and pwa_id='dni|${doc}' and ruc=? order by pwa_id desc, telefono desc, pwa_code_verification desc limit 1`;    
    const rows = await QueryServiceV1.ejecutarConsulta(query, [doc], 'SELECT', 'getConsultaDatosClienteNoTk');
    return ReS(res, {data: rows || [] });
}
module.exports.getConsultaDatosClienteNoTk = getConsultaDatosClienteNoTk;


// guarda los datos de facturacion que especifica el usuario desde pwa
const setDatosFacturacionClientePwa = async function (req, res) {
    const data = req.body;
    // const read_query = `call procedure_set_datos_facturacion_pwa('${JSON.stringify(data)}');`;   
    // return await emitirRespuestaSP_RES(read_query, res); 

    const query = `call procedure_set_datos_facturacion_pwa(?);`;   
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [JSON.stringify(data)], 'setDatosFacturacionClientePwa');
    return ReS(res, {data: rows || [] });
}
module.exports.setDatosFacturacionClientePwa = setDatosFacturacionClientePwa;

// datos al inicio despues de escanear codigo
const getDataSedeIni = async function (req, res) {	
	const idsede = req.body.idsede;
	// const read_query = `SELECT idsede, idorg, nombre, eslogan, pwa_msj_ini, pwa_time_limit, pwa_delivery_comercio_online from sede where (idsede=${idsede}) AND estado=0`;	
    // return await emitirRespuesta_RES(read_query, res);

    const query = `SELECT idsede, idorg, nombre, eslogan, pwa_msj_ini, pwa_time_limit, pwa_delivery_comercio_online from sede where (idsede=?) AND estado=0`;	
    const rows = await QueryServiceV1.ejecutarConsulta(query, [idsede], 'SELECT', 'getDataSedeIni');
    return ReS(res, {data: rows || [] });
}
module.exports.getDataSedeIni = getDataSedeIni;

const getIdSedeFromNickName = async function (req, res) {  
    const nomsede = req.body.nomsede;
    // const read_query = `SELECT idsede, idorg, nombre, eslogan, pwa_msj_ini, pwa_time_limit, is_holding from sede where link_carta='${nomsede}' AND estado=0`;    
    // return await emitirRespuesta_RES(read_query, res);

    const query = `SELECT idsede, idorg, nombre, eslogan, pwa_msj_ini, pwa_time_limit, is_holding from sede where link_carta=? AND estado=0`;    
    const rows = await QueryServiceV1.ejecutarConsulta(query, [nomsede], 'SELECT', 'getIdSedeFromNickName');
    return ReS(res, {data: rows || [] });
}
module.exports.getIdSedeFromNickName = getIdSedeFromNickName;


const getReglasApp = async function (req, res) {	
	// const read_query = `SELECT * from pwa_reglas_app where estado=0`;	
    // return await emitirRespuesta_RES(read_query, res);

    const query = `SELECT * from pwa_reglas_app where estado=0`;	
    const rows = await QueryServiceV1.ejecutarConsulta(query, [], 'SELECT', 'getReglasApp');
    return ReS(res, {data: rows || [] });
}
module.exports.getReglasApp = getReglasApp;

const getConsAppDelivery = async function (req, res) {	
	// const read_query = `SELECT value from sys_const where llave in ('DELIVERY_CANTIDAD_ITEMS_ESCALA', 'DELIVERY_COSTO_ITEMS_ESCALA')`;	
    // return await emitirRespuesta_RES(read_query, res);

    const query = `SELECT value from sys_const where llave in ('DELIVERY_CANTIDAD_ITEMS_ESCALA', 'DELIVERY_COSTO_ITEMS_ESCALA')`;	
    const rows = await QueryServiceV1.ejecutarConsulta(query, [], 'SELECT', 'getConsAppDelivery');
    return ReS(res, {data: rows || [] });
}
module.exports.getConsAppDelivery = getConsAppDelivery;


const setRegisterClienteLogin = async function (req, res) {
	// const idorg = req.body.idorg;
	const dataLogin = req.body;
	// const read_query = `call procedure_pwa_register_cliente_login('${JSON.stringify(dataLogin)}')`;

    // return await emitirRespuestaSP_RES(read_query, res); 

    const query = `call procedure_pwa_register_cliente_login(?, ?);`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [JSON.stringify(dataLogin), ''], 'setRegisterClienteLogin');
    return ReS(res, {data: rows || [] });
}
module.exports.setRegisterClienteLogin = setRegisterClienteLogin;

const getCalcTimeDespacho = async function (req, res) {	
	const idsede = req.body.idsede;
	// const read_query = `call procedure_pwa_calc_time_despacho('${idsede}')`;
    // return await emitirRespuestaSP_RES(read_query, res); 

    const query = `call procedure_pwa_calc_time_despacho(?);`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [idsede], 'getCalcTimeDespacho');
    return ReS(res, {data: rows || [] });
}
module.exports.getCalcTimeDespacho = getCalcTimeDespacho;


// encuesta al terminar de pagar la cuenta // agarra la primer encuesta por los momentos
const getEncuesta = async function (req, res) {	
    const idsede = req.body.idsede;
        
    // const read_query = `SELECT preguntas from encuesta_sede_conf where idsede=${idsede} and estado=0 limit 1`;
    // return emitirRespuestaSP(read_query);      
    // return await emitirRespuesta_RES(read_query, res);  

    const query = `SELECT preguntas from encuesta_sede_conf where idsede=? and estado=0 limit 1`;
    const rows = await QueryServiceV1.ejecutarConsulta(query, [idsede], 'SELECT', 'getEncuesta');
    return ReS(res, {data: rows || [] });
}
module.exports.getEncuesta = getEncuesta;

// opciones de la encuesta, bueno, excelente ...
const getEncuestaOpRespuesta = async function (req, res) {	
    const idsede = req.body.idsede;
        
    // const read_query = `select * from encuesta_respuesta where estado=0`;
    // return emitirRespuestaSP(read_query);      
    // return await emitirRespuesta_RES(read_query, res);  

    const query = `select * from encuesta_respuesta where estado=0`;
    const rows = await QueryServiceV1.ejecutarConsulta(query, [], 'SELECT', 'getEncuestaOpRespuesta');
    return ReS(res, {data: rows || [] });
}
module.exports.getEncuestaOpRespuesta = getEncuestaOpRespuesta;


// guadar encuensta
const setEncuestaGuardar = async function (req, res) {	
	const id = req.body.i;
	const item = req.body.item;
	// const read_query = `call procedure_save_encuesta(${id}, '${JSON.stringify(item)}')`;
    // return await emitirRespuestaSP_RES(read_query, res); 

    const query = `call procedure_save_encuesta(?, ?);`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [id, JSON.stringify(item)], 'setEncuestaGuardar');
    return ReS(res, {data: rows || [] });
}
module.exports.setEncuestaGuardar = setEncuestaGuardar;

// sede obtener  pwa_requiere_gps  > si sede requiere geolocalizacion
const getSedeRequiereGPS = async function (req, res) {	
    const idsede = req.body.idsede;
        
    // return emitirRespuestaSP(read_query);      
    // const read_query = `select pwa_requiere_gps, is_holding from sede where idsede=${idsede} and estado=0`;
    // return await emitirRespuesta_RES(read_query, res);  

    const query = `select pwa_requiere_gps, is_holding from sede where idsede=? and estado=0`;
    const rows = await QueryServiceV1.ejecutarConsulta(query, [idsede], 'SELECT', 'getSedeRequiereGPS');
    return ReS(res, {data: rows || [] });
}
module.exports.getSedeRequiereGPS = getSedeRequiereGPS;


// cliente log por dni, buscar
const getUsuarioClietenByDNI = async function (req, res) {	
    // try {
        const { documento } = req.body;
        
        // ✅ SEGURO: Prepared statement previene SQL Injection
        // const read_query = `SELECT * FROM cliente WHERE ruc = ? AND estado = 0`;
    //     const rows = await sequelize.query(read_query, {
    //         replacements: [documento],
    //         type: QueryTypes.SELECT
    //     });
        
    //     return ReS(res, { data: rows });
    // } catch (error) {
    //     logger.error({ err: error, body: req.body }, 'Error en getUsuarioClietenByDNI');
    //     return ReE(res, 'Error al buscar cliente', 500);
    // }

    const query = `SELECT * FROM cliente WHERE ruc = ? AND estado = 0`;
    const rows = await QueryServiceV1.ejecutarConsulta(query, [documento], 'SELECT', 'getUsuarioClietenByDNI');
    return ReS(res, {data: rows || [] });
}
module.exports.getUsuarioClietenByDNI = getUsuarioClietenByDNI;


// cliente perfil
const getClientePerfil = async function (req, res) {	
    // try {
        const { idcliente } = req.body;
        
        // ✅ SEGURO: Prepared statement previene SQL Injection
    //     const read_query = `SELECT * FROM cliente WHERE idcliente = ? AND estado = 0`;
    //     const rows = await sequelize.query(read_query, {
    //         replacements: [idcliente],
    //         type: QueryTypes.SELECT
    //     });
        
    //     return ReS(res, { data: rows });
    // } catch (error) {
    //     logger.error({ err: error, body: req.body }, 'Error en getClientePerfil');
    //     return ReE(res, 'Error al obtener perfil', 500);
    // }

    const query = `SELECT * FROM cliente WHERE idcliente = ? AND estado = 0`;
    const rows = await QueryServiceV1.ejecutarConsulta(query, [idcliente], 'SELECT', 'getClientePerfil');
    return ReS(res, {data: rows || [] });
}
module.exports.getClientePerfil = getClientePerfil;

const setClientePerfil = async function (req, res) {	
    try {
        const { idcliente, ruc, email, f_nac } = req.body;
        
        // ✅ SEGURO: Prepared statement previene SQL Injection
        // const read_query = `UPDATE cliente SET ruc = ?, email = ?, f_nac = ? WHERE idcliente = ?`;
        // const rows = await sequelize.query(read_query, {
        //     replacements: [ruc, email, f_nac, idcliente],
        //     type: QueryTypes.UPDATE
        // });
        
        // return ReS(res, { data: rows });

        const query = `UPDATE cliente SET ruc = ?, email = ?, f_nac = ? WHERE idcliente = ?`;
        const rows = await QueryServiceV1.ejecutarConsulta(query, [ruc, email, f_nac, idcliente], 'UPDATE', 'setClientePerfil');
        return ReS(res, {data: rows || [] });
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Error en setClientePerfil');
        return ReE(res, 'Error al actualizar perfil', 500);
    }
}
module.exports.setClientePerfil = setClientePerfil;

// guarda direccion de cliente pwa
const setClienteNewDireccion = async function (req, res) {	
	// const id = req.body.i;
	const _data = req.body;
	// const read_query = `call procedure_pwa_guardar_direccion_cliente('${JSON.stringify(_data)}')`;
    // return await emitirRespuestaSP_RES(read_query, res); 

    const query = `call procedure_pwa_guardar_direccion_cliente(?)`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [JSON.stringify(_data)], 'setClienteNewDireccion');
    return ReS(res, {data: rows || [] });
}
module.exports.setClienteNewDireccion = setClienteNewDireccion;


const setHistoryError = async function (req, res) {	
    try {
        const { elerror, elorigen } = req.body;
        
        // ✅ SEGURO: Prepared statement previene SQL Injection
        
        const query = `INSERT INTO historial_error(fecha, error, origen) VALUES (NOW(), ?, ?)`;
        const rows = await QueryServiceV1.ejecutarConsulta(query, [JSON.stringify(elerror), elorigen], 'INSERT', 'setHistoryError');

        // const read_query = `INSERT INTO historial_error(fecha, error, origen) VALUES (NOW(), ?, ?)`;
        // const rows = await sequelize.query(read_query, {
        //     replacements: [JSON.stringify(elerror), elorigen],
        //     type: QueryTypes.INSERT
        // });
        
        return ReS(res, { data: rows });
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Error en setHistoryError');
        return ReE(res, 'Error al guardar error', 500);
    }
}
module.exports.setHistoryError = setHistoryError;

const getAllClienteBySearch = async function (req, res) {
    // const read_query = `call pwa_delivery_get_all_clientes()`;
    // return await emitirRespuestaSP_RES(read_query, res); 

    const query = `call pwa_delivery_get_all_clientes()`;
    const rows = await QueryServiceV1.ejecutarProcedimiento(query, [], 'getAllClienteBySearch');
    return ReS(res, {data: rows || [] });
}
module.exports.getAllClienteBySearch = getAllClienteBySearch;

const getAllClienteBySearchName = async function (req, res) {
    try {
        const { buscar, only_sede } = req.body;
        const idsede = managerFilter.getInfoToken(req, 'idsede');
        const onlySede = only_sede || false;
        
        let read_query, replacements;
        
        // ✅ SEGURO: Prepared statement previene SQL Injection
        if (onlySede) {
            read_query = `SELECT c.idcliente, c.nombres, c.ruc, c.telefono 
                FROM cliente c 
                INNER JOIN cliente_sede cs ON c.idcliente = cs.idcliente 
                WHERE c.estado = 0 
                AND c.nombres != '' 
                AND cs.idsede = ? 
                AND LENGTH(c.nombres) > 10 
                AND c.nombres LIKE ? 
                GROUP BY c.nombres 
                ORDER BY c.nombres`;
            replacements = [idsede, `%${buscar}%`];
        } else {
            read_query = `SELECT idcliente, nombres, ruc, telefono 
                FROM cliente 
                WHERE estado = 0 
                AND nombres != '' 
                AND LENGTH(nombres) > 10 
                AND nombres LIKE ? 
                GROUP BY nombres 
                ORDER BY nombres`;
            replacements = [`%${buscar}%`];
        }
        
        // const rows = await sequelize.query(read_query, {
        //     replacements,
        //     type: QueryTypes.SELECT
        // });
        
        // return ReS(res, { data: rows });
        
        const rows = await QueryServiceV1.ejecutarConsulta(read_query, replacements, 'SELECT', 'getAllClienteBySearchName');
        return ReS(res, {data: rows || [] });


    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Error en getAllClienteBySearchName');
        return ReE(res, 'Error al buscar clientes', 500);
    }
}
module.exports.getAllClienteBySearchName = getAllClienteBySearchName;

const getLastComisionEntrega = async function (req, res) {    
    try {
        const { codigo_postal } = req.body;
        
        // ✅ SEGURO: Prepared statement previene SQL Injection
        const read_query = `SELECT * FROM sede_config_service_delivery 
            WHERE codigo_postal LIKE ? 
            LIMIT 1`;
        
        // const rows = await sequelize.query(read_query, {
        //     replacements: [`%${codigo_postal}%`],
        //     type: QueryTypes.SELECT
        // });
        
        // return ReS(res, { data: rows });

        const rows = await QueryServiceV1.ejecutarConsulta(read_query, [`%${codigo_postal}%`], 'SELECT', 'getLastComisionEntrega');
        return ReS(res, {data: rows || [] });
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Error en getLastComisionEntrega');
        return ReE(res, 'Error al obtener comisión', 500);
    }
}
module.exports.getLastComisionEntrega = getLastComisionEntrega;


const getCanalesConsumo = async function (req, res) {    
    try {
        const { idsede } = req.body;
        
        // ✅ SEGURO: Prepared statement previene SQL Injection
        const read_query = `SELECT idtipo_consumo, descripcion, titulo 
            FROM tipo_consumo 
            WHERE idsede = ? AND estado = 0`;
        
        // const rows = await sequelize.query(read_query, {
        //     replacements: [idsede],
        //     type: QueryTypes.SELECT
        // });
        
        // return ReS(res, { data: rows });

        const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idsede], 'SELECT', 'getCanalesConsumo');
        return ReS(res, {data: rows || [] });
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Error en getCanalesConsumo');
        return ReE(res, 'Error al obtener canales', 500);
    }
}
module.exports.getCanalesConsumo = getCanalesConsumo;

const setRegisterScanQr = async function (req, res) {    
    try {
        const { idsede, canal, idscan = 0 } = req.body;
        
        // ✅ SEGURO: Prepared statement para stored procedure
        const read_query = `CALL procedure_register_scan_qr(?, ?, ?)`;
        // const rows = await sequelize.query(read_query, {
        //     replacements: [idsede, canal, idscan],
        //     type: QueryTypes.SELECT
        // });
        
        // const arr = Object.values(rows[0]);
        // return ReS(res, { data: arr });

        const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [idsede, canal, idscan], 'setRegisterScanQr');
        return ReS(res, {data: rows || [] });
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Error en setRegisterScanQr');
        return ReE(res, 'Error al registrar QR', 500);
    }
}
module.exports.setRegisterScanQr = setRegisterScanQr;

// enviado desde el servidor de impresion
const setFlagPrinter = async function (id) {    
    try {
        // ✅ SEGURO: Prepared statement previene SQL Injection
        const read_query = `UPDATE print_server_detalle SET impreso = 1 WHERE idprint_server_detalle = ?`;
        // return await sequelize.query(read_query, {
        //     replacements: [id],
        //     type: QueryTypes.UPDATE
        // });

        QueryServiceV1.ejecutarConsulta(read_query, [id], 'UPDATE', 'setFlagPrinter');        
    } catch (error) {
        logger.error({ err: error, id }, 'Error en setFlagPrinter');
        return false;
    }
}
module.exports.setFlagPrinter = setFlagPrinter;

const setFlagPrinterChangeEstadoPedido = async function (id) {    
    try {
        // ✅ SEGURO: Prepared statement previene SQL Injection
        const read_query = `UPDATE pedido SET pwa_estado = 'A' WHERE idpedido = ?`;
        // return await sequelize.query(read_query, {
        //     replacements: [id],
        //     type: QueryTypes.UPDATE
        // });

        QueryServiceV1.ejecutarConsulta(read_query, [id], 'UPDATE', 'setFlagPrinterChangeEstadoPedido');
    } catch (error) {
        logger.error({ err: error, id }, 'Error en setFlagPrinterChangeEstadoPedido');
        return false;
    }
}
module.exports.setFlagPrinterChangeEstadoPedido = setFlagPrinterChangeEstadoPedido;


// busca los subitems del item seleccionado, para hacer mas rapida la consulta
const getSearchSubitemsItem = async function (iditem) {
    try {
        // ✅ SEGURO: Prepared statement para stored procedure
        const read_query = `CALL porcedure_pwa_pedido_carta_get_subitens(?)`;
        // const rows = await sequelize.query(read_query, {
        //     replacements: [iditem],
        //     type: QueryTypes.SELECT
        // });

        return await QueryServiceV1.ejecutarProcedimiento(read_query, [iditem], 'getSearchSubitemsItem');
    } catch (error) {
        logger.error({ err: error, iditem }, 'Error en getSearchSubitemsItem');
        return false;
    }
}
module.exports.getSearchSubitemsItem = getSearchSubitemsItem;


const setCodigoVerificacionTelefonoCliente =  async function (data) {
    try {
        const numTelefono = parseInt(data.idcliente) < 0 ? data.numberphone : '';
        
        // ✅ SEGURO: Prepared statement para stored procedure
        const read_query = `CALL porcedure_pwa_update_phono_sms_cliente(?, ?, ?)`;
        // const rows = await sequelize.query(read_query, {
        //     replacements: [data.idcliente, numTelefono, data.cod],
        //     type: QueryTypes.SELECT
        // });
        
        // return Object.values(rows[0]);
        return await QueryServiceV1.ejecutarProcedimiento(read_query, [data.idcliente, numTelefono, data.cod], 'setCodigoVerificacionTelefonoCliente');
    } catch (error) {
        logger.error({ err: error, data }, 'Error en setCodigoVerificacionTelefonoCliente');
        return false;
    }
}
module.exports.setCodigoVerificacionTelefonoCliente = setCodigoVerificacionTelefonoCliente;

const saveCallClientMesa =  async function (data, op) {        
    // const read_query = `call procedure_pwa_call_client_mesa('${JSON.stringify(data)}', ${op})`;
    // return await emitirRespuestaSP(read_query);

    const read_query = `call procedure_pwa_call_client_mesa(?, ?)`;
    return await QueryServiceV1.ejecutarProcedimiento(read_query, [JSON.stringify(data), op], 'saveCallClientMesa');
}
module.exports.saveCallClientMesa = saveCallClientMesa;

const listCallClientMesa =  async function (data) {
    try {
        // ✅ SEGURO: Prepared statement previene SQL Injection
        const read_query = `SELECT num_mesa FROM cliente_solicita_atencion_mesa WHERE idsede = ? AND atendido = 0`;
        // return await sequelize.query(read_query, {
        //     replacements: [data.idsede],
        //     type: QueryTypes.SELECT
        // });
        
        return await QueryServiceV1.ejecutarConsulta(read_query, [data.idsede], 'SELECT', 'listCallClientMesa');
    } catch (error) {
        logger.error({ err: error, data }, 'Error en listCallClientMesa');
        return [];
    }
}
module.exports.listCallClientMesa = listCallClientMesa;


// datos de facturacion
const getComprobantesSede = async function (req, res) {
    try {
        const { idsede } = req.body;
        
        // ✅ SEGURO: Prepared statement previene SQL Injection
        const read_query = `SELECT tc.idtipo_comprobante, tc.descripcion 
            FROM tipo_comprobante_serie tcs 
            INNER JOIN tipo_comprobante tc ON tcs.idtipo_comprobante = tc.idtipo_comprobante 
            WHERE tcs.idsede = ? AND tcs.estado = 0 AND tc.codsunat != '0'`;
        
        // const rows = await sequelize.query(read_query, {
        //     replacements: [idsede],
        //     type: QueryTypes.SELECT
        // });
        
        const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idsede], 'SELECT', 'getComprobantesSede');
        return ReS(res, { data: rows });
    } catch (error) {
        logger.error({ err: error, body: req.body }, 'Error en getComprobantesSede');
        return ReE(res, 'Error al obtener comprobantes', 500);
    }
}
module.exports.getComprobantesSede = getComprobantesSede;


const getLastPedidoClienteThisTable = async function (req, res) {   
    const idsede = req.body.idsede;    
    const nummesa = req.body.nummesa;   
    // const read_query = `select p.referencia, TIMESTAMPDIFF(MINUTE, p.fecha_hora, now()) min 
    //                     from pedido p left join pedido_correlativos pc on pc.idsede = p.idsede 
    //                     where p.idpedido > pc.last_id_pedido_cierre and p.idsede=${idsede} and p.flag_is_cliente = 1 and p.nummesa = ${nummesa} and p.estado = 0 order by p.idpedido desc limit 1`;
    
    // return await emitirRespuesta_RES(read_query, res);

    const read_query = `select p.referencia, TIMESTAMPDIFF(MINUTE, p.fecha_hora, now()) min 
                        from pedido p left join pedido_correlativos pc on pc.idsede = p.idsede 
                        where p.idpedido > pc.last_id_pedido_cierre and p.idsede=? and p.flag_is_cliente = 1 and p.nummesa = ? and p.estado = 0 order by p.idpedido desc limit 1`;
    
    const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idsede, nummesa], 'SELECT', 'getLastPedidoClienteThisTable');
    return ReS(res, { data: rows });
}
module.exports.getLastPedidoClienteThisTable = getLastPedidoClienteThisTable;


const getListMesas = async function (req, res) {   
    const idsede = req.body.idsede;    
    const obj = req.body.obj;       
    let read_query = '';

    if ( obj ) {
        // read_query = `call procedure_refresh_mesas_list_mozo(${idsede}, '${JSON.stringify(obj)}')`;    
        read_query = `call procedure_refresh_mesas_list_mozo(?, ?)`;    
        const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [idsede, JSON.stringify(obj)], 'getListMesas');
        return ReS(res, { data: rows });
    } else {
        // read_query = `call procedure_refresh_mesas_list_mozo(${idsede}, null)`;    
        read_query = `call procedure_refresh_mesas_list_mozo(?, null)`;    
        const rows = await QueryServiceV1.ejecutarProcedimiento(read_query, [idsede], 'getListMesas');
        return ReS(res, { data: rows });
    }
    
    // return await emitirRespuestaSP_RES(read_query, res);
}
module.exports.getListMesas = getListMesas;


const updateTimeLinePedido = async function (idpedido,time_line) {
    // const read_query = `insert into pedido_time_line_entrega (idpedido, time_line) values (${idpedido}, '${JSON.stringify(time_line)}') ON DUPLICATE KEY UPDATE time_line = '${JSON.stringify(time_line)}'`;
    // return await emitirRespuesta(read_query);        
    
    const read_query = `insert into pedido_time_line_entrega (idpedido, time_line) values (?, ?) ON DUPLICATE KEY UPDATE time_line = ?`;
    QueryServiceV1.ejecutarConsulta(read_query, [idpedido, JSON.stringify(time_line), JSON.stringify(time_line)], 'INSERT', 'updateTimeLinePedido');
}
module.exports.updateTimeLinePedido = updateTimeLinePedido;

// const setUserAccountRemove = async function (req, res) { 
//     const user = req.body.user;      
//     console.log('user remove', user);
//     if ( user.isCliente ) {
//         const read_query = `update usuario set estado=1 where idusuario=${idusuario}`;
//         emitirRespuestaSP(read_query);                
//     }
//     res.status(200).json({success: true})
// }
// module.exports.setUserAccountRemove = setUserAccountRemove;

const setUserAccountRemove = async (req, res) => {
    const user = req.body.user;

    try {
        if (user.isCliente) {
            // const read_query = `UPDATE usuario SET estado = 1 WHERE idusuario = ${user.idusuario}`;
            // return await emitirRespuestaSP(read_query);
            
            const read_query = `UPDATE usuario SET estado = 1 WHERE idusuario = ?`;
            QueryServiceV1.ejecutarConsulta(read_query, [user.idusuario], 'UPDATE', 'setUserAccountRemove');
        }

        res.status(200).json({ success: true });
    } catch (error) {
        logger.error({ error }, 'Error al eliminar cuenta de usuario');
        res.status(500).json({ success: false, error: 'An error occurred.' });
    }
};
module.exports.setUserAccountRemove = setUserAccountRemove;

// listar todos los mozos para change user
const getAllMozosChangeUser = async function (req, res) {
    const idsede = managerFilter.getInfoToken(req, 'idsede');
    // const read_query = `select idusuario, nombres, usuario from usuario where idsede=${idsede} and estado=0 and acc like '%A2%'`;
    // return await emitirRespuesta_RES(read_query, res);    


    const read_query = `select idusuario, nombres, usuario from usuario where idsede=? and estado=0 and acc like '%A2%'`;
    const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idsede], 'SELECT', 'getAllMozosChangeUser');
    return ReS(res, { data: rows });
}
module.exports.getAllMozosChangeUser = getAllMozosChangeUser;

// solicitud remoto de borrar
const updatePermissionDeleteItemPedido = async function (idpedido_detalle) {
    // const read_query = `update pedido_detalle set permission_delete = '1' where idpedido_detalle=${idpedido_detalle}`;
    // await ejecutarQuery(read_query);        

    const read_query = `update pedido_detalle set permission_delete = '1' where idpedido_detalle=?`;
    QueryServiceV1.ejecutarConsulta(read_query, [idpedido_detalle], 'UPDATE', 'updatePermissionDeleteItemPedido');
}
module.exports.updatePermissionDeleteItemPedido = updatePermissionDeleteItemPedido;

// solicitud remoto de borrar
const updatePermissionDeleteAllPedido = async function (idpedido) {
    // const read_query = `update pedido set permission_delete = '1' where idpedido in (${idpedido})`;
    // await ejecutarQuery(read_query);        

    const read_query = `update pedido set permission_delete = '1' where idpedido in (?)`;
    QueryServiceV1.ejecutarConsulta(read_query, [idpedido], 'UPDATE', 'updatePermissionDeleteAllPedido');
}
module.exports.updatePermissionDeleteAllPedido = updatePermissionDeleteAllPedido;

// solicitud cambiar metodo de pago
const updatePermissionChangeMetodoPago = async function (idregistro_pago_detalle) {
    // const read_query = `update registro_pago_detalle set permission_change = '1' where idregistro_pago_detalle = ${idregistro_pago_detalle}`;
    // await ejecutarQuery(read_query);        

    const read_query = `update registro_pago_detalle set permission_change = '1' where idregistro_pago_detalle = ?`;
    QueryServiceV1.ejecutarConsulta(read_query, [idregistro_pago_detalle], 'UPDATE', 'updatePermissionChangeMetodoPago');
}
module.exports.updatePermissionChangeMetodoPago = updatePermissionChangeMetodoPago;

const updatePermissionRemoveRegistroPago = async function (idregistro_pago) {
    // const read_query = `update registro_pago set permission_delete = '1' where idregistro_pago = ${idregistro_pago}`;
    // await ejecutarQuery(read_query);        

    const read_query = `update registro_pago set permission_delete = '1' where idregistro_pago = ?`;
    QueryServiceV1.ejecutarConsulta(read_query, [idregistro_pago], 'UPDATE', 'updatePermissionRemoveRegistroPago');
}
module.exports.updatePermissionRemoveRegistroPago = updatePermissionRemoveRegistroPago;

const calculateQuantity = (item) => {

    // si la cantidad es un string como una operacion matematica como '5-1' o '4+1' entonces resolverla
    // console.log('item.cantidad ====', item.cantidad);
    if (typeof item.cantidad === 'string' && item.cantidad.match(/[\+\-\*\/]/)) {
        item.cantidad = 1;
    }
    // console.log('item.cantidad ====', item.cantidad);


    if ( !item.cantidad && item.isporcion === 'SP' ) {
        item.cantidad = item.cantidad_seleccionada || 1;
    }

    // convertir la cantidad a int
    item.cantidad = item.cantidad !== 'ND' && item.cantidad !== 'SP' && item.cantidad === undefined ? parseInt(item.cantidad) : item.cantidad;



    item.cantidad = isNaN(item.cantidad) || item.cantidad === null || item.cantidad === undefined ? 'ND' : item.cantidad;
    item.cantidad = parseInt(item.cantidad) >= 9999 ? item.isporcion || 'ND' : item.cantidad;    

    handleStock.checkExistSubItemsWithCantidad(item);    
    
    let _cantSumar = item.venta_x_peso === 1 ? -item.cantidad : item.sumar ? -1 : parseInt(item.sumar) === 0 ? 0 : 1;
    if (item.cantidad != 'ND') {
        item.cantidadSumar = _cantSumar;
    } else {
        if (item.isExistSubItemsWithCantidad) {
            item.cantidadSumar = _cantSumar;
        }
    }

    return item;
}
module.exports.calculateQuantity = calculateQuantity;

const updateSubItems = (item, listSubItems) => {
    if (listSubItems && item.subitems) {
        try {
            listSubItems.map(subitem => {
                item.subitems.map(s => {
                    if (s.opciones && Array.isArray(s.opciones)) {
                        let itemFind = s.opciones.filter(_subItem => parseInt(_subItem.iditem_subitem) === parseInt(subitem.iditem_subitem))[0];
                        if (itemFind) {
                            itemFind.cantidad = subitem.cantidad;
                        }
                    }
                });
            });
        } catch (error) {            
            logger.error(error);
        }
    }
    return item;
}
module.exports.updateSubItems = updateSubItems;


const saveCallMozoHolding = (data) => {
    const {idpedido, idusuario} = data;
    // const read_query = `insert into sede_holding_call_pedido_listo(fecha, idpedido, idusuario, data) values (now(), ${idpedido}, ${idusuario}, '${JSON.stringify(data)}')`;
    // return emitirRespuesta(read_query);
    
    const read_query = `insert into sede_holding_call_pedido_listo(fecha, idpedido, idusuario, data) values (now(), ?, ?, ?)`;
    QueryServiceV1.ejecutarConsulta(read_query, [idpedido, idusuario, JSON.stringify(data)], 'INSERT', 'saveCallMozoHolding');
}
module.exports.saveCallMozoHolding = saveCallMozoHolding;

const saveCallMozoHoldingEstado = (idpedido) => {
    // const read_query = `update sede_holding_call_pedido_listo set estado='1' where idpedido=${idpedido}`;
    // return emitirRespuesta(read_query);

    const read_query = `update sede_holding_call_pedido_listo set estado='1' where idpedido=?`;
    QueryServiceV1.ejecutarConsulta(read_query, [idpedido], 'UPDATE', 'saveCallMozoHoldingEstado');
}
module.exports.saveCallMozoHoldingEstado = saveCallMozoHoldingEstado;

const getListCallMozoHolding = async function (req, res) {
    const idusuario= managerFilter.getInfoToken(req, 'idusuario');
    // const read_query = `select * from sede_holding_call_pedido_listo where estado=0 and idusuario=${idusuario}`;
    // return await emitirRespuesta_RES(read_query, res);    

    const read_query = `select * from sede_holding_call_pedido_listo where estado=0 and idusuario=?`;
    const rows = await QueryServiceV1.ejecutarConsulta(read_query, [idusuario], 'SELECT', 'getListCallMozoHolding');
    return ReS(res, { data: rows });
}
module.exports.getListCallMozoHolding = getListCallMozoHolding;

// separar proceso de actualizar stock de porcedure_pwa_update_cantidad_item

// async function processItem(item, idsede) {
//     let result = [{
//         cantidad: null,
//         listItemsPorcion: null,
//         listSubItems: null
//     }];

//     const _item = {
//         iditem: item.iditem,
//         idcarta_lista: item.idcarta_lista,
//         cantidad_reset: item.cantidad_reset,
//         cantidadSumar: item.cantidadSumar,
//         isporcion: item.isporcion,
//         iditem2: item.iditem2        
//     }

//     let updatedItem;    
//     try {     
//         updatedItem = await emitirRespuestaSP(`call procedure_stock_item('${JSON.stringify(_item)}', ${idsede})`);    
//         result[0].cantidad = updatedItem[0].cantidad;
//         return result;
//     } catch (error) {
//         const sqlQuery = `call procedure_stock_item('${JSON.stringify(_item)}', ${idsede})`;
//         const dataError = {
//             incidencia: {
//                 message: error,
//                 data: {
//                     item_process: _item,                    
//                     query: sqlQuery,
//                     res_query: updatedItem
//                 }
//             },
//             origen: 'processItem'            
//         }
//         errorManager.logError(dataError);
//         console.error('processItem====', error);
//     }
        
//     // cambiamos 220624 -> no funciono, mas funciona lo antrior a esto
//     //     try {
//     //         // Calcular la cantidad a actualizar
//     //         let cantidadUpdate = item.cantidad_reset ? item.cantidad_reset : item.cantidadSumar;
//     //         // Iniciar una transacción
//     //         const t = await sequelize.transaction();
            
//     //         // esto porque puede venir de monitoreo de stock
//     //         // cantidadUpdate = cantidadUpdate === 0 ? item.cantidad : cantidadUpdate;
//     //         console.log('0cantidadUpdate', cantidadUpdate);
                            
//     //         // Actualizar la cantidad en la tabla carta_lista
//     //         await sequelize.query(`
//     //             UPDATE carta_lista 
//     //             SET cantidad = cantidad + :cantidadUpdate 
//     //             WHERE idcarta_lista = :idcarta_lista
//     //         `, {
//     //             replacements: { cantidadUpdate, idcarta_lista: item.idcarta_lista },
//     //             type: QueryTypes.UPDATE,
//     //             transaction: t
//     //         });

//     //         await t.commit();
            

//     //         // Obtener la cantidad actualizada
//     //         const updatedItem = await sequelize.query(`
//     //             SELECT cantidad 
//     //             FROM carta_lista 
//     //             WHERE idcarta_lista = :idcarta_lista
//     //         `, {
//     //             replacements: { idcarta_lista: item.idcarta_lista },
//     //             type: QueryTypes.SELECT,                
//     //         });            
            
//     //         result[0].cantidad = updatedItem[0].cantidad;

//     //         result[0].cantidad = updatedItem[0].cantidad;
           

//     //     } catch (err) {
//     //         // await t.rollback();

//     //         let errorObject = {
//     //             message: err.message,
//     //             error: err
//     //         };
            
//     //         sequelize.query(`
//     //             INSERT INTO historial_error (fecha, error, origen) 
//     //             VALUES (:fecha, :error, :origen)
//     //         `, {
//     //             replacements: { 
//     //                 fecha: new Date(), 
//     //                 error: JSON.stringify(errorObject), 
//     //                 origen: 'processItem update cantidad carta_lista' 
//     //             },
//     //             type: QueryTypes.INSERT,
//     //             transaction: t
//     //         });

//     //         await t.commit();



//     //         console.error(err);
//     //         // Maneja el error de la manera que prefieras
//     //     }    

//     // return result;
// }
// module.exports.processItem = processItem;


// async function processItemPorcion(item) {    
//     let result = [{
//         cantidad: null,
//         listItemsPorcion: null,
//         listSubItems: null
//     }];

//     const _idItemUpdate = item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem;

//     // mandamos como item solo los datos necesarios para actualizar
//     let updatedItem; 
//     let _itemProcessPorcion = {};
//     try { 
//         _itemProcessPorcion = {
//             iditem: item.iditem,
//             idcarta_lista: item.idcarta_lista,
//             cantidad_reset: item.cantidad_reset,
//             cantidadSumar: item.cantidadSumar,
//             isporcion: item.isporcion,
//             iditem2: item.iditem2        
//         }       
           
//         updatedItem = await emitirRespuestaSP(`call procedure_stock_item_porcion('${JSON.stringify(_itemProcessPorcion)}')`);    
//         console.log('updatedItem', updatedItem);
//         result[0].listItemsPorcion = updatedItem[0].listItemsPorcion;
//         const listItemsJson = JSON.parse(updatedItem[0].listItemsPorcion)
    
//         // buscamos en result[0].listItemsPorcion la cantidad segun item
//         const itemCantidad = listItemsJson.filter(i => i.iditem == _idItemUpdate);
//         result[0].cantidad = itemCantidad[0].cantidad;
//         return result;
//     } catch (error) {
//         const sqlQuery = `call procedure_stock_item_porcion('${JSON.stringify(_itemProcessPorcion)}')`;

//         const dataError = {
//             incidencia: {
//                 message: error.toString(),
//                 data: {
//                     item_process: _itemProcessPorcion,
//                     // item: item,
//                     query: sqlQuery,
//                     res_query: updatedItem
//                 }
//             },
//             origen: 'processItemPorcion'
//         }
//         errorManager.logError(dataError);

//         console.error('processItemPorcion====', error);
//     }
    
//     // cambiamos 220624 -> no funciono, mas funciona lo antrior a esto
//     // const t = await sequelize.transaction();
//     // try {
//     //     let cantidadUpdate = item.cantidad_reset ? item.cantidad_reset : item.cantidadSumar;
//     //     console.log('cantidadUpdate', cantidadUpdate);
//     //     // Actualizar la cantidad en la tabla porcion

//     //     const _idItemUpdate = item.iditem === item.idcarta_lista ? item.iditem2 : item.iditem;

//     //     await sequelize.query(`
//     //         UPDATE porcion AS p
// 	// 			LEFT JOIN item_ingrediente AS ii using (idporcion)
// 	// 		 SET p.stock = p.stock + (:cantidadUpdate * (ii.cantidad))
//     //         WHERE ii.iditem = :xIdItem
//     //     `, {
//     //         replacements: { cantidadUpdate, xIdItem: _idItemUpdate },
//     //         type: QueryTypes.UPDATE,
//     //         transaction: t
//     //     })
//     //     // Actualizar la cantidad en la tabla producto_stock si esta relacionados con productos
//     //     await sequelize.query(`
//     //         UPDATE producto_stock AS ps
// 	// 			LEFT JOIN item_ingrediente AS ii using (idproducto_stock)					
// 	// 		SET ps.stock= ps.stock + (:cantidadUpdate * (ii.cantidad))
//     //         WHERE ii.iditem = :xIdItem
//     //     `, {
//     //         replacements: { cantidadUpdate, xIdItem: _idItemUpdate },
//     //         type: QueryTypes.UPDATE,
//     //         transaction: t
//     //     })

//     //     await t.commit();

//     //     let updatedItem;
//     //     if (item.isporcion === 'SP') {
//     //         console.log('query iditem', item.iditem);
//     //         const t_cantidad = await sequelize.transaction();
//     //         updatedItem = await sequelize.query(`
//     //         SELECT FLOOR(
//     //             IF (
//     //                 SUM(i1.necesario) >= 1, 
//     //                 IF(i1.viene_de='1', MIN(CAST(p1.stock AS SIGNED)), MIN(CAST(ps.stock AS SIGNED))),
//     //                 IF(i1.viene_de='1', CAST(p1.stock AS SIGNED), CAST(ps.stock AS SIGNED))
//     //             ) / i1.cantidad
//     //         ) AS cantidad 
//     //         FROM item_ingrediente AS i1 
//     //         LEFT JOIN porcion AS p1 ON i1.idporcion=p1.idporcion 
//     //         LEFT JOIN producto_stock ps ON ps.idproducto_stock = i1.idproducto_stock
//     //         WHERE i1.iditem = :iditem 
//     //         GROUP BY i1.iditem, i1.necesario 
//     //         ORDER BY i1.necesario DESC, i1.iditem_ingrediente 
//     //         LIMIT 1
//     //         `, {
//     //             replacements: { iditem: _idItemUpdate },
//     //             type: QueryTypes.SELECT,  
//     //             transaction: t_cantidad              
//     //         });
//     //         await t_cantidad.commit();
//     //     } else {
//     //         updatedItem = await sequelize.query(`
//     //             SELECT cantidad 
//     //                 FROM carta_lista 
//     //             WHERE idcarta_lista = :idcarta_lista
//     //         `, {
//     //             replacements: { idcarta_lista: item.idcarta_lista },
//     //             type: QueryTypes.SELECT,                
//     //         });
//     //     }

//     //     console.log('updatedItem', updatedItem);

//     //     result[0].cantidad = updatedItem[0].cantidad;

//     // } catch (error) {
//     //     console.error(error);
//     // }

//     // return result;

// }
// module.exports.processItemPorcion = processItemPorcion;

// async function processAllItemSubitemSeleted(allItems) {
    
//     // const sqlQuery = `call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`;
//     let updatedItem;
//     try {        
//         updatedItem = await emitirRespuestaSP(`call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`);
//         console.log('updatedItem', updatedItem);
//         return updatedItem;
//     } catch (error) {
//         const sqlQuery = `call procedure_stock_all_subitems('${JSON.stringify(allItems)}')`;

//         const dataError = {
//             incidencia: {
//                 message: error,
//                 data: {
//                     item_process: _item,                    
//                     query: sqlQuery,
//                     res_query: updatedItem
//                 }
//             },
//             origen: 'processAllItemSubitemSeleted'            
//         }
//         errorManager.logError(dataError);

//         console.error('processAllItemSubitemSeleted====', error);        
//     }
//     // result[0].listItemsPorcion = updatedItem[0].cantidad;
// }
// module.exports.processAllItemSubitemSeleted = processAllItemSubitemSeleted;


// cambiamos 220624 -> no funciono, mas funciona lo antrior a esto
// async function processItemSubitemSeleted(subitem_selected, cantidadSumar) {    
//     console.log('subitem_selected', subitem_selected);
//     console.log('cantidadSumar', cantidadSumar);
//     const t = await sequelize.transaction();
//     if ( subitem_selected.idporcion > 0 ) {
//         try {
//             await sequelize.query(`
//                 UPDATE porcion 
//                 SET stock = stock + :cantidad 
//                 WHERE idporcion = :idporcion
//             `, {
//                 replacements: { cantidad: cantidadSumar, idporcion: subitem_selected.idporcion },
//                 type: QueryTypes.UPDATE,
//                 transaction: t
//             });
//         } catch (error) {
//             console.error(error);
//         }    
//     }

//     if ( subitem_selected.idproducto > 0 ) {
//         try {
//             await sequelize.query(`
//                 UPDATE producto_stock 
//                 SET stock = stock + :cantidad 
//                 WHERE idproducto_stock = :idproducto
//             `, {
//                 replacements: { cantidad: cantidadSumar, idproducto: subitem_selected.idproducto },
//                 type: QueryTypes.UPDATE,
//                 transaction: t
//             });
//         } catch (error) {
//             console.error(error);
//         }
//     }

//     // si acaso no es porcion ni porducto
//     if ( subitem_selected.cantidad !== 'ND' && subitem_selected.idporcion === 0 && subitem_selected.idproducto === 0 ) {
//         try {
//             await sequelize.query(`
//                 UPDATE item_subitem 
//                 SET cantidad = cantidad + :cantidad 
//                 WHERE iditem_subitem = :iditem_subitem
//             `, {
//                 replacements: { cantidad: cantidadSumar, iditem_subitem: subitem_selected.iditem_subitem },
//                 type: QueryTypes.UPDATE,
//                 transaction: t
//             });
//         } catch (error) {
//             console.error(error);
//         }
//     }

//     await t.commit();
// }
// module.exports.processItemSubitemSeleted = processItemSubitemSeleted;


async function processAndEmitItem(item, chanelConect, io, idsede, notificar = true) {
    let rpt;
    try {
        item = calculateQuantity(item);

        // vemos si tiene subitems con cantidad distinta de ND
        // si los tiene entonces no se modifica el stock
        // console.log('item apiPwa processAndEmitItem', item);
        // let _existSubItemsWithCantidadInND = false; 

        // _existSubItemsWithCantidadInND = handleStock.checkExistSubItemsWithCantidad(item);
        // if (_existSubItemsWithCantidadInND) {
        //     item.cantidad = 'SUBITEM-CANTIDAD'; // para manejar solo los subitems
        // }

        // if (item.isExistSubItemsWithCantidad) {
        //     item.cantidad = 'SUBITEM-CANTIDAD'; // para manejar solo los subitems
        // }
        
        // console.log('_existSubItemsWithCantidadInND apiPwa', _existSubItemsWithCantidadInND);
        
        if (item.cantidad !== 'ND' || item.isExistSubItemsWithCantidad) {
            const rptCantidad = await setItemCarta(0, item, idsede);                        
            item.cantidad = rptCantidad[0].cantidad;
            // item.cantidad = _existSubItemsWithCantidadInND ? 'ND' : rptCantidad[0].cantidad;

            // Check if rptCantidad[0] and listSubItems exist before using them
            const listSubItems = rptCantidad[0] && rptCantidad[0].listSubItems ? rptCantidad[0].listSubItems : null;
            item = updateSubItems(item, listSubItems);
            rpt = {
                item : item,
                listItemPorcion: item.isporcion === 'SP' && rptCantidad[0] && rptCantidad[0].listItemsPorcion ? JSON.parse(rptCantidad[0].listItemsPorcion) : null,    
                listSubItems: listSubItems                
            }

            // console.log('rpt =>>>>', rpt);
            if ( notificar ) {
                io.to(chanelConect).emit('itemModificado-pwa', rpt);
                io.to(chanelConect).emit('itemModificado', item); 
            }
        } else {
            if ( notificar ) {                	
                io.to(chanelConect).emit('itemModificado', item);
                io.to(chanelConect).emit('itemModificado-pwa', item);
            }
        }   
    } catch (_error) {
        logger.error({ error: _error }, 'Error en procesamiento de item desde pwa');
        
        const dataError = {
            incidencia: {
                message: _error.toString(),
                data: {
                    item_process: item,                               
                    res_query: rpt
                }
            },
            origen: 'processAndEmitItem'            
        }
        errorManager.logError(dataError);

        io.to(chanelConect).emit('error', { message: 'Error al modificar el item', _error });
    }
}
module.exports.processAndEmitItem = processAndEmitItem;

// consultar version app
const getVersionApp = async function (req, res) {
    const {name_app} = req.body;
    // const version = await sequelize.query(`SELECT version,properties FROM app_version WHERE name_app = :name_app`, {
    //     replacements: { name_app: name_app },
    //     type: QueryTypes.SELECT
    // });

    // res.json({ data: version });

    const read_query = `SELECT version,properties FROM app_version WHERE name_app = ?`;
    const version = await QueryServiceV1.ejecutarConsulta(read_query, [name_app], 'SELECT', 'getVersionApp');
    res.json({ data: version });
}
module.exports.getVersionApp = getVersionApp;

// const setModificaStockTest = async function (req, res) { 
//     const id = req.body;      
//     console.log('==========> llego setModificaStockTest', id)
//     res.status(200).json({success: true})
// }
// module.exports.setModificaStockTest = setModificaStockTest



// function emitirRespuesta_RES(xquery, res) {
// 	console.log(xquery);
// 	return sequelize.query(xquery, {type: QueryTypes.SELECT})
// 	.then(function (rows) {
		
// 		return ReS(res, {
// 			data: rows
// 		});
// 		// return rows;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }




// function emitirRespuesta(xquery, res) {
// 	console.log(xquery);
// 	return sequelize.query(xquery, {type: QueryTypes.SELECT})
// 	.then(function (rows) {
		
// 		// return ReS(res, {
// 		// 	data: rows
// 		// });
// 		return rows;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }


// function emitirRespuestaSP(xquery) {
// 	console.log(xquery);
// 	return sequelize.query(xquery, {		
// 		type: QueryTypes.SELECT
// 	})
// 	.then(function (rows) {

// 		// convertimos en array ya que viene en object
// 		var arr = [];
// 		arr = Object.values(rows[0]);		
		
// 		return arr;
// 	})
// 	.catch((err) => {
// 		return false;
// 	});
// }



// function emitirRespuestaSP_RES(xquery, res) {
// 	console.log(xquery);
// 	sequelize.query(xquery, {		
// 		type: QueryTypes.SELECT
// 	})
// 	.then(function (rows) {

// 		// convertimos en array ya que viene en object
// 		var arr = [];
// 		arr = Object.values(rows[0]) ;
		
// 		return ReS(res, {
// 			data: arr
// 		});
// 	})
// 	.catch((err) => {
// 		return ReE(res, err);
// 	});
// }

