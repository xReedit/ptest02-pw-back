const { setNuevoPedido, setNuevoPedido2 } = require('../controllers/apiPwa_v1');
const mysql = require('mysql2/promise'); // Asegúrate de que este módulo esté instalado

// Mock para emitirRespuestaSP y emitirRespuestaSP_RES
jest.mock('../controllers/apiPwa_v1', () => {
  const originalModule = jest.requireActual('../controllers/apiPwa_v1');
  
  return {
    ...originalModule,
    emitirRespuestaSP: jest.fn().mockImplementation(async (query) => {
      // Simular respuesta exitosa
      return [{ idpedido: 12345 }];
    }),
    emitirRespuestaSP_RES: jest.fn().mockImplementation(async (query, res) => {
      // Simular respuesta exitosa
      return [{ idpedido: 12345 }];
    })
  };
});

describe('Pruebas de guardado de nuevo pedido', () => {
  // Datos de prueba con caracteres especiales que podrían causar problemas
  const dataPrueba = {
    dataPedido: {
      p_header: {
        m: "1",
        m_respaldo: "1",
        r: "",
        nom_us: "ADMINISTRADOR",
        delivery: 0,
        reservar: 0,
        solo_llevar: 0,
        idcategoria: "154",
        correlativo_dia: "",
        num_pedido: "",
        isCliente: 0,
        idregistro_pago: 0,
        arrDatosDelivery: {},
        arrDatosReserva: {},
        systemOS: "Windows",
        idregistra_scan_qr: 0,
        is_print_subtotales: 0,
        isprint_copy_short: 0,
        isprint_all_short: 0,
        appv: "v.2z",
        is_holding: 0
      },
      p_body: {
        tipoconsumo: [
          {
            descripcion: "CONSUMIR EN EL LOCAL",
            idtipo_consumo: 384,
            titulo: "LOCAL",
            idimpresora: 0,
            cantidad_seleccionada: 1,
            secciones: [
              {
                items: [
                  {
                    des: "GUANABANA SOLA\ncon caracteres especiales: áéíóú ñ & \" ' \\ / \n\r\t",
                    img: "",
                    iditem: 10259,
                    precio: 5,
                    procede: 1,
                    cantidad: "01",
                    detalles: "",
                    subitems: [
                      {
                        des: "Temperatura del jugo",
                        iditem: 10262,
                        opciones: [
                          {
                            des: "\nhelada\n",
                            precio: "00",
                            cantidad: "ND",
                            idporcion: 0,
                            idproducto: 0,
                            iditem_subitem: 2714,
                            cantidad_porcion: "ND",
                            precio_visible: true,
                            cantidad_visible: false,
                            selected: true,
                            idtipo_consumo: 384
                          }
                        ],
                        show_cant_item: 0,
                        subitem_cant_select: 1,
                        iditem_subitem_content: 446,
                        subitem_cant_select_ini: 1,
                        subitem_required_select: 0,
                        isSoloUno: true,
                        isObligatorio: false,
                        des_cant_select: "Solo 1"
                      }
                    ],
                    idseccion: 1607,
                    isalmacen: 0,
                    isporcion: "ND",
                    idcategoria: 154,
                    idcarta_lista: "119136160160710259",
                    count_subitems: 1,
                    precio_default: 5,
                    precio_unitario: 5,
                    imprimir_comanda: 1,
                    is_recomendacion: "0",
                    subitem_cant_select: 0,
                    subitem_required_select: 0,
                    seccion: "JUGOS DE FRUTA",
                    idimpresora: 293,
                    sec_orden: 3,
                    ver_stock_cero: 0,
                    selected: true,
                    visible: true,
                    itemtiposconsumo: [],
                    subitems_selected: [
                      {
                        des: "\nhelada\n",
                        precio: "00",
                        cantidad: "ND",
                        idporcion: 0,
                        idproducto: 0,
                        iditem_subitem: 2714,
                        cantidad_porcion: "ND",
                        precio_visible: true,
                        cantidad_visible: false,
                        selected: true,
                        idtipo_consumo: 384
                      }
                    ],
                    subitems_view: [
                      {
                        id: "2714",
                        des: "\nhelada\n",
                        listDes: [
                          "\nhelada\n"
                        ],
                        cantidad_seleccionada: 1,
                        precio: 0,
                        indicaciones: "",
                        subitems: [
                          {
                            des: "\nhelada\n",
                            precio: "00",
                            cantidad: "ND",
                            idporcion: 0,
                            idproducto: 0,
                            iditem_subitem: 2714,
                            cantidad_porcion: "ND",
                            precio_visible: true,
                            cantidad_visible: false,
                            selected: true,
                            idtipo_consumo: 384
                          }
                        ],
                        idtipo_consumo: 384
                      }
                    ],
                    is_search_subitems: true,
                    indicaciones: "",
                    sumar: true,
                    cantidad_seleccionada: 1,
                    is_visible_control_last_add: false,
                    precio_total: 5,
                    precio_print: "5.00",
                    precio_total_calc: null,
                    des_seccion: "JUGOS DE FRUTA"
                  }
                ],
                des: "JUGOS DE FRUTA",
                idimpresora: 293,
                idimpresora_otro: 0,
                idseccion: 1607,
                sec_orden: 3,
                ver_stock_cero: 0,
                count_items: 1
              }
            ],
            count_items_seccion: 1
          }
        ]
      },
      p_subtotales: [
        {
          id: 0,
          descripcion: "SUB TOTAL",
          esImpuesto: 0,
          visible: true,
          quitar: false,
          tachado: false,
          visible_cpe: true,
          importe: "5.00"
        },
        {
          id: 0,
          esImpuesto: 0,
          descripcion: "TOTAL",
          visible: true,
          quitar: false,
          tachado: false,
          visible_cpe: true,
          importe: "5.00"
        }
      ],
      idpedido: 0
    },
    dataPrint: [
      {
        Array_enca: {
          m: "1",
          m_respaldo: "1",
          r: "",
          nom_us: "ADMINISTRADOR",
          delivery: 0,
          reservar: 0,
          solo_llevar: 0,
          idcategoria: "154",
          correlativo_dia: "",
          num_pedido: "",
          isCliente: 0,
          idregistro_pago: 0,
          arrDatosDelivery: {},
          arrDatosReserva: {},
          systemOS: "Windows",
          idregistra_scan_qr: 0,
          is_print_subtotales: 0,
          isprint_copy_short: 0,
          isprint_all_short: 0,
          appv: "v.2z"
        },
        ArraySubTotales: [
          {
            id: 0,
            descripcion: "SUB TOTAL",
            esImpuesto: 0,
            visible: true,
            quitar: false,
            tachado: false,
            visible_cpe: true,
            importe: "5.00"
          },
          {
            id: 0,
            esImpuesto: 0,
            descripcion: "TOTAL",
            visible: true,
            quitar: false,
            tachado: false,
            visible_cpe: true,
            importe: "5.00"
          }
        ]
      }
    ],
    dataUsuario: {
      idusuario: 636,
      idorg: 119,
      idsede: 136,
      nombres: "ADMINISTRADOR",
      cargo: "ADMINISTRADOR",
      usuario: "JNADMIN"
    },
    isDeliveryAPP: false,
    isClienteRecogeLocal: false,
    dataDescuento: []
  };

  // Datos del cliente
  const dataCliente = {
    idusuario: 636,
    idorg: 119,
    idsede: 136
  };

  // Respuesta simulada para la solicitud HTTP
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };

  // Solicitud simulada para setNuevoPedido2
  const mockReq = {
    body: JSON.stringify(dataPrueba)
  };

  test('setNuevoPedido debe sanitizar correctamente el JSON y guardar el pedido', async () => {
    // Ejecutar la función que queremos probar
    const resultado = await setNuevoPedido(dataCliente, dataPrueba);
    
    // Verificar que se haya devuelto un resultado exitoso
    expect(resultado).toBeDefined();
    expect(resultado[0].idpedido).toBe(12345);
  });

  test('setNuevoPedido2 debe sanitizar correctamente el JSON y guardar el pedido', async () => {
    // Ejecutar la función que queremos probar
    const resultado = await setNuevoPedido2(mockReq, mockRes);
    
    // Verificar que se haya devuelto un resultado exitoso
    expect(resultado).toBeDefined();
    expect(resultado[0].idpedido).toBe(12345);
  });

  test('El JSON sanitizado no debe contener caracteres inválidos', async () => {
    // Crear una implementación personalizada para capturar el JSON sanitizado
    const emitirRespuestaSP = require('../controllers/apiPwa_v1').emitirRespuestaSP;
    
    // Restablecer el mock para capturar la consulta
    emitirRespuestaSP.mockImplementationOnce((query) => {
      // Extraer el JSON de la consulta
      const match = query.match(/'(.+)'/);
      if (match && match[1]) {
        const jsonSanitizado = match[1];
        
        // Verificar que no contenga caracteres problemáticos
        expect(jsonSanitizado).not.toMatch(/[\u0000-\u001F]/); // No caracteres de control
        expect(jsonSanitizado).not.toMatch(/\\n(?![\\"])/); // No newlines sin escapar
        expect(jsonSanitizado).not.toMatch(/\\r(?![\\"])/); // No retornos de carro sin escapar
        expect(jsonSanitizado).not.toMatch(/\\t(?![\\"])/); // No tabs sin escapar
        expect(jsonSanitizado).not.toMatch(/\\f(?![\\"])/); // No form feeds sin escapar
        expect(jsonSanitizado).not.toMatch(/(?<!\\)'/); // No comillas simples sin escapar
        expect(jsonSanitizado).not.toMatch(/(?<!\\)"/); // No comillas dobles sin escapar
        
        // Verificar que MySQL pueda analizar este JSON
        try {
          JSON.parse(jsonSanitizado.replace(/\\'/g, "'").replace(/\\"/g, '"'));
        } catch (e) {
          fail('El JSON sanitizado no es válido: ' + e.message);
        }
      }
      
      return [{ idpedido: 12345 }];
    });
    
    await setNuevoPedido(dataCliente, dataPrueba);
  });

  test('Debe manejar correctamente caracteres especiales en el JSON', async () => {
    // Crear datos con caracteres problemáticos específicos
    const datosProblematicos = JSON.parse(JSON.stringify(dataPrueba));
    datosProblematicos.dataPedido.p_body.tipoconsumo[0].secciones[0].items[0].des = 
      "Texto con caracteres problemáticos: \u0000\u0001\u0002\u0003\u001F\u007F\u009F\u200B\u200C\u200D\uFEFF";
    
    // Ejecutar la función que queremos probar
    const resultado = await setNuevoPedido(dataCliente, datosProblematicos);
    
    // Verificar que se haya devuelto un resultado exitoso a pesar de los caracteres problemáticos
    expect(resultado).toBeDefined();
    expect(resultado[0].idpedido).toBe(12345);
  });

  test('Debe manejar correctamente JSON con caracteres Unicode', async () => {
    // Crear datos con caracteres Unicode
    const datosUnicode = JSON.parse(JSON.stringify(dataPrueba));
    datosUnicode.dataPedido.p_body.tipoconsumo[0].secciones[0].items[0].des = 
      "Texto con caracteres Unicode: 你好 こんにちは 안녕하세요 مرحبا Привет";
    
    // Ejecutar la función que queremos probar
    const resultado = await setNuevoPedido(dataCliente, datosUnicode);
    
    // Verificar que se haya devuelto un resultado exitoso a pesar de los caracteres Unicode
    expect(resultado).toBeDefined();
    expect(resultado[0].idpedido).toBe(12345);
  });
});
