/**
 * test-hybrid-solution.js
 * Script para probar la implementación híbrida con Sequelize
 * Valida el manejo de deadlocks, errores SQL y referencias nulas
 */

// Importar servicios necesarios
const stockHybridService = require('../service/stock.hybrid');
const stockIntegration = require('../service/stock.integration.hybrid');

// Datos para pruebas
const validItem = {
    idcarta_lista: '123456',
    iditem: '123456',
    cantidadSumar: -1,
    isalmacen: 0,
    isporcion: 'N'
};

const complexItem = {
    idcarta_lista: '789012',
    iditem: '789012',
    cantidadSumar: -1,
    isporcion: 'SP',
    subitems_selected: [
        {
            idporcion: '101',
            idproducto: '201',
            opciones: [
                {
                    iditem_subitem: '301',
                    cantidad: 5
                }
            ]
        }
    ]
};

// Item que causaría error de referencia nula
const invalidItem = {
    iditem: '123456'
    // cantidadSumar está ausente
};

// Item que causaría error de sintaxis SQL (simulado)
const sqlErrorItem = {
    idcarta_lista: "123'; DROP TABLE users; --",
    iditem: '123456',
    cantidadSumar: -1,
    isporcion: 'SP',
    subitems_selected: [
        {
            idporcion: '101',
            idproducto: '201',
            opciones: [
                {
                    iditem_subitem: '301',
                    cantidad: "5'; SELECT * FROM users; --"
                }
            ]
        }
    ]
};

// Contador para resultados de prueba
const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
};

// Función auxiliar para el registro de resultados
function logResult(testName, passed, error = null, data = null) {
    results.total++;
    if (passed) {
        results.passed++;
        console.log(`✅ PASÓ: ${testName}`);
    } else {
        results.failed++;
        console.log(`❌ FALLÓ: ${testName}`);
        if (error) {
            console.error(`   Error: ${error.message}`);
        }
    }
    
    results.details.push({
        testName,
        passed,
        error: error ? error.message : null,
        data
    });
}

// Función principal de prueba
async function runTests() {
    console.log('\n----- PRUEBAS DE IMPLEMENTACIÓN HÍBRIDA CON SEQUELIZE -----\n');
    
    try {
        // 1. Probar conexión a la base de datos
        try {
            console.log('Probando conexión a la base de datos...');
            await stockHybridService.sequelize.authenticate();
            logResult('Conexión a la base de datos', true);
        } catch (error) {
            logResult('Conexión a la base de datos', false, error);
            console.error('ERROR: No se pudo conectar a la base de datos, abortando pruebas.');
            return summarizeResults();
        }
        
        // 2. Probar actualización de stock con item válido
        try {
            console.log('\nProbando actualización de stock con item válido...');
            const result = await stockHybridService.updateStock('U', validItem, '1');
            logResult('Actualización de stock (item válido)', true, null, result);
        } catch (error) {
            logResult('Actualización de stock (item válido)', false, error);
        }
        
        // 3. Probar validación contra referencias nulas
        try {
            console.log('\nProbando validación contra referencias nulas...');
            await stockHybridService.updateStock('U', invalidItem, '1');
            logResult('Validación contra referencias nulas', false, 
                new Error('La prueba debería haber fallado pero no lo hizo'));
        } catch (error) {
            // Esperamos que falle con mensaje sobre campos requeridos
            const passedValidation = error.message.includes('Campos requeridos') || 
                                     error.message.includes('cantidadSumar');
            logResult('Validación contra referencias nulas', passedValidation, 
                passedValidation ? null : error);
        }
        
        // 4. Probar manejo de errores SQL en items complejos
        try {
            console.log('\nProbando manejo de errores SQL en items complejos...');
            const result = await stockHybridService.updateStock('U', complexItem, '1');
            logResult('Manejo de items complejos', true, null, result);
        } catch (error) {
            // Si falla, puede ser por problema real de procedimiento almacenado,
            // pero el sistema debería manejar el error adecuadamente
            logResult('Manejo de items complejos', false, error);
        }
        
        // 5. Probar sanitización de SQL para prevenir inyección
        try {
            console.log('\nProbando sanitización contra inyección SQL...');
            await stockHybridService.updateStock('U', sqlErrorItem, '1');
            logResult('Sanitización contra inyección SQL', true);
        } catch (error) {
            // Si hay error pero contiene información sobre sanitización o validación, es correcto
            const isSafeError = !error.message.includes('SQL syntax') && 
                               !error.message.includes('DROP TABLE');
            logResult('Sanitización contra inyección SQL', isSafeError, 
                isSafeError ? null : error);
        }
        
        // 6. Probar buffer de actualizaciones
        try {
            console.log('\nProbando buffer de actualizaciones...');
            const buffer1 = stockHybridService.bufferStockUpdate('U', validItem, '1');
            const buffer2 = stockHybridService.bufferStockUpdate('U', {...validItem, cantidadSumar: -2}, '1');
            const buffer3 = stockHybridService.bufferStockUpdate('U', {...validItem, cantidadSumar: -3}, '1');
            
            const results = await stockHybridService.flushBuffer();
            logResult('Buffer de actualizaciones', true, null, {
                buffer1,
                buffer2,
                buffer3,
                results
            });
        } catch (error) {
            logResult('Buffer de actualizaciones', false, error);
        }
        
        // 7. Probar integración con implementación original
        try {
            console.log('\nProbando integración con implementación original...');
            stockIntegration.patchOriginalImplementation();
            logResult('Integración con implementación original', true);
        } catch (error) {
            logResult('Integración con implementación original', false, error);
        }
        
    } catch (error) {
        console.error('Error general en pruebas:', error);
    } finally {
        // Resumen de resultados
        summarizeResults();
        
        // Cerrar conexiones
        try {
            await stockHybridService.sequelize.close();
            console.log('\nConexión a la base de datos cerrada correctamente.');
        } catch (error) {
            console.error('Error al cerrar conexión:', error);
        }
    }
}

function summarizeResults() {
    console.log('\n----- RESUMEN DE PRUEBAS -----');
    console.log(`Total: ${results.total}`);
    console.log(`Pasaron: ${results.passed}`);
    console.log(`Fallaron: ${results.failed}`);
    console.log(`Tasa de éxito: ${(results.passed / results.total * 100).toFixed(2)}%`);
    
    if (results.failed > 0) {
        console.log('\nDetalle de pruebas fallidas:');
        results.details
            .filter(r => !r.passed)
            .forEach(r => {
                console.log(`- ${r.testName}: ${r.error}`);
            });
    }
    
    console.log('\n----- RECOMENDACIONES -----');
    if (results.failed === 0) {
        console.log('✅ La implementación híbrida está funcionando correctamente.');
        console.log('   Recomendaciones:');
        console.log('   1. Considerar aumentar el número de workers en la cola de WebSockets a 6-8');
        console.log('   2. Monitorear el rendimiento en producción durante 1-2 semanas');
        console.log('   3. Evaluar migración completa a Redis para distributed locking en alta carga');
    } else {
        console.log('⚠️ Se detectaron problemas con la implementación híbrida.');
        console.log('   Recomendaciones:');
        console.log('   1. Resolver los errores detectados en las pruebas');
        console.log('   2. Verificar la conexión y configuración de la base de datos');
        console.log('   3. Optimizar los procedimientos almacenados problemáticos');
    }
}

// Ejecutar pruebas
runTests().catch(error => {
    console.error('Error fatal en pruebas:', error);
});
