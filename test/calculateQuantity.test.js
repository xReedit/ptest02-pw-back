const { calculateQuantity } = require('../controllers/apiPwa_v1'); // Ajusta la ruta según sea necesario

describe('calculateQuantity', () => {
    test('debe manejar cantidad no definida', () => {
        const item = { cantidad: undefined };
        const result = calculateQuantity(item);
        expect(result.cantidad).toBe('ND');
    });

    test('debe manejar cantidad nula', () => {
        const item = { cantidad: null };
        const result = calculateQuantity(item);
        expect(result.cantidad).toBe('ND');
    });

    test('debe manejar cantidad no numérica', () => {
        const item = { cantidad: 'no-numerico' };
        const result = calculateQuantity(item);
        expect(result.cantidad).toBe('ND');
    });

    test('debe manejar cantidad >= 9999 sin isporcion', () => {
        const item = { cantidad: 10000 };
        const result = calculateQuantity(item);
        expect(result.cantidad).toBe('ND');
    });

    test('debe manejar cantidad >= 9999 con isporcion', () => {
        const item = { cantidad: 10000, isporcion: 'Sí' };
        const result = calculateQuantity(item);
        console.log('result', result);
        expect(result.cantidad).toBe('Sí');
    });

    test('debe calcular cantidadSumar basado en venta_x_peso y sumar', () => {
        const item = { cantidad: 5, venta_x_peso: 1, sumar: true };
        const result = calculateQuantity(item);
        console.log('result', result);
        expect(result.cantidadSumar).toBe(-5);
    });

    test('debe calcular si cantidad no esta definido pero si es porcion', () => {
        const item = { isporcion: 'SP', sumar: true , venta_x_peso: 1};
        const result = calculateQuantity(item);
        console.log('result', result);
        expect(result.cantidad).toBe(1);
    });

    test('debe calcular si cantidad ND es porcion', () => {
        const item = { cantidad: '150', isporcion: 'SP' };
        const result = calculateQuantity(item);
        console.log('result debe calcular si cantidad ND es porcion', result);
        // expect(result.cantidad).toBe(1000);
    });

    test('un item especifico', () => {
        const item = {
    "des": "PROMOCION PIZZA PERSONAL",
    "img": "",
    "iditem": 58190,
    "precio": 10,
    "procede": 1,
    "detalles": "",
    "subitems": [
        {
            "des": "SABOR",
            "iditem": 58190,
            "opciones": [
                {
                    "des": "1 Americana",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8695,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": true,
                    "cantidad_selected": 1,
                    "cantidad_seleccionada": 1,
                    "isSuma_selected": true,
                    "desIni": "Americana",
                    "precio_first": 0,
                    "stop_add": false,
                    "idtipo_consumo": 315
                },
                {
                    "des": "Hawaiana",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8696,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": false,
                    "stop_add": false
                },
                {
                    "des": "Kings",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8697,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": false,
                    "stop_add": false
                },
                {
                    "des": "Peperoni",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8698,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": false,
                    "stop_add": false
                }
            ],
            "show_cant_item": 1,
            "subitem_cant_select": 30,
            "iditem_subitem_content": 2768,
            "subitem_cant_select_ini": 30,
            "subitem_required_select": 0,
            "isSoloUno": false,
            "isObligatorio": false,
            "des_cant_select": "Hasta 30"
        },
        {
            "des": "GASEOSA",
            "iditem": 58190,
            "opciones": [
                {
                    "des": "Gaseosa casenelli 300 ml",
                    "precio": "0",
                    "cantidad": "1",
                    "idporcion": 0,
                    "idproducto": 14404,
                    "iditem_subitem": 8722,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": true,
                    "selected": true,
                    "idtipo_consumo": 315
                }
            ],
            "show_cant_item": 0,
            "subitem_cant_select": 1,
            "iditem_subitem_content": 2772,
            "subitem_cant_select_ini": 0,
            "subitem_required_select": 0,
            "isSoloUno": false,
            "isObligatorio": false,
            "des_cant_select": "Hasta 1"
        }
    ],
    "idseccion": 866,
    "isalmacen": 0,
    "isporcion": "SP",
    "idcategoria": 128,
    "idcarta_lista": "9911012186658190",
    "count_subitems": 2,
    "precio_default": 10,
    "precio_unitario": 10,
    "imprimir_comanda": 1,
    "is_recomendacion": "0",
    "subitem_cant_select": 0,
    "subitem_required_select": 0,
    "selected": true,
    "itemtiposconsumo": [
        {
            "descripcion": "CONSUMIR EN EL LOCAL",
            "idtipo_consumo": 315,
            "titulo": "LOCAL",
            "idimpresora": 196,
            "cantidad_seleccionada": 1
        },
        {
            "descripcion": "PARA LLEVAR",
            "idtipo_consumo": 316,
            "titulo": "",
            "idimpresora": 196
        },
        {
            "descripcion": "DELIVERY",
            "idtipo_consumo": 317,
            "titulo": "",
            "idimpresora": 196
        }
    ],
    "subitems_selected": [
        {
            "des": "1 Americana",
            "precio": "0.00",
            "cantidad": "ND",
            "idporcion": 0,
            "idproducto": 0,
            "iditem_subitem": 8695,
            "cantidad_porcion": "ND",
            "precio_visible": true,
            "cantidad_visible": false,
            "selected": true,
            "cantidad_selected": 1,
            "cantidad_seleccionada": 1,
            "isSuma_selected": true,
            "desIni": "Americana",
            "precio_first": 0,
            "stop_add": false,
            "idtipo_consumo": 315
        },
        {
            "des": "Gaseosa casenelli 300 ml",
            "precio": "0",
            "cantidad": "1",
            "idporcion": 0,
            "idproducto": 14404,
            "iditem_subitem": 8722,
            "cantidad_porcion": "ND",
            "precio_visible": true,
            "cantidad_visible": true,
            "selected": true,
            "idtipo_consumo": 315
        }
    ],
    "subitems_view": [
        {
            "id": "86958722",
            "des": "1 americana, Gaseosa casenelli 300 ml",
            "listDes": [
                "1 americana",
                "Gaseosa casenelli 300 ml"
            ],
            "cantidad_seleccionada": 1,
            "precio": 0,
            "indicaciones": "",
            "subitems": [
                {
                    "des": "1 Americana",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8695,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": true,
                    "cantidad_selected": 1,
                    "cantidad_seleccionada": 1,
                    "isSuma_selected": true,
                    "desIni": "Americana",
                    "precio_first": 0,
                    "stop_add": false,
                    "idtipo_consumo": 315
                },
                {
                    "des": "Gaseosa casenelli 300 ml",
                    "precio": "0",
                    "cantidad": "1",
                    "idporcion": 0,
                    "idproducto": 14404,
                    "iditem_subitem": 8722,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": true,
                    "selected": true,
                    "idtipo_consumo": 315
                }
            ],
            "idtipo_consumo": 315
        }
    ],
    "is_search_subitems": true,
    "indicaciones": "",
    "sumar": true,
    "cantidad_seleccionada": 1,
    "cantidadSumar": -1
};
        const result = calculateQuantity(item);
        // expect(result.cantidadSumar).toBe(-5);
        console.log(result.cantidad, result.cantidadSumar);
    });
});