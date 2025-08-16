/**
 * test-stock-update.js
 * Script para probar la implementación refactorizada del manejo de stock
 * 
 * Este script compara el comportamiento del código original y refactorizado
 * para actualizar el stock, enfocándose en el flujo actual donde todas las
 * solicitudes pasan por handle.stock.js
 */

// Importar módulos
const originalHandleStock = require('../service/handle.stock');
const handleStockV1 = require('../service/handle.stock.v1');
const stockService = require('../service/stock.service');
const errorManagerV1 = require('../service/error.manager.v1');
const stockIntegration = require('../service/stock.integration');

// Configuración de prueba
const TEST_CASES = [
    // Caso 1: Item de almacén normal
    {
        name: 'Item de almacén normal',
        op: '0',
        item: {
            cantidadSumar: 1,
            idcarta_lista: '123456',
            cantidad_reset: 0,
            isalmacen: 1
        },
        idsede: '100'
    },
    // Caso 2: Item con subitems
    {
        name: 'Item con subitems',
        op: '0',
        item: {
            iditem: '78430',
            idcarta_lista: '137505948688578430',
            cantidadSumar: -1,
            isporcion: '6',
            cantidad: 4,
            subitems: [
                {
                    des: 'Subitem 1',
                    opciones: [
                        { cantidad: '2', des: 'Opción 1' },
                        { cantidad: 'ND', des: 'Opción 2' }
                    ]
                }
            ],
            subitems_selected: [
                {
                    idporcion: '123',
                    idproducto: '456',
                    iditem_subitem: '789',
                    cantidad_selected: 2
                }
            ],
            sumar: true
        },
        idsede: '505'
    },
    // Caso 3: Item con porción SP (que ha causado errores de sintaxis SQL)
    {
        name: 'Item con porción SP',
        op: '0',
        item: {
            iditem: '1375391037727777945',
            idcarta_lista: '1375391037727777945',
            cantidadSumar: 1,
            isporcion: 'SP',
            iditem2: '1375391037727777945',
            subitems: [
                {
                    des: 'seleccione',
                    opciones: [
                        { des: 'TRADICIONAL', precio: 0, cantidad: null, selected: true }
                    ]
                }
            ],
            subitems_selected: [
                { des: 'TRADICIONAL', precio: 0, cantidad: null, selected: true }
            ]
        },
        idsede: '539'
    },
    // Caso 4: Item con valores nulos (que ha causado errores de referencia)
    {
        name: 'Item con valores nulos',
        op: '0',
        item: {
            iditem: '199234327232756179',
            idcarta_lista: '199234327232756179',
            cantidadSumar: -2,
            isporcion: '31',
            iditem2: '56179',
            // Intencionalmente omitimos algunos campos para probar la robustez
        },
        idsede: '234'
    }
];

// Función para ejecutar pruebas
async function runTests() {
    console.log('=== INICIANDO PRUEBAS DE ACTUALIZACIÓN DE STOCK ===');
    console.log('Fecha y hora:', new Date().toISOString());
    console.log('===================================================');
    
    // Primero probamos con la implementación original
    console.log('\n=== PRUEBAS CON IMPLEMENTACIÓN ORIGINAL ===');
    for (const testCase of TEST_CASES) {
        console.log(`\n>> CASO DE PRUEBA ORIGINAL: ${testCase.name}`);
        
        try {
            console.log('Probando con handle.stock original:');
            const originalResult = await originalHandleStock.updateStock(testCase.op, testCase.item, testCase.idsede);
            console.log('Resultado:', JSON.stringify(originalResult, null, 2));
        } catch (error) {
            console.error('Error en handle.stock original:', error.message);
            console.error('Tipo de error:', error.constructor.name);
            if (error.stack) console.error('Stack:', error.stack);
        }
        
        console.log('---------------------------------------------------');
    }
    
    // Ahora reemplazamos la implementación original con la nueva
    console.log('\n=== REEMPLAZANDO IMPLEMENTACIÓN CON STOCK.INTEGRATION ===');
    const restoreOriginal = stockIntegration.patchOriginalImplementation();
    
    // Probamos con la implementación reemplazada
    console.log('\n=== PRUEBAS CON IMPLEMENTACIÓN REEMPLAZADA ===');
    for (const testCase of TEST_CASES) {
        console.log(`\n>> CASO DE PRUEBA REEMPLAZADO: ${testCase.name}`);
        
        try {
            // Ahora llamamos a handle.stock pero internamente usará la implementación mejorada
            console.log('Probando con handle.stock (reemplazado):');
            const patchedResult = await originalHandleStock.updateStock(testCase.op, testCase.item, testCase.idsede);
            console.log('Resultado:', JSON.stringify(patchedResult, null, 2));
        } catch (error) {
            console.error('Error en handle.stock (reemplazado):', error.message);
            console.error('Tipo de error:', error.constructor.name);
            if (error.stack) console.error('Stack:', error.stack);
        }
        
        console.log('---------------------------------------------------');
    }
    
    // Restauramos la implementación original
    console.log('\n=== RESTAURANDO IMPLEMENTACIÓN ORIGINAL ===');
    restoreOriginal();
    
    // Pruebas adicionales con cada implementación por separado
    console.log('\n=== PRUEBAS INDIVIDUALES DE CADA IMPLEMENTACIÓN ===');
    for (const testCase of TEST_CASES) {
        console.log(`\n>> CASO DE PRUEBA INDIVIDUAL: ${testCase.name}`);
        
        try {
            // 1. Probar con handle.stock.v1 directamente
            console.log('\n1. Probando con handle.stock.v1:');
            const v1Result = await handleStockV1.updateStock(testCase.op, testCase.item, testCase.idsede);
            console.log('Resultado:', JSON.stringify(v1Result, null, 2));
        } catch (error) {
            console.error('Error en handle.stock.v1:', error.message);
        }
        
        try {
            // 2. Probar con el servicio de stock (síncrono)
            console.log('\n2. Probando con StockService (síncrono):');
            const syncResult = await stockService.updateStockSync(testCase.op, testCase.item, testCase.idsede);
            console.log('Resultado:', JSON.stringify(syncResult, null, 2));
        } catch (error) {
            console.error('Error en StockService (síncrono):', error.message);
        }
        
        try {
            // 3. Probar con el servicio de stock (asíncrono)
            console.log('\n3. Probando con StockService (asíncrono):');
            const asyncResult = await stockService.updateStock(testCase.op, testCase.item, testCase.idsede);
            console.log('Resultado:', JSON.stringify(asyncResult, null, 2));
            
            // Esperar un poco para que se procese el trabajo
            console.log('Esperando procesamiento...');
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verificar estado del trabajo
            if (asyncResult.jobId) {
                const jobStatus = stockService.getJobStatus(asyncResult.jobId);
                console.log('Estado del trabajo:', JSON.stringify(jobStatus, null, 2));
            }
        } catch (error) {
            console.error('Error en StockService (asíncrono):', error.message);
        }
        
        console.log('---------------------------------------------------');
    }
    
    console.log('\n=== PRUEBAS COMPLETADAS ===');
}

// Ejecutar pruebas
runTests()
    .then(() => {
        console.log('Script de prueba finalizado.');
    })
    .catch(error => {
        console.error('Error en script de prueba:', error);
    });
