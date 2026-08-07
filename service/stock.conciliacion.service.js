/**
 * stock.conciliacion.service.js  (Capa 2)
 *
 * Concilia el stock contra la fuente de verdad (pedido/pedido_detalle) y corrige
 * las diferencias con un movimiento auditado 'AJUSTE CIERRE' (idtipo 10).
 *
 * Ecuación por porción/producto, por ventana de watermarks:
 *   esperado   = consumo según pedidos guardados (recetas + subitems + almacén directo)
 *   registrado = Σ VENTA − Σ VENTA DEVOLUCION − Σ RECUPERA   (flujos de venta del historial)
 *   ajuste     = −(esperado − registrado)
 *
 * Compara FLUJOS, no niveles: compras, entradas/salidas manuales y sets del monitor
 * no están en ninguno de los dos lados, así que no la contaminan.
 *
 * Garantías:
 *  - Watermarks por sede (stock_conciliacion_control): nunca se concilia dos veces la misma ventana.
 *  - Primera corrida por sede = baseline (fija watermarks, NO ajusta historia previa).
 *  - Solo corre con la sede "quieta" (sin movimientos recientes) => sin pedidos a medio componer.
 *  - Porción con SET del monitor (idtipo 9) en la ventana => no se ajusta (manual_set).
 *  - |ajuste| > MAX_AJUSTE => no se aplica (excede_limite), revisión humana.
 *  - Error de parseo => corrida en modo reporte (parse_error), sin ajustes.
 *  - Todo en UNA transacción (ajustes + auditoría + watermarks).
 *
 * Plan: test/CONCILIACION-STOCK-CIERRE-PLAN.md
 */

const { sequelize, Sequelize } = require('../config/database');
const { QueryTypes } = Sequelize;
const logger = require('../utilitarios/logger');
const errorManager = require('./error.manager');
const StockPorcionService = require('./stock.porcion.service');
const { registrarMovimientoProducto } = require('./producto.movements.service');

const CONFIG = {
    QUIET_MINUTOS_CIERRE: 3,   // tras el cierre de caja la venta ya paro: guard corto para conciliar YA
    QUIET_MINUTOS_FALLBACK: 20,// respaldo para sedes que no hicieron cierre: exige valle largo
    MAX_AJUSTE_ABS: 50,        // ponytail: tope de seguridad; mas que esto huele a bug, no se auto-ajusta
    ESTADO_ANULADO: 4,         // pedido.estado = 4 => anulado
    MAX_SEDES_POR_TICK: 15     // escala (350+ locales): reparte la carga entre corridas del cron
};

/**
 * Switch global via .env: CONCILIACION_STOCK=0 desactiva TODA la conciliacion
 * (cron, endpoint sincrono del cierre y llamadas manuales). Activa por defecto.
 * Se lee en cada corrida para que un cambio de .env + restart baste.
 */
const conciliacionActiva = () => process.env.CONCILIACION_STOCK !== '0';

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (v) => {
    const n = parseFloat((v === 0 ? '0' : (v || '')).toString().replace(',', '.'));
    return isNaN(n) ? 0 : n;
};

// ============================== helpers de datos ==============================

async function getControl(idsede, transaction) {
    const [row] = await sequelize.query(
        'SELECT * FROM stock_conciliacion_control WHERE idsede = ? FOR UPDATE',
        { replacements: [idsede], type: QueryTypes.SELECT, transaction }
    );
    return row || null;
}

async function getMaximos(idsede, transaction) {
    const [p] = await sequelize.query(
        'SELECT COALESCE(MAX(idpedido),0) mx FROM pedido WHERE idsede = ?',
        { replacements: [idsede], type: QueryTypes.SELECT, transaction });
    const [ph] = await sequelize.query(
        'SELECT COALESCE(MAX(idporcion_historial),0) mx FROM porcion_historial WHERE idsede = ?',
        { replacements: [idsede], type: QueryTypes.SELECT, transaction });
    const [pr] = await sequelize.query(
        'SELECT COALESCE(MAX(idproducto_historial),0) mx FROM producto_historial WHERE idsede = ?',
        { replacements: [idsede], type: QueryTypes.SELECT, transaction });
    return { pedido: p.mx, porcionHist: ph.mx, productoHist: pr.mx };
}

async function sedeQuieta(idsede, wmPorcionHist, quietMinutos, transaction) {
    // porcion_historial.fecha es char(30) con formato ISO ('YYYY-MM-DD HH:MM:SS' en filas
    // nuevas): la comparacion lexicografica contra un cutoff ISO es correcta. El rango por
    // PK (> watermark) acota el scan a la ventana pendiente, no al historico de la sede.
    // pedido.fecha_hora (datetime, indexado) cubre ventas guardadas de solo-productos.
    const minutos = parseInt(quietMinutos) || CONFIG.QUIET_MINUTOS_FALLBACK;
    const [r] = await sequelize.query(`
        SELECT (
            (SELECT COUNT(*) FROM porcion_historial
                WHERE idporcion_historial > ? AND idsede = ?
                  AND fecha >= DATE_FORMAT(NOW() - INTERVAL ${minutos} MINUTE, '%Y-%m-%d %H:%i:%s'))
          + (SELECT COUNT(*) FROM pedido
                WHERE fecha_hora >= NOW() - INTERVAL ${minutos} MINUTE AND idsede = ?)
        ) AS recientes
    `, { replacements: [wmPorcionHist, idsede, idsede], type: QueryTypes.SELECT, transaction });
    return (r?.recientes || 0) === 0;
}

// ============================== lado ESPERADO ==============================

/** Suma `cant` a `mapa[id]` */
const acumular = (mapa, id, cant) => {
    const key = parseInt(id);
    if (!key || key <= 0 || !cant) return;
    mapa[key] = round2((mapa[key] || 0) + cant);
};

const validarDescuenta = (d) => {
    const p = parseFloat(d);
    return (!isNaN(p) && isFinite(p) && p > 0) ? p : 1;
};

/**
 * Expande recetas (item_ingrediente directo + subrecetas) para un set de items.
 * Devuelve { [iditem]: [{idporcion, idproducto_stock, cantidad}] }
 */
async function expandirRecetas(iditems, transaction) {
    if (!iditems.length) return {};
    const directas = await sequelize.query(`
        SELECT ii.iditem, ii.idporcion, ii.idproducto_stock, ii.cantidad
        FROM item_ingrediente ii
        WHERE ii.iditem IN (:ids) AND ii.estado = 0 AND ii.viene_de != '3'
            AND (ii.idporcion > 0 OR ii.idproducto_stock > 0)
    `, { replacements: { ids: iditems }, type: QueryTypes.SELECT, transaction });

    const deSubrecetas = await sequelize.query(`
        SELECT ii.iditem, si.idporcion, si.idproducto_stock, (ii.cantidad * si.cantidad) cantidad
        FROM item_ingrediente ii
            INNER JOIN subreceta_ingrediente si ON si.idsubreceta = ii.idsubreceta
        WHERE ii.iditem IN (:ids) AND ii.estado = 0 AND ii.viene_de = '3' AND ii.idsubreceta > 0
            AND si.estado = 0 AND (si.idporcion > 0 OR si.idproducto_stock > 0)
    `, { replacements: { ids: iditems }, type: QueryTypes.SELECT, transaction });

    const porItem = {};
    [...directas, ...deSubrecetas].forEach(r => {
        (porItem[r.iditem] = porItem[r.iditem] || []).push(r);
    });
    return porItem;
}

/** Ingredientes de subrecetas usadas como subitem: { [idsubreceta]: [{idporcion, idproducto_stock, cantidad}] } */
async function expandirSubrecetas(ids, transaction) {
    if (!ids.length) return {};
    const rows = await sequelize.query(`
        SELECT idsubreceta, idporcion, idproducto_stock, cantidad
        FROM subreceta_ingrediente
        WHERE idsubreceta IN (:ids) AND estado = 0
            AND (idporcion > 0 OR idproducto_stock > 0)
    `, { replacements: { ids }, type: QueryTypes.SELECT, transaction });
    const map = {};
    rows.forEach(r => (map[r.idsubreceta] = map[r.idsubreceta] || []).push(r));
    return map;
}

/**
 * Calcula el consumo esperado de la ventana de pedidos.
 * @returns {{porciones: Object, productos: Object, errores: string[]}}
 */
async function calcularEsperado(idsede, desdeIdPedido, hastaIdPedido, transaction) {
    const porciones = {};
    const productos = {};
    const errores = [];

    const detalles = await sequelize.query(`
        SELECT pd.idpedido, pd.iditem, pd.idcarta_lista, pd.procede_tabla,
               pd.cantidad_r, CAST(pd.subitems AS CHAR) subitems_json
        FROM pedido_detalle pd
            INNER JOIN pedido p ON p.idpedido = pd.idpedido
        WHERE p.idsede = :idsede
            AND p.idpedido > :desde AND p.idpedido <= :hasta
            AND p.estado != ${CONFIG.ESTADO_ANULADO}
            AND pd.borrado = 0
    `, {
        replacements: { idsede, desde: desdeIdPedido, hasta: hastaIdPedido },
        type: QueryTypes.SELECT,
        transaction
    });

    // Prefetch de recetas para los items SP (procede_tabla=2)
    const itemsSP = [...new Set(detalles.filter(d => d.procede_tabla === 2).map(d => d.iditem))];
    const recetas = await expandirRecetas(itemsSP, transaction);

    // Primera pasada: acumular directo + juntar subrecetas de subitems
    const subitemsPendientes = []; // {idsubreceta, cant}
    for (const d of detalles) {
        const cant = num(d.cantidad_r);
        if (cant <= 0) continue;

        // Producto de almacén directo (idcarta_lista = idproducto_stock)
        if (d.procede_tabla === 0) {
            acumular(productos, d.idcarta_lista, cant);
        }

        // Item con receta (SP)
        if (d.procede_tabla === 2) {
            for (const ing of (recetas[d.iditem] || [])) {
                if (ing.idporcion > 0) acumular(porciones, ing.idporcion, cant * num(ing.cantidad));
                if (ing.idproducto_stock > 0) acumular(productos, ing.idproducto_stock, cant * num(ing.cantidad));
            }
        }

        // Subitems seleccionables (JSON persistido en pedido_detalle)
        if (d.subitems_json && d.subitems_json !== 'null') {
            try {
                const grupos = JSON.parse(d.subitems_json);
                if (Array.isArray(grupos)) {
                    for (const g of grupos) {
                        if (!g) continue;
                        const multGrupo = num(g.cantidad_seleccionada) > 0 ? num(g.cantidad_seleccionada) : cant;
                        const opciones = g.subitems || g.opciones || [];
                        for (const s of opciones) {
                            if (!s || !s.selected) continue;
                            const q = multGrupo * (num(s.cantidad_selected) > 0 ? num(s.cantidad_selected) : 1) * validarDescuenta(s.descuenta);
                            if (q <= 0) continue;
                            if (s.idporcion > 0) acumular(porciones, s.idporcion, q);
                            if (s.idproducto > 0) acumular(productos, s.idproducto, q);
                            if (s.idsubreceta > 0) subitemsPendientes.push({ idsubreceta: s.idsubreceta, cant: q });
                        }
                    }
                }
            } catch (e) {
                errores.push(`pedido ${d.idpedido} iditem ${d.iditem}: subitems JSON invalido (${e.message})`);
            }
        }
    }

    // Segunda pasada: subrecetas usadas como subitem
    const idsSub = [...new Set(subitemsPendientes.map(s => s.idsubreceta))];
    const subrecetas = await expandirSubrecetas(idsSub, transaction);
    for (const s of subitemsPendientes) {
        for (const ing of (subrecetas[s.idsubreceta] || [])) {
            if (ing.idporcion > 0) acumular(porciones, ing.idporcion, s.cant * num(ing.cantidad));
            if (ing.idproducto_stock > 0) acumular(productos, ing.idproducto_stock, s.cant * num(ing.cantidad));
        }
    }

    return { porciones, productos, errores };
}

// ============================== lado REGISTRADO ==============================

/**
 * Neto de flujos de venta por porción en la ventana + set de porciones con SET manual.
 * idtipo: 3=VENTA (salida), 6=VENTA DEVOLUCION (entrada), 5=RECUPERA (entrada), 9=SET monitor, 10=AJUSTE.
 */
async function calcularRegistradoPorciones(idsede, desdeId, hastaId, transaction) {
    const rows = await sequelize.query(`
        SELECT idporcion, idtipo_movimiento_stock idtipo,
               SUM(ABS(CAST(REPLACE(cantidad, ',', '.') AS DECIMAL(10,2)))) total
        FROM porcion_historial
        WHERE idsede = :idsede
            AND idporcion_historial > :desde AND idporcion_historial <= :hasta
            AND idporcion > 0
        GROUP BY idporcion, idtipo_movimiento_stock
    `, { replacements: { idsede, desde: desdeId, hasta: hastaId }, type: QueryTypes.SELECT, transaction });

    const neto = {};
    const conSetManual = new Set();
    for (const r of rows) {
        const t = r.idtipo;
        if (t === 9) { conSetManual.add(r.idporcion); continue; }
        if (t === 3) acumular(neto, r.idporcion, num(r.total));
        else if (t === 6 || t === 5) acumular(neto, r.idporcion, -num(r.total));
        // 1,2,4,7,8,10 y legacy NULL: fuera de los flujos de venta
    }
    return { neto, conSetManual };
}

/**
 * Neto de flujos de venta por producto. producto_historial se agrupa por (idproducto, idalmacen):
 * se mapea de vuelta a idproducto_stock. Excluye agregados 'POR DIA' del SP legado.
 */
async function calcularRegistradoProductos(idsede, desdeId, hastaId, transaction) {
    const rows = await sequelize.query(`
        SELECT ph.idproducto, ph.idalmacen, ph.tipo_movimiento,
               SUM(ABS(CAST(REPLACE(ph.cantidad, ',', '.') AS DECIMAL(10,2)))) total,
               ps.idproducto_stock
        FROM producto_historial ph
            LEFT JOIN producto_stock ps
                ON ps.idproducto = ph.idproducto AND ps.idalmacen = ph.idalmacen
        WHERE ph.idsede = :idsede
            AND ph.idproducto_historial > :desde AND ph.idproducto_historial <= :hasta
            AND ph.hora != 'POR DIA'
        GROUP BY ph.idproducto, ph.idalmacen, ph.tipo_movimiento, ps.idproducto_stock
    `, { replacements: { idsede, desde: desdeId, hasta: hastaId }, type: QueryTypes.SELECT, transaction });

    const neto = {};
    for (const r of rows) {
        if (!r.idproducto_stock) continue;
        const tipo = ((r.tipo_movimiento || '') + '').toUpperCase();
        if (tipo === 'VENTA') acumular(neto, r.idproducto_stock, num(r.total));
        else if (tipo === 'VENTA DEVOLUCION' || tipo === 'RECUPERA') acumular(neto, r.idproducto_stock, -num(r.total));
        // ENTRADA/SALIDA/Aumenta/Disminuye/AJUSTE CIERRE: fuera de los flujos de venta
    }
    return { neto };
}

// ============================== ajustes ==============================

async function aplicarAjustePorcion(idporcion, diferencia, idsede, transaction) {
    // esperado > registrado => falto descontar => restar (cantidad negativa)
    const r = await StockPorcionService.procesarMovimientoPorcion(
        idporcion,
        -diferencia,
        'AJUSTE_CIERRE',
        { idsede, idusuario: 1, idpedido: null, iditem: 0 },
        transaction
    );
    return r && r.success;
}

async function aplicarAjusteProducto(idproductoStock, diferencia, idsede, transaction) {
    await sequelize.query(
        'UPDATE producto_stock SET stock = GREATEST(0, stock + ?) WHERE idproducto_stock = ?',
        { replacements: [-diferencia, idproductoStock], type: QueryTypes.UPDATE, transaction }
    );
    await registrarMovimientoProducto({
        idproductoStock,
        cantidad: -diferencia,
        tipoMovimiento: 'AJUSTE CIERRE',
        idsede,
        idusuario: 1,
        idpedido: null
    }, transaction);
    return true;
}

async function guardarAuditoria(fila, transaction) {
    await sequelize.query(`
        INSERT INTO stock_conciliacion
            (idsede, fecha, tipo, idref, esperado, registrado, diferencia, ajuste_aplicado, estado, detalle)
        VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)
    `, {
        replacements: [
            fila.idsede, fila.tipo, fila.idref, fila.esperado, fila.registrado,
            fila.diferencia, fila.ajuste_aplicado, fila.estado, fila.detalle || null
        ],
        type: QueryTypes.INSERT,
        transaction
    });
}

// ============================== orquestación ==============================

/**
 * Concilia una sede. Corre TODO en una transacción.
 * @param {number} idsede
 * @param {Object} [opts]
 * @param {boolean} [opts.dryRun=false] - calcula y audita, no aplica ajustes
 * @param {boolean} [opts.forzar=false] - salta el guard de sede quieta (para pruebas manuales)
 */
async function conciliarSede(idsede, opts = {}) {
    const { dryRun = false, forzar = false, quietMinutos = CONFIG.QUIET_MINUTOS_FALLBACK } = opts;

    if (!conciliacionActiva()) {
        return { success: true, disabled: true, reason: 'CONCILIACION_STOCK=0' };
    }

    let transaction = null;
    try {
        transaction = await sequelize.transaction();

        const maximos = await getMaximos(idsede, transaction);
        let control = await getControl(idsede, transaction);

        // Guard fino de quietud, acotado por watermark (barato incluso en sedes grandes)
        if (control && !forzar
            && !(await sedeQuieta(idsede, control.last_idporcion_historial, quietMinutos, transaction))) {
            await transaction.rollback();
            return { success: true, skipped: true, reason: 'sede con movimientos recientes' };
        }

        // Primera corrida: baseline (no concilia historia previa al deploy)
        if (!control) {
            await sequelize.query(`
                INSERT INTO stock_conciliacion_control
                    (idsede, last_idpedido, last_idporcion_historial, last_idproducto_historial, fecha_ultima)
                VALUES (?, ?, ?, ?, NOW())
            `, {
                replacements: [idsede, maximos.pedido, maximos.porcionHist, maximos.productoHist],
                type: QueryTypes.INSERT, transaction
            });
            await transaction.commit();
            logger.info({ idsede, maximos }, '📐 [conciliacion] Baseline creado (sin ajustes)');
            return { success: true, baseline: true };
        }

        // Nada nuevo que conciliar
        if (maximos.pedido <= control.last_idpedido
            && maximos.porcionHist <= control.last_idporcion_historial
            && maximos.productoHist <= control.last_idproducto_historial) {
            await transaction.commit();
            return { success: true, sinCambios: true };
        }

        // 1. Esperado (pedidos) y registrado (historial) de la ventana
        const esperado = await calcularEsperado(idsede, control.last_idpedido, maximos.pedido, transaction);
        const regPorcion = await calcularRegistradoPorciones(idsede, control.last_idporcion_historial, maximos.porcionHist, transaction);
        const regProducto = await calcularRegistradoProductos(idsede, control.last_idproducto_historial, maximos.productoHist, transaction);

        const soloReporte = dryRun || esperado.errores.length > 0;
        const estadoBase = esperado.errores.length > 0 ? 'parse_error' : (dryRun ? 'dry_run' : 'ajustado');

        // 2. Diferencias y ajustes
        const resumen = { ajustes: 0, reportadas: 0, filas: [] };

        const procesar = async (tipo, esperadoMap, netoMap, excluidas, aplicarFn) => {
            const ids = new Set([...Object.keys(esperadoMap), ...Object.keys(netoMap)].map(Number));
            for (const id of ids) {
                const esp = round2(esperadoMap[id] || 0);
                const reg = round2(netoMap[id] || 0);
                const dif = round2(esp - reg);
                if (Math.abs(dif) < 0.01) continue;

                let estado = estadoBase;
                let ajusteAplicado = 0;

                if (excluidas && excluidas.has(id)) {
                    estado = 'manual_set';
                } else if (Math.abs(dif) > CONFIG.MAX_AJUSTE_ABS) {
                    estado = 'excede_limite';
                } else if (!soloReporte) {
                    const ok = await aplicarFn(id, dif, idsede, transaction);
                    if (ok) {
                        ajusteAplicado = round2(-dif);
                        resumen.ajustes++;
                    } else {
                        estado = 'error_ajuste';
                    }
                }
                if (ajusteAplicado === 0) resumen.reportadas++;

                const fila = {
                    idsede, tipo, idref: id,
                    esperado: esp, registrado: reg, diferencia: dif,
                    ajuste_aplicado: ajusteAplicado, estado,
                    detalle: esperado.errores.length ? esperado.errores.slice(0, 2).join(' | ').substring(0, 250) : null
                };
                await guardarAuditoria(fila, transaction);
                resumen.filas.push(fila);
            }
        };

        await procesar('porcion', esperado.porciones, regPorcion.neto, regPorcion.conSetManual, aplicarAjustePorcion);
        await procesar('producto', esperado.productos, regProducto.neto, null, aplicarAjusteProducto);

        // 3. Avanzar watermarks (los movimientos AJUSTE recien insertados quedan fuera de
        //    los flujos de venta por su tipo, asi que no contaminan la proxima ventana)
        await sequelize.query(`
            UPDATE stock_conciliacion_control
            SET last_idpedido = ?, last_idporcion_historial = ?, last_idproducto_historial = ?, fecha_ultima = NOW()
            WHERE idsede = ?
        `, {
            replacements: [maximos.pedido, maximos.porcionHist, maximos.productoHist, idsede],
            type: QueryTypes.UPDATE, transaction
        });

        await transaction.commit();

        if (resumen.filas.length > 0) {
            logger.warn({ idsede, ajustes: resumen.ajustes, reportadas: resumen.reportadas, filas: resumen.filas },
                '📐 [conciliacion] Diferencias detectadas');
        } else {
            logger.debug({ idsede }, '📐 [conciliacion] Sin diferencias');
        }

        return { success: true, ...resumen, erroresParseo: esperado.errores };

    } catch (error) {
        if (transaction) {
            try { await transaction.rollback(); } catch (e) { /* noop */ }
        }
        errorManager.logError({
            incidencia: { message: `Error conciliando stock: ${error.message}`, data: { idsede } },
            origen: 'StockConciliacion.conciliarSede'
        });
        return { success: false, error: error.message };
    }
}

/**
 * Sedes CANDIDATAS en UNA sola query (clave para 350+ locales).
 *
 * Disparo PRINCIPAL — cierre de caja: procedure_run_cierre marca pedido.cierre=1;
 * si hay pedidos cerrados por encima del watermark, se concilia YA (guard corto),
 * para que el stock este corregido cuando el encargado hace el conteo fisico.
 *
 * Disparo RESPALDO — sede que no hizo cierre: pedidos pendientes y >= 20 min sin vender.
 *
 * Usa el indice de pedido.fecha_hora; el guard fino de movimientos (sedeQuieta)
 * se aplica despues SOLO a esta lista corta.
 */
async function sedesCandidatas() {
    const rows = await sequelize.query(`
        SELECT t.idsede,
               CASE
                   WHEN t.mx_cerrado IS NOT NULL AND (c.idsede IS NULL OR t.mx_cerrado > c.last_idpedido)
                       THEN 'cierre'
                   ELSE 'valle'
               END AS motivo
        FROM (
            SELECT idsede,
                   MAX(idpedido) mx_pedido,
                   MAX(CASE WHEN cierre = 1 THEN idpedido END) mx_cerrado,
                   MAX(fecha_hora) ultimo
            FROM pedido
            WHERE fecha_hora >= NOW() - INTERVAL 1 DAY
            GROUP BY idsede
        ) t
        LEFT JOIN stock_conciliacion_control c ON c.idsede = t.idsede
        WHERE
            (t.mx_cerrado IS NOT NULL AND (c.idsede IS NULL OR t.mx_cerrado > c.last_idpedido))
            OR
            (t.ultimo < NOW() - INTERVAL ${CONFIG.QUIET_MINUTOS_FALLBACK} MINUTE
                AND (c.idsede IS NULL OR t.mx_pedido > c.last_idpedido))
        ORDER BY motivo, t.idsede
        LIMIT ${CONFIG.MAX_SEDES_POR_TICK}
    `, { type: QueryTypes.SELECT });
    return rows;
}

/**
 * Corrida del cron. Costo en regimen para 350 locales:
 *  - 1 query global de candidatas (rango indexado de 24h)
 *  - por candidata (pocas por tick): 1 query de quietud fina + conciliacion ventaneada
 * Prioriza cierres de caja ('cierre' ordena antes que 'valle') y el LIMIT reparte
 * los picos (deploy inicial, varios cierres simultaneos) entre corridas.
 */
async function conciliarSedesPendientes() {
    if (!conciliacionActiva()) {
        return {}; // desactivada: ni siquiera consulta candidatas
    }
    const sedes = await sedesCandidatas();
    const resultados = {};
    for (const { idsede, motivo } of sedes) {
        resultados[idsede] = await conciliarSede(idsede, {
            quietMinutos: motivo === 'cierre' ? CONFIG.QUIET_MINUTOS_CIERRE : CONFIG.QUIET_MINUTOS_FALLBACK
        });
        resultados[idsede].motivo = motivo;
    }
    return resultados;
}

module.exports = {
    conciliarSede,
    conciliarSedesPendientes,
    sedesCandidatas,
    // internos expuestos para pruebas
    _internals: { calcularEsperado, calcularRegistradoPorciones, calcularRegistradoProductos, CONFIG }
};
