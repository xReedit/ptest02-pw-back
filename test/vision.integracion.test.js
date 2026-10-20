/**
 * Puente /vision/v1 contra la MySQL de DESARROLLO (manual, se salta en la suite).
 *
 *   VISION_TEST_MYSQL=1 VISION_TEST_IDSEDE=13 npx jest test/vision.integracion
 *
 * Verifica que leerCuentas ve, mesa por mesa, el mismo conjunto de idpedido que
 * Control de pedidos (log.php case 507 con m=<mesa>, confirmar_pago=0).
 *
 * Solo SELECT. OJO: lastIdPedidoSede(idsede, 1) puede recalcular y escribir
 * pedido_correlativos de ESA sede, igual que abrir Control de pedidos.
 * La consulta de referencia va con sequelize.query directo (lanza si falla):
 * QueryServiceV1.ejecutarConsulta devuelve [] ante un error y daría un verde falso.
 */

jest.mock('../utilitarios/logger', () => ({
    debug: jest.fn(), error: jest.fn(), warn: jest.fn(), info: jest.fn()
}));

const CON_MYSQL = process.env.VISION_TEST_MYSQL === '1';
const IDSEDE = parseInt(process.env.VISION_TEST_IDSEDE, 10);
const describeMysql = CON_MYSQL ? describe : describe.skip;

// Texto de log.php case 507 (bdphp/log.php:2101-2110), con las variables PHP
// sustituidas como lo hace PHP: $lastIdPedido, $g_idsede, $condicion, $isQyueryConfirmar.
function sql507(lastIdPedido, gIdsede, condicion) {
    const isQyueryConfirmar = 'p.estado IN(0,1)'; // confirmar_pago = 0
    return `
				SELECT p.*,
					SUBSTRING_INDEX(u.nombres, ' ', 1) AS nom_usuario,
					concat('P',LPAD(p.correlativo_dia,3,'0')) AS des_pedido,TIMESTAMPDIFF(MINUTE , STR_TO_DATE(concat(p.fecha,' ',p.hora),'%d/%m/%Y %H:%i:%s'), CURRENT_TIMESTAMP() ) AS min_transcurridos
					, c.idcliente, c.nombres, p.idcliente
					, r.idrepartidor, r.nombre as nom_repartidor, r.apellido as ap_repartidor, r.telefono as tel_repartidor
				FROM pedido AS p
					left JOIN usuario AS u on p.idusuario = u.idusuario
					left join cliente as c on p.idcliente = c.idcliente
					left join repartidor as r on r.idrepartidor = p.idrepartidor
				WHERE p.idpedido >= ${lastIdPedido} and (p.idsede=${gIdsede} and ${condicion}) and ${isQyueryConfirmar}`;
}

const ordenar = (ids) => ids.map(Number).sort((a, b) => a - b);

describeMysql(`puente contra MySQL dev (sede ${IDSEDE})`, () => {
    let vision;
    let sequelize;
    let QueryTypes;

    const select = (sql, replacements = []) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

    // Segunda llamada a la bandera: devuelve lo que ya guardó la de leerCuentas (mismo valor).
    async function banderaDeSede() {
        const filas = await require('../service/query.service.v1')
            .ejecutarProcedimiento('call lastIdPedidoSede(?, 1)', [IDSEDE], 'test-vision-bandera');
        if (!filas || !filas[0]) throw new Error('lastIdPedidoSede no respondió');
        const bandera = Number(filas[0].idpedido);
        expect(bandera).toBeGreaterThan(0);
        return bandera;
    }

    beforeAll(() => {
        if (!(IDSEDE > 0)) throw new Error('VISION_TEST_IDSEDE (entero > 0) es obligatorio');
        vision = require('../service/vision.service');
        ({ sequelize, QueryTypes } = require('../config/database'));
    });

    afterAll(async () => {
        if (sequelize) await sequelize.close();
    });

    test('para cada mesa con cuenta, los idpedido de leerCuentas = los de case 507 (m=<mesa>)', async () => {
        const data = await vision.leerCuentas(IDSEDE);
        const bandera = await banderaDeSede();

        const porMesa = new Map();
        for (const c of data.cuentas) {
            const k = vision.claveMesa(c.mesa);
            if (!porMesa.has(k)) porMesa.set(k, []);
            porMesa.get(k).push(c.idpedido);
        }
        if (porMesa.size === 0) {
            throw new Error(`La sede ${IDSEDE} no tiene cuentas abiertas desde la bandera ${bandera}: elegir otra sede de prueba`);
        }

        for (const [k, ids] of porMesa) {
            // PHP arma p.nummesa=<m> sin comillas (log.php:2076). Con una mesa alfanumérica esa
            // SQL revienta en Control de pedidos (choque 2); aquí se compara con comillas.
            const condicion = /^\d+$/.test(k) ? `p.nummesa=${k}` : `p.nummesa='${k.replace(/'/g, "''")}'`;
            const ref = await select(sql507(Number(bandera), IDSEDE, condicion));
            expect({ mesa: k, ids: ordenar(ids) }).toEqual({ mesa: k, ids: ordenar(ref.map((f) => f.idpedido)) });
        }
    });

    test('ninguna cuenta abierta con mesa queda afuera (solo se excluyen "" y "0")', async () => {
        const data = await vision.leerCuentas(IDSEDE);
        const bandera = await banderaDeSede();
        const todas = await select(
            'SELECT p.idpedido, p.nummesa FROM pedido AS p WHERE p.idpedido >= ? AND p.idsede = ? AND p.estado IN (0,1)',
            [Number(bandera), IDSEDE]
        );
        const conMesa = todas.filter((f) => !['', '0'].includes(vision.claveMesa(f.nummesa)));
        expect(ordenar(data.cuentas.map((c) => c.idpedido))).toEqual(ordenar(conMesa.map((f) => f.idpedido)));
        for (const c of data.cuentas) {
            expect(c.creado).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/);
            expect(c.total).toMatch(/^-?\d+\.\d{2}$/);
            expect(['qr', 'personal']).toContain(c.origen);
        }
    });

    test('corte_dia y por_confirmar coinciden con sede_opciones / pedido_por_confirmar', async () => {
        const data = await vision.leerCuentas(IDSEDE);
        const corte = await select('SELECT hora_cierre_dia FROM sede_opciones WHERE idsede = ?', [IDSEDE]);
        expect(data.corte_dia).toBe(vision.corteDia(corte[0] ? corte[0].hora_cierre_dia : null));
        expect(data.corte_dia).toMatch(/^\d{2}:\d{2}$/);

        const ppc = await select(
            "SELECT mesa FROM pedido_por_confirmar WHERE idsede = ? AND estado = '0' AND fecha_registro >= NOW() - INTERVAL 1 DAY",
            [IDSEDE]
        );
        expect(data.por_confirmar.map((p) => p.mesa).sort()).toEqual(ppc.map((p) => p.mesa).sort());
        for (const p of data.por_confirmar) {
            expect(p.creado).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00$/);
        }
    });

    test('leerPedidosMesa (últimas 23 h): mismos idpedido que la referencia, sin anulados, pagado = estado 2', async () => {
        const desde = new Date(Date.now() - 23 * 3600 * 1000);
        const desdeLima = vision.limaLocal(desde);
        const mesas = await select(
            'SELECT DISTINCT p.nummesa FROM pedido AS p WHERE p.idsede = ? AND p.fecha_hora >= ? AND p.nummesa NOT IN (\'\', \'0\')',
            [IDSEDE, desdeLima]
        );
        for (const { nummesa } of mesas) {
            const { pedidos } = await vision.leerPedidosMesa(IDSEDE, nummesa, desde);
            const k = vision.claveMesa(nummesa);
            const ref = await select(
                `SELECT p.idpedido, p.nummesa, p.estado,
                        (SELECT MAX(STR_TO_DATE(rp.fecha, '%d/%m/%Y %H:%i:%s'))
                           FROM registro_pago_pedido AS rpp
                           INNER JOIN registro_pago AS rp ON rp.idregistro_pago = rpp.idregistro_pago
                          WHERE rpp.idpedido = p.idpedido) AS pagado_en
                   FROM pedido AS p
                  WHERE p.idsede = ? AND p.fecha_hora >= ? AND p.estado <> 3`,
                [IDSEDE, desdeLima]
            );
            const deLaMesa = ref.filter((f) => vision.claveMesa(f.nummesa) === k);
            expect(ordenar(pedidos.map((p) => p.idpedido))).toEqual(ordenar(deLaMesa.map((f) => f.idpedido)));
            for (const p of pedidos) {
                const f = deLaMesa.find((x) => Number(x.idpedido) === p.idpedido);
                expect(Number(f.estado)).not.toBe(3);
                expect(p.pagado).toBe(Number(f.estado) === 2);
                if (p.pagado && f.pagado_en) {
                    expect(p.pagado_en).toBe(String(f.pagado_en).replace(' ', 'T').slice(0, 19) + '-05:00');
                } else if (!p.pagado) {
                    expect(p.pagado_en).toBeNull();
                }
            }
        }
    });
});

if (!CON_MYSQL) {
    test.skip('puente contra MySQL dev: se corre a mano con VISION_TEST_MYSQL=1 VISION_TEST_IDSEDE=<sede>', () => {});
}
