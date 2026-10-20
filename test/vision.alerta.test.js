// Puente /vision/v1 de salida (Cámaras IA, repo papaya-vision): el servidor Go manda
// una alerta (push a los mozos + socket al POS) o un evento (socket a la sede).
// Contrato: global-constraints de F2 (POST /alerta, POST /evento) y F2-R7:
// /alerta reemite el CUERPO COMPLETO como `vision-alerta`; /evento reemite
// `datos` TAL CUAL con el nombre de `evento` (así lo consume la app mozo).

jest.mock('../utilitarios/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));
// El router carga el servicio de cuentas; sin BD real en esta suite.
jest.mock('../config/database', () => ({
    sequelize: { query: jest.fn() }, QueryTypes: { SELECT: 'SELECT' },
}));
const mockEjecutar = jest.fn();
jest.mock('../service/query.service.v1', () => ({ ejecutarConsulta: (...a) => mockEjecutar(...a) }));
const mockMulticast = jest.fn();
jest.mock('../firebase_config', () => ({
    admin: { messaging: () => ({ sendEachForMulticast: (...a) => mockMulticast(...a) }) },
}));
const mockEmitToRoom = jest.fn();
jest.mock('../service/socket.manager', () => ({
    emitToRoom: (...a) => mockEmitToRoom(...a),
    getIO: () => { throw new Error('Socket.IO no ha sido inicializado'); },
}));

const http = require('http');
const express = require('express');
const logger = require('../utilitarios/logger');
const { sendAlertaVision } = require('../service/push.mozo.service');

const CLAVE = 'k'.repeat(40);
const TOKENS = ['tok-mozo-1-aaaaaaaaaaaaaaaa', 'tok-mozo-2-bbbbbbbbbbbbbbbb'];

const alerta = (o = {}) => ({
    idorg: 1, idsede: 13, alerta_id: 9, tipo: 'sin_atencion', mesa: '12', mesa_clave: '12',
    texto: 'Mesa 12 lleva 5 min sin atención', para: ['mozos', 'caja'], recordatorio: false, ...o,
});

const resuelta = (o = {}) => ({
    idorg: 1, idsede: 13, evento: 'vision-alerta-resuelta',
    datos: { alerta_id: 9, mesa_clave: '12', resuelta_por: 'pedido' }, ...o,
});

// Responde según el texto del SQL: tokens de la sede o el DELETE de tokens muertos.
function bd({ tokens = TOKENS } = {}) {
    mockEjecutar.mockImplementation(async (sql) => {
        if (sql.includes('SELECT fcm_token FROM usuario_push_token')) return tokens.map((t) => ({ fcm_token: t }));
        if (sql.startsWith('DELETE')) return [];
        throw new Error(`SQL no esperado en el test: ${sql}`);
    });
}

function fcmOk() {
    mockMulticast.mockImplementation(async ({ tokens }) => ({
        successCount: tokens.length, failureCount: 0, responses: tokens.map(() => ({ success: true })),
    }));
}

// El push va sin await en el controlador: se dejan correr las promesas pendientes.
async function dejarCorrerPush() {
    for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
}

let server;
let puerto;

beforeAll((listo) => {
    process.env.VISION_PUENTE_KEY = CLAVE;
    process.env.VISION_PUENTE_IPS = '127.0.0.1';
    const app = express();
    app.use(express.json({ limit: '50mb' })); // igual que app.js (bodyParser.json 50mb global)
    app.use('/vision/v1', require('../routes/routesVision'));
    server = app.listen(0, '127.0.0.1', () => { puerto = server.address().port; listo(); });
});

afterAll((listo) => {
    delete process.env.VISION_PUENTE_KEY;
    delete process.env.VISION_PUENTE_IPS;
    server.close(listo);
});

beforeEach(() => {
    jest.clearAllMocks();
    bd();
    fcmOk();
});

function pedir(ruta, { metodo = 'POST', cuerpo, clave = CLAVE } = {}) {
    return new Promise((resolver, rechazar) => {
        const texto = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
        const headers = { 'content-type': 'application/json', 'content-length': Buffer.byteLength(texto) };
        if (clave) headers['x-api-key'] = clave;
        const r = http.request({ host: '127.0.0.1', port: puerto, path: ruta, method: metodo, headers }, (res) => {
            let resp = '';
            res.on('data', (d) => { resp += d; });
            res.on('end', () => resolver({ status: res.statusCode, body: JSON.parse(resp) }));
        });
        // Una ruta que no responde falla rápido y suelta la conexión (si no, server.close cuelga).
        r.setTimeout(2000, () => r.destroy(new Error(`sin respuesta en 2 s: ${metodo} ${ruta}`)));
        r.on('error', rechazar);
        r.end(texto);
    });
}

describe('POST /vision/v1/alerta', () => {
    test('para [mozos, caja] → push a los mozos de la sede y socket vision-alerta con el cuerpo completo', async () => {
        const cuerpo = alerta();
        const r = await pedir('/vision/v1/alerta', { cuerpo });
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ success: true });

        expect(mockEmitToRoom).toHaveBeenCalledTimes(1);
        expect(mockEmitToRoom).toHaveBeenCalledWith('room113', 'vision-alerta', cuerpo);

        await dejarCorrerPush();
        const [sql, params] = mockEjecutar.mock.calls[0];
        expect(sql).toMatch(/WHERE idsede = \? AND last_seen_at >= NOW\(\) - INTERVAL \? HOUR/);
        expect(params).toEqual([13, 24]);
        expect(mockMulticast).toHaveBeenCalledTimes(1);
        const msg = mockMulticast.mock.calls[0][0];
        expect(msg.tokens).toEqual(TOKENS);
        expect(msg.notification).toEqual({ title: 'Mesa 12 lleva 5 min sin atención', body: 'Aviso de Cámaras IA' });
        // FCM exige strings en data.
        expect(msg.data).toEqual({ tipo: 'vision_sin_atencion', num_mesa: '12', alerta_id: '9' });
        expect(msg.android.notification.tag).toBe('vision_12');
    });

    test('para [caja] → sin push, con socket', async () => {
        const cuerpo = alerta({ tipo: 'cuenta_abierta', texto: 'Mesa 12 se vació con cuenta abierta, verificar', para: ['caja'] });
        const r = await pedir('/vision/v1/alerta', { cuerpo });
        expect(r.status).toBe(200);
        expect(mockEmitToRoom).toHaveBeenCalledWith('room113', 'vision-alerta', cuerpo);
        await dejarCorrerPush();
        expect(mockEjecutar).not.toHaveBeenCalled();
        expect(mockMulticast).not.toHaveBeenCalled();
    });

    test('para [] → sin push, con socket (lo filtra cada pantalla)', async () => {
        const r = await pedir('/vision/v1/alerta', { cuerpo: alerta({ para: [] }) });
        expect(r.status).toBe(200);
        expect(mockEmitToRoom).toHaveBeenCalledTimes(1);
        await dejarCorrerPush();
        expect(mockMulticast).not.toHaveBeenCalled();
    });

    test('recordatorio y mesa alfanumérica: tag por mesa_clave, num_mesa = mesa para mostrar', async () => {
        const cuerpo = alerta({
            tipo: 'por_limpiar', mesa: 's1-05', mesa_clave: 'S1-5', texto: 'Mesa s1-05 lleva 5 min por limpiar',
            para: ['mozos'], recordatorio: true, alerta_id: 41,
        });
        const r = await pedir('/vision/v1/alerta', { cuerpo });
        expect(r.status).toBe(200);
        expect(mockEmitToRoom).toHaveBeenCalledWith('room113', 'vision-alerta', cuerpo);
        await dejarCorrerPush();
        const msg = mockMulticast.mock.calls[0][0];
        expect(msg.data).toEqual({ tipo: 'vision_por_limpiar', num_mesa: 's1-05', alerta_id: '41' });
        expect(msg.android.notification.tag).toBe('vision_S1-5');
    });

    test('la respuesta no espera al push (el Go corta a los 5 s y un reintento duplicaría el aviso)', async () => {
        mockMulticast.mockImplementation(() => new Promise(() => {})); // FCM que nunca responde
        const r = await pedir('/vision/v1/alerta', { cuerpo: alerta() });
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ success: true });
    });

    test('FCM falla → igual 200 con socket; el error va al log', async () => {
        mockMulticast.mockRejectedValue(Object.assign(new Error('fcm caído'), { code: 'messaging/internal-error' }));
        const r = await pedir('/vision/v1/alerta', { cuerpo: alerta() });
        expect(r.status).toBe(200);
        expect(mockEmitToRoom).toHaveBeenCalledTimes(1);
        await dejarCorrerPush();
        expect(logger.error).toHaveBeenCalledWith(
            expect.objectContaining({ idsede: 13, alerta_id: 9, err: 'fcm caído' }), expect.any(String));
    });

    test('tipo desconocido → 400 pedido_invalido, sin socket ni push', async () => {
        const r = await pedir('/vision/v1/alerta', { cuerpo: alerta({ tipo: 'mesa_sucia' }) });
        expect(r.status).toBe(400);
        expect(r.body).toEqual({ success: false, error: 'pedido_invalido' });
        await dejarCorrerPush();
        expect(mockEmitToRoom).not.toHaveBeenCalled();
        expect(mockMulticast).not.toHaveBeenCalled();
    });

    test('mesa con espacios → 400', async () => {
        const r = await pedir('/vision/v1/alerta', { cuerpo: alerta({ mesa: '1 2' }) });
        expect(r.status).toBe(400);
        expect(r.body).toEqual({ success: false, error: 'pedido_invalido' });
        expect(mockEmitToRoom).not.toHaveBeenCalled();
    });

    test.each([
        ['mesa_clave con espacios', { mesa_clave: 'S1 05' }],
        ['mesa vacía', { mesa: '' }],
        ['mesa de 11 caracteres', { mesa: 'A'.repeat(11) }],
        ['mesa número (no texto)', { mesa: 12 }],
        ['mesa con salto de línea al final', { mesa: '12\n' }],
        ['texto de 121 caracteres', { texto: 'x'.repeat(121) }],
        ['texto vacío', { texto: '' }],
        ['sin texto', { texto: undefined }],
        ['para con destino desconocido', { para: ['mozos', 'cocina'] }],
        ['para no es lista', { para: 'mozos' }],
        ['sin para', { para: undefined }],
        ['idorg como texto', { idorg: '1' }],
        ['idsede decimal', { idsede: 13.5 }],
        ['idsede 0', { idsede: 0 }],
        ['sin idsede', { idsede: undefined }],
        ['sin alerta_id', { alerta_id: undefined }],
        ['alerta_id como texto', { alerta_id: '9' }],
        ['recordatorio que no es booleano', { recordatorio: 'no' }],
    ])('inválido (%s) → 400 sin socket', async (_nombre, cambio) => {
        const r = await pedir('/vision/v1/alerta', { cuerpo: alerta(cambio) });
        expect(r.status).toBe(400);
        expect(r.body).toEqual({ success: false, error: 'pedido_invalido' });
        expect(mockEmitToRoom).not.toHaveBeenCalled();
    });

    test('cuerpo que no es objeto → 400', async () => {
        const r = await pedir('/vision/v1/alerta', { cuerpo: [alerta()] });
        expect(r.status).toBe(400);
        expect(mockEmitToRoom).not.toHaveBeenCalled();
    });

    test('sin clave → 401 (verificarVision), sin socket ni push', async () => {
        const r = await pedir('/vision/v1/alerta', { cuerpo: alerta(), clave: null });
        expect(r.status).toBe(401);
        expect(r.body).toEqual({ success: false, error: 'clave_invalida' });
        await dejarCorrerPush();
        expect(mockEmitToRoom).not.toHaveBeenCalled();
        expect(mockMulticast).not.toHaveBeenCalled();
    });

    test('GET /alerta con clave → 404 del contrato (solo POST)', async () => {
        const r = await pedir('/vision/v1/alerta', { metodo: 'GET' });
        expect(r.status).toBe(404);
        expect(r.body).toEqual({ success: false, error: 'no_encontrado' });
    });
});

describe('POST /vision/v1/evento', () => {
    test('vision-alerta-resuelta → emitToRoom con `datos` tal cual (F2-R7)', async () => {
        const cuerpo = resuelta();
        const r = await pedir('/vision/v1/evento', { cuerpo });
        expect(r.status).toBe(200);
        expect(r.body).toEqual({ success: true });
        expect(mockEmitToRoom).toHaveBeenCalledTimes(1);
        expect(mockEmitToRoom).toHaveBeenCalledWith('room113', 'vision-alerta-resuelta', cuerpo.datos);
        await dejarCorrerPush();
        expect(mockMulticast).not.toHaveBeenCalled();
    });

    test('vision-mesas-estado → emitToRoom con el estado completo en `datos`', async () => {
        const datos = {
            mesas: [
                { mesa: '05', mesa_clave: '5', estado: 'ocupada', desde: '2026-10-19T13:05:00-05:00', personas: 3, alerta_id: null, alerta_tipo: null },
                { mesa: '12', mesa_clave: '12', estado: 'ocupada', desde: '2026-10-19T13:00:00-05:00', personas: 2, alerta_id: 9, alerta_tipo: 'sin_atencion' },
            ],
        };
        const r = await pedir('/vision/v1/evento', { cuerpo: { idorg: 1, idsede: 13, evento: 'vision-mesas-estado', datos } });
        expect(r.status).toBe(200);
        expect(mockEmitToRoom).toHaveBeenCalledWith('room113', 'vision-mesas-estado', datos);
    });

    test.each([
        ['vision-alerta (va por /alerta)', 'vision-alerta'],
        ['evento del POS', 'printerComanda'],
        ['sin evento', undefined],
    ])('evento fuera de la lista (%s) → 400 sin socket', async (_nombre, evento) => {
        const r = await pedir('/vision/v1/evento', { cuerpo: resuelta({ evento }) });
        expect(r.status).toBe(400);
        expect(r.body).toEqual({ success: false, error: 'pedido_invalido' });
        expect(mockEmitToRoom).not.toHaveBeenCalled();
    });

    test('datos de más de 64 KB → 400; justo 64 KB → 200', async () => {
        const conRelleno = (bytes) => {
            const base = JSON.stringify({ mesas: [], r: '' }).length; // {"mesas":[],"r":""}
            return { mesas: [], r: 'x'.repeat(bytes - base) };
        };
        const grande = await pedir('/vision/v1/evento', { cuerpo: resuelta({ evento: 'vision-mesas-estado', datos: conRelleno(64 * 1024 + 1) }) });
        expect(grande.status).toBe(400);
        expect(mockEmitToRoom).not.toHaveBeenCalled();

        const justo = await pedir('/vision/v1/evento', { cuerpo: resuelta({ evento: 'vision-mesas-estado', datos: conRelleno(64 * 1024) }) });
        expect(justo.status).toBe(200);
        expect(mockEmitToRoom).toHaveBeenCalledTimes(1);
    });

    test('el tope de 64 KB es en bytes UTF-8, no en caracteres', async () => {
        // 'ó' ocupa 2 bytes: 40 000 caracteres = ~80 KB.
        const r = await pedir('/vision/v1/evento', { cuerpo: resuelta({ datos: { r: 'ó'.repeat(40000) } }) });
        expect(r.status).toBe(400);
        expect(mockEmitToRoom).not.toHaveBeenCalled();
    });

    test.each([
        ['sin datos', { datos: undefined }],
        ['datos null', { datos: null }],
        ['datos lista', { datos: [1, 2] }],
        ['datos texto', { datos: 'hola' }],
        ['idsede como texto', { idsede: '13' }],
        ['sin idorg', { idorg: undefined }],
    ])('inválido (%s) → 400 sin socket', async (_nombre, cambio) => {
        const r = await pedir('/vision/v1/evento', { cuerpo: resuelta(cambio) });
        expect(r.status).toBe(400);
        expect(mockEmitToRoom).not.toHaveBeenCalled();
    });

    test('sin clave → 401, sin socket', async () => {
        const r = await pedir('/vision/v1/evento', { cuerpo: resuelta(), clave: null });
        expect(r.status).toBe(401);
        expect(r.body).toEqual({ success: false, error: 'clave_invalida' });
        expect(mockEmitToRoom).not.toHaveBeenCalled();
    });
});

describe('sendAlertaVision', () => {
    const datos = { tipo: 'sin_atencion', mesa: '12', mesa_clave: '12', texto: 'Mesa 12 lleva 5 min sin atención', alerta_id: 9 };

    test('sede sin mozos activos → no llama a FCM', async () => {
        bd({ tokens: [] });
        await sendAlertaVision(13, datos);
        expect(mockEjecutar).toHaveBeenCalledTimes(1);
        expect(mockMulticast).not.toHaveBeenCalled();
    });

    test('error al leer tokens → no lanza; al log sin el error completo', async () => {
        mockEjecutar.mockRejectedValue(new Error('mysql caído'));
        await expect(sendAlertaVision(13, datos)).resolves.toBeNull();
        expect(mockMulticast).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(
            { err: 'mysql caído', code: undefined, idsede: 13, alerta_id: 9 }, 'sendAlertaVision');
    });

    test('token muerto → se borra (mismo enviarATokens que el llamado de mesa)', async () => {
        mockMulticast.mockResolvedValue({
            successCount: 1, failureCount: 1,
            responses: [{ success: true }, { error: { code: 'messaging/registration-token-not-registered', message: 'x' } }],
        });
        const r = await sendAlertaVision(13, datos);
        expect(r).toEqual({ ok: 1, fail: 1 });
        const borrado = mockEjecutar.mock.calls.find(([sql]) => sql.startsWith('DELETE'));
        expect(borrado[1]).toEqual([[TOKENS[1]]]);
    });
});
