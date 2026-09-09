-- 2026-09-08 · App de repartidores 2.0 (apiRepartidorV2.js). Solo objetos NUEVOS: no altera tablas ni SP existentes.
-- Ejecutar en producción antes de desplegar el backend con routes/routesRepartidorV2.js.
-- Referencia: pwa-app-repartidor-new/docs/superpowers/specs/2026-09-08-propuesta-asignacion-pedidos.md

-- 1) Log de eventos por repartidor: responde "qué pasó" cuando un repartidor reporta un problema
CREATE TABLE IF NOT EXISTS repartidor_evento_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idrepartidor INT NOT NULL,
  idpedido INT NULL,
  evento VARCHAR(40) NOT NULL,          -- oferta_enviada, oferta_renovada, oferta_quitada, aceptado, aceptar_rechazado, asignado_manual, entregado, liberado, liberado_pedido, online, offline, socket_conectado, socket_desconectado
  canal VARCHAR(20) NULL,               -- http, socket, loop
  detalle JSON NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rep_fecha (idrepartidor, fecha),
  KEY idx_pedido (idpedido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) Entregar (v2): marca el pedido como entregado y libera al repartidor si no le quedan pedidos activos.
--    Copia de procedure_pwa_delivery_pedido_entregado (que NO se toca; la app anterior la sigue usando).
DROP PROCEDURE IF EXISTS procedure_pwa_delivery_pedido_entregado_v2;
DELIMITER $$
CREATE PROCEDURE procedure_pwa_delivery_pedido_entregado_v2(IN xobj JSON)
BEGIN
  DECLARE xIdCliente INT;
  DECLARE xIdRepartidor INT;
  DECLARE xIdPedido INT;
  DECLARE xActivos INT;

  SET xIdPedido = xobj->>'$.idpedido';
  SET xIdRepartidor = xobj->>'$.idrepartidor';

  -- la app 2.0 no manda idcliente ni operacion: se toman del pedido / vacío (las columnas son NOT NULL)
  SET xIdCliente = COALESCE(NULLIF(xobj->>'$.idcliente', 'null'), (SELECT idcliente FROM pedido WHERE idpedido = xIdPedido));

  SET @isComercioAfiliado = (SELECT pwa_comercio_afiliado FROM sede WHERE idsede = xobj->>'$.idsede');

  -- idempotente: entregar dos veces no duplica el registro
  IF NOT EXISTS (SELECT 1 FROM repartidor_pedido_entregado WHERE idpedido = xIdPedido AND idrepartidor = xIdRepartidor)
     AND EXISTS (SELECT 1 FROM pedido WHERE idpedido = xIdPedido AND idrepartidor = xIdRepartidor) THEN
    INSERT INTO repartidor_pedido_entregado ( idrepartidor, idpedido, idcliente, idsede, comercio_afiliado, fecha, operacion )
    VALUES ( xIdRepartidor, xIdPedido, xIdCliente, COALESCE(xobj->>'$.idsede', (SELECT idsede FROM pedido WHERE idpedido = xIdPedido)),
             @isComercioAfiliado, NOW(), COALESCE(xobj->'$.operacion', JSON_OBJECT()) );
  END IF;

  -- v1 solo guardaba el tiempo; el estado lo cambiaba un socket que se perdía. Aquí queda todo en la misma llamada.
  -- solo si el pedido es de este repartidor (el endpoint ya lo valida; aquí se refuerza)
  UPDATE pedido
     SET pwa_delivery_tiempo_atendido = TIMESTAMPDIFF(MINUTE, fecha_hora, NOW()),
         pwa_delivery_status = '4',
         pwa_estado = 'E'
   WHERE idpedido = xIdPedido AND idrepartidor = xIdRepartidor;

  UPDATE cliente SET pwa_last_pedido_calificar = xIdPedido WHERE idcliente = xIdCliente;

  UPDATE repartidor
     SET pedido_por_aceptar = JSON_REPLACE(pedido_por_aceptar, '$.cantidad_entregados', COALESCE(pedido_por_aceptar->>'$.cantidad_entregados', 0) + 1)
   WHERE idrepartidor = xIdRepartidor AND pedido_por_aceptar IS NOT NULL;

  IF ( COALESCE(xobj->>'$.time_line', '0') NOT IN ('0', 'null') ) THEN
    INSERT INTO pedido_time_line_entrega (idpedido, time_line) VALUES (xIdPedido, xobj->>'$.time_line')
    ON DUPLICATE KEY UPDATE time_line = xobj->>'$.time_line';
  END IF;

  -- libera al repartidor si ya no tiene pedidos activos (pedidos de más de 2 días no cuentan: basura de versiones anteriores)
  SET xActivos = (SELECT COUNT(*) FROM pedido
                   WHERE idrepartidor = xIdRepartidor AND estado != 3
                     AND COALESCE(pwa_delivery_status, '0') NOT IN ('4', '5')
                     AND fecha_hora >= NOW() - INTERVAL 2 DAY);
  IF xActivos = 0 THEN
    UPDATE repartidor
       SET ocupado = 0, pedido_por_aceptar = NULL, pedido_paso_va = 0, flag_paso_pedido = 0, solicita_liberar_pedido = 0
     WHERE idrepartidor = xIdRepartidor;
  END IF;

  SELECT @isComercioAfiliado AS comercio_afiliado, xActivos AS pedidos_activos;
END$$
DELIMITER ;

-- 3) Saneamiento (OPCIONAL, revisar antes): repartidores globales que quedaron ocupados sin pedidos activos.
--    Primero mirar cuántos son:
--    SELECT r.idrepartidor, r.nombre, r.online, r.ocupado, r.pedido_por_aceptar->>'$.pedidos' pedidos
--      FROM repartidor r
--     WHERE r.idsede_suscrito IS NULL AND (r.ocupado = 1 OR r.pedido_por_aceptar IS NOT NULL)
--       AND NOT EXISTS (SELECT 1 FROM pedido p WHERE p.idrepartidor = r.idrepartidor AND p.estado != 3
--                        AND COALESCE(p.pwa_delivery_status,'0') NOT IN ('4','5') AND p.fecha_hora >= NOW() - INTERVAL 2 DAY);
--    Y si la lista es la esperada, liberarlos:
--    UPDATE repartidor r
--       SET r.ocupado = 0, r.pedido_por_aceptar = NULL, r.pedido_paso_va = 0, r.flag_paso_pedido = 0, r.solicita_liberar_pedido = 0
--     WHERE r.idsede_suscrito IS NULL AND (r.ocupado = 1 OR r.pedido_por_aceptar IS NOT NULL)
--       AND NOT EXISTS (SELECT 1 FROM pedido p WHERE p.idrepartidor = r.idrepartidor AND p.estado != 3
--                        AND COALESCE(p.pwa_delivery_status,'0') NOT IN ('4','5') AND p.fecha_hora >= NOW() - INTERVAL 2 DAY);
