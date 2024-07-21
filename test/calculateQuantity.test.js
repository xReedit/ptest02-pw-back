const { calculateQuantity, setItemCarta } = require('../controllers/apiPwa_v1'); // Ajusta la ruta según sea necesario

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

    test('un item especifico', async() => {
        const item = {
    "des": "PROMOCION AQUI ES",
    "img": "",
    "iditem": 58185,
    "precio": 20,
    "procede": 1,
    "cantidad": 102,
    "detalles": "",
    "subitems": [
        {
            "des": "GASEOSA",
            "iditem": 58185,
            "opciones": [
                {
                    "des": "Fanta",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8647,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": false
                }
            ],
            "show_cant_item": 0,
            "subitem_cant_select": 1,
            "iditem_subitem_content": 2750,
            "subitem_cant_select_ini": 0,
            "subitem_required_select": 0,
            "isSoloUno": false,
            "isObligatorio": false,
            "des_cant_select": "Hasta 1"
        },
        {
            "des": "SABOR ",
            "iditem": 58185,
            "opciones": [
                {
                    "des": "Americana ",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8652,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": false
                },
                {
                    "des": "Hawaiana",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8653,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": false
                },
                {
                    "des": "Kings",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8654,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": true,
                    "idtipo_consumo": 316
                },
                {
                    "des": "Peperoni",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8655,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": false
                }
            ],
            "show_cant_item": 0,
            "subitem_cant_select": 4,
            "iditem_subitem_content": 2753,
            "subitem_cant_select_ini": 0,
            "subitem_required_select": 0,
            "isSoloUno": false,
            "isObligatorio": false,
            "des_cant_select": "Hasta 4"
        }
    ],
    "idseccion": 866,
    "isalmacen": 0,
    "isporcion": "SP",
    "idcategoria": 128,
    "idcarta_lista": "9911012186658185",
    "count_subitems": 2,
    "precio_default": 20,
    "precio_unitario": 20,
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
            "idimpresora": 0
        },
        {
            "descripcion": "PARA LLEVAR",
            "idtipo_consumo": 316,
            "titulo": "",
            "idimpresora": 918,
            "cantidad_seleccionada": 1
        },
        {
            "descripcion": "DELIVERY",
            "idtipo_consumo": 317,
            "titulo": "",
            "idimpresora": 918
        }
    ],
    "subitems_selected": [
        {
            "des": "Kings",
            "precio": "0.00",
            "cantidad": "ND",
            "idporcion": 0,
            "idproducto": 0,
            "iditem_subitem": 8654,
            "cantidad_porcion": "ND",
            "precio_visible": true,
            "cantidad_visible": false,
            "selected": true,
            "idtipo_consumo": 316
        }
    ],
    "subitems_view": [
        {
            "id": "8654",
            "des": "Kings",
            "listDes": [
                "Kings"
            ],
            "cantidad_seleccionada": 1,
            "precio": 0,
            "indicaciones": "",
            "subitems": [
                {
                    "des": "Kings",
                    "precio": "0.00",
                    "cantidad": "ND",
                    "idporcion": 0,
                    "idproducto": 0,
                    "iditem_subitem": 8654,
                    "cantidad_porcion": "ND",
                    "precio_visible": true,
                    "cantidad_visible": false,
                    "selected": true,
                    "idtipo_consumo": 316
                }
            ],
            "idtipo_consumo": 316
        }
    ],
    "is_search_subitems": true,
    "indicaciones": "",
    "sumar": true,
    "cantidad_seleccionada": 1,
    "cantidadSumar": -1,
    "iditem2": 58185
};
        const result = calculateQuantity(item);
        if (result.cantidad !== 'ND') {
            console.log('ingresa a setItemCarta');
            const rptCantidad = await setItemCarta(0, item, 13);
            console.log('rptCantidad === ', rptCantidad);
        }
        // expect(result.cantidadSumar).toBe(-5);
        console.log(result.cantidad, result.cantidadSumar);
    });
});