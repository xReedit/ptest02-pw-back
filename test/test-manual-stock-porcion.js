/**
 * Script de prueba manual para StockPorcionService
 * Permite probar el servicio con datos reales de producción
 * 
 * USO:
 * node test/test-manual-stock-porcion.js
 */

const StockPorcionService = require('../service/stock.porcion.service');
const readline = require('readline');

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Interfaz para leer input del usuario
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

/**
 * Función para hacer preguntas
 */
function pregunta(texto) {
    return new Promise((resolve) => {
        rl.question(texto, (respuesta) => {
            resolve(respuesta);
        });
    });
}

/**
 * Mostrar banner
 */
function mostrarBanner() {
    console.clear();
    console.log(colors.cyan + colors.bright);
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                                                          ║');
    console.log('║       PRUEBA MANUAL - StockPorcionService                ║');
    console.log('║       Sistema de Stock Centralizado                      ║');
    console.log('║                                                          ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(colors.reset);
}

/**
 * Mostrar menú principal
 */
function mostrarMenu() {
    console.log(colors.yellow + '\n━━━ MENÚ PRINCIPAL ━━━' + colors.reset);
    console.log('1. Probar venta de producto (descuenta stock)');
    console.log('2. Probar entrada de mercadería (aumenta stock)');
    console.log('3. Probar reset de stock (establece valor)');
    console.log('4. Consultar stock actual de una porción');
    console.log('5. Ver últimos movimientos de una porción');
    console.log('6. Salir');
    console.log('');
}

/**
 * Test 1: Venta de producto
 */
async function testVenta() {
    console.log(colors.blue + '\n━━━ TEST: VENTA DE PRODUCTO ━━━' + colors.reset);
    console.log('Este test simula la venta de un producto que consume porciones.\n');
    
    const iditem = await pregunta('Ingresa el ID del item/producto (ej: 1290): ');
    const cantidad = await pregunta('Ingresa la cantidad vendida (ej: 2): ');
    const idsede = await pregunta('Ingresa el ID de la sede (ej: 1): ');
    const idusuario = await pregunta('Ingresa el ID del usuario (ej: 103): ');
    
    console.log(colors.yellow + '\n⏳ Procesando venta...' + colors.reset);
    
    const startTime = Date.now();
    const resultado = await StockPorcionService.actualizarStockConHistorial({
        iditem: parseInt(iditem),
        cantidadProducto: parseInt(cantidad),
        idsede: parseInt(idsede),
        idusuario: parseInt(idusuario),
        idpedido: null,
        tipoMovimiento: 'VENTA',
        esReset: false
    });
    const tiempoEjecucion = Date.now() - startTime;
    
    mostrarResultado(resultado, tiempoEjecucion);
}

/**
 * Test 2: Entrada de mercadería
 */
async function testEntrada() {
    console.log(colors.blue + '\n━━━ TEST: ENTRADA DE MERCADERÍA ━━━' + colors.reset);
    console.log('Este test simula la entrada de mercadería (suma al stock existente).\n');
    
    const iditem = await pregunta('Ingresa el ID del item/producto (ej: 1290): ');
    const cantidad = await pregunta('Ingresa la cantidad a agregar (ej: 10): ');
    const idsede = await pregunta('Ingresa el ID de la sede (ej: 1): ');
    const idusuario = await pregunta('Ingresa el ID del usuario (ej: 103): ');
    
    console.log(colors.yellow + '\n⏳ Procesando entrada...' + colors.reset);
    
    const startTime = Date.now();
    const resultado = await StockPorcionService.actualizarStockConHistorial({
        iditem: parseInt(iditem),
        cantidadProducto: parseInt(cantidad),
        idsede: parseInt(idsede),
        idusuario: parseInt(idusuario),
        idpedido: null,
        tipoMovimiento: 'ENTRADA',
        esReset: false
    });
    const tiempoEjecucion = Date.now() - startTime;
    
    mostrarResultado(resultado, tiempoEjecucion);
}

/**
 * Test 3: Reset de stock
 */
async function testReset() {
    console.log(colors.blue + '\n━━━ TEST: RESET DE STOCK ━━━' + colors.reset);
    console.log('Este test establece un valor absoluto de stock (NO suma ni resta).\n');
    
    const iditem = await pregunta('Ingresa el ID del item/producto (ej: 1290): ');
    const cantidad = await pregunta('Ingresa el valor de stock a establecer (ej: 50): ');
    const idsede = await pregunta('Ingresa el ID de la sede (ej: 1): ');
    const idusuario = await pregunta('Ingresa el ID del usuario (ej: 103): ');
    
    console.log(colors.yellow + '\n⏳ Procesando reset...' + colors.reset);
    
    const startTime = Date.now();
    const resultado = await StockPorcionService.actualizarStockConHistorial({
        iditem: parseInt(iditem),
        cantidadProducto: parseInt(cantidad),
        idsede: parseInt(idsede),
        idusuario: parseInt(idusuario),
        idpedido: null,
        tipoMovimiento: 'ENTRADA',
        esReset: true
    });
    const tiempoEjecucion = Date.now() - startTime;
    
    mostrarResultado(resultado, tiempoEjecucion);
}

/**
 * Test 4: Consultar stock actual
 */
async function consultarStock() {
    console.log(colors.blue + '\n━━━ CONSULTAR STOCK ACTUAL ━━━' + colors.reset);
    
    const idporcion = await pregunta('Ingresa el ID de la porción (ej: 3): ');
    
    const { sequelize, Sequelize } = require('../config/database');
    
    const query = `
        SELECT 
            p.idporcion,
            p.descripcion,
            p.stock,
            p.idsede,
            COUNT(ph.idporcion_historial) as total_movimientos
        FROM porcion p
        LEFT JOIN porcion_historial ph ON ph.idporcion = p.idporcion 
            AND ph.fecha_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        WHERE p.idporcion = :idporcion
        GROUP BY p.idporcion
    `;
    
    const [resultado] = await sequelize.query(query, {
        replacements: { idporcion: parseInt(idporcion) },
        type: Sequelize.QueryTypes.SELECT
    });
    
    if (resultado) {
        console.log(colors.green + '\n✓ Porción encontrada:' + colors.reset);
        console.log(`  ID: ${resultado.idporcion}`);
        console.log(`  Descripción: ${resultado.descripcion}`);
        console.log(`  Stock actual: ${colors.bright}${resultado.stock}${colors.reset}`);
        console.log(`  Sede: ${resultado.idsede}`);
        console.log(`  Movimientos (últimos 7 días): ${resultado.total_movimientos}`);
    } else {
        console.log(colors.red + '\n✗ Porción no encontrada' + colors.reset);
    }
}

/**
 * Test 5: Ver últimos movimientos
 */
async function verMovimientos() {
    console.log(colors.blue + '\n━━━ ÚLTIMOS MOVIMIENTOS ━━━' + colors.reset);
    
    const idporcion = await pregunta('Ingresa el ID de la porción (ej: 3): ');
    const limite = await pregunta('¿Cuántos movimientos ver? (ej: 10): ');
    
    const { sequelize, Sequelize } = require('../config/database');
    
    const query = `
        SELECT 
            ph.idporcion_historial,
            ph.tipo_movimiento,
            ph.cantidad,
            ph.stock_total,
            ph.fecha_date,
            ph.hora,
            ph.iditem,
            i.descripcion as item_descripcion,
            ph.idpedido,
            u.usuario as nombre_usuario
        FROM porcion_historial ph
        LEFT JOIN item i ON ph.iditem = i.iditem
        LEFT JOIN usuario u ON ph.idusuario = u.idusuario
        WHERE ph.idporcion = :idporcion
        ORDER BY ph.idporcion_historial DESC
        LIMIT :limite
    `;
    
    const resultados = await sequelize.query(query, {
        replacements: { 
            idporcion: parseInt(idporcion),
            limite: parseInt(limite)
        },
        type: Sequelize.QueryTypes.SELECT
    });
    
    if (resultados.length > 0) {
        console.log(colors.green + `\n✓ ${resultados.length} movimientos encontrados:\n` + colors.reset);
        
        resultados.forEach((mov, index) => {
            console.log(colors.bright + `${index + 1}. Movimiento #${mov.idporcion_historial}` + colors.reset);
            console.log(`   Tipo: ${mov.tipo_movimiento}`);
            console.log(`   Cantidad: ${mov.cantidad}`);
            console.log(`   Stock resultante: ${mov.stock_total}`);
            console.log(`   Fecha: ${mov.fecha_date} ${mov.hora}`);
            if (mov.item_descripcion) {
                console.log(`   Item: ${mov.item_descripcion} (ID: ${mov.iditem})`);
            }
            if (mov.idpedido) {
                console.log(`   Pedido: #${mov.idpedido}`);
            }
            if (mov.nombre_usuario) {
                console.log(`   Usuario: ${mov.nombre_usuario}`);
            }
            console.log('');
        });
    } else {
        console.log(colors.red + '\n✗ No se encontraron movimientos' + colors.reset);
    }
}

/**
 * Mostrar resultado de la operación
 */
function mostrarResultado(resultado, tiempoEjecucion) {
    console.log('\n' + colors.cyan + '━━━ RESULTADO ━━━' + colors.reset);
    
    if (resultado.success) {
        console.log(colors.green + '✓ OPERACIÓN EXITOSA' + colors.reset);
        console.log(`  Tiempo de ejecución: ${tiempoEjecucion}ms`);
        console.log(`  Mensaje: ${resultado.message}`);
        
        if (resultado.porcionesAfectadas && resultado.porcionesAfectadas.length > 0) {
            console.log(`\n  Porciones afectadas: ${resultado.porcionesAfectadas.length}`);
            
            resultado.porcionesAfectadas.forEach((porcion, index) => {
                console.log(`\n  ${index + 1}. ${colors.bright}${porcion.descripcion}${colors.reset}`);
                console.log(`     ID Porción: ${porcion.idporcion}`);
                console.log(`     Stock anterior: ${porcion.stockAnterior}`);
                console.log(`     Ajuste: ${porcion.cantidadAjustada > 0 ? '+' : ''}${porcion.cantidadAjustada}`);
                console.log(`     Stock nuevo: ${colors.bright}${porcion.stockNuevo}${colors.reset}`);
            });
        }
        
        // Evaluación de performance
        console.log('\n  ' + colors.yellow + 'Evaluación de performance:' + colors.reset);
        if (tiempoEjecucion < 100) {
            console.log(`  ${colors.green}⚡ EXCELENTE${colors.reset} (< 100ms)`);
        } else if (tiempoEjecucion < 500) {
            console.log(`  ${colors.blue}✓ BUENO${colors.reset} (< 500ms)`);
        } else if (tiempoEjecucion < 1000) {
            console.log(`  ${colors.yellow}⚠ ACEPTABLE${colors.reset} (< 1s)`);
        } else {
            console.log(`  ${colors.red}⚠ LENTO${colors.reset} (> 1s) - Revisar índices`);
        }
        
    } else {
        console.log(colors.red + '✗ OPERACIÓN FALLIDA' + colors.reset);
        console.log(`  Error: ${resultado.error}`);
        
        if (resultado.detalleError) {
            console.log('\n  Detalle del error:');
            if (Array.isArray(resultado.detalleError)) {
                resultado.detalleError.forEach(detalle => {
                    if (typeof detalle === 'object') {
                        console.log(`    - ${detalle.porcion}: Falta ${detalle.faltante} (requiere ${detalle.requerido}, disponible ${detalle.disponible})`);
                    } else {
                        console.log(`    - ${detalle}`);
                    }
                });
            } else {
                console.log(`    ${resultado.detalleError}`);
            }
        }
        
        if (resultado.attempt) {
            console.log(`\n  Reintentos realizados: ${resultado.attempt - 1}`);
        }
    }
}

/**
 * Función principal
 */
async function main() {
    mostrarBanner();
    
    console.log(colors.magenta + '🔧 Este script te permite probar el servicio de stock de porciones');
    console.log('   con datos reales de tu base de datos antes de integrarlo.' + colors.reset);
    console.log(colors.yellow + '\n⚠️  IMPORTANTE: Las operaciones SI afectarán tu base de datos.' + colors.reset);
    console.log('   Si estás en producción, úsalo con precaución.\n');
    
    const continuar = await pregunta('¿Deseas continuar? (s/n): ');
    
    if (continuar.toLowerCase() !== 's') {
        console.log('\nOperación cancelada.');
        rl.close();
        process.exit(0);
    }
    
    let salir = false;
    
    while (!salir) {
        mostrarMenu();
        const opcion = await pregunta('Selecciona una opción (1-6): ');
        
        try {
            switch (opcion) {
                case '1':
                    await testVenta();
                    break;
                case '2':
                    await testEntrada();
                    break;
                case '3':
                    await testReset();
                    break;
                case '4':
                    await consultarStock();
                    break;
                case '5':
                    await verMovimientos();
                    break;
                case '6':
                    console.log(colors.green + '\n✓ ¡Hasta luego!' + colors.reset);
                    salir = true;
                    break;
                default:
                    console.log(colors.red + '\n✗ Opción inválida' + colors.reset);
            }
            
            if (!salir) {
                await pregunta(colors.cyan + '\nPresiona ENTER para continuar...' + colors.reset);
                console.clear();
                mostrarBanner();
            }
            
        } catch (error) {
            console.log(colors.red + '\n✗ Error inesperado:' + colors.reset);
            console.error(error);
            await pregunta(colors.cyan + '\nPresiona ENTER para continuar...' + colors.reset);
        }
    }
    
    rl.close();
    process.exit(0);
}

// Ejecutar
main().catch(error => {
    console.error(colors.red + '\n❌ Error fatal:' + colors.reset);
    console.error(error);
    rl.close();
    process.exit(1);
});
