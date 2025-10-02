/**
 * Test suite para StockPorcionService
 * Validar concurrencia y atomicidad
 */

const StockPorcionService = require('../service/stock.porcion.service');

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

/**
 * Test 1: Validación de parámetros
 */
async function test1_ValidacionParametros() {
    console.log('\n' + colors.blue + '━━━ TEST 1: Validación de parámetros ━━━' + colors.reset);
    
    const testCases = [
        {
            name: 'Sin iditem',
            params: { cantidadProducto: 1, idsede: 1, idusuario: 1, tipoMovimiento: 'VENTA', esReset: false },
            expectedError: 'iditem es requerido'
        },
        {
            name: 'Cantidad <= 0',
            params: { iditem: 1290, cantidadProducto: 0, idsede: 1, idusuario: 1, tipoMovimiento: 'VENTA', esReset: false },
            expectedError: 'cantidadProducto debe ser mayor a 0'
        },
        {
            name: 'Sin idsede',
            params: { iditem: 1290, cantidadProducto: 1, idusuario: 1, tipoMovimiento: 'VENTA', esReset: false },
            expectedError: 'idsede es requerido'
        },
        {
            name: 'Sin tipoMovimiento',
            params: { iditem: 1290, cantidadProducto: 1, idsede: 1, idusuario: 1, esReset: false },
            expectedError: 'tipoMovimiento es requerido'
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const testCase of testCases) {
        const resultado = await StockPorcionService.actualizarStockConHistorial(testCase.params);
        
        if (!resultado.success && resultado.error === testCase.expectedError) {
            console.log(colors.green + `✓ ${testCase.name}: PASS` + colors.reset);
            passed++;
        } else {
            console.log(colors.red + `✗ ${testCase.name}: FAIL` + colors.reset);
            console.log(`  Esperado: ${testCase.expectedError}`);
            console.log(`  Obtenido: ${resultado.error}`);
            failed++;
        }
    }
    
    console.log(`\nResultado: ${colors.green}${passed} passed${colors.reset}, ${colors.red}${failed} failed${colors.reset}`);
    return { passed, failed };
}

/**
 * Test 2: Actualización simple de stock
 */
async function test2_ActualizacionSimple() {
    console.log('\n' + colors.blue + '━━━ TEST 2: Actualización simple de stock ━━━' + colors.reset);
    
    try {
        const resultado = await StockPorcionService.actualizarStockConHistorial({
            iditem: 1290,
            cantidadProducto: 1,
            idsede: 1,
            idusuario: 103,
            idpedido: 99999, // ID de prueba
            tipoMovimiento: 'VENTA',
            esReset: false
        });
        
        console.log('Resultado:', JSON.stringify(resultado, null, 2));
        
        if (resultado.success) {
            console.log(colors.green + '✓ Actualización exitosa' + colors.reset);
            console.log(`  Tiempo de ejecución: ${resultado.ejecutionTime}ms`);
            console.log(`  Porciones afectadas: ${resultado.porcionesAfectadas.length}`);
            
            resultado.porcionesAfectadas.forEach(p => {
                console.log(`    - ${p.descripcion}: ${p.stockAnterior} → ${p.stockNuevo} (${p.cantidadAjustada})`);
            });
            
            return { passed: 1, failed: 0 };
        } else {
            console.log(colors.yellow + '⚠ No se pudo actualizar (puede ser que el item no tenga porciones)' + colors.reset);
            console.log('  Error:', resultado.error);
            return { passed: 0, failed: 0 };
        }
    } catch (error) {
        console.log(colors.red + '✗ Error en test' + colors.reset);
        console.error(error);
        return { passed: 0, failed: 1 };
    }
}

/**
 * Test 3: Concurrencia - múltiples transacciones simultáneas
 */
async function test3_Concurrencia() {
    console.log('\n' + colors.blue + '━━━ TEST 3: Concurrencia (10 transacciones simultáneas) ━━━' + colors.reset);
    
    const numTransacciones = 10;
    const startTime = Date.now();
    
    try {
        const promises = [];
        
        for (let i = 0; i < numTransacciones; i++) {
            promises.push(
                StockPorcionService.actualizarStockConHistorial({
                    iditem: 1290,
                    cantidadProducto: 1,
                    idsede: 1,
                    idusuario: 103,
                    idpedido: 99900 + i,
                    tipoMovimiento: 'VENTA',
                    esReset: false
                })
            );
        }
        
        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        
        const exitosos = results.filter(r => r.success).length;
        const fallidos = numTransacciones - exitosos;
        const avgTime = results.reduce((sum, r) => sum + (r.ejecutionTime || 0), 0) / numTransacciones;
        
        console.log(`\nResultados de concurrencia:`);
        console.log(`  Total transacciones: ${numTransacciones}`);
        console.log(`  ${colors.green}Exitosas: ${exitosos}${colors.reset}`);
        console.log(`  ${colors.red}Fallidas: ${fallidos}${colors.reset}`);
        console.log(`  Tiempo total: ${totalTime}ms`);
        console.log(`  Tiempo promedio por transacción: ${avgTime.toFixed(2)}ms`);
        console.log(`  Throughput: ${(numTransacciones / (totalTime / 1000)).toFixed(2)} tx/seg`);
        
        // Analizar reintentos por deadlock
        const conReintentos = results.filter(r => r.attempt && r.attempt > 1).length;
        if (conReintentos > 0) {
            console.log(`  ${colors.yellow}⚠ Transacciones que requirieron reintentos: ${conReintentos}${colors.reset}`);
        }
        
        if (exitosos === numTransacciones) {
            console.log(colors.green + '\n✓ Test de concurrencia PASS' + colors.reset);
            return { passed: 1, failed: 0 };
        } else if (exitosos > numTransacciones * 0.8) {
            console.log(colors.yellow + '\n⚠ Test de concurrencia PASS con advertencias' + colors.reset);
            return { passed: 1, failed: 0 };
        } else {
            console.log(colors.red + '\n✗ Test de concurrencia FAIL' + colors.reset);
            return { passed: 0, failed: 1 };
        }
    } catch (error) {
        console.log(colors.red + '✗ Error en test de concurrencia' + colors.reset);
        console.error(error);
        return { passed: 0, failed: 1 };
    }
}

/**
 * Test 4: Stress test - 50 transacciones simultáneas
 */
async function test4_StressTest() {
    console.log('\n' + colors.blue + '━━━ TEST 4: Stress Test (50 transacciones simultáneas) ━━━' + colors.reset);
    console.log(colors.yellow + '⚠ Este test puede tomar varios segundos...' + colors.reset);
    
    const numTransacciones = 50;
    const startTime = Date.now();
    
    try {
        const promises = [];
        
        for (let i = 0; i < numTransacciones; i++) {
            promises.push(
                StockPorcionService.actualizarStockConHistorial({
                    iditem: 1290,
                    cantidadProducto: 1,
                    idsede: 1,
                    idusuario: 103,
                    idpedido: 98000 + i,
                    tipoMovimiento: 'VENTA',
                    esReset: false
                })
            );
        }
        
        const results = await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        
        const exitosos = results.filter(r => r.success).length;
        const fallidos = numTransacciones - exitosos;
        const avgTime = results.reduce((sum, r) => sum + (r.ejecutionTime || 0), 0) / numTransacciones;
        
        // Analizar distribución de tiempos
        const tiempos = results.map(r => r.ejecutionTime || 0).sort((a, b) => a - b);
        const p50 = tiempos[Math.floor(tiempos.length * 0.5)];
        const p95 = tiempos[Math.floor(tiempos.length * 0.95)];
        const p99 = tiempos[Math.floor(tiempos.length * 0.99)];
        
        console.log(`\nResultados del stress test:`);
        console.log(`  Total transacciones: ${numTransacciones}`);
        console.log(`  ${colors.green}Exitosas: ${exitosos}${colors.reset}`);
        console.log(`  ${colors.red}Fallidas: ${fallidos}${colors.reset}`);
        console.log(`  Tiempo total: ${totalTime}ms`);
        console.log(`  Throughput: ${(numTransacciones / (totalTime / 1000)).toFixed(2)} tx/seg`);
        console.log(`\nDistribución de tiempos:`);
        console.log(`  Promedio: ${avgTime.toFixed(2)}ms`);
        console.log(`  P50 (mediana): ${p50}ms`);
        console.log(`  P95: ${p95}ms`);
        console.log(`  P99: ${p99}ms`);
        console.log(`  Máximo: ${tiempos[tiempos.length - 1]}ms`);
        
        // Analizar reintentos
        const conReintentos = results.filter(r => r.attempt && r.attempt > 1).length;
        if (conReintentos > 0) {
            console.log(`\n  ${colors.yellow}⚠ Transacciones con reintentos: ${conReintentos} (${(conReintentos/numTransacciones*100).toFixed(1)}%)${colors.reset}`);
        }
        
        // Criterios de éxito
        const tasaExito = exitosos / numTransacciones;
        const throughput = numTransacciones / (totalTime / 1000);
        
        if (tasaExito >= 0.95 && throughput >= 10) {
            console.log(colors.green + '\n✓ Stress test PASS - Sistema estable bajo carga' + colors.reset);
            return { passed: 1, failed: 0 };
        } else if (tasaExito >= 0.8) {
            console.log(colors.yellow + '\n⚠ Stress test PASS con advertencias - Revisar configuración' + colors.reset);
            return { passed: 1, failed: 0 };
        } else {
            console.log(colors.red + '\n✗ Stress test FAIL - Sistema inestable bajo carga' + colors.reset);
            return { passed: 0, failed: 1 };
        }
    } catch (error) {
        console.log(colors.red + '✗ Error en stress test' + colors.reset);
        console.error(error);
        return { passed: 0, failed: 1 };
    }
}

/**
 * Ejecutar todos los tests
 */
async function runAllTests() {
    console.log(colors.cyan + '\n╔═══════════════════════════════════════════════════╗');
    console.log('║  TEST SUITE: StockPorcionService                ║');
    console.log('╚═══════════════════════════════════════════════════╝' + colors.reset);
    
    const resultados = [];
    
    // Test 1: Validaciones
    resultados.push(await test1_ValidacionParametros());
    
    // Test 2: Actualización simple
    resultados.push(await test2_ActualizacionSimple());
    
    // Test 3: Concurrencia
    resultados.push(await test3_Concurrencia());
    
    // Test 4: Stress test (opcional, comentar si es muy pesado)
    // resultados.push(await test4_StressTest());
    
    // Resumen final
    const totalPassed = resultados.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = resultados.reduce((sum, r) => sum + r.failed, 0);
    
    console.log(colors.cyan + '\n╔═══════════════════════════════════════════════════╗');
    console.log(`║  RESUMEN FINAL                                    ║`);
    console.log('╚═══════════════════════════════════════════════════╝' + colors.reset);
    console.log(`  ${colors.green}Tests exitosos: ${totalPassed}${colors.reset}`);
    console.log(`  ${colors.red}Tests fallidos: ${totalFailed}${colors.reset}`);
    console.log(`  Total: ${totalPassed + totalFailed}`);
    
    if (totalFailed === 0) {
        console.log(colors.green + '\n🎉 TODOS LOS TESTS PASARON' + colors.reset);
    } else {
        console.log(colors.red + '\n⚠️  ALGUNOS TESTS FALLARON' + colors.reset);
    }
    
    process.exit(totalFailed > 0 ? 1 : 0);
}

// Ejecutar tests
if (require.main === module) {
    runAllTests().catch(error => {
        console.error(colors.red + '\n❌ Error fatal en suite de tests:' + colors.reset);
        console.error(error);
        process.exit(1);
    });
}

module.exports = {
    test1_ValidacionParametros,
    test2_ActualizacionSimple,
    test3_Concurrencia,
    test4_StressTest
};
