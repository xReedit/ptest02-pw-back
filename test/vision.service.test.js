// Lectura de cuentas del puente /vision/v1 con la BD simulada.
// El servidor Go decide "sin atención" y "cuenta abierta" con esto: tiene que
// ver exactamente las cuentas que ve Control de pedidos (log.php case 507).

jest.mock('../utilitarios/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

// BD simulada en la capa de sequelize: el puente usa su propio helper estricto
// (lanza ante error de SQL), no QueryServiceV1, que devuelve [] ante un error.
const mockQuery = jest.fn();
jest.mock('../config/database', () => ({
    sequelize: { query: (...a) => mockQuery(...a) },
    QueryTypes: { SELECT: 'SELECT' },
}));

const vision = require('../service/vision.service');
const controller = require('../controllers/vision');

const IDSEDE = 13;
const BANDERA = 26223;

const cuenta = (o = {}) => ({
    idpedido: 26250, nummesa: '5', fecha: '19/10/2026', hora: '13:05:00',
    is_from_client_pwa: 0, total: '45.50', ...o,
});

// Qué consulta es, según su texto.
function tipoDe(sql) {
    if (sql.startsWith('call lastIdPedidoSede')) return 'bandera';
    if (sql.includes('FROM pedido_por_confirmar')) return 'por_confirmar';
    if (sql.includes('FROM sede_opciones')) return 'corte';
    if (sql.includes('p.fecha_hora >=')) return 'pedidos';
    if (sql.includes('FROM pedido AS p')) return 'cuentas';
    throw new Error(`SQL no esperado en el test: ${sql}`);
}

// Responde según el texto del SQL, como pedido.por.confirmar.service.test.js.
// falla: nombre de la consulta que lanza un error de MySQL.
// cuelga: nombre de la consulta que nunca responde (lock, MySQL saturado).
function bd({ bandera = BANDERA, cuentas = [cuenta()], ppc = [], corte = [{ hora_cierre_dia: '0' }], pedidos = [], falla = null, cuelga = null } = {}) {
    mockQuery.mockImplementation(async (sql) => {
        const tipo = tipoDe(sql);
        if (tipo === cuelga) return new Promise(() => {});
        if (tipo === falla) throw new Error(`ER_LOCK_WAIT_TIMEOUT simulado en ${tipo}`);
        switch (tipo) {
            // Forma real de Sequelize para un CALL: [{"0": fila}, OkPacket]
            case 'bandera': return bandera === null ? [{}, { affectedRows: 0 }] : [{ 0: { idpedido: bandera } }, { affectedRows: 0 }];
            case 'por_confirmar': return ppc;
            case 'corte': return corte;
            case 'pedidos': return pedidos;
            default: return cuentas;
        }
    });
}

// [sql, replacements, type] de la primera llamada cuyo SQL contiene el texto.
function llamadaCon(texto) {
    const c = mockQuery.mock.calls.find(([sql]) => sql.includes(texto));
    return c && [c[0], c[1].replacements, c[1].type];
}
const llamadasA = (tipo) => mockQuery.mock.calls.filter(([sql]) => tipoDe(sql) === tipo);

beforeEach(() => jest.clearAllMocks());

describe('claveMesa (misma tabla que TestClaveMesa de Go)', () => {
    test.each([
        ['05', '5'],
        [' 5 ', '5'],
        ['0', '0'],
        ['s1-05', 'S1-05'],
        ['VIP', 'VIP'],
    ])('%j → %j', (codigo, quiere) => {
        expect(vision.claveMesa(codigo)).toBe(quiere);
    });

    test('vacío y nulos → ""', () => {
        expect(vision.claveMesa('')).toBe('');
        expect(vision.claveMesa(null)).toBe('');
        expect(vision.claveMesa('000')).toBe('0');
    });
});

describe('formatos', () => {
    test('total "1,234.50" → "1234.50" (quita las comas de format())', () => {
        expect(vision.normalizarTotal('1,234.50')).toBe('1234.50');
        expect(vision.normalizarTotal('45.5')).toBe('45.50');
        expect(vision.normalizarTotal(12)).toBe('12.00');
    });

    test('total que no es número → "0.00" (el Go rechaza la sede entera con un total inválido)', () => {
        expect(vision.normalizarTotal('abc')).toBe('0.00');
        expect(vision.normalizarTotal(null)).toBe('0.00');
    });

    test('creado "19/10/2026" "13:05:00" → "2026-10-19T13:05:00-05:00"', () => {
        expect(vision.creadoISO('19/10/2026', '13:05:00')).toBe('2026-10-19T13:05:00-05:00');
    });

    test('creado acepta la fecha yyyy-mm-dd que dejan algunos pedidos de app', () => {
        expect(vision.creadoISO('2026-09-08', '20:23:08')).toBe('2026-09-08T20:23:08-05:00');
        expect(vision.creadoISO('9/1/2026', '8:05:00')).toBe('2026-01-09T08:05:00-05:00');
    });

    test('creado ilegible → null', () => {
        expect(vision.creadoISO('', '')).toBeNull();
        expect(vision.creadoISO('ayer', '13:05:00')).toBeNull();
    });

    test('is_from_client_pwa 1 → qr; si no, personal', () => {
        expect(vision.origenDe({ is_from_client_pwa: 1 })).toBe('qr');
        expect(vision.origenDe({ is_from_client_pwa: '1' })).toBe('qr');
        expect(vision.origenDe({ is_from_client_pwa: 0 })).toBe('personal');
        expect(vision.origenDe({})).toBe('personal');
    });

    test('corte "0" → "00:00"; "03:00" se respeta; sin fila → "00:00"', () => {
        expect(vision.corteDia('0')).toBe('00:00');
        expect(vision.corteDia('03:00')).toBe('03:00');
        expect(vision.corteDia('3:00')).toBe('03:00');
        expect(vision.corteDia('05:00:00')).toBe('05:00');
        expect(vision.corteDia(null)).toBe('00:00');
        expect(vision.corteDia('')).toBe('00:00');
    });

    test('limaLocal: instante → "yyyy-mm-dd HH:MM:SS" de Lima (fecha_hora se guarda en hora local)', () => {
        expect(vision.limaLocal(new Date('2026-10-19T18:03:00Z'))).toBe('2026-10-19 13:03:00');
        expect(vision.limaLocal(new Date('2026-10-20T03:30:00Z'))).toBe('2026-10-19 22:30:00');
    });
});

describe('leerCuentas', () => {
    test('llama lastIdPedidoSede(idsede, 1) y usa su valor como cota de idpedido', async () => {
        bd();
        await vision.leerCuentas(IDSEDE);

        expect(llamadasA('bandera')).toHaveLength(1);
        const [sqlProc, paramsProc] = llamadaCon('lastIdPedidoSede');
        expect(sqlProc).toBe('call lastIdPedidoSede(?, 1)');
        expect(paramsProc).toEqual([IDSEDE]);

        const [sql, params, tipo] = llamadaCon('FROM pedido AS p');
        expect(sql).toMatch(/p\.idpedido >= \? AND p\.idsede = \? AND p\.estado IN \(0,1\)/);
        // La cota es la bandera tal cual: el puente no tiene tarjeta, no la baja con numpedido (choque 3).
        expect(params).toEqual([BANDERA, IDSEDE]);
        expect(tipo).toBe('SELECT');
    });

    test('sin filtro de mesa en SQL: trae todas las cuentas de la sede', async () => {
        bd();
        await vision.leerCuentas(IDSEDE);
        const [sql] = llamadaCon('FROM pedido AS p');
        expect(sql).not.toMatch(/nummesa\s*=/);
    });

    test('excluye nummesa "" y "0" (delivery, para llevar: no tienen mesa)', async () => {
        bd({
            cuentas: [
                cuenta({ idpedido: 1, nummesa: '' }),
                cuenta({ idpedido: 2, nummesa: '0' }),
                cuenta({ idpedido: 3, nummesa: '00' }),
                cuenta({ idpedido: 4, nummesa: '05' }),
                cuenta({ idpedido: 5, nummesa: 'S1-02' }),
            ],
        });
        const { cuentas } = await vision.leerCuentas(IDSEDE);
        expect(cuentas.map((c) => c.idpedido)).toEqual([4, 5]);
    });

    test('arma cada cuenta con el contrato: mesa cruda, creado -05:00, origen, total sin comas', async () => {
        bd({ cuentas: [cuenta({ idpedido: 123, nummesa: '05', total: '1,234.50', is_from_client_pwa: 1 })] });
        const { cuentas } = await vision.leerCuentas(IDSEDE);
        expect(cuentas).toEqual([{
            idpedido: 123, mesa: '05', creado: '2026-10-19T13:05:00-05:00', origen: 'qr', total: '1234.50',
        }]);
    });

    test('por_confirmar: pendientes (estado "0") de la sede, mesa cruda y creado -05:00', async () => {
        bd({ ppc: [{ mesa: '5', creado: '2026-10-19T13:04:10-05:00' }] });
        const data = await vision.leerCuentas(IDSEDE);
        expect(data.por_confirmar).toEqual([{ mesa: '5', creado: '2026-10-19T13:04:10-05:00' }]);

        const [sql, params] = llamadaCon('FROM pedido_por_confirmar');
        expect(sql).toMatch(/idsede = \? AND estado = '0'/);
        expect(params[0]).toBe(IDSEDE);
    });

    test('corte del día de sede_opciones: "0" → "00:00", "03:00" → "03:00", sin fila → "00:00"', async () => {
        bd({ corte: [{ hora_cierre_dia: '0' }] });
        expect((await vision.leerCuentas(IDSEDE)).corte_dia).toBe('00:00');
        bd({ corte: [{ hora_cierre_dia: '03:00' }] });
        expect((await vision.leerCuentas(IDSEDE)).corte_dia).toBe('03:00');
        bd({ corte: [] });
        expect((await vision.leerCuentas(IDSEDE)).corte_dia).toBe('00:00');
    });

    test('si lastIdPedidoSede no devuelve bandera, rechaza: nunca responde "sin cuentas" por un error', async () => {
        bd({ bandera: null });
        await expect(vision.leerCuentas(IDSEDE)).rejects.toThrow(/lastIdPedidoSede/);
        expect(llamadasA('cuentas')).toHaveLength(0);
    });

    test.each(['bandera', 'cuentas', 'por_confirmar', 'corte'])('error de SQL en %s → rechaza (no lista vacía)', async (falla) => {
        bd({ falla });
        await expect(vision.leerCuentas(IDSEDE)).rejects.toThrow(/simulado/);
    });
});

describe('leerPedidosMesa', () => {
    const DESDE = new Date('2026-10-19T18:03:00Z'); // 13:03 en Lima
    const pedido = (o = {}) => ({
        idpedido: 26250, nummesa: '5', fecha: '19/10/2026', hora: '13:05:00',
        is_from_client_pwa: 0, total: '45.50', estado: 1, pagado_en: null, ...o,
    });

    test('pedidos excluye estado 3 y entra por idsede + fecha_hora desde "desde" (hora Lima)', async () => {
        bd({ pedidos: [] });
        await vision.leerPedidosMesa(IDSEDE, '05', DESDE);
        const [sql, params, tipo] = llamadaCon('p.fecha_hora >=');
        expect(sql).toMatch(/p\.idsede = \? AND p\.fecha_hora >= \? AND p\.estado <> 3/);
        expect(params).toEqual([IDSEDE, '2026-10-19 13:03:00']);
        expect(tipo).toBe('SELECT');
    });

    test('filtra la mesa en JS con ClaveMesa ("05" = "5" = " 5 ", no "15" ni "S1-05")', async () => {
        bd({
            pedidos: [
                pedido({ idpedido: 1, nummesa: '5' }),
                pedido({ idpedido: 2, nummesa: '05' }),
                pedido({ idpedido: 3, nummesa: '15' }),
                pedido({ idpedido: 4, nummesa: 'S1-05' }),
                pedido({ idpedido: 5, nummesa: ' 5 ' }),
            ],
        });
        const { pedidos } = await vision.leerPedidosMesa(IDSEDE, '05', DESDE);
        expect(pedidos.map((p) => p.idpedido)).toEqual([1, 2, 5]);
    });

    test('pagado = estado 2, con pagado_en; los no pagados van con pagado_en null', async () => {
        bd({
            pedidos: [
                pedido({ idpedido: 1, estado: 2, total: '1,200.00', pagado_en: '2026-10-19T14:10:00-05:00', is_from_client_pwa: 1 }),
                pedido({ idpedido: 2, estado: 0, pagado_en: '2026-10-19T14:00:00-05:00' }),
            ],
        });
        const { pedidos } = await vision.leerPedidosMesa(IDSEDE, '5', DESDE);
        expect(pedidos).toEqual([
            { idpedido: 1, creado: '2026-10-19T13:05:00-05:00', origen: 'qr', total: '1200.00', pagado: true, pagado_en: '2026-10-19T14:10:00-05:00' },
            { idpedido: 2, creado: '2026-10-19T13:05:00-05:00', origen: 'personal', total: '45.50', pagado: false, pagado_en: null },
        ]);
    });
});

// --- controlador: validación y sobre {success, data, error} -----------------
function fakeRes() {
    return {
        statusCode: 200,
        body: null,
        json(payload) { this.body = payload; return this; },
    };
}

describe('GET /vision/v1/cuentas', () => {
    test('responde {success:true, data:{corte_dia, cuentas, por_confirmar}}', async () => {
        bd();
        const res = fakeRes();
        await controller.cuentas({ query: { idsede: '13' } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(Object.keys(res.body.data).sort()).toEqual(['corte_dia', 'cuentas', 'por_confirmar']);
        expect(llamadaCon('lastIdPedidoSede')[1]).toEqual([13]);
    });

    test.each([undefined, '', '0', '-3', 'abc', '13abc', '1.5', ['13', '14']])('idsede %j → 400 pedido_invalido', async (idsede) => {
        bd();
        const res = fakeRes();
        await controller.cuentas({ query: { idsede } }, res);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ success: false, error: 'pedido_invalido' });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test.each(['bandera', 'cuentas', 'por_confirmar', 'corte'])('cuentas con error SQL en %s → 500, nunca lista vacía', async (falla) => {
        bd({ falla });
        const res = fakeRes();
        await controller.cuentas({ query: { idsede: '13' } }, res);
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ success: false, error: 'error_interno' });
    });

    test('lastIdPedidoSede sin fila → 500', async () => {
        bd({ bandera: null });
        const res = fakeRes();
        await controller.cuentas({ query: { idsede: '13' } }, res);
        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);
    });
});

describe('GET /vision/v1/pedidos', () => {
    const haceHoras = (h) => new Date(Date.now() - h * 3600 * 1000);
    const iso = (d) => d.toISOString();

    test('pedidos rechaza desde de hace 25 h → 400 pedido_invalido', async () => {
        bd();
        const res = fakeRes();
        await controller.pedidos({ query: { idsede: '13', mesa: '5', desde: iso(haceHoras(25)) } }, res);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ success: false, error: 'pedido_invalido' });
        expect(mockQuery).not.toHaveBeenCalled();
    });

    test('pedidos con error SQL → 500, nunca lista vacía', async () => {
        bd({ falla: 'pedidos' });
        const res = fakeRes();
        await controller.pedidos({ query: { idsede: '13', mesa: '5', desde: iso(haceHoras(1)) } }, res);
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ success: false, error: 'error_interno' });
    });

    test('desde de hace 23 h con zona -05:00 → 200 {success, data:{pedidos}}', async () => {
        bd({ pedidos: [] });
        const d = haceHoras(23);
        const lima = new Date(d.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 19) + '-05:00';
        const res = fakeRes();
        await controller.pedidos({ query: { idsede: '13', mesa: '05', desde: lima } }, res);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ success: true, data: { pedidos: [] } });
        const [, params] = llamadaCon('p.fecha_hora >=');
        expect(params[1]).toBe(lima.slice(0, 19).replace('T', ' '));
    });

    test.each([
        ['sin desde', { idsede: '13', mesa: '5' }],
        ['desde no ISO', { idsede: '13', mesa: '5', desde: '19/10/2026 13:00' }],
        ['desde sin zona', { idsede: '13', mesa: '5', desde: '2026-10-19T13:00:00' }],
        ['sin mesa', { idsede: '13', desde: 'AHORA' }],
        ['mesa "0"', { idsede: '13', mesa: '0', desde: 'AHORA' }],
        ['mesa repetida', { idsede: '13', mesa: ['5', '6'], desde: 'AHORA' }],
        ['idsede 0', { idsede: '0', mesa: '5', desde: 'AHORA' }],
    ])('%s → 400 pedido_invalido', async (_nombre, query) => {
        bd();
        const q = { ...query };
        if (q.desde === 'AHORA') q.desde = iso(haceHoras(1));
        const res = fakeRes();
        await controller.pedidos({ query: q }, res);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('pedido_invalido');
        expect(mockQuery).not.toHaveBeenCalled();
    });
});

// --- tope de 5 s por consulta: el Go abandona a los 5 s; Node no debe quedarse ----
// esperando con una conexión del pool ocupada ni responder tarde con datos.
describe('tope de 5 s por consulta (falla cerrado)', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test.each(['bandera', 'cuentas', 'por_confirmar', 'corte'])('cuentas: %s colgada → a los 5 s responde 500', async (cuelga) => {
        bd({ cuelga });
        const res = fakeRes();
        const enCurso = controller.cuentas({ query: { idsede: '13' } }, res);
        await jest.advanceTimersByTimeAsync(4999);
        expect(res.body).toBeNull(); // todavía esperando
        await jest.advanceTimersByTimeAsync(1);
        await enCurso;
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ success: false, error: 'error_interno' });
    });

    test('pedidos colgada → a los 5 s responde 500, nunca lista vacía', async () => {
        bd({ cuelga: 'pedidos' });
        const res = fakeRes();
        const desde = new Date(Date.now() - 3600 * 1000).toISOString();
        const enCurso = controller.pedidos({ query: { idsede: '13', mesa: '5', desde } }, res);
        await jest.advanceTimersByTimeAsync(5000);
        await enCurso;
        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ success: false, error: 'error_interno' });
    });

    test('una respuesta a tiempo no deja timers colgados', async () => {
        bd();
        await vision.leerCuentas(IDSEDE);
        expect(jest.getTimerCount()).toBe(0);
    });
});
