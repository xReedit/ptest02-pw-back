-- Corrige la búsqueda por nombre (devolvía 1/0) y devuelve idcliente al cliente. Aplicar en desarrollo y producción.
-- El cuerpo lleva ';' internos: con DELIMITER el archivo se aplica tal cual desde el cliente mysql.
-- scripts/apply-sql.js quita las lineas DELIMITER y devuelve '$$' a ';' antes de ejecutar.
DROP PROCEDURE IF EXISTS procedure_pwa_pedido_guardar;

DELIMITER $$
CREATE PROCEDURE `procedure_pwa_pedido_guardar`(
	IN xidorg int,
	IN xidsede int,
	IN xidusuario int,
	in xobj json
)
BEGIN
	DECLARE objDataPedido JSON;
	DECLARE objHeader JSON;
	DECLARE objSubtotales JSON;
	DECLARE objSubtotal JSON;
	DECLARE objSubtotal_r JSON;
	DECLARE objPedido JSON;
	DECLARE objTipoConsumo JSON;
	DECLARE objSecciones JSON;
	DECLARE objSeccion JSON;
	DECLARE objSitems JSON;
	DECLARE objSitem JSON;
	DECLARE objDelivery JSON;
	DECLARE objDeliveryDireccionCliente JSON;
	DECLARE objUsuario json; -- puede ser usuario o cliente -> isCliente
	DECLARE objFechaProgramada json;
	DECLARE objListIdsDescuento json;
	DECLARE objSubItems json;
	DECLARE objSubChild json;


	-- DECLARE objReturn JSON;
	DECLARE json_items int;
	DECLARE xindex int UNSIGNED DEFAULT 0;
	DECLARE rpt char(200) DEFAULT '';

	DECLARE lenthSubTotales int;
	DECLARE xIdPedido int;
	DECLARE xIdCliente int DEFAULT 0;
	DECLARE xisFromPwa int DEFAULT 0;
	DECLARE xisFromPwaDelivery int DEFAULT 0;
	DECLARE xisFlagCliente int DEFAULT 0; -- si el pedido lo hace el cliente
	DECLARE xisFlagIsReserva int DEFAULT 0; -- si es reservacion del cliente pwa

	-- print-server-detalle
	DECLARE objDataPrint JSON;
   	DECLARE xindexPrint int UNSIGNED DEFAULT 0;
	DECLARE xindeDescuento int UNSIGNED DEFAULT 0;
	DECLARE lenthPrint int UNSIGNED DEFAULT 0;
	DECLARE lenthDescuento int UNSIGNED DEFAULT 0;
	DECLARE objPrinter JSON;	
	DECLARE objDescuento JSON;
	-- print-server-detalle
	
	DECLARE xFecha char(30);
	DECLARE xHora char(30);
	DECLARE horaSys datetime;
	
	-- SET GLOBAL time_zone = 'America/Lima';
	-- SET time_zone = 'Europe/Helsinki'; 
	set horaSys = NOW();
	set xFecha = DATE_FORMAT(horaSys,'%d/%m/%Y');
	set xHora = time(DATE_FORMAT(horaSys,'%H:%i:%s'));
	-- set xFecha = DATE_FORMAT(now(),'%d/%m/%Y');
	-- set xHora = CURTIME() - 8;
	-- set xHora = time(DATE_FORMAT(CURTIME(),'%H:%i:%s'));


	SET objDataPedido = xobj->>'$.dataPedido';
	SET objListIdsDescuento = xobj->>'$.dataDescuento';
	

	set  @idCategoria = 1;

	
	SET @@SESSION.sql_mode= '';
	SET group_concat_max_len = 900000000;
	SET objPedido = objDataPedido->>'$.p_body.tipoconsumo';
	SET json_items = JSON_LENGTH(objPedido);
	set @idTipoConsumo = objPedido->>'$[0].idtipo_consumo';

	-- usuario - cliente 
	set objUsuario = xobj->>'$.dataUsuario';
	set @isCliente = objUsuario->>'$.isCliente';
	
	IF (objUsuario->>'$.idusuario' = 0) THEN
		set xidCliente = objUsuario->>'$.idcliente';
		set xisFromPwa = 1;
	END IF;

	
		
	-- get total y subototal 
	set objSubtotales = objDataPedido->>'$.p_subtotales';
	set lenthSubTotales = JSON_LENGTH(objSubtotales);
	set @impSubtotalPedido = objSubtotales->>'$[0].importe';
	set objSubtotal_r = JSON_EXTRACT(objSubtotales, CONCAT('$[', lenthSubTotales-1, ']'));
	set @impTotalPedido = objSubtotal_r->>'$.importe';

	SET objHeader = objDataPedido->>'$.p_header';

	-- set  @idCategoria = objHeader->>'$.idcategoria';

	set xisFlagCliente = objHeader->>'$.isCliente';
	set xisFlagIsReserva = objHeader->>'$.reservar';

	if ( xisFlagCliente = 0 ) then
		set xisFlagIsReserva = 0;
	else 
		-- si escanea codigo qr verifica y guarda el nombre -- nombre invitado
		if (objHeader->>'$.idregistra_scan_qr' > 0) then
			update cliente set nombres = objHeader->>'$.nom_us' where idcliente = xidCliente;
		end if;				
	end if;
	
	-- cliente del delivery -- guardar primero
	IF ( objHeader->>'$.delivery' = 1 ) THEN
		set xisFromPwa = 1; -- todos los deliverys vienen de la app 
		SET xisFromPwaDelivery = 1;
		SET objDelivery = objHeader->>'$.arrDatosDelivery';
	    -- SET xIdCliente = objDelivery->>'$.idcliente';
	    SET xIdCliente = (SELECT IF (objDelivery->>'$.idcliente' IS NULL = 1, 0, objDelivery->>'$.idcliente'));
	   
	   -- si el cliente no tiene dni y es nuevo busca si existe por nombre
	   if ( xIdCliente = 0  and objDelivery->>'$.ruc' = '' ) THEN
	   			-- buscamos por el nombre
	   			set xIdCliente = COALESCE((SELECT idcliente FROM cliente WHERE nombres = UPPER(objDelivery->>'$.nombre') AND idorg = xidorg ORDER BY idcliente DESC LIMIT 1), 0);
	   			
		END IF;
		
	   	-- guarda cliente
	   	set @fechaNac = COALESCE(xobj->>'$.f_nac', COALESCE(DATE_FORMAT(xobj->>'$.f_nac', '%d/%m/%Y'), xobj->>'$.f_nac'));
	   	IF ( xIdCliente = 0 ) THEN			   			   		
	   	
	   		INSERT INTO cliente (idorg, nombres, f_nac, f_registro, ruc, direccion, telefono, dni_num_verificador)
	   				values (xidorg, UPPER(objDelivery->>'$.nombre'), @fechaNac, xFecha, objDelivery->>'$.dni', objDelivery->>'$.direccion', objDelivery->>'$.telefono', objDelivery->>'$.num_verificador');
	   						
			-- ultimo idcliente 
	   		SET xIdCliente = (SELECT LAST_INSERT_ID());
	   	
	   	
	   		-- guardar en cliente_sede
	   		INSERT into cliente_sede (idcliente, idsede) values (xIdCliente, xidsede);
	   		
	   	ELSE
	   		-- GUARDA TELEFONO -- codigo de verificacion y fecha de cumple
	   		-- set @fechaNac = COALESCE(xobj->>'$.f_nac', COALESCE(DATE_FORMAT(xobj->>'$.f_nac', '%d/%m/%Y'), xobj->>'$.f_nac'));
	   		UPDATE cliente set telefono = objDelivery->>'$.telefono', dni_num_verificador = objDelivery->>'$.num_verificador', f_nac = @fechaNac WHERE idcliente = xIdCliente;
	   	
	   		-- verifica si existe el cliente en la sede, si el cliente envia delivery
	   		if not exists ( SELECT * from cliente_sede cs where idsede = xidsede and idcliente = xIdCliente ) THEN 
	   			INSERT into cliente_sede (idcliente, idsede) values (xIdCliente, xidsede);
	   		end if;
	   	
		END IF;
	
		IF (objDelivery->>'$.isFromComercio' = 1 ) THEN
			set objDeliveryDireccionCliente = objDelivery->>'$.direccionEnvioSelected';
			
			-- GUARDAR DIRECCION
			IF ( objDeliveryDireccionCliente->>'$.idcliente_pwa_direccion' = 0) THEN
				INSERT INTO cliente_pwa_direccion (idcliente, direccion,ciudad,provincia,departamento,pais,titulo,latitude,longitude, codigo, referencia)
				values (xIdCliente, 
						objDeliveryDireccionCliente->>'$.direccion',
						objDeliveryDireccionCliente->>'$.ciudad',
						objDeliveryDireccionCliente->>'$.provincia',
						objDeliveryDireccionCliente->>'$.departamento',
						objDeliveryDireccionCliente->>'$.pais',
						objDeliveryDireccionCliente->>'$.titulo',
						objDeliveryDireccionCliente->>'$.latitude',
						objDeliveryDireccionCliente->>'$.longitude',
						objDeliveryDireccionCliente->>'$.codigo',
						objDeliveryDireccionCliente->>'$.referencia');
			
			END IF;
		
		END IF;
		
	END IF;

	
	-- PEDIDO 
	-- correlativo dia y numpedido
	-- SET @numPedido = (select count(idpedido) + 1 as d1 from pedido where idsede=xidsede);
	-- SET @numPedido = (SELECT numpedido + 1 FROM pedido WHERE idsede = xidsede order by idpedido desc limit 1);
	SET @numPedido = 1;
	
	-- correlativo del dia -- 040221
	-- SET @correlativoDia = (SELECT LPAD(count(fecha) + 1,7, '0') AS d1 FROM pedido WHERE idsede=xidsede and STR_TO_DATE(fecha,'%d/%m/%Y') = curdate());
	set @correlativoDia = (select COALESCE((SELECT correlativo_dia from pedido_correlativos where idsede = xidsede and fecha = CURDATE()), 0) + 1);
	insert into pedido_correlativos (idsede, correlativo_dia, fecha)
		values (xidsede, @correlativoDia, curdate()) ON DUPLICATE KEY UPDATE correlativo_dia=@correlativoDia, fecha = curdate();
	
	

	SET @num_mesa = (SELECT IF (objHeader->>'$.m' IS NULL = 1, 0, if(CONVERT(objHeader->>'$.m', SIGNED INTEGER) < 0, 0, objHeader->>'$.m')));
	
	SET @num_mesa = (IF (@num_mesa='00', '0', @num_mesa));
	
	set objFechaProgramada = objHeader->>'$.arrDatosDelivery.tiempoEntregaProgamado';
	SET @fecha_programada = now();
	SET @flag_prorgramado = 0;

	if ( objFechaProgramada->>'$.modificado' = 'true') THEN
		set @fecha_programada = ( SELECT STR_TO_DATE(objFechaProgramada->>'$.date', '%d/%m/%Y %H:%i:%s') );
		SET @flag_prorgramado = 1;
	END IF;

	-- objHeader->>'$.idregistro_pago' = idpwa_pago_transaction; 
	-- esto viene con id solo si es delivery y pago con tarjeta, sino no viene
		
	INSERT INTO pedido (idorg, idsede, idusuario, idcliente, idtipo_consumo, idcategoria, idpwa_pago_transaction
		 				, fecha, hora, fecha_hora
		 				, nummesa, numpedido, correlativo_dia
		 				, reserva, referencia
			 			, total, total_r
			 			, solo_llevar, json_datos_delivery, is_from_client_pwa, pwa_is_delivery, flag_is_cliente 
			 			, flag_pedido_programado, fecha_hora_registro, idregistra_scan_qr
			 			)
				values (xidorg, xidsede, xidusuario, xIdCliente, @idTipoConsumo, @idCategoria, objHeader->>'$.idregistro_pago'
						, xFecha, xHora, @fecha_programada
						, @num_mesa, @numPedido, @correlativoDia
						, objHeader->>'$.reservar', objHeader->>'$.r'
						, format(@impSubtotalPedido, 2), format(@impTotalPedido, 2)
						, objHeader->>'$.solo_llevar', objDataPedido, xisFromPwa, xisFromPwaDelivery, xisFlagCliente
						, @flag_prorgramado, now(), objHeader->>'$.idregistra_scan_qr'
					);
					
					
	-- objHeader->>'$.arrDatosDelivery' -> change x -> objDataPedido				
	
	-- ULTIMO IDPEDIDO INSERT					
	SET xIdPedido = (SELECT LAST_INSERT_ID());	

	-- >> 14022025 - guardar en pedidos_json
	SET @idsede_holding = COALESCE(
	    JSON_EXTRACT(objDataPedido, '$.p_sede.holding.idsede_holding'),	    
	    0  -- default value if path doesn't exist
	);

	INSERT INTO pedido_json (idsede, idsede_holding, fecha, pedido_json, idpedido) values (xidsede, @idsede_holding, now(), objDataPedido, xIdPedido);
	-- >> pedido_json

	-- 291220
	-- actualizamos el numpedido colocando el ultimo idpedido
	update pedido set numpedido = xIdPedido where idpedido = xIdPedido;


	-- SUB TOTALES
	SET @sqlTotales = '';
	SET @subTotalIndex = 0;
	WHILE @subTotalIndex < lenthSubTotales DO
		set objSubtotal = JSON_EXTRACT(objSubtotales, CONCAT('$[', @subTotalIndex, ']'));
		set @sqlTotales = concat( @sqlTotales, '(',xIdPedido ,', '
												  ,xidorg ,', '
												  ,xidsede ,', '
												  ,objSubtotal->'$.descripcion' ,', '
												  ,format(objSubtotal->>'$.importe', 2) ,'),');

		SET @subTotalIndex := @subTotalIndex + 1;
	END WHILE;
	
		
	-- PEDIDO DETALLE
	-- tipo consumo
	set @sqlInsertPd = '';
	WHILE xindex < json_items DO
		set objTipoConsumo = JSON_EXTRACT(objPedido, CONCAT('$[', xindex, ']'));
		set objSecciones = objTipoConsumo->>'$.secciones';
		set @idTipoConsumo = objTipoConsumo->>'$.idtipo_consumo';
		set @lenghSeccion = JSON_LENGTH(objSecciones);
		set @secIdnex = 0;
	
		-- secciones
		-- set @sqlInsertPd = '';
		WHILE @secIdnex < @lenghSeccion DO
			set objSeccion = JSON_EXTRACT(objSecciones, CONCAT('$[', @secIdnex, ']'));
			set objSitems = objSeccion->>'$.items';
			set @lenghItem = JSON_LENGTH(objSitems);
			set @ItemIdnex = 0;
		
			-- items 			
			WHILE @ItemIdnex < @lenghItem DO
				set objSitem = JSON_EXTRACT(objSitems, CONCAT('$[', @ItemIdnex, ']'));
				set @desItem = TRIM(objSitem->>'$.des');
				if ( objSitem->>'$.indicaciones' != '' ) THEN
					set @desItem = CONCAT(@desItem,' (', objSitem->>'$.indicaciones' ,')');
				END IF;				
				-- set @desItem = convert(@desItem USING UTF8);
				-- set @subitemJson = (select if(JSON_KEYS(objSitem,'$.subitems_view') = 'NULL', 0, json_extract(objSitem,'$.subitems_view')));
				set objSubItems = objSitem->'$.subitems_view';
				set @isObSubItemIsNull = JSON_TYPE(objSubItems);
				set @isObSubItemIsNull = (SELECT if ( @isObSubItemIsNull = 'NULL', 0, COALESCE(JSON_LENGTH(objSubItems), 0)));
				-- set @isObSubItemIsNull = COALESCE(JSON_LENGTH(objSubItems), 0);
			
				-- 29/07/2020 SI TIENE SUBITEMS ENTONCES EN EL DETALLE DESGLOSA
				-- ESTO PARA CONTROL DE PEDIDOS 
				-- IF ( @isObSubItemIsNull = 'NULL' ) THEN
				
				-- erro al selccionar cantidad 2 del mismo item pero solo un subitem -- error guarda solo uno el del subitem
				-- obtenemos la cantidad total del item seleccionado, sin importar los subitems
				
				set @cantItemSeleccionda = objSitem->'$.cantidad_seleccionada';
				set @PrecioTotalItemSeleccionda = objSitem->'$.precio_total';
				
				-- SI ES NULL O ARRAY VACIO = 0 SINO TIENE SUBITEMS
				IF ( @isObSubItemIsNull = 0 ) THEN
					
					-- subitems vacio sino vota error null
					set objSubItems = '[]';
				
					set @sqlInsertPd = concat( @sqlInsertPd, '(',xIdPedido ,', '
													,@idTipoConsumo ,', '
													,objSitem->'$.idcategoria' ,', '-- ,@idCategoria ,', '
													,objSitem->'$.idcarta_lista' ,', '
													,objSitem->>'$.iditem' ,', "'
													,objSitem->>'$.idseccion' ,'", '
													,objSitem->'$.cantidad_seleccionada' ,', ' 
													,objSitem->'$.cantidad_seleccionada' ,', '
													-- ,format(objSitem->'$.precio', 2) ,', '
													-- ,format(objSitem->'$.precio_print', 2) ,', '
													-- ,format(objSitem->'$.precio_print', 2) ,', "'
													,replace(format(objSitem->'$.precio', 2), ',', '') ,', '
													,replace(format(objSitem->'$.precio_print', 2), ',', '') ,', '
													,replace(format(objSitem->'$.precio_print', 2), ',', '') ,', "'
													,@desItem ,'", '
													,objSitem->>'$.isalmacen' ,', '
													,objSitem->>'$.procede', ", '"
													,objSubItems, "', "
													,0,', '
													,'1,"",""),');  
				
				ELSE
				
					set @lenghSubItem = JSON_LENGTH(objSubItems);
					set @ItemIdnexSubItem = 0;
					set @pUnitarioItem = objSitem->>'$.precio';	
				
					if ( @lenghSubItem > 0 ) then
						
					
						WHILE @ItemIdnexSubItem < @lenghSubItem DO
							set objSubChild = JSON_EXTRACT(objSubItems, CONCAT('$[', @ItemIdnexSubItem, ']'));
							set @pUnitario = objSubChild->>'$.precio';
							set @cantSelectSubChild = objSubChild->>'$.cantidad_seleccionada';
							set @desItem = CONCAT(objSitem->>'$.des', ' (', objSubChild->>'$.des' ,')');
							set @iditem_subitem = objSubChild->>'$.subitems[0].iditem_subitem';
						
							if ( @pUnitario = 0 ) THEN						
								set @pUnitario = @pUnitarioItem;
								set @pTotal = @pUnitario * @cantSelectSubChild;
							else 
								set @pUnitario = objSubChild->>'$.precio' / @cantSelectSubChild +  @pUnitarioItem;
								set @pTotal = @pUnitario * @cantSelectSubChild;
							END IF;
						
							set objSitem = (SELECT JSON_REPLACE(objSitem, '$.cantidad_seleccionada', @cantSelectSubChild));
							set objSitem = (SELECT JSON_REPLACE(objSitem, '$.precio', @pUnitario));
							set objSitem = (SELECT JSON_REPLACE(objSitem, '$.precio_print', @pTotal));		
						
							-- resta la cantidad de subitems con la cantidad total
							set @cantItemSeleccionda = @cantItemSeleccionda - @cantSelectSubChild;
						
							-- insertamos
							set @sqlInsertPd = concat( @sqlInsertPd, '(',xIdPedido ,', '
														,@idTipoConsumo ,', '
														,objSitem->'$.idcategoria' ,', '-- ,@idCategoria ,', '
														,objSitem->'$.idcarta_lista' ,', '
														,objSitem->>'$.iditem' ,', "'
														,objSitem->>'$.idseccion' ,'", '
														,objSitem->'$.cantidad_seleccionada' ,', ' 
														,objSitem->'$.cantidad_seleccionada' ,', '
														-- ,format(objSitem->'$.precio', 2) ,', '
														-- ,format(objSitem->'$.precio_print', 2) ,', '
														-- ,format(objSitem->'$.precio_print', 2) ,', "'
														,replace(format(objSitem->'$.precio', 2), ',', '') ,', '
													   ,replace(format(objSitem->'$.precio_print', 2), ',', '') ,', '
													   ,replace(format(objSitem->'$.precio_print', 2), ',', '') ,', "'
														,@desItem ,'", '
														,objSitem->>'$.isalmacen' ,', '
														,objSitem->>'$.procede', ", '"
														,objSubItems, "', "
														,@iditem_subitem ,', '
														,'1,"",""),');  
							
							-- restar el precio total -- esto para guardar si hay diferencia en la cantidad 
							set @PrecioTotalItemSeleccionda = @PrecioTotalItemSeleccionda - @pTotal; 
													
							SET @ItemIdnexSubItem := @ItemIdnexSubItem + 1;
						END WHILE;
					
						-- si los subitems son menores a la cantidad total seleccionada entonces guarda la diferencia
						if (@cantItemSeleccionda > 0) then
							set @desItem = TRIM(objSitem->>'$.des');
							set @sqlInsertPd = concat( @sqlInsertPd, '(',xIdPedido ,', '
													,@idTipoConsumo ,', '
													,objSitem->'$.idcategoria' ,', '-- ,@idCategoria ,', '
													,objSitem->'$.idcarta_lista' ,', '
													,objSitem->>'$.iditem' ,', "'
													,objSitem->>'$.idseccion' ,'", '
													,@cantItemSeleccionda ,', ' 
													,@cantItemSeleccionda ,', '
													-- ,format(objSitem->'$.precio', 2) ,', '
													-- ,format(@PrecioTotalItemSeleccionda, 2) ,', '
													-- ,format(@PrecioTotalItemSeleccionda, 2) ,', "'
													,replace(format(objSitem->'$.precio', 2), ',', '') ,', '
													,replace(format(@PrecioTotalItemSeleccionda, 2), ',', '') ,', '
													,replace(format(@PrecioTotalItemSeleccionda, 2), ',', '') ,', "'
													,@desItem ,'", '
													,objSitem->>'$.isalmacen' ,', '
													,objSitem->>'$.procede', ", '"
													,objSubItems, "', "
													,0 ,', '
													,'1,"",""),');  
						end if;
					
					else 
						
						-- 301020
						-- si @ItemIdnexSubItem es cero entonces no paso guardando
						-- aseguramos y guardamos toda la cantidad del item seleccionado
						
						set @sqlInsertPd = concat( @sqlInsertPd, '(',xIdPedido ,', '
													,@idTipoConsumo ,', '
													,objSitem->'$.idcategoria' ,', '-- ,@idCategoria ,', '
													,objSitem->'$.idcarta_lista' ,', '
													,objSitem->>'$.iditem' ,', "'
													,objSitem->>'$.idseccion' ,'", '
													,objSitem->'$.cantidad_seleccionada' ,', ' 
													,objSitem->'$.cantidad_seleccionada' ,', '
													-- ,format(objSitem->'$.precio', 2) ,', '
													-- ,format(objSitem->'$.precio_print', 2) ,', '
													-- ,format(objSitem->'$.precio_print', 2) ,', "'
													,replace(format(objSitem->'$.precio', 2), ',', '') ,', '
												   ,replace(format(objSitem->'$.precio_print', 2), ',', '') ,', '
													,replace(format(objSitem->'$.precio_print', 2), ',', '') ,', "'
													,@desItem ,'", '
													,objSitem->>'$.isalmacen' ,', '
													,objSitem->>'$.procede', ", '"
													,objSubItems, "', "
													,0 ,', '
													,'1,"",""),');
					
						/*-- si los subitems son menores a la cantidad total seleccionada entonces guarda la diferencia
						
						set @cantItemSeleccionda = @cantItemSeleccionda - @ItemIdnexSubItem;  
						if (@cantItemSeleccionda > 0) then						
							set @sqlInsertPd = concat( @sqlInsertPd, '(',xIdPedido ,', '
														,@idTipoConsumo ,', '
														,@idCategoria ,', '
														,objSitem->'$.idcarta_lista' ,', '
														,objSitem->>'$.iditem' ,', "'
														,objSitem->>'$.idseccion' ,'", '
														,@cantItemSeleccionda ,', ' 
														,@cantItemSeleccionda ,', '
														,format(@PrecioTotalItemSeleccionda, 2) ,', '
														,format(@PrecioTotalItemSeleccionda, 2) ,', '
														,format(@PrecioTotalItemSeleccionda, 2) ,', "'
														,@desItem ,'", '
														,objSitem->>'$.isalmacen' ,', '
														,objSitem->>'$.procede', ", '"
														,objSubItems, "', "
														,'1,"",""),');  
						
						end if;*/
					
					end if;
												
				END IF;
							
				SET @ItemIdnex := @ItemIdnex + 1;
			END WHILE;
					
			SET @secIdnex := @secIdnex + 1;
		END WHILE;
		
		
		SET xindex := xindex + 1;
	END WHILE;

	-- detalle pedido
	-- el campo pwa indica que viene de aplicacion y el trigger para descontar stock de pedido_detalle no se ejecuta 
	-- set @sqlInsertPd = LEFT(trim(@sqlInsertPd),length(trim(@sqlInsertPd))-1);	
	-- set @sqlInsertPd = REPLACE(@sqlInsertPd, '),', ')');
	set @sqlInsertPd = SUBSTRING(@sqlInsertPd, 1, CHAR_LENGTH(trim(@sqlInsertPd))-1);
	set @sqlInsertPd = CONCAT('insert into pedido_detalle (idpedido,idtipo_consumo,idcategoria,idcarta_lista,iditem,idseccion,cantidad,cantidad_r,punitario,ptotal,ptotal_r,descripcion,procede,procede_tabla, subitems, iditem_subitem, pwa, despachado_hora, despachado_tiempo) values ', @sqlInsertPd, ';');	
	PREPARE stmt_array_callback FROM @sqlInsertPd;
    EXECUTE stmt_array_callback;
    DEALLOCATE PREPARE stmt_array_callback;
   
   	-- subtotales
  	set @sqlTotales = LEFT(@sqlTotales,length(@sqlTotales)-1);
	set @sqlTotales = CONCAT('insert into pedido_subtotales (idpedido, idorg, idsede, descripcion, importe) values ', @sqlTotales, ';');
	PREPARE stmt_array_callback_sub FROM @sqlTotales;
    EXECUTE stmt_array_callback_sub;
    DEALLOCATE PREPARE stmt_array_callback_sub;
   
   
   	-- GUARDAR EN PRINT-SERVER-DETALLE
	SET objDataPrint = xobj->>'$.dataPrint';
	SET lenthPrint = JSON_LENGTH(objDataPrint);

	SET @@SESSION.sql_mode= '';
	SET group_concat_max_len = 90000;

	-- last id print_detalle
	set @lastIdPrintD = (select idprint_server_detalle from print_server_detalle order by idprint_server_detalle desc limit 1);
		
	-- set @objReturn = JSON_OBJECT('data',null);
	set @objReturn = JSON_ARRAY();
	set @sqlPrintDetalle = '';
	WHILE xindexPrint < lenthPrint DO
		set objPrinter = JSON_EXTRACT(objDataPrint, CONCAT('$[', xindexPrint, ']'));
		-- ageragar correlativo dia y numpedido
		set objPrinter = (SELECT JSON_REPLACE(objPrinter, '$.Array_enca.correlativo_dia', @correlativoDia));
		set objPrinter = (SELECT JSON_REPLACE(objPrinter, '$.Array_enca.num_pedido', @numPedido));
		set objPrinter = (SELECT JSON_INSERT(objPrinter, '$.Array_enca.idpedido', xIdPedido));
						
		set @sqlPrintDetalle = concat( @sqlPrintDetalle, '(',xidorg ,', '
													,xidsede ,', '
													,xidusuario ,', '
													,xisFlagIsReserva,', '
													,1 ,', "'
													,'comanda' ,'", "'
													,xFecha ,'", "'
													,xHora ,'", '
													,"'", objPrinter, "'),");
	
		set @lastIdPrintD := @lastIdPrintD + 1;
		set @objChildReturn = JSON_OBJECT('idprint_server_detalle', @lastIdPrintD, 'hora', xHora, 'nom_documento', 'comanda', 'descripcion_doc', 'comanda', 'detalle_json', objPrinter);												
		
		set @objReturn = JSON_ARRAY_APPEND(@objReturn , '$', JSON_OBJECT('print', cast(@objChildReturn as json)));
		
		SET xindexPrint := xindexPrint + 1;
	END WHILE;

	IF ( @sqlPrintDetalle != '' ) THEN
		set @sqlPrintDetalle = SUBSTRING(@sqlPrintDetalle, 1, CHAR_LENGTH(@sqlPrintDetalle)-1);
		set @sqlPrintDetalle = CONCAT('insert into print_server_detalle (idorg, idsede, idusuario, isreserva, idprint_server_estructura, descripcion_doc, fecha, hora, detalle_json) values ',@sqlPrintDetalle, '; ');
		PREPARE stmt_array_callback_print FROM @sqlPrintDetalle;
	    EXECUTE stmt_array_callback_print;
    	DEALLOCATE PREPARE stmt_array_callback_print;
    END IF;
   
   
   -- List iddescuentos -- restar   
	SET lenthDescuento = JSON_LENGTH(objListIdsDescuento);	
	WHILE xindeDescuento < lenthDescuento DO
		set objDescuento = JSON_EXTRACT(objListIdsDescuento, CONCAT('$[', xindeDescuento, ']'));
		update sede_descuento set numero_pedidos = numero_pedidos - 1 where idsede_descuento = objDescuento->>'$.id';
		SET xindeDescuento := xindeDescuento + 1;
	END WHILE;
	
   
   -- respuesta , @sqlInsertPd 
	SELECT cast(@objReturn as json) as data, xIdPedido as idpedido, xIdCliente as idcliente, @iditem_subitem;
END$$
DELIMITER ;