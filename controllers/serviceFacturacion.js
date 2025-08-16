// servicio de facturacion
// datos requeridos;
// pedido items formateado
// arraysubtotales
// arraycomprobante
// arrcliente
// arrSede

const { to, ReE, ReS }  = require('../service/uitl.service');
let Sequelize = require('sequelize');
// let config = require('../config');
let config = require('../_config');
let managerFilter = require('../utilitarios/filters');

const fetch = require("node-fetch");
// var FormData = require('form-data');
let url_restobar = config.URL_RESTOBAR;
let sequelize = new Sequelize(config.database, config.username, config.password, config.sequelizeOption);

let mysql_clean = function (string) {
        return sequelize.getQueryInterface().escape(string);
};

var f_idorg, f_idsede, f_idusuario;

const cocinarFactura = async function (req, res) {  
    f_idsede = managerFilter.getInfoToken(req,'idsede');
    f_idorg = managerFilter.getInfoToken(req,'idorg');
    f_idusuario = managerFilter.getInfoToken(req,'idusuario');

    const xArrayCuerpo = req.body.items;
    const xArraySubTotales = req.body.subtotales;
    const xArrayComprobante = req.body.comprobante;
    const xArrayCliente = req.body.cliente;
    const xArraySede = req.body.sede;

    const xjsonXml = await xJsonSunatCocinarDatos(xArrayCuerpo, xArraySubTotales, xArrayComprobante, xArrayCliente, xArraySede);
    return ReS(res, {
                data: xjsonXml
            });
    
}
module.exports.cocinarFactura = cocinarFactura;



async function xJsonSunatCocinarDatos(xArrayCuerpo, xArraySubTotales, xArrayComprobante, xArrayCliente, xArraySede, showPrint=true) {

    const xArrayEncabezado =  xArraySede; // this.comercioService.getSedeInfo();
    // const isFacturacionElectronica = xArrayEncabezado.facturacion_e_activo === "0" ? false : true; // si se emiten comprobantes electronicos    
    const valIGV = xArrayEncabezado.porcentaje_igv;
    const isExoneradoIGV = xArrayEncabezado.is_exonerado_igv.toString() === '1' ? true : false;
    // const isExoneradoIGV = xArrayEncabezado.activo === "1" ? true : false; //1 = desactivado => exonerado

    // xCartaSubtotales.filter(x => x.descripcion.indexOf('I.G.V') > -1)
    //     .map(x => procentajeIGV = x);
    // const valIGV = parseFloat(procentajeIGV.monto);
    // const isExoneradoIGV = procentajeIGV.activo === "1" ? true : false; //1 = desactivado => exonerado


    // cpe = false subtotal + adicional -> lo ponemos en xImprimirComprobanteAhora() // para mostrar en la impresion
    // var xitems = xEstructuraItemsJsonComprobante(xArrayCuerpo, xArraySubTotales, false);
    const xitems = xJsonSunatCocinarItemDetalle(xArrayCuerpo, valIGV, isExoneradoIGV);
    // const xitems = this.xJsonSunatCocinarItemDetalle(xArrayCuerpo, valIGV, isExoneradoIGV);
    // const xitems = xArrayCuerpo;


    // array encabezado org sede
    // const xArrayEncabezado =  this.comercioService.getSedeInfo(); // xm_log_get('datos_org_sede');
    // const logo64 = xArrayEncabezado[0].logo64.split("base64,")[1];
    let fecha_actual = '', hora_actual = '';
    let xnum_doc_cliente = xArrayCliente.num_doc;

    const abreviaCo = xArrayComprobante.descripcion.substr(0, 1).toUpperCase();

    const xtipo_de_documento_identidad_cliente = xnum_doc_cliente.length >= 10 ? 6 : 1;
    const xtipo_de_documento_comprobante = xArrayComprobante.codsunat;
    const xidtipo__comprobante_serie = xArrayComprobante.idtipo_comprobante_serie;


    // si viene dni sin valor '00000000 = publico en general'
    xnum_doc_cliente = xnum_doc_cliente.length === 0 ? '00000000' : xnum_doc_cliente;

    // Importe total a pagar siempre ultimo es es el total
    const index_total = xArraySubTotales.length - 1;
    const importe_total_pagar = parseFloat(xArraySubTotales[index_total].importe).toFixed(2);
    const importe_total_igv = xArraySubTotales.filter(x => x.descripcion === 'I.G.V').map( x => x.importe)[0] || 0;

    // verifica si esta exonerado al igv /*/ caso de la selva u otros ubigeos exonerados del igv
    // const isExoneradoIGV = true;
    // let total_valor_de_venta_operaciones_gravadas = 0,total_valor_de_venta_operaciones_exoneradas = 0, leyenda = [];
    let totales = {};
    let descuento = [];
    let descuentoEnTotal = 0;

    if ( isExoneradoIGV ) { // exonerado del igv
        // totales
        totales = {
            "total_descuentos": descuentoEnTotal,
            "total_exportacion": 0.00,
            "total_operaciones_gravadas": 0.00,
            "total_operaciones_inafectas": 0.00,
            "total_operaciones_exoneradas": parseFloat(importe_total_pagar) + descuentoEnTotal,
            "total_operaciones_gratuitas": 0.00,
            "total_igv": 0.00,
            "total_impuestos": 0.00,
            "total_valor": importe_total_pagar,
            "total_venta": importe_total_pagar
        };


        
    } else {

        const total_operaciones_gravadas = descuentoEnTotal > 0 ? (importe_total_pagar_calc_igv - parseFloat(importe_total_igv)) + descuentoEnTotal : xArraySubTotales[0].importe; // el subtotal
        // const total_operaciones_gravadas = xArraySubTotales[0].importe; // el subtotal
        const _total_valor = descuentoEnTotal > 0 ? _base - descuentoEnTotal : importe_total_pagar - parseFloat(importe_total_igv);
        const _total_venta = importe_total_pagar_calc_igv;



        totales = {
             "total_descuentos": descuentoEnTotal,
            "total_descuentos": 0.00,
            "total_exportacion": 0.00,
            "total_operaciones_gravadas": total_operaciones_gravadas,
            "total_operaciones_inafectas": 0.00,
            "total_operaciones_exoneradas": 0.00,
            "total_operaciones_gratuitas": 0.00,
            "total_igv": importe_total_igv,
            "total_impuestos": importe_total_igv,
            "total_valor": _total_valor,
            "total_venta": _total_venta
        };
    }


        totales.total_descuentos = descuentoEnTotal;

        const rptDate = new Date().toLocaleString().split(' ');
        const fecha_manual = xArrayComprobante.fecha_manual || null; // para regularizar desde facturador

        fecha_actual = fecha_manual === null ? rptDate[0].replace(',', '').replace(/(\d+)\/(\d+)\/(\d+)/, '$3-$1-$2') : fecha_manual;

        // transformar fecha dia y mes 0 adelante
        const fecha_format = fecha_actual.split('-');
        fecha_actual = `${fecha_format[0]}-${xCeroIzq(fecha_format[1], 2)}-${xCeroIzq(fecha_format[2], 2)}`;

        hora_actual = rptDate[1];

        var direccionEmisor = xArrayEncabezado.sededireccion === '' ? xArrayEncabezado.direccion : xArrayEncabezado.sededireccion;
        direccionEmisor = direccionEmisor === undefined ? xArrayEncabezado.direccion: direccionEmisor;

    

        var jsonData = {                    
            "serie_documento": `${abreviaCo}${xArrayComprobante.serie}`,
            "numero_documento": "#",
            "fecha_de_emision": `${fecha_actual}`,
            "hora_de_emision": `${hora_actual}`,
            "codigo_tipo_operacion": "0101",
            "codigo_tipo_documento": `${xtipo_de_documento_comprobante}`,
            "codigo_tipo_moneda": "PEN",
            "fecha_de_vencimiento": `${fecha_actual}`,
            "numero_orden_de_compra": "",
            "datos_del_emisor": {
                "codigo_pais": "PE",
                "ubigeo": xArrayEncabezado.ubigeo,
                "direccion": `${direccionEmisor} `+ ' | ' + `${xArrayEncabezado.sedeciudad}`,
                "correo_electronico": "",
                "telefono": `${xArrayEncabezado.telefono}`,
                "codigo_del_domicilio_fiscal": xArrayEncabezado.codigo_del_domicilio_fiscal
            },
            "datos_del_cliente_o_receptor":{
                "codigo_tipo_documento_identidad": `${xtipo_de_documento_identidad_cliente}`,
                "numero_documento": `${xnum_doc_cliente}`,
                "apellidos_y_nombres_o_razon_social": `${xArrayCliente.nombres === "" ? "PUBLICO EN GENERAL" : xArrayCliente.nombres}`,
                "codigo_pais": "PE",
                "ubigeo": "150101",
                "direccion": xArrayCliente.direccion,
                "correo_electronico": "",
                "telefono": ""
            },
            "descuentos": descuento,
            "totales": totales,
            "items": xitems,
            "extras":{
                "forma_de_pago": "",
                "observaciones": "",
                "vendedor": "",
                "caja": "",
                "idcliente": xArrayCliente.idcliente
            }

        }

        console.log(jsonData);

        // envia a sunat
       const rptPrint = await xSendApiSunat(xArrayEncabezado.authorization_api_comprobante, jsonData, xArrayComprobante.idtipo_comprobante_serie);


       console.log('rptPrint', rptPrint);
    // });

    // mandamos a imprimir 
    if ( !showPrint ) { return rptPrint; }

    const xImpresoraPrint = xArrayEncabezado.datos_impresion || null;

    if ( xImpresoraPrint ) {
        xArrayComprobante.pie_pagina_comprobante = xImpresoraPrint.pie_pagina_comprobante;
        xArrayEncabezado.hash = rptPrint.hash; // que es realidad el qr
        xArrayEncabezado.external_id = rptPrint.external_id;
        // correlativo comprobante; 
        xArrayComprobante.correlativo = rptPrint.correlativo_comprobante || xArrayComprobante.correlativo;
        xArrayComprobante.facturacion_correlativo_api = rptPrint.facturacion_correlativo_api || xArrayComprobante.facturacion_correlativo_api;




        xImprimirComprobanteAhora(xArrayEncabezado,xArrayCuerpo,xArraySubTotales,xArrayComprobante,xArrayCliente, xImpresoraPrint);
    }


    return rptPrint;

    // return jsonData;
}


// items del comprobante
function xJsonSunatCocinarItemDetalle(orden, ValorIGV, isExoneradoIGV) {
    const xListItemsRpt = [];
    const procentaje_IGV = parseFloat(parseFloat(ValorIGV)/100);

    console.log('orden ============= > ', orden);
    // var valor_referencial_unitario_por_item_en_operaciones_no_onerosas_y_codigo = {"monto_de_valor_referencial_unitario": "01", "codigo_de_tipo_de_precio": "02"};
    // orden[0].items.map(items => {
        orden[0].items.map( (x, index) => {
            // if ( typeof x !== 'Object' ) {return; }
            index++;

            let codigo_tipo_afectacion_igv = "20";
            let total_base_igv = 0;
            let total_igv = 0;
            let total_valor_item = parseFloat(x.precio_total).toFixed(2); // x.precio_total;
            let _precio_unitario = x.punitario || x.precio_total;
            let _valor_unitario = _precio_unitario;

            if (!isExoneradoIGV) {// con igv
            //   valor_referencial_unitario_por_item_en_operaciones_no_onerosas_y_codigo = { monto_de_valor_referencial_unitario: "01" };
              // codigo_tipo_afectacion_igv = "10";
              // total_igv = parseFloat(x.precio_total) * procentaje_IGV;
              // total_base_igv = parseFloat(x.precio_total) - total_igv;
              // total_valor_item = total_base_igv;

              // total_igv = parseFloat(parseFloat(x.precio_total) * procentaje_IGV).toFixed(2);
              // total_base_igv = parseFloat(x.precio_total) - total_igv;
              // total_valor_item = parseFloat(total_base_igv);


              codigo_tipo_afectacion_igv = "10";
              total_igv = parseFloat(parseFloat(x.precio_total) * procentaje_IGV).toFixed(2);
              _valor_unitario = parseFloat(_precio_unitario) - (parseFloat(_precio_unitario) * procentaje_IGV); 
              total_base_igv = parseFloat(_precio_unitario) * x.cantidad;
              total_valor_item = _valor_unitario *  x.cantidad;
            } else {
                total_base_igv = parseFloat(x.precio_total); // cambio x error 3105 IGV
            }

            const _val_unitario = x.punitario || x.precio_total;

            // const montoIGVItem =  parseFloat(parseFloat(x.precio_total) * procentaje_IGV).toFixed(2);
            const jsonItem = {
                "codigo_interno": x.id,
                "descripcion": x.des,
                "codigo_producto_sunat": "90101500",
                "codigo_producto_gsl": "90101500",
                "unidad_de_medida": "NIU",
                "cantidad": x.cantidad,
                "valor_unitario": parseFloat(_val_unitario).toFixed(2), //parseFloat(x.punitario).toFixed(2),
                "codigo_tipo_precio": "01",
                "precio_unitario": parseFloat(_val_unitario).toFixed(2), // parseFloat(x.punitario).toFixed(2),
                "codigo_tipo_afectacion_igv": codigo_tipo_afectacion_igv,
                "total_base_igv": total_base_igv,
                "porcentaje_igv": parseFloat(ValorIGV),
                "total_igv": total_igv,
                "total_impuestos": total_igv,
                "total_valor_item": total_valor_item,
                "total_item": parseFloat(x.precio_total).toFixed(2)
            };

            xListItemsRpt.push(jsonItem);

        });
    // });    

    return xListItemsRpt;
}


function xReturnCorrelativoComprobante(_obj) {  
    let _rpt;
    if ( _obj.codsunat === '0' ) {  // para ticktes y otros
        _rpt = parseInt(_obj.correlativo) + 1;
        _rpt = xCeroIzq(_rpt, 7); // 7 ceros a la izq

        // suma correlativo  otro comprobante no declarado
        fetch(url_restobar+ 'bdphp/log_002.php', {
            method: 'POST',        
            body: {
                op: '103',
                i: _obj.idtipo_comprobante_serie}
        });
        // $.ajax({
        //     type: 'POST',
        //     url: url_restobar+ 'bdphp/log_002.php',
        //     data: {
        //         op: '103',
        //         i: _obj.idtipo_comprobante_serie
        //     }
        // });

    } else {
        const tomaDelApi = parseInt(_obj.facturacion_correlativo_api) === 0 ? false : true;
        _rpt = tomaDelApi ? '#' : parseInt(_obj.correlativo) + 1;
        if (!tomaDelApi) {
            _obj.facturacion_correlativo_api = 1;       
        }
    }

    return _rpt;
}


// tipo_documento = 01 > factura se envia de manera individual 
// idtipo_comprobante_serie => guardar el correlativo
async function xSendApiSunat(authorization_api_comprobante, json_xml, idtipo_comprobante_serie, guardarError=true) {
    // const dtSede = xm_log_get("datos_org_sede")[0];
    // const url_api_fac_sede = dtSede.url_api_fac || '';
    // const URL_COMPROBANTE = url_api_fac_sede === '' ?  xm_log_get('app3_sys_const')[0].value : url_api_fac_sede;
    const _url = config.URL_COMPROBANTE+'/documents';
    let _headers = config.HEADERS_COMPROBANTE;
    _headers.Authorization = "Bearer " + authorization_api_comprobante;

    var rpt = {};
    const numero_comp = json_xml.serie_documento + "-" + json_xml.numero_documento;
    const nomCliente = json_xml.datos_del_cliente_o_receptor.apellidos_y_nombres_o_razon_social;
    const idclienteComprobante = json_xml.extras.idcliente;
    const totalComprobante = json_xml.totales.total_venta;
    const totalesJson = json_xml.totales;
    // json_xml = json_xml;   

    // const _idregistro_p = typeof idregistro_pago === "object" ? idregistro_pago[1] : idregistro_pago;    
    // const _viene_facturador = typeof idregistro_pago === "object" ? 1 : 0; 
    const _idregistro_p = '';
    const _viene_facturador = 0;
    
    console.log('_headers', _headers);
    console.log('JSON.stringify(json_xml)', JSON.stringify(json_xml));
    //xPopupLoad.xopen();
    // xm_all_xToastOpen("Conectando con Sunat...");

    await fetch(_url, {
        method: 'POST',
        headers: _headers,
        body: JSON.stringify(json_xml),
    }).then(function (response) {
        return response.json();
    }).then(function (res) { 
        console.log('success cpe', res);
        const errSoap = res.response ? res.response.error_soap : false;
        // if (res.success || !errSoap) { // respuesta ok
            rpt.ok = true; 
            rpt.qr = res.data.qr;
            rpt.hash = res.data.hash;
            rpt.external_id = res.data.external_id;
            rpt.correlativo_comprobante = xCeroIzqNumberComprobante(res.data.number).split('-')[1]            
            rpt.facturacion_correlativo_api = 1; // toma los correlativos del api
                        
            res.data.nomcliente = nomCliente;
            res.data.idcliente = idclienteComprobante;
            res.data.total = totalComprobante;
            res.data.totales_json = totalesJson;
            res.data.numero = numero_comp;
            res.data.idregistro_pago = _idregistro_p;
            res.data.viene_facturador = _viene_facturador;
            res.data.idtipo_comprobante_serie = idtipo_comprobante_serie;
            res.data.jsonxml = errSoap ? json_xml : ''; // si hay un error al enviar a sunat guarda jsonxml para enviarlo luego
            
            CpeInterno_Registrar(res);

            return rpt;
    }).catch(async function (error) { // error de conexion o algo pero imprime
        console.log('error cpe', error);

        const data = {
                pdf:'0',
                cdr: '0',
                xml: '0',                
                idcliente: idclienteComprobante,
                total: totalComprobante,
                totales_json: totalesJson,
                nomcliente: nomCliente,
                numero: numero_comp, 
                jsonxml: json_xml, 
                external_id: '',  
                estado_api: 0,
                estado_sunat: 1,
                viene_facturador: _viene_facturador,
                idtipo_comprobante_serie: idtipo_comprobante_serie,                
            }
        
        rpt.ok = true;
        rpt.qr = '';
        rpt.hash = "www.papaya.com.pe";
        rpt.external_id = '';
        const correlativo_error = await CpeInterno_Error(data, _idregistro_p, _viene_facturador, idtipo_comprobante_serie);        
        rpt.correlativo_comprobante = correlativo_error.correlativo;
        rpt.facturacion_correlativo_api = correlativo_error.facturacion_correlativo_api;
        
        return rpt;
    });
    
    // setTimeout(() => {        
    //     // xm_all_xToastClose();
    // }, 500);    

    return rpt
}









function CpeInterno_Registrar(data) {
    
    if (data.success) { //si todo salio bien graba en CE (comprobantes electronicos)
        
        let dataSave = {}
    
        dataSave.jsonxml = data.data.jsonxml;
        // datos
        dataSave.pdf = data.links.pdf != '' ? 1 : 0; 
        dataSave.cdr = data.links.cdr != '' ? 1 : 0; 
        dataSave.xml = data.links.xml != '' ? 1 : 0; 
        dataSave.nomcliente = data.data.nomcliente;
        dataSave.idcliente = data.data.idcliente === "" ? 0 : data.data.idcliente;
        dataSave.total = data.data.total;
        dataSave.totales_json = data.data.totales_json;
        // dataSave.numero = data.data.numero;
        dataSave.numero = xCeroIzqNumberComprobante(data.data.number);
        dataSave.external_id = data.data.external_id;
        // dataSave.number = data.data.number; // numero de comprobante
        dataSave.hash = data.data.hash;
        dataSave.idregistro_pago = data.data.idregistro_pago;
        dataSave.viene_facturador = data.data.viene_facturador;
        dataSave.idtipo_comprobante_serie = data.data.idtipo_comprobante_serie;
        
        // response si tiene datos es factura y se registro ya en sunat
        dataSave.estado_api = 0; // se registro correctamente
        dataSave.estado_sunat = 1; // aun no se envia ( si es boleta va en resumen)
        dataSave.msj = 'Registrado'; 
        dataSave.msj_error = '';
        
        if ( data.response.length != 0 ) {
            //cuando es boleta debe ir 1 de todas maneras porque boleta se envia despues
            // si es factura debemos ver si hay error entonces 1 = se envia luego, de lo contrario 0 = envio a sunat ok
            const _estado_sunat = data.response.error_soap && dataSave.numero.indexOf('F') > -1 ? 1 : data.response.code ? data.response.code : 0;
            
            // dataSave.estado_sunat = data.response.error_soap ? data.response.code : 0; // si no hay error quiere decir que si registro
            dataSave.estado_sunat = _estado_sunat;
            dataSave.msj = data.response.description; 
        } 

        CpeInterno_SaveBD(dataSave);

    }
}

function xCeroIzqNumberComprobante(_number) {
    const _arrNumber = _number.split('-');
    const _num = xCeroIzq(_arrNumber[1],7);
    return _arrNumber[0] + '-' + _num;
}

function xCeroIzq(Num, CantidadCeros){
   Num = Num.toString();
   while(Num.length < CantidadCeros) Num = "0" + Num;
   return Num;
}

// hubo un error no conexion con el servicio o algo parecido
// guarda el cpe para volver a enviarlo al cierre
// registra el jsonxml para ser enviado luego
// idtipo_comprobante_serie => guardar el correlativo
async function CpeInterno_Error(data, _idregistro_p, _viene_facturador, idtipo_comprobante_serie) {
  let dataSave = {};

  console.log(' error  CpeInterno_Error', data);

  dataSave = data;
  dataSave.estado_api = 1;
  dataSave.estado_sunat = 1;
  dataSave.msj = "Sin registrar";
  dataSave.error_api = 1;
  if ( _idregistro_p != 0 ) {
      dataSave.idregistro_pago = _idregistro_p;
  }
  return await CpeInterno_SaveBD(dataSave);
}

// registra pero la sunat devuelve error m// en facturas
function CpeInterno_ErrorValidacionSunat(_idregistro_p, dataSave) {
  if (_idregistro_p != 0) {
    dataSave.idregistro_pago = _idregistro_p;
  }
  CpeInterno_SaveBD(dataSave);
};

// guardar en la base de datos el comprobante
async function CpeInterno_SaveBD(dataSave) {

    const read_query = `call procedure_cpe_registro(${f_idorg}, ${f_idsede}, ${f_idusuario}, '${JSON.stringify(dataSave)}')`;
    emitirRespuestaSP(read_query);     
}


function xImprimirComprobanteAhora(xArrayEncabezado,xArrayCuerpo,xArraySubtotal,xArrayComprobante,xArrayCliente, xImpresoraPrint){
    // xPopupLoad.titulo="Imprimiendo..."; 

    // formato de impresion items comprobante donde no se tiene en cuenta el tipo de consumo solo seccion e items
    // let _arrBodyComprobante = xEstructuraItemsJsonComprobante(xArrayCuerpo, xArraySubtotal, true); // cpe = true subtotal + adicional
    // _arrBodyComprobante = xEstructuraItemsAgruparPrintJsonComprobante(_arrBodyComprobante);

    const _arrBodyComprobante = xEstructuraItemPrint(xArrayCuerpo);

    
    xArrayEncabezado.nom_us = '';

    // preparar los arrays segun el formato impresion php
    let arrEnca = [];
    arrEnca[0] = xArrayEncabezado;
    xArrayEncabezado = arrEnca;

    let arrPrint = [];
    arrPrint[0] = xImpresoraPrint;
    xImpresoraPrint = arrPrint;


    const _data = {
        Array_enca: xArrayEncabezado,
        Array_print: xImpresoraPrint,
        ArrayItem: _arrBodyComprobante, // xArrayCuerpo 
        ArraySubTotales: xArraySubtotal,
        ArrayComprobante: xArrayComprobante,
        ArrayCliente: xArrayCliente
    }
    
    xSendDataPrintServer(_data, 2, 'comprobante');        
    
}

function xEstructuraItemPrint(xArrayCuerpo) {    
    xArrayCuerpo[0].items.map((item, index) => {
        xArrayCuerpo[0][index] = item;
    });    

    xArrayCuerpo[0].items = null;
    return xArrayCuerpo;
}


/// enviar a print server
function xSendDataPrintServer(_data, _idprint_server_estructura, _tipo){
    // _data = JSON.stringify(JSON.stringify(_data)); si no es prueba
    // switch (_idprint_server_estructura) {
    //     case 3: //pruebas
    //         break;
    //     case 4: // cuadre de caja
    //         if (_data.Array_enca.ip_print === '') return;
    //         break;
    //     default:
    //         if (_data.Array_print.ip_print === '') return;
            
    //         break;
    // }

    _data.Array_print.logo64 = '';
    _data.Array_print.logo = '';
    
    _data = JSON.stringify(_data);  
    _tipo = _tipo === 'pre cuenta' ? 'comanda' : _tipo;
    const rptDate = new Date().toLocaleString().split(' ');
    const fecha_now = rptDate[0];
    const hora_now = rptDate[1];


    const read_query = `INSERT INTO print_server_detalle (idorg, idsede, idusuario, idprint_server_estructura, descripcion_doc, fecha, hora, detalle_json) 
                                            values (${f_idorg},${f_idsede},${f_idusuario},${_idprint_server_estructura}, '${_tipo}','${fecha_now}','${hora_now}','${_data}');`;
    emitirRespuestaSP(read_query);
    

    // console.log('xSendDataPrintServer', _data);



    // $.ajax({
    //     url: url_restobar+ 'bdphp/log_003.php?op=1',
    //     type: 'POST',       
    //     data: {
    //         datos: _data,
    //         idprint_server_estructura: _idprint_server_estructura,
    //         tipo: _tipo
    //     }
    // });    
}


function emitirRespuestaSP(xquery) {
    // console.log(xquery);
    return sequelize.query(xquery, {        
        type: sequelize.QueryTypes.SELECT
    })
    .then(function (rows) {

        // convertimos en array ya que viene en object
        var arr = [];
        arr = Object.values(rows[0]);       
        
        return arr;
    })
    .catch((err) => {
        return false;
    });
}
















// actualiza estados de documentos reenviados// estado_api , estado_sunat
// desde cierre de caja - soapSunat
function CpeInterno_UpdateRegistro(dataUpdate) {

    fetch(
        url_restobar+ 'bdphp/log_002.php', {
            method: 'POST',        
            body: { op: '2', data: dataUpdate }
    });

    // $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { op: '2', data: dataUpdate } })
    // .done(function (res) {
    //     // console.log(res);
    // });
}


function CpeInterno_SaveResumenDiario(dataResumen) {
    fetch(
        url_restobar+ 'bdphp/log_002.php', {
            method: 'POST',        
            body: { op: '202', data: dataUpdate }
    });

    // $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { op: '202', data: dataResumen } })
    // .done(function (res) {
    //     // console.log(res);
    // });

}

async function CpeInterno_UpdateAnulacion(dataAnulacion) {
    let rpt=false;
    await fetch(
        url_restobar+ 'bdphp/log_002.php', {
            method: 'POST',        
            body: { op: '8', data: dataAnulacion }
    }).then(function (response) {
        return response.json();
    }).then(function (res) { 
        rpt=true;
    });

    // await $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { op: '8', data: dataAnulacion } })
    //     .done(function (res) {
    //         rpt=true;
    //     });
    
        return rpt;
}


// al actualiar factura tambien actualiza el cdr y el xml
function CpeInterno_UpdateAnulacionFactura(dataAnulacion) {


    fetch(
        url_restobar+ 'bdphp/log_002.php', {
            method: 'POST',        
            body: { op: '8', data: dataAnulacion }
    });
        // $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { op: '8', data: dataAnulacion } })
        // .done(function (res) {
        //     // console.log(res);
        // });
}



// actualiza resumen boletas con la respuesta obtenida
// ademas si es aceptado cambia el estado de las boletas estado_api=0 -> aceptado
function CpeInterno_UpdateResumenDiario(dataUpdateResumen) {
    fetch(
        url_restobar+ 'bdphp/log_002.php', {
            method: 'POST',        
            body: { op: '203', data: dataUpdateResumen }
    });

    // $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { op: '203', data: dataUpdateResumen } })
    // .done(function (res) {
    //     // console.log(res);
    // });

}