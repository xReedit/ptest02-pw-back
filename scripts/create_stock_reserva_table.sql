-- =====================================================
-- SCRIPT: Crear tabla stock_reserva
-- Sistema de reservas de stock simplificado
-- Fecha: 2026-02-01
-- =====================================================

-- Tabla para almacenar reservas temporales de stock
-- Las reservas se acumulan por recurso (porcion/producto/carta_lista) + sede
-- No requiere tracking de sesiones

CREATE TABLE IF NOT EXISTS stock_reserva (
    idstock_reserva INT AUTO_INCREMENT PRIMARY KEY,
    idsede INT NOT NULL,
    
    -- Solo UN campo tendrá valor según el tipo de recurso
    idporcion INT NULL,
    idproducto_stock INT NULL,
    idcarta_lista INT NULL,
    
    -- Cantidad total reservada para este recurso (siempre >= 0)
    cantidad DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- Control de tiempo para cleanup automático
    fecha_ultima_modificacion DATETIME DEFAULT NOW() ON UPDATE NOW(),
    
    -- Constraints únicos: solo puede existir una reserva por recurso+sede
    UNIQUE KEY uk_porcion_sede (idsede, idporcion),
    UNIQUE KEY uk_producto_sede (idsede, idproducto_stock),
    UNIQUE KEY uk_carta_sede (idsede, idcarta_lista),
    
    -- Índice para cleanup eficiente
    INDEX idx_modificacion (fecha_ultima_modificacion),
    INDEX idx_sede (idsede)
    
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- EJEMPLO DE USO:
-- =====================================================
-- 
-- Mozo agrega hamburguesa (idporcion=5, cantidad=2):
--   INSERT INTO stock_reserva (idsede, idporcion, cantidad) VALUES (1, 5, 2)
--   ON DUPLICATE KEY UPDATE cantidad = cantidad + 2;
--
-- Mozo quita 1 hamburguesa:
--   UPDATE stock_reserva SET cantidad = GREATEST(0, cantidad - 1) 
--   WHERE idsede = 1 AND idporcion = 5;
--
-- Mozo confirma pedido (descuenta de stock real):
--   UPDATE porcion SET stock = stock - 2 WHERE idporcion = 5 AND idsede = 1;
--   UPDATE stock_reserva SET cantidad = GREATEST(0, cantidad - 2) 
--   WHERE idsede = 1 AND idporcion = 5;
--
-- Consultar stock disponible:
--   SELECT p.stock - COALESCE(sr.cantidad, 0) AS stock_disponible
--   FROM porcion p
--   LEFT JOIN stock_reserva sr ON sr.idporcion = p.idporcion AND sr.idsede = p.idsede
--   WHERE p.idporcion = 5 AND p.idsede = 1;
--
-- Cleanup nocturno (3:00 AM):
--   UPDATE stock_reserva SET cantidad = 0
--   WHERE fecha_ultima_modificacion < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
--   AND cantidad > 0;
-- =====================================================
