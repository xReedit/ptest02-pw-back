/**
 * Contrato puente /vision/v1 ↔ Control de pedidos (log.php case 507 / 50701).
 *
 * El puente promete ver "las mismas cuentas abiertas que Control de pedidos".
 * Esa definición vive en el PHP legacy, que NO se toca desde aquí: estas pruebas
 * leen su TEXTO en el share y fallan si cambia. Si Control de pedidos cambia su
 * definición, este test obliga a cambiar el puente (service/vision.service.js).
 *
 * Patrón de carta-stock-historial.sql.test.js: rutas absolutas al share; si el
 * share no responde la suite FALLA con mensaje explícito, nunca se salta.
 */

jest.mock('../utilitarios/logger', () => ({
    debug: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn()
}));
// Sin BD: el servicio solo se carga para leer sus SQL.
jest.mock('../config/database', () => ({
    sequelize: { query: jest.fn() }, QueryTypes: { SELECT: 'SELECT' },
}));

const fs = require('fs');
const path = require('path');
const vision = require('../service/vision.service');

const RUTA_LOG = path.join('\\\\192.168.1.65\\system$\\restobar', 'bdphp', 'log.php');

function leerLogPhp() {
    try {
        return fs.readFileSync(RUTA_LOG, 'latin1');
    } catch (err) {
        throw new Error(
            `No se pudo leer ${RUTA_LOG}. El share SMB \\\\192.168.1.65\\system$ debe estar ` +
            `montado para correr esta suite. Causa: ${err.code || err.message}`
        );
    }
}

/** Quita comentarios PHP: bloques (/* ... *\/) y líneas que empiezan con //. */
function phpSinComentarios(php) {
    return php.replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
}

const escaparRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** La línea completa, sola en su renglón (solo espacios o tabs alrededor). */
const lineaExacta = (s) => new RegExp(`^[ \\t]*${escaparRe(s)}[ \\t]*\\r?$`, 'm');

/** Cuerpo del `case <num>:` hasta la siguiente etiqueta `case <n>:` del archivo. */
function extraerCase(php, num) {
    const etiquetas = [...php.matchAll(/^[ \t]*case\s+(\d+)\s*:/gm)];
    const i = etiquetas.findIndex((m) => m[1] === String(num));
    if (i === -1) throw new Error(`No existe 'case ${num}:' en log.php`);
    const desde = etiquetas[i].index;
    const hasta = i + 1 < etiquetas.length ? etiquetas[i + 1].index : php.length;
    return php.slice(desde, hasta);
}

/**
 * Definición de "cuenta abierta" de Control de pedidos que el puente copia. Recibe el
 * TEXTO CRUDO de log.php y devuelve la lista de lo que falta (vacía = el puente sigue
 * valiendo). Los mutantes de abajo prueban que un filtro agregado no pasa en silencio.
 */
function contrato507(textoCrudo) {
    const sin = phpSinComentarios(textoCrudo);
    const c507 = extraerCase(sin, 507);
    const c50701 = extraerCase(sin, 50701);
    const faltas = [];
    const exige = (ok, que) => { if (!ok) faltas.push(que); };

    exige(c50701.includes('call lastIdPedidoSede($g_idsede, 1)'), 'case 50701: call lastIdPedidoSede($g_idsede, 1)');
    exige(c507.includes('call lastIdPedidoSede($g_idsede, 1)'), 'case 507: call lastIdPedidoSede($g_idsede, 1)');
    exige(/if\s*\(\s*\$isConfirmarPago\s*==\s*0\s*\)\s*\{\s*\$isQyueryConfirmar = 'p\.estado IN\(0,1\)';/.test(c507),
        "case 507: $isQyueryConfirmar = 'p.estado IN(0,1)' cuando confirmar_pago = 0");
    // log.php:2109 completo: un AND agregado al final o en medio cambia la línea.
    exige(lineaExacta(LINEA_WHERE).test(c507), `case 507: línea WHERE completa ${LINEA_WHERE}`);
    // log.php:2076: la condición de mesa no suma filtros.
    exige(lineaExacta("$condicion='p.nummesa='.$nummesa;").test(c507), "case 507: $condicion='p.nummesa='.$nummesa;");
    // Ningún filtro pegado después a la SQL.
    exige(!/\$sql\s*\.=/.test(c507), 'case 507: sin $sql .= después de armar la SQL');
    return faltas;
}

// Copia del texto con un cambio DENTRO del case 507 (log.php no se toca). Falla si el
// texto a cambiar no está: un mutante igual al original no probaría nada.
function mutarEn507(texto, de, a) {
    const inicio = texto.search(/^[ \t]*case\s+507\s*:/m);
    const i = inicio === -1 ? -1 : texto.indexOf(de, inicio);
    if (i === -1) throw new Error(`mutante inválido: no está ${JSON.stringify(de)} en case 507`);
    return texto.slice(0, i) + a + texto.slice(i + de.length);
}

const LINEA_WHERE = 'WHERE p.idpedido >= $lastIdPedido and (p.idsede=".$g_idsede." and ".$condicion.") and ".$isQyueryConfirmar;';

const MUTANTES = [
    ['filtro extra al final del WHERE (and p.cierre=0)',
        (t) => mutarEn507(t, LINEA_WHERE, LINEA_WHERE.replace(/;$/, '." and p.cierre=0";'))],
    ['filtro extra en $condicion',
        (t) => mutarEn507(t, "$condicion='p.nummesa='.$nummesa;", "$condicion='p.nummesa='.$nummesa.' and p.idusuario>0';")],
    ['filtro agregado después con $sql .=',
        (t) => mutarEn507(t, LINEA_WHERE, `${LINEA_WHERE}\n\t\t\t$sql .= " and p.cierre=0";`)],
    ['SQL vieja comentada con /* */ y otra nueva con filtro',
        (t) => {
            const inicio = t.search(/^[ \t]*case\s+507\s*:/m);
            const fin = t.indexOf(LINEA_WHERE, inicio) + LINEA_WHERE.length;
            const sql = t.lastIndexOf('$sql="', fin);
            const nueva = '$sql="SELECT p.* FROM pedido AS p WHERE p.idpedido >= $lastIdPedido and p.cierre=0 and (p.idsede=".$g_idsede." and ".$condicion.") and ".$isQyueryConfirmar;';
            return `${t.slice(0, sql)}/* ${t.slice(sql, fin)} */\n\t\t\t${nueva}${t.slice(fin)}`;
        }],
];

let crudo;
let case507;

beforeAll(() => {
    crudo = leerLogPhp();
    case507 = extraerCase(phpSinComentarios(crudo), 507);
});

describe('Control de pedidos sigue definiendo "cuenta abierta" como el puente', () => {
    test('log.php real cumple el contrato (bandera, estado IN(0,1), WHERE completo, $condicion)', () => {
        expect(contrato507(crudo)).toEqual([]);
    });

    test.each(MUTANTES)('el contrato detecta el mutante: %s', (_nombre, mutar) => {
        const mutado = mutar(crudo);
        expect(mutado).not.toBe(crudo);
        expect(contrato507(mutado)).not.toEqual([]);
    });

    test('el puente usa el mismo procedimiento, estado y cota que el 507', () => {
        expect(vision.SQL.bandera).toBe('call lastIdPedidoSede(?, 1)');
        expect(vision.SQL.cuentas).toMatch(/p\.estado IN \(0,1\)/);
        expect(vision.SQL.cuentas).toMatch(/WHERE p\.idpedido >= \? AND p\.idsede = \? AND p\.estado IN \(0,1\)\s*$/);
        expect(vision.SQL.cuentas).toMatch(/FROM pedido AS p\b/);
    });

    test('case 507: los LEFT JOIN son por PK (usuario, cliente, repartidor): no cambian el conjunto de filas', () => {
        // El puente no los hace. Si 507 suma un INNER JOIN o un join que multiplique filas, revisar.
        const from = case507.slice(case507.indexOf('FROM pedido AS p'), case507.indexOf('WHERE p.idpedido'));
        const joins = [...from.matchAll(/\b(left|inner|right)?\s*join\b/gi)].map((m) => (m[1] || '').toLowerCase());
        expect(joins).toEqual(['left', 'left', 'left']);
        expect(from).toMatch(/left JOIN usuario AS u on p\.idusuario = u\.idusuario/);
        expect(from).toMatch(/left join cliente as c on p\.idcliente = c\.idcliente/);
        expect(from).toMatch(/left join repartidor as r on r\.idrepartidor = p\.idrepartidor/);
    });
});

describe('choque 3: el puente NO baja la bandera con numpedido', () => {
    test('case 507 la baja con el numpedido de la tarjeta (cuentas viejas); el puente no tiene tarjeta', () => {
        expect(case507).toContain('if ($numpedido < $lastIdPedido) {');
        expect(case507).toContain('$lastIdPedido = $numpedido > 0 ? $numpedido - 500 : $numpedido;');
    });

    test('el código del puente no usa numpedido ni resta a la bandera', () => {
        const fuente = fs.readFileSync(path.join(__dirname, '..', 'service', 'vision.service.js'), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, '');
        expect(fuente).not.toMatch(/numpedido/);
        expect(fuente).not.toMatch(/-\s*500\b/);
    });
});
