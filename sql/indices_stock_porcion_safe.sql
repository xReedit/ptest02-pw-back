-- =====================================================
-- ÍNDICES OPTIMIZADOS PARA STOCK DE PORCIONES (MySQL 5.7)
-- Versión SEGURA - Verifica existencia antes de crear
-- =====================================================

USE restobar;

DELIMITER $$

-- =====================================================
-- PROCEDIMIENTO PARA CREAR ÍNDICES SOLO SI NO EXISTEN
-- =====================================================
DROP PROCEDURE IF EXISTS create_index_if_not_exists$$

CREATE PROCEDURE create_index_if_not_exists(
    IN p_table_name VARCHAR(128),
    IN p_index_name VARCHAR(128),
    IN p_index_definition TEXT
)
BEGIN
    DECLARE index_exists INT DEFAULT 0;
    
    -- Verificar si el índice ya existe (usando BINARY para evitar problemas de collation)
    SELECT COUNT(*) INTO index_exists
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
        AND BINARY TABLE_NAME = BINARY p_table_name
        AND BINARY INDEX_NAME = BINARY p_index_name;
    
    -- Crear solo si no existe
    IF index_exists = 0 THEN
        SET @sql = CONCAT('CREATE INDEX ', p_index_name, ' ON ', p_table_name, ' ', p_index_definition);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SELECT CONCAT('Indice ', p_index_name, ' creado exitosamente') AS resultado;
    ELSE
        SELECT CONCAT('Indice ', p_index_name, ' ya existe, omitiendo...') AS resultado;
    END IF;
END$$

DELIMITER ;


-- =====================================================
-- CREAR ÍNDICES EN TABLA: porcion
-- =====================================================

CALL create_index_if_not_exists(
    'porcion',
    'idx_porcion_lock',
    '(idporcion, idsede, estado)'
);

CALL create_index_if_not_exists(
    'porcion',
    'idx_porcion_idsede',
    '(idsede, estado)'
);


-- =====================================================
-- CREAR ÍNDICES EN TABLA: item_ingrediente
-- =====================================================

CALL create_index_if_not_exists(
    'item_ingrediente',
    'idx_item_ingrediente_receta',
    '(iditem, estado, idporcion, idproducto_stock)'
);

CALL create_index_if_not_exists(
    'item_ingrediente',
    'idx_item_ingrediente_porcion',
    '(idporcion, estado)'
);

CALL create_index_if_not_exists(
    'item_ingrediente',
    'idx_item_ingrediente_producto',
    '(idproducto_stock, estado)'
);


-- =====================================================
-- CREAR ÍNDICES EN TABLA: porcion_historial
-- =====================================================

CALL create_index_if_not_exists(
    'porcion_historial',
    'idx_porcion_historial_consulta',
    '(idporcion, fecha_date, idtipo_movimiento_stock)'
);

CALL create_index_if_not_exists(
    'porcion_historial',
    'idx_porcion_historial_pedido',
    '(idpedido, fecha_date)'
);

CALL create_index_if_not_exists(
    'porcion_historial',
    'idx_porcion_historial_item',
    '(iditem, fecha_date)'
);

CALL create_index_if_not_exists(
    'porcion_historial',
    'idx_porcion_historial_sede_fecha',
    '(idsede, fecha_date, idtipo_movimiento_stock)'
);


-- =====================================================
-- CREAR ÍNDICES EN TABLA: carta_lista
-- =====================================================

CALL create_index_if_not_exists(
    'carta_lista',
    'idx_carta_lista_item',
    '(iditem, estado)'
);


-- =====================================================
-- VERIFICAR ÍNDICES CREADOS
-- =====================================================

SELECT '=== ÍNDICES EN TABLA: porcion ===' AS info;
SHOW INDEX FROM porcion WHERE Key_name LIKE 'idx_porcion%';

SELECT '=== ÍNDICES EN TABLA: item_ingrediente ===' AS info;
SHOW INDEX FROM item_ingrediente WHERE Key_name LIKE 'idx_item_ingrediente%';

SELECT '=== ÍNDICES EN TABLA: porcion_historial ===' AS info;
SHOW INDEX FROM porcion_historial WHERE Key_name LIKE 'idx_porcion_historial%';

SELECT '=== ÍNDICES EN TABLA: carta_lista ===' AS info;
SHOW INDEX FROM carta_lista WHERE Key_name LIKE 'idx_carta_lista%';


-- =====================================================
-- OPTIMIZAR TABLAS DESPUÉS DE CREAR ÍNDICES
-- =====================================================

SELECT '⏳ Optimizando tablas...' AS info;

OPTIMIZE TABLE porcion;
OPTIMIZE TABLE item_ingrediente;
OPTIMIZE TABLE porcion_historial;
OPTIMIZE TABLE carta_lista;

ANALYZE TABLE porcion;
ANALYZE TABLE item_ingrediente;
ANALYZE TABLE porcion_historial;
ANALYZE TABLE carta_lista;

SELECT '✓ Proceso completado exitosamente' AS info;


-- =====================================================
-- LIMPIAR PROCEDIMIENTO TEMPORAL
-- =====================================================

DROP PROCEDURE IF EXISTS create_index_if_not_exists;
