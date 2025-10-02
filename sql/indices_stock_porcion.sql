-- =====================================================
-- ÍNDICES OPTIMIZADOS PARA STOCK DE PORCIONES
-- Para soportar 50+ transacciones/segundo
-- Compatible con MySQL 5.7+
-- =====================================================

-- Usar base de datos
USE restobar;

-- =====================================================
-- NOTA IMPORTANTE PARA MySQL 5.7:
-- Si el índice ya existe, el comando dará error pero es SEGURO IGNORARLO
-- Puedes verificar índices existentes con: SHOW INDEX FROM tabla_nombre;
-- =====================================================

-- =====================================================
-- 1. ÍNDICES EN TABLA: porcion
-- =====================================================

-- Índice compuesto para locks rápidos (SELECT FOR UPDATE)
-- Usado en: StockPorcionService._lockPorciones()
CREATE INDEX idx_porcion_lock 
ON porcion(idporcion, idsede, estado);

-- Índice para búsquedas por sede
CREATE INDEX idx_porcion_idsede 
ON porcion(idsede, estado);

-- Verificar índices existentes
SHOW INDEX FROM porcion;


-- =====================================================
-- 2. ÍNDICES EN TABLA: item_ingrediente (RECETA)
-- =====================================================

-- Índice compuesto para obtener receta rápidamente
-- Usado en: StockPorcionService._obtenerRecetaItem()
CREATE INDEX idx_item_ingrediente_receta 
ON item_ingrediente(iditem, estado, idporcion, idproducto_stock);

-- Índice para búsquedas por porción
CREATE INDEX idx_item_ingrediente_porcion 
ON item_ingrediente(idporcion, estado);

-- Índice para búsquedas por producto stock
CREATE INDEX idx_item_ingrediente_producto 
ON item_ingrediente(idproducto_stock, estado);

-- Verificar índices existentes
SHOW INDEX FROM item_ingrediente;


-- =====================================================
-- 3. ÍNDICES EN TABLA: porcion_historial
-- =====================================================

-- Índice compuesto para consultas por porción y fecha
CREATE INDEX idx_porcion_historial_consulta 
ON porcion_historial(idporcion, fecha_date, idtipo_movimiento_stock);

-- Índice para búsquedas por pedido
CREATE INDEX idx_porcion_historial_pedido 
ON porcion_historial(idpedido, fecha_date);

-- Índice para búsquedas por item
CREATE INDEX idx_porcion_historial_item 
ON porcion_historial(iditem, fecha_date);

-- Índice para búsquedas por sede y fecha
CREATE INDEX idx_porcion_historial_sede_fecha 
ON porcion_historial(idsede, fecha_date, idtipo_movimiento_stock);

-- Verificar índices existentes
SHOW INDEX FROM porcion_historial;


-- =====================================================
-- 4. ÍNDICES EN TABLA: carta_lista
-- =====================================================

-- Índice para búsquedas por item
CREATE INDEX idx_carta_lista_item 
ON carta_lista(iditem, estado);

-- Verificar índices existentes
SHOW INDEX FROM carta_lista;


-- =====================================================
-- 5. CONFIGURACIÓN DE MYSQL PARA ALTA CONCURRENCIA
-- =====================================================

-- Verificar configuración actual
SHOW VARIABLES LIKE 'innodb_lock_wait_timeout';
SHOW VARIABLES LIKE 'innodb_deadlock_detect';
SHOW VARIABLES LIKE 'transaction_isolation';
SHOW VARIABLES LIKE 'max_connections';

-- Configuración recomendada (requiere permisos de administrador)
-- SET GLOBAL innodb_lock_wait_timeout = 5;  -- 5 segundos máximo esperando lock
-- SET GLOBAL max_connections = 200;         -- Soportar más conexiones simultáneas
-- SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB para cache (ajustar según RAM)


-- =====================================================
-- 6. ANÁLISIS DE PERFORMANCE
-- =====================================================

-- Query para analizar uso de índices
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    SEQ_IN_INDEX,
    COLUMN_NAME,
    CARDINALITY,
    INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'restobar'
AND TABLE_NAME IN ('porcion', 'item_ingrediente', 'porcion_historial')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;


-- =====================================================
-- 7. PRUEBA DE PERFORMANCE DE QUERIES
-- =====================================================

-- Test 1: Obtener receta de un item (debe usar índice)
EXPLAIN SELECT 
    ii.iditem_ingrediente,
    ii.iditem,
    ii.idporcion,
    ii.cantidad as cantidad_receta,
    p.stock as stock_actual
FROM item_ingrediente ii
LEFT JOIN porcion p ON ii.idporcion = p.idporcion
WHERE ii.iditem = 1290
    AND ii.estado = 0
    AND ii.idporcion > 0;

-- Test 2: Lock de porciones (debe usar índice)
EXPLAIN SELECT 
    idporcion,
    stock,
    descripcion
FROM porcion
WHERE idporcion IN (2, 3, 4)
    AND idsede = 1
FOR UPDATE;

-- Test 3: Consulta de historial (debe usar índice)
EXPLAIN SELECT * 
FROM porcion_historial
WHERE idporcion = 3
    AND fecha_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY fecha_date DESC;


-- =====================================================
-- 8. MONITOREO DE DEADLOCKS
-- =====================================================

-- Ver información de deadlocks recientes
SHOW ENGINE INNODB STATUS;

-- Query para ver locks activos
SELECT * FROM information_schema.INNODB_LOCKS;

-- Query para ver transacciones en espera
SELECT * FROM information_schema.INNODB_LOCK_WAITS;


-- =====================================================
-- 9. LIMPIEZA Y MANTENIMIENTO
-- =====================================================

-- Optimizar tablas después de crear índices
OPTIMIZE TABLE porcion;
OPTIMIZE TABLE item_ingrediente;
OPTIMIZE TABLE porcion_historial;

-- Analizar tablas para actualizar estadísticas
ANALYZE TABLE porcion;
ANALYZE TABLE item_ingrediente;
ANALYZE TABLE porcion_historial;


-- =====================================================
-- RESUMEN DE ÍNDICES CREADOS
-- =====================================================
/*
PORCION:
- idx_porcion_lock (idporcion, idsede, estado)
- idx_porcion_idsede (idsede, estado)

ITEM_INGREDIENTE:
- idx_item_ingrediente_receta (iditem, estado, idporcion, idproducto_stock)
- idx_item_ingrediente_porcion (idporcion, estado)
- idx_item_ingrediente_producto (idproducto_stock, estado)

PORCION_HISTORIAL:
- idx_porcion_historial_consulta (idporcion, fecha_date, idtipo_movimiento_stock)
- idx_porcion_historial_pedido (idpedido, fecha_date)
- idx_porcion_historial_item (iditem, fecha_date)
- idx_porcion_historial_sede_fecha (idsede, fecha_date, idtipo_movimiento_stock)

CARTA_LISTA:
- idx_carta_lista_item (iditem, estado)
*/

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
/*
1. Ejecutar este script en PRODUCCIÓN durante horario de baja demanda
2. Los índices pueden tardar varios minutos en crearse si las tablas son grandes
3. Monitorear el uso de disco después de crear índices
4. Verificar que no haya índices duplicados antes de ejecutar
5. Hacer backup de la base de datos antes de ejecutar
6. Probar primero en ambiente de desarrollo
*/
