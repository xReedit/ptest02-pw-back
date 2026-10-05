// Impresión por área de mesas (plan/IMPRESION-POR-AREA-PLAN.md del legacy).
// Cada área (area_mesa.reglas_impresora) puede decir "la impresora X se cambia por la Y"
// para las mesas de esa área. Se aplica UNA sola vez, antes de guardar el pedido
// (procedure_pwa_pedido_guardar): lo que se imprime sale del resultado del SP.
//
// Pertenencia mesa -> área (misma regla en la web legacy y en la app de mozo):
// - mesa '' / '0' (o solo ceros) -> ninguna área (para llevar / delivery).
// - numérica: mesa entera y num_mesa_ini <= n <= num_mesa_fin.
// - alfanumérica: empieza con prefijo_mesa (sin distinguir mayúsculas) y el resto entero en ini..fin.
// - la primera área que calza gana.

const logger = require('../utilitarios/logger');

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // idsede -> { at, data: { areas, impresoras } }

// campos de la impresora destino que reemplazan a los del trabajo de impresión
const CAMPOS_IMPRESORA = ['ip_print', 'var_margen_iz', 'var_size_font', 'num_copias', 'papel_size'];

const esEntero = (s) => /^\d+$/.test(s);

function parseReglas(json) {
    if (!json || typeof json !== 'string') return [];
    try {
        const arr = JSON.parse(json);
        if (!Array.isArray(arr)) return [];
        return arr
            .map(r => ({ o: Number(r && r.o), d: Number(r && r.d) }))
            .filter(r => Number.isInteger(r.o) && r.o > 0 && Number.isInteger(r.d) && r.d > 0);
    } catch (e) {
        return [];
    }
}

function mesaEnArea(area, mesa) {
    const ini = Number(area.num_mesa_ini);
    const fin = Number(area.num_mesa_fin);
    const tipo = String(area.tipo_mesa ?? '').trim().toLowerCase();

    let resto = mesa;
    if (tipo === 'alfanumerica') {
        const prefijo = String(area.prefijo_mesa ?? '').trim().toUpperCase();
        if (!mesa.toUpperCase().startsWith(prefijo)) return false;
        resto = mesa.substring(prefijo.length);
    }
    if (!esEntero(resto)) return false;
    const n = parseInt(resto, 10);
    return n >= ini && n <= fin;
}

// devuelve el área (fila de area_mesa) a la que pertenece la mesa, o null
function buscarArea(areas, mesa) {
    const m = String(mesa ?? '').trim();
    if (m === '' || /^0+$/.test(m)) return null;
    if (!Array.isArray(areas)) return null;
    return areas.find(a => a && mesaEnArea(a, m)) || null;
}

// id de la impresora destino para la impresora origen en esa área, o null
function destinoRegla(area, idimpresoraOrigen) {
    if (!area || !idimpresoraOrigen) return null;
    const regla = parseReglas(area.reglas_impresora).find(r => r.o === Number(idimpresoraOrigen));
    return regla ? regla.d : null;
}

// identifica la impresora origen de un trabajo: por idimpresora si viene, si no por IP (única en la sede)
function idImpresoraOrigen(trabajo, impresoras) {
    if (trabajo.idimpresora) return Number(trabajo.idimpresora);
    const ip = String(trabajo.ip_print ?? trabajo.ip ?? '').trim();
    if (ip === '' || ip === '0') return null;
    const coinciden = impresoras.filter(i => String(i.ip ?? '').trim() === ip);
    if (coinciden.length > 1) {
        logger.warn({ ip, ids: coinciden.map(i => i.idimpresora) }, '[regla-impresora-area] IP compartida por varias impresoras, no se aplica regla');
        return null;
    }
    return coinciden.length === 1 ? Number(coinciden[0].idimpresora) : null;
}

// aplica la regla a una impresora de trabajo ({ip_print, ...}); devuelve una copia (o la misma si no hay regla)
function aplicarAImpresora(trabajo, area, impresoras) {
    if (!trabajo || typeof trabajo !== 'object') return trabajo;
    const idOrigen = idImpresoraOrigen(trabajo, impresoras);
    const idDestino = destinoRegla(area, idOrigen);
    if (!idDestino || idDestino === idOrigen) return trabajo;

    const destino = impresoras.find(i => Number(i.idimpresora) === idDestino);
    if (!destino) {
        logger.warn({ idOrigen, idDestino }, '[regla-impresora-area] impresora destino no existe o no está activa en la sede');
        return trabajo;
    }

    const cambiado = { ...trabajo };
    const valores = { ...destino, ip_print: destino.ip };
    CAMPOS_IMPRESORA.forEach(c => { if (valores[c] !== undefined) cambiado[c] = valores[c]; });
    if (trabajo.idimpresora) cambiado.idimpresora = idDestino;
    if (trabajo.ip !== undefined) cambiado.ip = destino.ip;
    return cambiado;
}

// función pura: aplica la regla del área a un dataPrint (array de {Array_enca, ArrayItem, Array_print})
// y a una lista de impresoras opcional (listPrinters, usada por pago-mozo). No muta la entrada.
function aplicarReglaEnDatos({ areas, impresoras }, mesa, dataPrint, listPrinters) {
    const area = buscarArea(areas, mesa);
    if (!area || parseReglas(area.reglas_impresora).length === 0) {
        return { area: null, dataPrint, listPrinters };
    }
    const imps = Array.isArray(impresoras) ? impresoras : [];
    const mapLista = (lista) => Array.isArray(lista) ? lista.map(p => aplicarAImpresora(p, area, imps)) : lista;

    const nuevoDataPrint = Array.isArray(dataPrint)
        ? dataPrint.map(t => (t && Array.isArray(t.Array_print)) ? { ...t, Array_print: mapLista(t.Array_print) } : t)
        : dataPrint;

    return { area, dataPrint: nuevoDataPrint, listPrinters: mapLista(listPrinters) };
}

async function cargarDatosSede(idsede) {
    const key = String(idsede);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

    // require diferido: el test de funciones puras no necesita base de datos
    const QueryServiceV1 = require('./query.service.v1');
    const areas = await QueryServiceV1.ejecutarConsulta(
        // mismo filtro que la web (log_009 op 5001): solo las áreas del tipo de mesa vigente de la sede,
        // así no se aplican reglas de áreas numéricas viejas en una sede que pasó a alfanumérica
        `select am.idarea_mesa, am.titulo, am.tipo_mesa, am.prefijo_mesa, am.num_mesa_ini, am.num_mesa_fin, am.reglas_impresora
         from area_mesa am
         inner join sede s on s.idsede = am.idsede
         where am.idsede=? and am.estado=0
           and (
             (s.mesas_alfanumerica = '1' and am.tipo_mesa = 'alfanumerica')
             or (coalesce(s.mesas_alfanumerica, '0') <> '1' and (am.tipo_mesa is null or am.tipo_mesa in ('', 'numerica')))
           )
         order by am.idarea_mesa`,
        [idsede], 'SELECT', 'reglaImpresoraArea.areas');
    const impresoras = await QueryServiceV1.ejecutarConsulta(
        `select idimpresora, descripcion, ip, num_copias, var_size_font, var_margen_iz, papel_size
         from impresora where idsede=? and estado=0`,
        [idsede], 'SELECT', 'reglaImpresoraArea.impresoras');

    const data = { areas: areas || [], impresoras: impresoras || [] };
    cache.set(key, { at: Date.now(), data });
    return data;
}

// aplica la regla del área a dataPrint; ante cualquier error devuelve dataPrint sin cambios
async function aplicarReglaArea(idsede, mesa, dataPrint) {
    const rpt = await aplicarReglaPedido(idsede, mesa, dataPrint, undefined);
    return rpt.dataPrint;
}

// idem, también sobre listPrinters (pago-mozo imprime con esa lista). Nunca lanza.
async function aplicarReglaPedido(idsede, mesa, dataPrint, listPrinters) {
    const sinCambio = { dataPrint, listPrinters };
    try {
        const m = String(mesa ?? '').trim();
        if (!idsede || m === '' || /^0+$/.test(m)) {
            return sinCambio; // para llevar / delivery: no se consulta la base
        }
        const datos = await cargarDatosSede(idsede);
        const rpt = aplicarReglaEnDatos(datos, mesa, dataPrint, listPrinters);
        if (rpt.area) {
            logger.debug({ idsede, mesa, area: rpt.area.titulo }, '[regla-impresora-area] regla por área aplicada');
        }
        return { dataPrint: rpt.dataPrint, listPrinters: rpt.listPrinters };
    } catch (error) {
        logger.error({ error: error.message, idsede, mesa }, '[regla-impresora-area] error, se sigue sin regla');
        return sinCambio;
    }
}

// aplica la regla sobre el payload de guardado (dataSend de la app: {dataPedido, dataPrint, listPrinters}).
// Reasigna dataPrint/listPrinters del payload (los caminos holding/pago-mozo leen esas mismas propiedades después).
async function aplicarReglaPayload(idsede, payload) {
    try {
        if (!payload || typeof payload !== 'object') return;
        const header = payload.dataPedido?.p_header || payload.p_header || {};
        // ponytail: en holding la mesa (p_header.m) es del holding pero el idsede es el de la marca,
        // y las áreas/impresoras de la marca no describen las mesas del holding. Es más seguro no desviar
        // que desviar mal: en holding no se aplica la regla. Mismo flag que usa sockets.js (is_holding == 1).
        if (header.is_holding == 1) return;
        const mesa = header.m ?? payload.dataPrint?.[0]?.Array_enca?.m;
        const rpt = await aplicarReglaPedido(idsede, mesa, payload.dataPrint, payload.listPrinters);
        if (rpt.dataPrint !== payload.dataPrint) payload.dataPrint = rpt.dataPrint;
        if (rpt.listPrinters !== payload.listPrinters) payload.listPrinters = rpt.listPrinters;
    } catch (error) {
        logger.error({ error: error.message, idsede }, '[regla-impresora-area] error en payload, se sigue sin regla');
    }
}

// todas las áreas vigentes (mismo filtro por tipo de mesa) + impresoras activas (app de mozo: precuenta).
// Van todas, no solo las que tienen reglas, para que la app encuentre la misma área que node y la web
// cuando hay áreas superpuestas (la primera que calza gana).
async function getReglasSede(idsede) {
    const datos = await cargarDatosSede(idsede);
    return { idsede: Number(idsede), areas: datos.areas, impresoras: datos.impresoras };
}

module.exports = {
    buscarArea,
    parseReglas,
    aplicarReglaEnDatos,
    aplicarReglaArea,
    aplicarReglaPedido,
    aplicarReglaPayload,
    getReglasSede
};
