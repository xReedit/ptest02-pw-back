/**
 * Sedes que atiende un repartidor (casa ∪ repartidor_sede_atiende) y su uso en pendientes y apiComercio.
 * Plan: restobar/plan/REPARTIDOR-MULTISEDE-PLAN.md (Tarea 8).
 * Ejecutar: npx jest test/repartidor-sedes.service.test.js
 */
const mockConsultas = [];
let mockRespuestasSelect = [];

jest.mock('../config/database', () => ({ sequelize: { getQueryInterface: () => ({ escape: (s) => s }), query: jest.fn() }, Sequelize: {}, QueryTypes: {} }));
jest.mock('../service/query.service.v1', () => ({
    ejecutarConsulta: jest.fn(async (sql, params, type) => {
        mockConsultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), params, type });
        return mockRespuestasSelect.length ? mockRespuestasSelect.shift() : [];
    }),
    ejecutarProcedimiento: jest.fn(async () => [])
}));
jest.mock('../service/estado-pedido.service', () => ({ notificar: jest.fn(), leerEstado: jest.fn(), setIo: jest.fn() }));
jest.mock('../utilitarios/logger', () => ({ debug: () => {}, error: () => {}, warn: () => {}, info: () => {} }));
jest.mock('../utilitarios/filters', () => ({ getInfoToken: (req, key) => (req.usuariotoken || {})[key] || null }));
jest.mock('../service/uitl.service', () => ({
    to: jest.fn(),
    ReS: (res, data) => { res.body = { ...(data || {}), success: true }; return res; },
    ReE: (res, err, code) => { res.statusCode = code || 500; res.body = { success: false, error: (err && err.message) || err }; return res; }
}));
jest.mock('../controllers/sendMsj.js', () => ({}));

const { sedesQueAtiende, repartidoresDeSede } = require('../service/repartidor-sedes.service');
const apiRepartidor = require('../controllers/apiRepartidor');
const apiComercio = require('../controllers/apiComercio');

const res = () => ({ statusCode: 200, body: null });

beforeEach(() => {
    mockConsultas.length = 0;
    mockRespuestasSelect = [];
});

describe('sedesQueAtiende', () => {
    test('casa 13 y tabla [13, 26] → [13, 26] sin repetidos', async () => {
        mockRespuestasSelect = [[{ idsede: 13 }, { idsede: 13 }, { idsede: '26' }]];
        expect(await sedesQueAtiende(7)).toEqual([13, 26]);
        const q = mockConsultas[0];
        expect(q.params).toEqual([7, 7]);
        expect(q.sql).toContain('repartidor_sede_atiende');
        expect(q.sql).toContain('s.idorg = casa.idorg');
        expect(q.sql).toContain('s.estado = 0');
        expect(q.sql).toContain('is_bloqueado');
    });

    test('global (sin casa) → []', async () => {
        mockRespuestasSelect = [[]];
        expect(await sedesQueAtiende(7)).toEqual([]);
    });
});

describe('repartidoresDeSede', () => {
    test('de casa o por la tabla, activos, con prepared statement', async () => {
        mockRespuestasSelect = [[{ idrepartidor: 1 }, { idrepartidor: 2 }]];
        expect(await repartidoresDeSede(26)).toHaveLength(2);
        expect(mockConsultas[0].params).toEqual([26, 26]);
        expect(mockConsultas[0].sql).toContain('r.estado = 0');
        expect(mockConsultas[0].sql).toContain('repartidor_sede_atiende');
    });
});

describe('getListPedidosPendientesComercio', () => {
    const req = { usuariotoken: { idrepartidor: 7, idsede_suscrito: 13 } };

    test('consulta las sedes que atiende con fecha sargable y nombre de sede', async () => {
        mockRespuestasSelect = [
            [{ idsede: 13 }, { idsede: 26 }],
            [{ idpedido: 1, idsede: 26, sede_nombre: 'SEDE B' }]
        ];
        const r = res();
        await apiRepartidor.getListPedidosPendientesComercio(req, r);
        expect(r.body.data).toEqual([{ idpedido: 1, idsede: 26, sede_nombre: 'SEDE B' }]);
        const q = mockConsultas[1];
        expect(q.sql).toContain('p.idsede IN (?)');
        expect(q.sql).toContain('p.fecha_hora >=');
        expect(q.sql).toContain('s.nombre AS sede_nombre');
        expect(q.sql).not.toContain('CAST(p.fecha_hora');
        expect(q.params).toEqual([[13, 26]]);
    });

    test('sin sedes → data [] sin consultar pedido', async () => {
        mockRespuestasSelect = [[]];
        const r = res();
        await apiRepartidor.getListPedidosPendientesComercio(req, r);
        expect(r.body.data).toEqual([]);
        expect(mockConsultas.filter(c => c.sql.includes('FROM pedido'))).toHaveLength(0);
    });
});

describe('apiComercio: repartidores de la sede', () => {
    test.each(['getComercioRepartidorSuscrito', 'getMisRepartidores'])('%s usa repartidoresDeSede', async (fn) => {
        mockRespuestasSelect = [[{ idrepartidor: 1 }]];
        const r = res();
        await apiComercio[fn]({ usuariotoken: { idsede: 26 } }, r);
        expect(r.body.data).toEqual([{ idrepartidor: 1 }]);
        expect(mockConsultas[0].params).toEqual([26, 26]);
    });
});
