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

/** Quita comentarios PHP de una sola línea (// ...) conservando las líneas. */
function phpSinComentarios(php) {
    return php.split('\n').map((l) => l.replace(/^\s*\/\/.*$/, '')).join('\n');
}

/** Cuerpo del `case <num>:` hasta la siguiente etiqueta `case <n>:` del archivo. */
function extraerCase(php, num) {
    const etiquetas = [...php.matchAll(/^[ \t]*case\s+(\d+)\s*:/gm)];
    const i = etiquetas.findIndex((m) => m[1] === String(num));
    if (i === -1) throw new Error(`No existe 'case ${num}:' en log.php`);
    const desde = etiquetas[i].index;
    const hasta = i + 1 < etiquetas.length ? etiquetas[i + 1].index : php.length;
    return php.slice(desde, hasta);
}

let php;
let case507;
let case50701;

beforeAll(() => {
    php = phpSinComentarios(leerLogPhp());
    case507 = extraerCase(php, 507);
    case50701 = extraerCase(php, 50701);
});

describe('Control de pedidos sigue definiendo "cuenta abierta" como el puente', () => {
    test('case 50701: la bandera sale de call lastIdPedidoSede($g_idsede, 1)', () => {
        expect(case50701).toContain('call lastIdPedidoSede($g_idsede, 1)');
        expect(vision.SQL.bandera).toBe('call lastIdPedidoSede(?, 1)');
    });

    test('case 507: sin bandera de la tarjeta usa el mismo procedimiento y modo', () => {
        expect(case507).toContain('call lastIdPedidoSede($g_idsede, 1)');
    });

    test("case 507: sin confirmar_pago, abierta = p.estado IN(0,1)", () => {
        expect(case507).toMatch(/if\s*\(\s*\$isConfirmarPago\s*==\s*0\s*\)\s*\{\s*\$isQyueryConfirmar = 'p\.estado IN\(0,1\)';/);
        expect(vision.SQL.cuentas).toMatch(/p\.estado IN \(0,1\)/);
    });

    test('case 507: cota por bandera y sede: WHERE p.idpedido >= $lastIdPedido and (p.idsede=', () => {
        expect(case507).toContain('WHERE p.idpedido >= $lastIdPedido and (p.idsede=');
        expect(vision.SQL.cuentas).toMatch(/WHERE p\.idpedido >= \? AND p\.idsede = \?/);
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
