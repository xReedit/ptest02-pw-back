/**
 * Tests de controllers/apiRepartidorV2.js con la base de datos simulada.
 * Cubren las reglas que resuelven los dos síntomas de producción:
 *  - "suena y no hay nada": oferta con expiración, renovación al único candidato, no reasignar mientras esté viva
 *  - "el pedido se queda en la lista": entregar libera, aceptar valida que el pedido siga libre (409), liberar rechaza entregados
 *
 * Ejecutar: npx jest test/apiRepartidorV2.test.js
 */

const mockConsultas = []; // [{ sql, params, type }]
let mockRespuestasSelect = [];  // cola de resultados para SELECT (en orden de llamada)
let mockRespuestasSP = [];      // cola de resultados para procedimientos

jest.mock('../service/query.service.v1', () => ({
    ejecutarConsulta: jest.fn(async (sql, params, type) => {
        mockConsultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), params, type });
        if (type === 'SELECT') return mockRespuestasSelect.length ? mockRespuestasSelect.shift() : [];
        return true;
    }),
    ejecutarProcedimiento: jest.fn(async (sql, params) => {
        mockConsultas.push({ sql: sql.replace(/\s+/g, ' ').trim(), params, type: 'CALL' });
        return mockRespuestasSP.length ? mockRespuestasSP.shift() : [];
    })
}));

const mockEmitidos = []; // { room, evento, data }
const mockIo = { to: (room) => ({ emit: (evento, data) => mockEmitidos.push({ room, evento, data }) }) };
jest.mock('../service/socket.manager', () => ({ getIO: () => mockIo, setIO: () => {}, emitToRoom: () => {} }));

jest.mock('../utilitarios/logger', () => ({ debug: () => {}, error: () => {}, warn: () => {}, info: () => {} }));
jest.mock('../utilitarios/filters', () => ({ getInfoToken: (req, key) => (req.usuariotoken || {})[key] || null }));
jest.mock('../service/uitl.service', () => ({
    ReS: (res, data) => { res.body = { ...(data || {}), success: true }; return res; },
    ReE: (res, err, code) => { res.statusCode = code || 500; res.body = { success: false, error: (err && err.message) || err }; return res; }
}));

const mockApiRepartidor = {
    getPedidosEsperaRepartidor: jest.fn(async () => []),
    getRepartidoreForPedidoFromInterval: jest.fn(async () => []),
    getSocketIdRepartidor: jest.fn(async () => [{ socketid: 'sock-anterior', ocupado: 0 }]),
    setEfectivoMano: jest.fn(async (req, res) => { res.body = { success: true, data: true }; return res; })
};
jest.mock('../controllers/apiRepartidor.js', () => mockApiRepartidor);
jest.mock('../controllers/apiComercio.js', () => ({ getSocketIdComercio: jest.fn(async () => [{ socketid: 'sock-comercio' }]) }));
const mockPush = { sendPushNotificactionOneRepartidor: jest.fn() };
jest.mock('../controllers/sendMsj.js', () => mockPush);

const v2 = require('../controllers/apiRepartidorV2');

const req = (body = {}, idrepartidor = 7) => ({ body, usuariotoken: { idrepartidor } });
const res = () => ({ statusCode: 200, body: null });
const sqlLlamadas = (fragmento) => mockConsultas.filter(c => c.sql.includes(fragmento));
const logs = (evento) => sqlLlamadas('repartidor_evento_log').filter(c => c.params[2] === evento);

beforeEach(() => {
    mockConsultas.length = 0;
    mockEmitidos.length = 0;
    mockRespuestasSelect = [];
    mockRespuestasSP = [];
    jest.clearAllMocks();
});

describe('getMiEstado', () => {
    test('devuelve asignados y una oferta vigente con su detalle', async () => {
        const ppa = { pedidos: [10, 11], importe_pagar: 55, expira_en: Date.now() + 60000 };
        mockRespuestasSelect = [
            [{ ocupado: 0, online: 1, flag_paso_pedido: 10, pedido_por_aceptar: JSON.stringify(ppa) }], // repartidor
            [{ idpedido: 5, pwa_delivery_status: '1' }],                                                 // asignados
            [{ idpedido: 10 }, { idpedido: 11 }]                                                         // detalle oferta
        ];
        const r = res();
        await v2.getMiEstado(req(), r);
        expect(r.body.success).toBe(true);
        expect(r.body.data.asignados).toHaveLength(1);
        expect(r.body.data.oferta.pedidos).toEqual([10, 11]);
        expect(r.body.data.oferta.expira_en).toBe(ppa.expira_en);
        expect(typeof r.body.data.servidor_hora).toBe('number');
    });

    test('una oferta expirada no se devuelve', async () => {
        const ppa = { pedidos: [10], expira_en: Date.now() - 1000 };
        mockRespuestasSelect = [
            [{ ocupado: 0, online: 1, flag_paso_pedido: 10, pedido_por_aceptar: ppa }],
            []
        ];
        const r = res();
        await v2.getMiEstado(req(), r);
        expect(r.body.data.oferta).toBeNull();
        expect(sqlLlamadas('COALESCE(p.idrepartidor, 0) = 0')).toHaveLength(0); // no consulta el detalle
    });

    test('una oferta cuyos pedidos ya tienen otro repartidor no se devuelve', async () => {
        mockRespuestasSelect = [
            [{ ocupado: 0, online: 1, flag_paso_pedido: 10, pedido_por_aceptar: { pedidos: [10] } }],
            [],
            [] // detalle vacío: el pedido ya tiene idrepartidor
        ];
        const r = res();
        await v2.getMiEstado(req(), r);
        expect(r.body.data.oferta).toBeNull();
    });

    test('sin idrepartidor en el token responde 401', async () => {
        const r = res();
        await v2.getMiEstado(req({}, null), r);
        expect(r.statusCode).toBe(401);
    });
});

describe('setAsignarPedido (aceptar)', () => {
    test('acepta cuando todos los pedidos quedaron a nombre del repartidor y quita la oferta a otros', async () => {
        mockRespuestasSelect = [
            [{ n: 2 }],                                        // COUNT mios
            [{ idrepartidor: 9, socketid: 'sock-otro' }]       // otros con la misma oferta
        ];
        const r = res();
        await v2.setAsignarPedido(req({ idpedido: '10,11' }), r);
        expect(r.statusCode).toBe(200);
        expect(r.body).toEqual({ data: true, success: true });
        const update = sqlLlamadas('UPDATE pedido SET idrepartidor')[0];
        expect(update.params).toEqual([7, [10, 11], 7]);
        expect(update.sql).toContain('COALESCE(idrepartidor, 0) = 0 OR idrepartidor = ?');
        expect(sqlLlamadas('SET ocupado = 1, pedido_paso_va = 1, flag_paso_pedido = 0')).toHaveLength(1);
        expect(mockEmitidos).toContainEqual({ room: 'sock-otro', evento: 'repartidor-estado-cambio', data: undefined });
        expect(logs('aceptado')).toHaveLength(1);
        expect(logs('oferta_quitada')).toHaveLength(1);
    });

    test('responde 409 y limpia la oferta propia si otro repartidor ya tomó el pedido', async () => {
        mockRespuestasSelect = [[{ n: 1 }]]; // solo 1 de 2 quedó a mi nombre
        const r = res();
        await v2.setAsignarPedido(req({ idpedido: '10,11' }), r);
        expect(r.statusCode).toBe(409);
        expect(r.body.success).toBe(false);
        expect(sqlLlamadas('SET flag_paso_pedido = 0, pedido_por_aceptar = NULL WHERE idrepartidor = ? AND ocupado = 0')).toHaveLength(1);
        expect(sqlLlamadas('SET ocupado = 1')).toHaveLength(0);
        expect(logs('aceptar_rechazado')).toHaveLength(1);
    });

    test('sin idpedido válido responde 400', async () => {
        const r = res();
        await v2.setAsignarPedido(req({ idpedido: 'abc' }), r);
        expect(r.statusCode).toBe(400);
        expect(mockConsultas).toHaveLength(0);
    });
});

describe('setFinPedidoEntregado (entregar)', () => {
    test('llama al SP v2, notifica comercio/restobar/monitor y libera cuando no quedan activos', async () => {
        mockRespuestasSP = [[{ comercio_afiliado: 1, pedidos_activos: 0 }]];
        const r = res();
        await v2.setFinPedidoEntregado(req({ idpedido: 10, idsede: 26, idorg: 23, time_line: { paso: 3 } }), r);
        expect(r.body.pedidos_activos).toBe(0);
        const call = sqlLlamadas('procedure_pwa_delivery_pedido_entregado_v2')[0];
        expect(JSON.parse(call.params[0]).idrepartidor).toBe(7); // el idrepartidor sale del token
        expect(mockEmitidos.map(e => `${e.room}:${e.evento}`)).toEqual([
            'sock-comercio:repartidor-notifica-fin-pedido',
            'room2326:repartidor-notifica-fin-pedido',
            'MONITOR:repartidor-notifica-fin-pedido',
            'MONITOR:repartidor-grupo-pedido-finalizado'
        ]);
        expect(logs('entregado')).toHaveLength(1);
        expect(logs('liberado')).toHaveLength(1);
    });

    test('con pedidos activos restantes no emite grupo finalizado', async () => {
        mockRespuestasSP = [[{ comercio_afiliado: 0, pedidos_activos: 2 }]];
        const r = res();
        await v2.setFinPedidoEntregado(req({ idpedido: 10, idsede: 26, idorg: 23 }), r);
        expect(mockEmitidos.some(e => e.evento === 'repartidor-grupo-pedido-finalizado')).toBe(false);
        expect(logs('liberado')).toHaveLength(0);
    });

    test('sin idpedido responde 400 y no llama al SP', async () => {
        const r = res();
        await v2.setFinPedidoEntregado(req({}), r);
        expect(r.statusCode).toBe(400);
        expect(sqlLlamadas('procedure_pwa_delivery_pedido_entregado_v2')).toHaveLength(0);
    });
});

describe('setPedidoCanceladoRepartidor (liberar)', () => {
    test('rechaza con 409 un pedido ya entregado', async () => {
        mockRespuestasSelect = [[{ pwa_delivery_status: '4' }]];
        const r = res();
        await v2.setPedidoCanceladoRepartidor(req({ idpedido: 10, idsede: 26, motivo: 'x' }), r);
        expect(r.statusCode).toBe(409);
        expect(sqlLlamadas('INSERT INTO pedido_delivery_cancelado_repartidor')).toHaveLength(0);
    });

    test('libera al repartidor cuando era su único pedido', async () => {
        mockRespuestasSelect = [
            [{ pwa_delivery_status: '1' }],
            [{ pedido_por_aceptar: { pedidos: [10] } }]
        ];
        const r = res();
        await v2.setPedidoCanceladoRepartidor(req({ idpedido: 10, idsede: 26, motivo: 'cerrado' }), r);
        expect(r.body).toEqual({ data: true, success: true });
        expect(sqlLlamadas("SET pwa_delivery_status = '5', pwa_estado = 'C' WHERE idpedido = ? AND idrepartidor = ?")).toHaveLength(1);
        expect(sqlLlamadas('pedido_por_aceptar = NULL, ocupado = 0, pedido_paso_va = 0, flag_paso_pedido = 0')).toHaveLength(1);
        expect(logs('liberado_pedido')).toHaveLength(1);
    });

    test('con más pedidos solo quita el liberado del JSON', async () => {
        mockRespuestasSelect = [
            [{ pwa_delivery_status: '1' }],
            [{ pedido_por_aceptar: JSON.stringify({ pedidos: [10, 11], cantidad_pedidos_aceptados: 2 }) }]
        ];
        await v2.setPedidoCanceladoRepartidor(req({ idpedido: 10, idsede: 26, motivo: 'x' }), res());
        const upd = sqlLlamadas('UPDATE repartidor SET pedido_por_aceptar = ? WHERE idrepartidor = ?')[0];
        expect(JSON.parse(upd.params[0])).toEqual({ pedidos: [11], cantidad_pedidos_aceptados: 1 });
        expect(sqlLlamadas('ocupado = 0')).toHaveLength(0);
    });
});

describe('asignarmePedido', () => {
    test('rechaza con 409 si el pedido es de otro repartidor', async () => {
        mockRespuestasSelect = [[{ idrepartidor: 9, estado: 1 }]];
        const r = res();
        await v2.asignarmePedido(req({ idpedido: 10, pedidos: [10], importe: 20, idsede: 26 }), r);
        expect(r.statusCode).toBe(409);
        expect(sqlLlamadas('procedure_delivery_set_pedido_repartidor_manual')).toHaveLength(0);
    });

    test('asigna con el SP del monitor y avisa a quien tenía la oferta', async () => {
        mockRespuestasSelect = [
            [{ idrepartidor: null, estado: 1 }],
            [{ idrepartidor: 9, socketid: 'sock-otro' }]
        ];
        const r = res();
        await v2.asignarmePedido(req({ idpedido: 10, pedidos: [5, 10], importe: 45.5, idsede: 26 }), r);
        expect(r.body.success).toBe(true);
        const call = sqlLlamadas('procedure_delivery_set_pedido_repartidor_manual')[0];
        const obj = JSON.parse(call.params[0]);
        expect(obj).toMatchObject({ pedidos: [5, 10], pedido_asignado_manual: 10, idrepartidor: 7, importe_pagar: 45.5, inSede: true, isexpress: 0 });
        expect(mockEmitidos).toContainEqual({ room: 'sock-otro', evento: 'repartidor-estado-cambio', data: undefined });
        expect(logs('asignado_manual')).toHaveLength(1);
    });
});

describe('setEfectivoMano', () => {
    test('fuerza el idrepartidor del token e ignora el del body', async () => {
        const r = res();
        const rq = req({ idrepartidor: 999, online: 1, efectivo: 50 });
        await v2.setEfectivoMano(rq, r);
        expect(rq.body.idrepartidor).toBe(7);
        expect(mockApiRepartidor.setEfectivoMano).toHaveBeenCalledTimes(1);
        expect(logs('online')).toHaveLength(1);
    });
});

describe('loop v2: colocarPedidoEnRepartidor', () => {
    const pedidoPendiente = (idpedido, extra = {}) => ({
        idpedido, idsede: 26, isshow: 1, isshow_back: 1, paso: false, total: '30.00', monto_acumula: 100,
        latitude: '-6.03', longitude: '-76.97', cliente_pasa_recoger: 'false', num_reasignaciones: null, last_id_repartidor_reasigno: null,
        json_datos_delivery: JSON.stringify({ p_header: { arrDatosDelivery: { metodoPago: { idtipo_pago: 1 } } } }),
        ...extra
    });

    test('ofrece al mejor candidato con expira_en, espera al SP y luego notifica', async () => {
        mockApiRepartidor.getPedidosEsperaRepartidor.mockResolvedValueOnce([pedidoPendiente(10)]);
        mockApiRepartidor.getRepartidoreForPedidoFromInterval.mockResolvedValueOnce([{ idrepartidor: 7 }]);
        mockRespuestasSelect = [
            [],                                                                              // ofertaViva: nadie
            [{ idrepartidor: 7, socketid: 'sock-7', pwa_code_verification: null, fcm_token: 'fcm-7' }] // datosNotificacion
        ];
        const antes = Date.now();
        await v2.colocarPedidoEnRepartidor(mockIo, 0);

        const sp = sqlLlamadas('procedure_delivery_set_pedido_repartidor(')[0];
        expect(sp.params[0]).toBe(10);
        expect(sp.params[1]).toBe(7);
        const obj = JSON.parse(sp.params[2]);
        expect(obj.pedidos).toEqual([10]);
        expect(obj.expira_en).toBeGreaterThanOrEqual(antes + v2.OFERTA_VENTANA_MS);

        // el SP se ejecuta ANTES del push y del socket
        const idxSP = mockConsultas.indexOf(sp);
        expect(mockPush.sendPushNotificactionOneRepartidor).toHaveBeenCalledTimes(1);
        expect(mockConsultas.findIndex(c => c.sql.includes('datosNotificacion') || c.sql.includes('pwa_code_verification, fcm_token'))).toBeGreaterThan(idxSP);
        expect(mockEmitidos).toContainEqual({ room: 'sock-7', evento: 'repartidor-estado-cambio', data: undefined });
        expect(mockEmitidos.some(e => e.room === 'sock-7' && e.evento === 'repartidor-nuevo-pedido')).toBe(true);
        expect(logs('oferta_enviada')).toHaveLength(1);
    });

    test('no reasigna mientras la oferta de alguien siga viva', async () => {
        mockApiRepartidor.getPedidosEsperaRepartidor.mockResolvedValueOnce([pedidoPendiente(10)]);
        mockRespuestasSelect = [[{ idrepartidor: 7 }]]; // ofertaViva
        await v2.colocarPedidoEnRepartidor(mockIo, 0);
        expect(mockApiRepartidor.getRepartidoreForPedidoFromInterval).not.toHaveBeenCalled();
        expect(sqlLlamadas('procedure_delivery_set_pedido_repartidor(')).toHaveLength(0);
        expect(mockPush.sendPushNotificactionOneRepartidor).not.toHaveBeenCalled();
    });

    test('sin candidatos renueva la oferta al repartidor que la tenía en vez de borrarla', async () => {
        mockApiRepartidor.getPedidosEsperaRepartidor.mockResolvedValueOnce([pedidoPendiente(10, { last_id_repartidor_reasigno: 7, num_reasignaciones: 1 })]);
        mockApiRepartidor.getRepartidoreForPedidoFromInterval.mockResolvedValueOnce([]); // nadie más disponible
        mockRespuestasSelect = [
            [],                    // ofertaViva: expiró
            [{ idrepartidor: 7 }], // holder online y libre
            [{ idrepartidor: 7, socketid: 'sock-7', pwa_code_verification: null, fcm_token: 'fcm-7' }]
        ];
        await v2.colocarPedidoEnRepartidor(mockIo, 0);
        expect(sqlLlamadas('SET flag_paso_pedido = 0, pedido_por_aceptar = NULL WHERE flag_paso_pedido = ?')).toHaveLength(0);
        expect(sqlLlamadas('procedure_delivery_set_pedido_repartidor(')[0].params[1]).toBe(7);
        expect(mockEmitidos.some(e => e.evento === 'repartidor-notifica-server-quita-pedido')).toBe(false); // a sí mismo no se le quita
        expect(logs('oferta_renovada')).toHaveLength(1);
    });

    test('sin candidatos y sin holder en línea libera la oferta para el próximo ciclo', async () => {
        mockApiRepartidor.getPedidosEsperaRepartidor.mockResolvedValueOnce([pedidoPendiente(10)]);
        mockApiRepartidor.getRepartidoreForPedidoFromInterval.mockResolvedValueOnce([]);
        mockRespuestasSelect = [[], []];
        await v2.colocarPedidoEnRepartidor(mockIo, 0);
        expect(sqlLlamadas('SET flag_paso_pedido = 0, pedido_por_aceptar = NULL WHERE flag_paso_pedido = ?')).toHaveLength(1);
        expect(mockPush.sendPushNotificactionOneRepartidor).not.toHaveBeenCalled();
    });

    test('al pasar la oferta a otro repartidor, al anterior se le quita y se le avisa', async () => {
        mockApiRepartidor.getPedidosEsperaRepartidor.mockResolvedValueOnce([pedidoPendiente(10, { last_id_repartidor_reasigno: 3, num_reasignaciones: 1 })]);
        mockApiRepartidor.getRepartidoreForPedidoFromInterval.mockResolvedValueOnce([{ idrepartidor: 7 }]);
        mockRespuestasSelect = [
            [],
            [{ idrepartidor: 7, socketid: 'sock-7', pwa_code_verification: 'sub', fcm_token: null }]
        ];
        await v2.colocarPedidoEnRepartidor(mockIo, 0);
        expect(mockEmitidos).toContainEqual({ room: 'sock-anterior', evento: 'repartidor-notifica-server-quita-pedido', data: null });
        expect(mockEmitidos).toContainEqual({ room: 'MONITOR', evento: 'notifica-server-quita-pedido-repartidor', data: 3 });
        expect(logs('oferta_quitada')).toHaveLength(1);
        expect(logs('oferta_enviada')).toHaveLength(1);
    });

    test('agrupa pedidos de la misma sede y los pedidos que recoge el cliente no se ofrecen', async () => {
        mockApiRepartidor.getPedidosEsperaRepartidor.mockResolvedValueOnce([
            pedidoPendiente(10), pedidoPendiente(11), pedidoPendiente(12, { cliente_pasa_recoger: 'true' })
        ]);
        mockApiRepartidor.getRepartidoreForPedidoFromInterval.mockResolvedValueOnce([{ idrepartidor: 7 }]);
        mockRespuestasSelect = [[], [{ idrepartidor: 7, socketid: null }]];
        await v2.colocarPedidoEnRepartidor(mockIo, 0);
        const obj = JSON.parse(sqlLlamadas('procedure_delivery_set_pedido_repartidor(')[0].params[2]);
        expect(obj.pedidos).toEqual([10, 11]);
        expect(obj.importe_pagar).toBe(60);
        expect(mockApiRepartidor.getRepartidoreForPedidoFromInterval).toHaveBeenCalledWith('-6.03', '-76.97', 60);
        expect(mockEmitidos.some(e => e.room === 'MONITOR' && e.evento === 'notifica-pedidos-pendientes')).toBe(true);
    });

    test('sin pedidos pendientes no hace nada', async () => {
        mockApiRepartidor.getPedidosEsperaRepartidor.mockResolvedValueOnce([]);
        await v2.colocarPedidoEnRepartidor(mockIo, 0);
        expect(mockConsultas).toHaveLength(0);
        expect(mockEmitidos).toHaveLength(0);
    });
});
