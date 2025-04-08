// Mockear las dependencias que causan problemas
jest.mock('../app', () => ({}));
jest.mock('../controllers/apiHolding', () => ({}));

const { agruparPedidosHolding, proccessSavePedidoHolding } = require('../service/holding.sevice');
// const assert = require('assert');

describe('Holding Service Tests', () => {
    
    const mockPedidoHolding = {
    "dataPedido": {
        "p_header": {
            "m": "12",
            "m_respaldo": "12",
            "r": "",
            "nom_us": "SISTEMA",
            "delivery": 0,
            "reservar": 0,
            "solo_llevar": 0,
            "idcategoria": "14",
            "correlativo_dia": "",
            "num_pedido": "",
            "isCliente": 0,
            "idregistro_pago": 0,
            "arrDatosDelivery": {},
            "arrDatosReserva": {},
            "systemOS": "Windows",
            "idregistra_scan_qr": 0,
            "is_print_subtotales": 1,
            "isprint_copy_short": 0,
            "isprint_all_short": 0,
            "appv": "v.2z",
            "is_holding": "1",
            "holding": {
                "idsede_holding": 6,
                "idsede": 13,
                "nombre": "CALANDRIA",
                "ciudad": "MOYOBAMBA",
                "estado": "0",
                "idorg": 16
            },
            "paymentMozo": {
                "methods": [
                    {
                        "id": 1,
                        "name": "Efectivo",
                        "icon": "http://192.168.1.65/restobar/images/_tp_01.png",
                        "amount": 60,
                        "amount_real": 55,
                        "isActive": true,
                        "isDisabled": false
                    }
                ],
                "isPaymentSuccess": true,
                "idusuario": 103
            },
            "idcliente": 0
        },
        "p_body": {
            "tipoconsumo": [
                {
                    "descripcion": "CONSUMIR EN EL LOCAL",
                    "idtipo_consumo": 31,
                    "titulo": "LOCAL",
                    "idimpresora": 0,
                    "cantidad_seleccionada": 1,
                    "secciones": [
                        {
                            "items": [
                                {
                                    "des": "COMBO PARRILLERO",
                                    "img": "1613parrilla-3.jpg",
                                    "iditem": 939,
                                    "precio": 55,
                                    "procede": 1,
                                    "cantidad": "01",
                                    "detalles": "",
                                    "subitems": [
                                        {
                                            "des": "elija bebida",
                                            "iditem": 939,
                                            "opciones": [
                                                {
                                                    "des": "Agua cielo 2,5l",
                                                    "precio": "0",
                                                    "cantidad": "26",
                                                    "idporcion": 0,
                                                    "idproducto": 3081,
                                                    "iditem_subitem": 286,
                                                    "cantidad_porcion": "ND",
                                                    "precio_visible": true,
                                                    "cantidad_visible": true,
                                                    "selected": true,
                                                    "idtipo_consumo": 31
                                                }
                                            ],
                                            "show_cant_item": 0,
                                            "subitem_cant_select": 1,
                                            "iditem_subitem_content": 97,
                                            "subitem_cant_select_ini": 1,
                                            "subitem_required_select": 1,
                                            "isSoloUno": true,
                                            "isObligatorio": false,
                                            "des_cant_select": "Solo 1"
                                        }
                                    ],
                                    "idseccion": 89,
                                    "isalmacen": 0,
                                    "isporcion": "13",
                                    "idcategoria": 14,
                                    "idcarta_lista": "16131289939",
                                    "count_subitems": 1,
                                    "precio_default": 55,
                                    "precio_unitario": 55,
                                    "imprimir_comanda": 1,
                                    "is_recomendacion": "0",
                                    "subitem_cant_select": 0,
                                    "subitem_required_select": 0,
                                    "selected": true,
                                    "itemtiposconsumo": [],
                                    "subitems_selected": [
                                        {
                                            "des": "Agua cielo 2,5l",
                                            "precio": "0",
                                            "cantidad": "26",
                                            "idporcion": 0,
                                            "idproducto": 3081,
                                            "iditem_subitem": 286,
                                            "cantidad_porcion": "ND",
                                            "precio_visible": true,
                                            "cantidad_visible": true,
                                            "selected": true,
                                            "idtipo_consumo": 31
                                        }
                                    ],
                                    "subitems_view": [
                                        {
                                            "id": "286",
                                            "des": "Agua cielo 2,5l",
                                            "listDes": [
                                                "Agua cielo 2,5l"
                                            ],
                                            "cantidad_seleccionada": 1,
                                            "precio": 0,
                                            "indicaciones": "",
                                            "subitems": [
                                                {
                                                    "des": "Agua cielo 2,5l",
                                                    "precio": "0",
                                                    "cantidad": "26",
                                                    "idporcion": 0,
                                                    "idproducto": 3081,
                                                    "iditem_subitem": 286,
                                                    "cantidad_porcion": "ND",
                                                    "precio_visible": true,
                                                    "cantidad_visible": true,
                                                    "selected": true,
                                                    "idtipo_consumo": 31
                                                }
                                            ],
                                            "idtipo_consumo": 31
                                        }
                                    ],
                                    "is_search_subitems": true,
                                    "indicaciones": "",
                                    "cantidad_seleccionada": 1,
                                    "precio_total": 55,
                                    "precio_print": "55.00",
                                    "precio_total_calc": null,
                                    "des_seccion": "A LA PARRILLA",
                                    "sec_orden": 2
                                }
                            ],
                            "des": "A LA PARRILLA",
                            "idimpresora": 38,
                            "idimpresora_otro": 0,
                            "idseccion": 89,
                            "sec_orden": 2,
                            "ver_stock_cero": 0,
                            "idsede": 13,
                            "idorg": 16,
                            "count_items": 1
                        }
                    ],
                    "count_items_seccion": 1
                }
            ]
        },
        "p_subtotales": [
            {
                "id": 0,
                "descripcion": "SUB TOTAL",
                "esImpuesto": 0,
                "visible": true,
                "quitar": false,
                "tachado": false,
                "visible_cpe": true,
                "importe": "55.00"
            },
            {
                "id": 0,
                "esImpuesto": 0,
                "descripcion": "TOTAL",
                "visible": true,
                "quitar": false,
                "tachado": false,
                "visible_cpe": true,
                "importe": "55.00"
            }
        ],
        "idpedido": 0
    },
    "dataPrint": [
        {
            "Array_enca": {
                "m": "12",
                "m_respaldo": "12",
                "r": "",
                "nom_us": "SISTEMA",
                "delivery": 0,
                "reservar": 0,
                "solo_llevar": 0,
                "idcategoria": "14",
                "correlativo_dia": "",
                "num_pedido": "",
                "isCliente": 0,
                "idregistro_pago": 0,
                "arrDatosDelivery": {},
                "arrDatosReserva": {},
                "systemOS": "Windows",
                "idregistra_scan_qr": 0,
                "is_print_subtotales": 1,
                "isprint_copy_short": 0,
                "isprint_all_short": 0,
                "appv": "v.2z",
                "is_holding": "1",
                "holding": {
                    "idsede_holding": 6,
                    "idsede": 13,
                    "nombre": "CALANDRIA",
                    "ciudad": "MOYOBAMBA",
                    "estado": "0",
                    "idorg": 16
                },
                "paymentMozo": {
                    "methods": [
                        {
                            "id": 1,
                            "name": "Efectivo",
                            "icon": "http://192.168.1.65/restobar/images/_tp_01.png",
                            "amount": 60,
                            "amount_real": 55,
                            "isActive": true,
                            "isDisabled": false
                        }
                    ],
                    "isPaymentSuccess": true,
                    "idusuario": 103
                },
                "idcliente": 0
            },
            "ArraySubTotales": [
                {
                    "id": 0,
                    "descripcion": "SUB TOTAL",
                    "esImpuesto": 0,
                    "visible": true,
                    "quitar": false,
                    "tachado": false,
                    "visible_cpe": true,
                    "importe": "55.00"
                },
                {
                    "id": 0,
                    "esImpuesto": 0,
                    "descripcion": "TOTAL",
                    "visible": true,
                    "quitar": false,
                    "tachado": false,
                    "visible_cpe": true,
                    "importe": "55.00"
                }
            ],
            "ArrayItem": [
                {
                    "939": {
                        "des": "COMBO PARRILLERO",
                        "img": "1613parrilla-3.jpg",
                        "iditem": 939,
                        "precio": 55,
                        "procede": 1,
                        "cantidad": "01",
                        "detalles": "",
                        "subitems": [
                            {
                                "des": "elija bebida",
                                "iditem": 939,
                                "opciones": [
                                    {
                                        "des": "Agua cielo 2,5l",
                                        "precio": "0",
                                        "cantidad": "26",
                                        "idporcion": 0,
                                        "idproducto": 3081,
                                        "iditem_subitem": 286,
                                        "cantidad_porcion": "ND",
                                        "precio_visible": true,
                                        "cantidad_visible": true,
                                        "selected": true,
                                        "idtipo_consumo": 31
                                    }
                                ],
                                "show_cant_item": 0,
                                "subitem_cant_select": 1,
                                "iditem_subitem_content": 97,
                                "subitem_cant_select_ini": 1,
                                "subitem_required_select": 1,
                                "isSoloUno": true,
                                "isObligatorio": false,
                                "des_cant_select": "Solo 1"
                            }
                        ],
                        "idseccion": 89,
                        "isalmacen": 0,
                        "isporcion": "13",
                        "idcategoria": 14,
                        "idcarta_lista": "16131289939",
                        "count_subitems": 1,
                        "precio_default": 55,
                        "precio_unitario": 55,
                        "imprimir_comanda": 1,
                        "is_recomendacion": "0",
                        "subitem_cant_select": 0,
                        "subitem_required_select": 0,
                        "selected": true,
                        "itemtiposconsumo": [],
                        "subitems_selected": [
                            {
                                "des": "Agua cielo 2,5l",
                                "precio": "0",
                                "cantidad": "26",
                                "idporcion": 0,
                                "idproducto": 3081,
                                "iditem_subitem": 286,
                                "cantidad_porcion": "ND",
                                "precio_visible": true,
                                "cantidad_visible": true,
                                "selected": true,
                                "idtipo_consumo": 31
                            }
                        ],
                        "subitems_view": [
                            {
                                "id": "286",
                                "des": "Agua cielo 2,5l",
                                "listDes": [
                                    "Agua cielo 2,5l"
                                ],
                                "cantidad_seleccionada": 1,
                                "precio": 0,
                                "indicaciones": "",
                                "subitems": [
                                    {
                                        "des": "Agua cielo 2,5l",
                                        "precio": "0",
                                        "cantidad": "26",
                                        "idporcion": 0,
                                        "idproducto": 3081,
                                        "iditem_subitem": 286,
                                        "cantidad_porcion": "ND",
                                        "precio_visible": true,
                                        "cantidad_visible": true,
                                        "selected": true,
                                        "idtipo_consumo": 31
                                    }
                                ],
                                "idtipo_consumo": 31
                            }
                        ],
                        "is_search_subitems": true,
                        "indicaciones": "",
                        "cantidad_seleccionada": 1,
                        "precio_total": 55,
                        "precio_print": "55.00",
                        "precio_total_calc": null,
                        "des_seccion": "A LA PARRILLA",
                        "sec_orden": 2
                    },
                    "des": "CONSUMIR EN EL LOCAL",
                    "id": 31,
                    "titulo": "LOCAL",
                    "conDatos": true
                }
            ],
            "Array_print": [
                {
                    "ip_print": "//DESKTOP-KHJ0E16/pcaja1",
                    "var_margen_iz": 0,
                    "var_size_font": 0,
                    "local": 0,
                    "num_copias": 0,
                    "var_size_font_tall_comanda": 0,
                    "copia_local": 0,
                    "img64": "",
                    "papel_size": 1,
                    "pie_pagina": "Buenvenidos, gracias por su preferencia. Presente este ticket al momento de pagar. Muchas gracias.",
                    "pie_pagina_comprobante": "Representación impresa del Comprobante de Venta Electrónico esta puede ser consultada en www.papaya.com.pe. Autorizado mediante resolución de intendencia 00000000/SUNAT."
                }
            ]
        }
    ],
    "dataUsuario": {
        "idusuario": 103,
        "idorg": 16,
        "idsede": 13,
        "nombres": "SISTEMA",
        "cargo": "IMPLEMENTADOR",
        "usuario": "EASOPORTE"
    },
    "isDeliveryAPP": false,
    "isClienteRecogeLocal": false,
    "dataDescuento": [],
    "listPrinters": [
        {
            "ip_print": "//DESKTOP-KHJ0E16/pcaja1",
            "var_margen_iz": 0,
            "var_size_font": 0,
            "local": 0,
            "num_copias": 0,
            "var_size_font_tall_comanda": 0,
            "copia_local": 0,
            "img64": "",
            "papel_size": 1,
            "pie_pagina": "Buenvenidos, gracias por su preferencia. Presente este ticket al momento de pagar. Muchas gracias.",
            "pie_pagina_comprobante": "Representación impresa del Comprobante de Venta Electrónico esta puede ser consultada en www.papaya.com.pe. Autorizado mediante resolución de intendencia 00000000/SUNAT."
        }
    ]
};

it('Agrupar Pedidos Holding', () => {
    const result = agruparPedidosHolding(mockPedidoHolding);
    expect(result).toBeDefined();
});

// const result = proccessSavePedidoHolding(mockPedidoHolding, 1);
// console.log(result);
  
});