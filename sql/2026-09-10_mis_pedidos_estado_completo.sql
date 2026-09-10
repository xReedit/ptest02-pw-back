-- Mis pedidos devuelve tambien el estado completo del pedido (pwa_estado, fecha_hora, programado)
-- y la ultima posicion del repartidor, para pintar el seguimiento sin otra consulta.
DROP PROCEDURE IF EXISTS procedure_pwa_delivery_mis_pedidos;
CREATE PROCEDURE `procedure_pwa_delivery_mis_pedidos`(
	in xidcliente int
)
BEGIN

select p.idpedido, p.total, p.total_r, p.pwa_delivery_status, p.pwa_estado, p.fecha_hora, p.flag_pedido_programado, p.fecha, p.hora, p.json_datos_delivery->>'$.p_header.arrDatosDelivery' as arrDatosDelivery, p.json_datos_delivery->>'$.p_header.arrDatosDelivery.direccionEnvioSelected' as direccionEnvioSelected
	, s.idorg, s.idsede, p.idcliente, s.nombre, s.ciudad, s.direccion,s.latitude,s.longitude
	,r.idrepartidor ,r.nombre as nom_repartidor, r.apellido as ap_repartidor, r.telefono as telefono_repartidor, r.position_now
	,s.pwa_delivery_servicio_propio
from pedido p
	inner join sede s on p.idsede = s.idsede
	LEFT join repartidor as r on p.idrepartidor = r.idrepartidor
where p.idcliente = xidcliente order by p.idpedido desc limit 5;

END
