const { to, ReE, ReS }  = require('../service/uitl.service');
// let Sequelize = require('sequelize');
// let config = require('../config');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');
let queryService = require('../service/query.service');
let socketHoldingService = require('../service/holding.socket.sevice');
const holdingService = require('../service/holding.sevice');
let logger = require('../utilitarios/logger');
const socketManager = require('../service/socket.manager');

// let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);
const { sequelize, QueryTypes } = require('../config/database');

const emitirRespuesta = async (xquery) => {    
    try {
        return await sequelize.query(xquery, { type: QueryTypes.SELECT });
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


const getMarcas = async function (req, res) {
    const {idsede_holding} = req.body;
    const xquery = `select sdm.*, s.nombre nom_sede from sede_holding_marcas sdm
	    inner join sede s on s.idsede = sdm.idsede_marca 
        where sdm.idsede_holding = ${idsede_holding} and sdm.estado = 0`;
    return emitirRespuesta_RES(xquery, res);
}


const getHoldingByIdSede = async function (req, res) {
    const {idsede} = req.body;
    const xquery = `select sh.* from sede_holding sh            
        where sh.idsede = ${idsede} and sh.estado = 0`;
    return emitirRespuesta_RES(xquery, res);
}

const getMetodoPagoMozo = async function (req, res) {
    const xquery = `select idtipo_pago, descripcion, img from tipo_pago where habilitado_mozo_holding=1`;
    return emitirRespuesta_RES(xquery, res);
}


const getListItemsPedidoDetalle = async function (v_idpedido) {
    const xquery = `SELECT        
        idpedido,
        idpedido_detalle,
        cantidad,
        ptotal
    FROM pedido_detalle 
    WHERE idpedido = ${v_idpedido} 
    AND estado = 0 
    AND pagado = 0;`;

    return await emitirRespuesta(xquery);    
}


const saveRegistroPagoPedido = async function (pedido, itemsPedidoDetalle) {    
    const _pedido = JSON.stringify(pedido);  
    const _itemsPedidoDetalle = JSON.stringify(itemsPedidoDetalle);   
    logger.debug(`call procedure_save_pedido_holding( '${_pedido}', '${_itemsPedidoDetalle}');`); 
    const xquery = `call procedure_save_pedido_holding(?,?);`;
    return await queryService.emitirRespuestaSP_RAW(xquery, [_pedido, _itemsPedidoDetalle]);
}

async function getPrinterMarcaInHolding(idsede_marca) {
    // const xquery = `select *, ip as ip_print from impresora i where idsede = ${idsede_marca} and estado=0 limit 1`;    
    const xquery = `SELECT cp.var_size_font_tall_comanda, i.ip, cp.num_copias, cp.pie_pagina, cp.pie_pagina_comprobante, cp.logo, '' as logo64, s.nombre AS des_sede, s.eslogan, s.mesas, s.ciudad
		, i.var_margen_iz, i.var_size_font, i.idimpresora, i.papel_size, i.img64, i.copia_local, i.local
			FROM conf_print AS cp
            	INNER JOIN sede AS s ON cp.idsede = s.idsede
            	LEFT join conf_print_otros cpo on cpo.idsede = s.idsede and cpo.idtipo_otro = -3
            	LEFT join impresora i on i.idimpresora = cpo.idimpresora
			WHERE (cp.idsede=${idsede_marca})`;
    return await queryService.emitirRespuesta(xquery);
    
    // return [{"idimpresora":1, "ip": "192.168.1.114","var_margen_iz": 0,"var_size_font": 0,"local": 0,"num_copias": 1,"var_size_font_tall_comanda": 0,"copia_local": 0,"img64": "","papel_size": 0,"pie_pagina": "Gracias por su preferencia. Estamos trabajando para brindarle un mejor servicio.","pie_pagina_comprobante": "Representación impresa del Comprobante de Venta Electrónico puede ser consultada en www.papaya.com.pe Bienes transferdios a la amazonia para ser consumidos en la misma."}];
}


// registra las suscripcion a mensajes push del cliente patio de comidas
async function saveSuscripcionCliente(req, res) {
    const {key_suscripcion_push, order_code} = req.body;
    const xquery = `insert into cliente_holding_suscripcion (key_suscripcion_push, codigo_localizador) values ('${key_suscripcion_push}', '${order_code}')`;
    return emitirRespuesta_RES(xquery, res);
}

// del patio de comidas, el cliente optiene datos de su pedido segun el codigo de orden
async function getPedidoClienteByOrdeCode(req, res) {
    const order_code = req.query.order_code; // Get from URL params    
    // Validate order_code
    if (!order_code) {
        return ReE(res, {
            success: false,
            message: 'Código de orden es requerido'
        });
    }

    const xquery = `
    SELECT 
        p.fecha_hora, 
        pl.idsede, 
        pl.idorg, 
        s.nombre nom_marca, 
        pl.idpedido,
        pl.estado,
        pl.table_number,
        pl.fecha_hora_listo,
        CASE 
            WHEN pl.estado = '0' THEN 'EN PREPARACION'
            WHEN pl.estado = '1' THEN 'ANULADO'
            WHEN pl.estado = '2' THEN 'PEDIDO LISTO'
            WHEN pl.estado = '3' THEN 'ENTREGADO'
        END as estado_show
    FROM pedido_codigo_localizador pl
    INNER JOIN pedido p ON p.idpedido = pl.idpedido 
    INNER JOIN sede s ON pl.idsede = s.idsede
    WHERE pl.codigo_localizador = ${order_code}
    AND p.fecha_hora >= DATE_SUB(NOW(), INTERVAL 3 HOUR)
    ORDER BY p.fecha_hora DESC`;

        return emitirRespuesta_RES(xquery, res);

}

async function setTableNumber(req, res) {
    const {idpedidos, table_number, rooms, order_code} = req.body;
    const xquery = `update pedido_codigo_localizador set table_number = '${table_number}' where idpedido in (${idpedidos}) and codigo_localizador = '${order_code}'`;
    socketHoldingService.sendNumberTableClienteHolding(rooms, table_number, order_code, idpedidos);
    queryService.emitirRespuesta_UPDATE(xquery);
    return ReS(res, {
        success: true,
        message: 'Número de mesa actualizado correctamente'
    });
}



// guarda temporalmente el pedido para que el mozo lo pueda confirmar
async function setSavePedidoClienteHolding (req, res) {
    const {id, pedido, idcliente, idsede_holding} = req.body;

    const _pedido = JSON.stringify(pedido);      
    logger.debug(`call procedure_save_pedido_cliente_holding( ${id}, '${_pedido}', '${idcliente}', '${idsede_holding}');`); 
    const xquery = `call procedure_save_pedido_cliente_holding(?,?,?,?);`;
    const result = await queryService.emitirRespuestaSP_RAW(xquery, [id, _pedido, idcliente, idsede_holding]);
    
    // Notificar al room del holding que hay nuevo pedido de cliente
    if (idsede_holding) {
        const roomHolding = `holding_${idsede_holding}`;
        
        // Obtener socketid del cliente desde la tabla cliente_socketid
        let socket_cliente = null;
        try {
            const querySocketCliente = `SELECT socketid FROM cliente_socketid WHERE idcliente = ${idcliente}`;
            const socketResult = await emitirRespuesta(querySocketCliente);
            socket_cliente = socketResult?.[0]?.socketid || null;
        } catch (error) {
            logger.error({ error }, 'Error obteniendo socket del cliente');
        }
        
        socketManager.emitToRoom(roomHolding, 'nuevo-pedido-cliente-holding', {
            id: result?.[0]?.id || id,
            idcliente,
            idsede_holding,
            pedido,
            timestamp: new Date().toISOString(),
            socket_cliente
        });
        logger.debug({ roomHolding, socket_cliente }, 'Notificación enviada a room del holding');
    }
    
    return ReS(res, {
            success: true,
            data: result,
            message: 'Pedido guardado correctamente'
        });
}

// obtener los pedidos del cliente por holding
async function getPedidoClienteByHolding (req, res) {
    const {idsede_holding} = req.body;
    const xquery = `select * from pedido_cliente_confirmar_holding where idsede_holding = ${idsede_holding} and estado = 0`;
    return emitirRespuesta_RES(xquery, res);
}

function setPedidoClienteAtendido (req, res) {
    const { idpedido_cliente_confirmar_holding, idusuario } = req.body;
    const xquery = `update pedido_cliente_confirmar_holding set estado = 1, idusuario=${idusuario} where idpedido_cliente_confirmar_holding = ${idpedido_cliente_confirmar_holding}`;
    queryService.emitirRespuesta_UPDATE(xquery, res);
    return ReS(res, {
        success: true,
        message: 'Pedido atendido correctamente'
    });
}

function setPedidoClientePagado (req, res) {
    const { idpedido_cliente_confirmar_holding } = req.body;
    const xquery = `update pedido_cliente_confirmar_holding set pagado = '1' where idpedido_cliente_confirmar_holding = ${idpedido_cliente_confirmar_holding}`;    
    queryService.emitirRespuesta_UPDATE(xquery, res);
    return ReS(res, {
        success: true,
        message: 'Pedido pagado'
    });
}

async function getUsuarioAceptePedidoClienteHolding (req, res) {
    const { idcliente, id } = req.body;
    const xquery = `select u.nombres from pedido_cliente_confirmar_holding p 
inner join usuario u on u.idusuario = p.idusuario 
where p.estado=1 and p.idpedido_cliente_confirmar_holding = ${id} order by p.idpedido_cliente_confirmar_holding  desc limit 2`;
    return await emitirRespuesta_RES(xquery, res);
}

async function getVerifyPedidoClienteMarcadoPagado(req, res) {
    const { id } = req.body;
    const xquery = `select pagado from pedido_cliente_confirmar_holding where idpedido_cliente_confirmar_holding = ${id}`;
    try {
        const result = await emitirRespuesta(xquery);
        const isPaid = result.length > 0 && result[0].pagado == '1';
        return ReS(res, {
            success: true,
            pagado: isPaid
        });
    } catch (error) {        
        logger.error(error);
        return ReE(res, {
            success: false,
            message: 'Error al verificar el estado de pago'
        });
    }
}

module.exports = {    
    getMarcas,
    getHoldingByIdSede,
    getMetodoPagoMozo,
    getListItemsPedidoDetalle,
    saveRegistroPagoPedido,
    getPrinterMarcaInHolding,
    saveSuscripcionCliente,
    getPedidoClienteByOrdeCode,
    getPedidoClienteByHolding,
    getUsuarioAceptePedidoClienteHolding,
    getVerifyPedidoClienteMarcadoPagado,
    setTableNumber,
    setSavePedidoClienteHolding,
    setPedidoClienteAtendido,
    setPedidoClientePagado
}
