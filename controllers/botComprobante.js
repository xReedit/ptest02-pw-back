// Emisión de comprobante electrónico (boleta/factura) para un pedido
// CONFIRMADO por el chatbot de WhatsApp. El bot manda items/subtotales ya
// cocinados desde la estructura del pedido (api-restobar). La emisión REUSA
// el endpoint interno /v3/service/facturacion-e vía loopback HTTP con un JWT
// de servicio — cero cambios en el flujo de caja/POS.
//
// Seguridad: exige el header x-bot-key == env CHATBOT_BOT_KEY (secreto
// compartido con api-restobar). Sin la env configurada, el endpoint queda
// APAGADO (fail-closed): emite documentos tributarios, no se deja abierto.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fetch = require('node-fetch');
const config = require('../_config');
const QueryServiceV1 = require('../service/query.service.v1');
const logger = require('../utilitarios/logger');

const URL_DESCARGA_CPE = 'https://apifac.papaya.com.pe/downloads/document';
// Servicio de consulta DNI/RUC (mismo que usa apiConsultaDniRuc.js).
const URL_SERVICE_CONSULTA = process.env.URL_SERVICE_CONSULTA_DNIRUC || 'https://restobar.papaya.com.pe/consulta/';
const TOKEN_CONSULTA = process.env.TOKEN_CONSULTA_DNIRUC;

const pad7 = (n) => {
    let s = String(n ?? '');
    while (s.length < 7) s = '0' + s;
    return s;
};

// reintentable:false => el bot NO debe permitir reintentar (evita doble
// emisión cuando el CPE quedó encolado o en estado incierto).
const fallo = (res, error, reintentable = true) => res.json({ success: false, error, reintentable });

// serviceFacturacion espera etiquetas EXACTAS: subtotales[0] es la base,
// una fila 'I.G.V' para el impuesto y la ÚLTIMA fila es el TOTAL. La
// estructura del pedido trae variantes ("Sub Total", "i.g.v.", "Total").
const normalizarSubtotales = (subtotales) => {
    const filas = (subtotales || []).map((s) => {
        const d = String(s.descripcion || '').trim();
        let descripcion = d;
        if (/^sub\s*\.?\s*total/i.test(d)) descripcion = 'SUB TOTAL';
        else if (/^i\.?\s*g\.?\s*v/i.test(d)) descripcion = 'I.G.V';
        else if (/^total$/i.test(d.replace(/[.\s]+$/g, ''))) descripcion = 'TOTAL';
        return { descripcion, importe: String(s.importe) };
    });
    // El TOTAL siempre al final (serviceFacturacion toma el último elemento).
    const idxTotal = filas.findIndex((f) => f.descripcion === 'TOTAL');
    if (idxTotal >= 0 && idxTotal !== filas.length - 1) {
        filas.push(filas.splice(idxTotal, 1)[0]);
    }
    return filas;
};

// IGV de la sede: vive en conf_print_detalle (es_impuesto=1). Convención del
// POS legado: activo=1 significa "IGV desactivado" => sede EXONERADA (selva).
// Sin fila de impuesto configurada => null (FAIL-CLOSED: no se adivina el
// régimen tributario de una sede).
const obtenerConfigIGV = async (idsede) => {
    const rows = await QueryServiceV1.ejecutarConsulta(
        `SELECT cpd.porcentaje, cpd.activo
         FROM conf_print_detalle cpd
         INNER JOIN conf_print cp ON cp.idconf_print = cpd.idconf_print
         WHERE cp.idsede = ? AND cpd.es_impuesto = 1 AND cpd.estado = 0
         LIMIT 1`,
        [idsede], 'SELECT', 'botComprobante-igv'
    );
    const fila = rows && rows[0];
    if (!fila) return null;
    return {
        porcentaje_igv: Number(fila.porcentaje) > 0 ? Number(fila.porcentaje) : 18,
        is_exonerado_igv: String(fila.activo ?? '0') === '1' ? '1' : '0'
    };
};

// Cliente por DNI/RUC: primero BD local, si no existe consulta el servicio
// (RENIEC/SUNAT) y lo registra. Nunca lanza: en el peor caso devuelve el
// documento pelado (el CPE sale a nombre del número, como hace caja).
const resolverCliente = async (idorg, numDoc, esRuc) => {
    try {
        const local = await QueryServiceV1.ejecutarConsulta(
            `SELECT idcliente, nombres, direccion, ruc AS num_doc FROM cliente
             WHERE estado = 0 AND ruc = ? AND idorg = ? LIMIT 1`,
            [numDoc, idorg], 'SELECT', 'botComprobante-cliente'
        );
        if (local && local[0]) return local[0];
    } catch (e) {
        logger.error('botComprobante: fallo consulta cliente local:', e.message);
    }

    let nombres = '', direccion = '';
    try {
        const servicio = esRuc ? 'ruc' : 'dni';
        const label = esRuc ? 'ruc' : 'ndni';
        const url = `${URL_SERVICE_CONSULTA}${servicio}/api/service.php?${label}=${numDoc}&token=${TOKEN_CONSULTA}`;
        const resp = await fetch(url, { method: 'POST', timeout: 8000 });
        const dt = await resp.json();
        if (dt.success && dt.haydatos) {
            if (esRuc) {
                nombres = dt.result.RazonSocial || '';
                direccion = dt.result.Direccion || '';
            } else {
                const apPat = dt.result.ApellidoPaterno || '';
                const apMat = dt.result.ApellidoMaterno || '';
                const apellidos = apPat === '' ? (dt.result.apellidos || '') : `${apPat} ${apMat}`;
                nombres = `${dt.result.Nombres || ''} ${apellidos}`.trim();
            }
        }
    } catch (e) {
        logger.error('botComprobante: fallo servicio dni/ruc:', e.message);
    }

    let idcliente = '';
    try {
        const nuevo = { nombres, direccion, num_doc: numDoc, f_nac: '', telefono: '' };
        const rsp = await QueryServiceV1.ejecutarProcedimiento(
            'call procedure_pwa_guardar_nuevo_cliente(?, ?)',
            [idorg, JSON.stringify(nuevo)], 'botComprobante-nuevoCliente'
        );
        const fila = rsp && rsp[0];
        idcliente = fila?.idcliente ?? (fila && Object.values(fila)[0]?.idcliente) ?? '';
    } catch (e) {
        logger.error('botComprobante: fallo alta cliente:', e.message);
    }

    return { idcliente, nombres, direccion, num_doc: numDoc };
};

// El registro interno del CPE (procedure_cpe_registro) necesita un idusuario
// válido; sin él la boleta se emite en apifac pero no queda en `ce` (gap de
// cumplimiento). Reusa/crea el usuario 'bot' (mismo patrón que el confirm).
const obtenerUsuarioBot = async (idorg, idsede) => {
    // Scopeado por org/sede: hay un usuario 'bot' por organizacion — usar el
    // de otro org atribuiria el CPE a un usuario ajeno.
    const buscar = () => QueryServiceV1.ejecutarConsulta(
        "SELECT idusuario FROM usuario WHERE usuario = 'bot' AND idorg = ? AND idsede = ? LIMIT 1",
        [idorg, idsede], 'SELECT', 'botComprobante-usuario'
    );
    const rows = await buscar();
    if (rows?.[0]?.idusuario) return Number(rows[0].idusuario);
    // Columnas reales de `usuario` (todas las NOT NULL sin default). La tabla
    // se usa para autenticar: contraseña aleatoria (nadie inicia sesión con el
    // bot) y estado/acc alineados a los usuarios bot existentes.
    const passAleatoria = crypto.randomBytes(10).toString('hex');
    await QueryServiceV1.ejecutarConsulta(
        "INSERT INTO usuario (idorg, idsede, nombres, cargo, usuario, pass, acc, per, estado, isbot) VALUES (?, ?, 'Bot WhatsApp', 'BOT', 'bot', ?, ',A25', '', 1, '1')",
        [idorg, idsede, passAleatoria], 'INSERT', 'botComprobante-crearUsuario'
    );
    const creado = await buscar();
    return Number(creado?.[0]?.idusuario) || null;
};

// POST /bot/generar-comprobante  (header x-bot-key obligatorio)
// body: { idorg, idsede, idpedido, tipo: 'boleta'|'factura', num_doc, items, subtotales }
const generarComprobanteBot = async function (req, res) {
    try {
        // Auth por secreto compartido: sin env configurada, apagado.
        const keyEsperada = process.env.CHATBOT_BOT_KEY || '';
        if (!keyEsperada) {
            logger.error('botComprobante: CHATBOT_BOT_KEY no configurada — endpoint apagado');
            return fallo(res, 'emisión de comprobantes no habilitada en el servidor', false);
        }
        if (String(req.headers['x-bot-key'] || '') !== keyEsperada) {
            return res.status(401).json({ success: false, error: 'no autorizado', reintentable: false });
        }

        const { tipo, num_doc, items, subtotales } = req.body || {};
        // Ids SOLO enteros: viajan a un JWT cuyo contenido termina interpolado
        // en SQL legado (procedure_cpe_registro) — nada de strings arbitrarios.
        const idorg = Number(req.body?.idorg);
        const idsede = Number(req.body?.idsede);
        const idpedido = Number(req.body?.idpedido);
        if (!Number.isInteger(idorg) || idorg <= 0 || !Number.isInteger(idsede) || idsede <= 0 || !Number.isInteger(idpedido) || idpedido <= 0) {
            return fallo(res, 'identificadores inválidos');
        }

        const numDoc = String(num_doc || '').replace(/\D/g, '');
        const esFactura = tipo === 'factura';
        if (!['boleta', 'factura'].includes(tipo)) {
            return fallo(res, 'tipo debe ser boleta o factura');
        }
        if (esFactura && numDoc.length !== 11) {
            return fallo(res, 'para factura se necesita un RUC de 11 dígitos');
        }
        if (!esFactura && numDoc.length !== 8) {
            return fallo(res, 'para boleta se necesita un DNI de 8 dígitos');
        }
        if (!Array.isArray(items) || !items.length || !Array.isArray(subtotales) || !subtotales.length) {
            return fallo(res, 'faltan datos del pedido');
        }

        // El pedido debe existir, ser de la sede y de HOY.
        // OJO: pedido.total es SOLO productos (sin delivery); el total real con
        // delivery/extras vive en total_r (o total_total en pedidos nuevos).
        const pedidoRows = await QueryServiceV1.ejecutarConsulta(
            'SELECT idpedido, total, total_r, total_total FROM pedido WHERE idpedido = ? AND idsede = ? AND DATE(fecha_hora) = CURDATE() LIMIT 1',
            [idpedido, idsede], 'SELECT', 'botComprobante-pedido'
        );
        if (!pedidoRows || !pedidoRows[0]) {
            return fallo(res, 'el pedido no existe o no es de hoy');
        }

        const filasNorm = normalizarSubtotales(subtotales);
        const totalDeclarado = Number(filasNorm[filasNorm.length - 1]?.importe);
        const sumaItems = (items[0]?.items || []).reduce((acc, it) => acc + (Number(it?.precio_total) || 0), 0);
        if (!Number.isFinite(totalDeclarado) || totalDeclarado <= 0) {
            return fallo(res, 'total del pedido inválido');
        }
        // Cuadre 1: items deben sumar el total (SUNAT rechaza documentos
        // descuadrados; también corta payloads manipulados).
        if (Math.abs(sumaItems - totalDeclarado) > 0.05) {
            logger.error(`botComprobante: items (${sumaItems}) no cuadran con total (${totalDeclarado}) pedido ${idpedido}`);
            return fallo(res, 'el detalle del pedido no cuadra con el total; solicítalo en caja', false);
        }
        // Cuadre 2: el total declarado debe coincidir con el pedido REAL en BD.
        const totalPedidoBD = Number(pedidoRows[0].total_total) || Number(pedidoRows[0].total_r) || Number(pedidoRows[0].total);
        if (Number.isFinite(totalPedidoBD) && totalPedidoBD > 0 && Math.abs(totalPedidoBD - totalDeclarado) > 0.5) {
            logger.error(`botComprobante: total declarado (${totalDeclarado}) != pedido BD (${totalPedidoBD}) pedido ${idpedido}`);
            return fallo(res, 'los montos no coinciden con el pedido registrado; solicítalo en caja', false);
        }

        const sedeRows = await QueryServiceV1.ejecutarConsulta(
            'SELECT * FROM sede WHERE idsede = ? LIMIT 1', [idsede], 'SELECT', 'botComprobante-sede'
        );
        const sede = sedeRows && sedeRows[0];
        if (!sede || String(sede.facturacion_e_activo) !== '1' || !sede.authorization_api_comprobante) {
            return fallo(res, 'esta sede no tiene facturación electrónica activa; el comprobante se emite en caja', false);
        }

        const serieRows = await QueryServiceV1.ejecutarConsulta(
            `SELECT tp.descripcion, tp.codsunat, tps.idtipo_comprobante_serie, tps.serie,
                    tps.correlativo, tps.facturacion_correlativo_api
             FROM tipo_comprobante tp
             INNER JOIN tipo_comprobante_serie tps ON tps.idtipo_comprobante = tp.idtipo_comprobante
             WHERE tps.idsede = ? AND tp.codsunat = ? AND tps.estado = 0
             ORDER BY tps.idtipo_comprobante_serie DESC LIMIT 1`,
            [idsede, esFactura ? '01' : '03'], 'SELECT', 'botComprobante-serie'
        );
        const comprobante = serieRows && serieRows[0];
        if (!comprobante) {
            return fallo(res, `la sede no tiene serie de ${tipo} configurada`, false);
        }

        const igv = await obtenerConfigIGV(idsede);
        if (!igv) {
            return fallo(res, 'la configuración de impuestos de la sede no está definida; solicítalo en caja', false);
        }

        const cliente = await resolverCliente(idorg, numDoc, esFactura);
        const idusuario = await obtenerUsuarioBot(idorg, idsede);
        if (!idusuario) {
            return fallo(res, 'no se pudo preparar la emisión; solicítalo en caja', false);
        }

        // Payload de sede para el cocinador: sin datos_impresion (el CPE del
        // bot NO debe imprimirse físicamente en el local).
        const sedePayload = {
            ...sede,
            porcentaje_igv: igv.porcentaje_igv,
            is_exonerado_igv: igv.is_exonerado_igv,
            sededireccion: sede.direccion || '',
            sedeciudad: sede.ciudad || '',
            datos_impresion: null
        };

        // Loopback al endpoint de emisión existente, con JWT de servicio (el
        // mismo shape que espera middleware/autentificacion + filters).
        const token = jwt.sign({ usuario: { idorg, idsede, idusuario } }, config.SEED, { expiresIn: '5m' });
        const respuesta = await fetch(`http://127.0.0.1:${config.port}/v3/service/facturacion-e`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', authorization: token },
            body: JSON.stringify({
                items,
                subtotales: filasNorm,
                comprobante,
                cliente,
                sede: sedePayload
            }),
            timeout: 30000
        });
        const rpt = await respuesta.json();
        const data = rpt && rpt.data;

        if (!data || !data.external_id) {
            // apifac caído: el CPE quedó en cola de reenvío nocturno con
            // correlativo consumido — un reintento DUPLICARÍA el documento.
            logger.error('botComprobante: emision sin external_id', JSON.stringify(rpt || {}));
            return fallo(res, 'la facturación no está disponible en este momento; tu comprobante quedó en proceso y también puedes pedirlo en caja', false);
        }

        const prefijo = String(comprobante.descripcion || '').substr(0, 1).toUpperCase();
        const numero = `${prefijo}${comprobante.serie}-${pad7(data.correlativo_comprobante)}`;
        const userId = sede.id_api_comprobante ? `/${sede.id_api_comprobante}` : '';
        const url_pdf = `${URL_DESCARGA_CPE}/pdf/${data.external_id}${userId}`;

        logger.debug(`botComprobante: emitido ${numero} (${data.external_id}) pedido ${idpedido}`);
        return res.json({ success: true, numero, external_id: data.external_id, url_pdf });

    } catch (error) {
        logger.error('botComprobante: error general:', error.message);
        // Estado incierto (pudo haberse emitido): no invitar al reintento.
        return fallo(res, 'no se pudo generar el comprobante en este momento; solicítalo en caja', false);
    }
};
module.exports.generarComprobanteBot = generarComprobanteBot;
