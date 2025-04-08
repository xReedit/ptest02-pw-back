/**
 * Procesa un pedido para generar la información de impresión
 * @param {Object} pedido - Objeto con la información del pedido
 * @param {Array} impresoras - Lista de impresoras disponibles
 * @param {Object} datosSede - Datos de configuración de la sede
 * @param {boolean} isCliente - Si el pedido proviene de un cliente
 * @param {boolean} isUsuarioHolding - Si el usuario es del tipo holding
 * @returns {Array} - Array con información para impresión
 */
function relationRowToPrint(pedido, impresoras, isCliente=false) {
  // Verificamos que tengamos datos válidos
  console.log('pedido', pedido);
  if (!pedido || !pedido.p_body || !pedido.p_body.tipoconsumo || !impresoras) {
    console.error("Datos insuficientes para procesar impresión");
    return [];
  }

  // Valores iniciales
  
  const xRptPrint = []; 
  const listOnlyPrinters = [];
  const datosSedeConfig = impresoras[0];// datosSede.datossede[0];
  
  // Valores de configuración de la sede
  const num_copias_all = datosSedeConfig.num_copias || 0
  const var_size_font_tall_comanda = datosSedeConfig.var_size_font_tall_comanda || 0;
  const pie_pagina = datosSedeConfig.pie_pagina || '';
  const pie_pagina_comprobante = datosSedeConfig.pie_pagina_comprobante || '';
  const isPrintPedidoDeliveryCompleto = datosSedeConfig.isprint_all_delivery === '1';
  const idSede = datosSedeConfig.idsede;  

  // Procesamos por cada impresora
  impresoras.forEach(impresora => {
    let isHayDatosPrintObj = false;
    let xArrayBodyPrint = [];
    
    // Procesamos tipos de consumo
    pedido.p_body.tipoconsumo.forEach((tpc, indexP) => {
      // console.log('tpc =>', tpc);
      const isPedidoDelivery = tpc.descripcion && tpc.descripcion.toLowerCase() === 'delivery';
      xArrayBodyPrint[indexP] = { 
        'des': tpc.descripcion || tpc.titulo, 
        'id': tpc.idtipo_consumo, 
        'titulo': tpc.titulo, 
        'conDatos': false
      };

      // console.log('object xArrayBodyPrint', xArrayBodyPrint);
      // console.log('impresora ===>', impresora);
      
      // Filtrar secciones por impresora
      const seccionesParaImpresora = tpc.secciones.filter(s =>        
        s.idimpresora === impresora.idimpresora || s.idimpresora_otro === impresora.idimpresora
      );

      // console.log('seccionesParaImpresora', seccionesParaImpresora);

      // Si es delivery y está configurado para imprimir todo, incluimos todas las secciones
      if (isPedidoDelivery && isPrintPedidoDeliveryCompleto) {
        // console.log('isPedidoDelivery', isPedidoDelivery);
        tpc.secciones.forEach(seccion => {
          seccion.items.forEach(item => {
            if (item.flag_add_tpc) return;
            
            procesarItem(item, seccion, indexP, xArrayBodyPrint);
            isHayDatosPrintObj = true;
          });
        });
      }
      
      // Procesamos los items de las secciones filtradas
      seccionesParaImpresora.forEach(seccion => {
        // console.log('seccion =>', seccion);
        seccion.items.forEach(item => {
          if (item.flag_add_tpc) return;
          if (item.imprimir_comanda === 0 && !isCliente) return;
          
          procesarItem(item, seccion, indexP, xArrayBodyPrint);
          isHayDatosPrintObj = true;
        });
      });
    });
    
    // Si no hay datos para esta impresora, continuamos
    
    if (!isHayDatosPrintObj) return;
    
    // Configuramos la impresora
    const configImpresora = {
      ip_print: impresora.ip,
      var_margen_iz: impresora.var_margen_iz,
      var_size_font: impresora.var_size_font,
      local: 0,
      num_copias: impresora.num_copias || num_copias_all,
      var_size_font_tall_comanda: var_size_font_tall_comanda,
      copia_local: 0,
      img64: '',
      papel_size: impresora.papel_size,
      pie_pagina: pie_pagina,
      pie_pagina_comprobante: pie_pagina_comprobante
    };
    
    // Agregamos configuración de impresora
    const xImpresoraPrint = [configImpresora];
    listOnlyPrinters.push(configImpresora);
    
    // Armamos el objeto para enviar
    const objPrint = {
      idsede: idSede,
      arrBodyPrint: xArrayBodyPrint,
      arrPrinters: xImpresoraPrint
    };
        
    
    xRptPrint.push(objPrint);
  });
  
  // Agregamos la lista de impresoras
  xRptPrint.listPrinters = listOnlyPrinters;
  
  return xRptPrint;
}

/**
 * Procesa un item para ser formateado para impresión
 */
function procesarItem(item, seccion, indexP, arrayBodyPrint) {
  arrayBodyPrint[indexP].conDatos = true;
  arrayBodyPrint[indexP][item.iditem] = { ...item };
  arrayBodyPrint[indexP][item.iditem].des_seccion = seccion.des;
  arrayBodyPrint[indexP][item.iditem].sec_orden = seccion.sec_orden;
  arrayBodyPrint[indexP][item.iditem].cantidad = item.cantidad_seleccionada 
    ? item.cantidad_seleccionada.toString().padStart(2, '0') 
    : (item.cantidad || '01');
  arrayBodyPrint[indexP][item.iditem].precio_print = parseFloat(
    item.precio_print || item.precio || 0
  ).toFixed(2);
  
  // Si no tiene subitems_view, inicializamos como null
  if (!item.subitems_view) {
    arrayBodyPrint[indexP][item.iditem].subitems_view = null;
  }
  
}


module.exports.relationRowToPrint = relationRowToPrint;

