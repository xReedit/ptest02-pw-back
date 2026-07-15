// Verifica la puerta de /chatbot/emitir: quién puede entrar y qué se acepta.
// Este endpoint escribe por WhatsApp desde el número del restaurante, así que
// un agujero aquí es un canal de spam a nombre del cliente.

jest.mock('../utilitarios/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const mockFetchSockets = jest.fn();
const mockEmitToRoom = jest.fn();
jest.mock('../service/socket.manager', () => ({
    getIO: () => ({ in: () => ({ fetchSockets: mockFetchSockets }) }),
    emitToRoom: mockEmitToRoom,
}));

const chatbotEmitir = require('../controllers/chatbotEmitir');

// res falso que captura status + json.
function fakeRes() {
    return {
        statusCode: 200,
        body: null,
        json(payload) { this.body = payload; return this; },
    };
}

const KEY = 'clave-de-prueba-larga';

beforeEach(() => {
    jest.clearAllMocks();
    process.env.CHATBOT_EMITIR_KEY = KEY;
    mockFetchSockets.mockResolvedValue([{ id: 'gateway-1' }]); // hay gateway conectado
});

describe('verificarApiKey', () => {
    test('sin CHATBOT_EMITIR_KEY configurada rechaza (falla cerrado)', () => {
        delete process.env.CHATBOT_EMITIR_KEY;
        const res = fakeRes();
        const next = jest.fn();
        chatbotEmitir.verificarApiKey({ headers: {} }, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(503);
    });

    test('sin cabecera rechaza', () => {
        const res = fakeRes();
        const next = jest.fn();
        chatbotEmitir.verificarApiKey({ headers: {} }, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    test('clave equivocada rechaza', () => {
        const res = fakeRes();
        const next = jest.fn();
        chatbotEmitir.verificarApiKey({ headers: { 'x-api-key': 'otra' } }, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    test('clave correcta pasa', () => {
        const res = fakeRes();
        const next = jest.fn();
        chatbotEmitir.verificarApiKey({ headers: { 'x-api-key': KEY } }, res, next);
        expect(next).toHaveBeenCalled();
    });
});

describe('emitir', () => {
    const bodyOK = { idorg: '12', idsede: '5', numero: '51999888777', mensaje: '¿Yape como la última vez?' };

    test('emite al room correcto con el formato que espera el gateway', async () => {
        const res = fakeRes();
        await chatbotEmitir.emitir({ body: bodyOK }, res);
        expect(mockEmitToRoom).toHaveBeenCalledWith(
            'mensajeria_125',
            'send_message',
            [{ numero: '51999888777', mensaje: '¿Yape como la última vez?', tipo: 'texto' }],
        );
        expect(res.body.success).toBe(true);
    });

    test('sin gateway conectado devuelve error en vez de perder el mensaje', async () => {
        mockFetchSockets.mockResolvedValue([]);
        const res = fakeRes();
        await chatbotEmitir.emitir({ body: bodyOK }, res);
        expect(mockEmitToRoom).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(503);
    });

    test.each([
        ['falta idorg', { ...bodyOK, idorg: undefined }],
        ['falta numero', { ...bodyOK, numero: undefined }],
        ['mensaje vacío', { ...bodyOK, mensaje: '   ' }],
        ['numero con letras', { ...bodyOK, numero: '519998a8777' }],
        ['numero muy corto', { ...bodyOK, numero: '123' }],
        ['numero con + (el gateway espera dígitos)', { ...bodyOK, numero: '+51999888777' }],
        ['mensaje larguísimo', { ...bodyOK, mensaje: 'a'.repeat(1001) }],
        ['body vacío', {}],
        ['idorg no numérico', { ...bodyOK, idorg: 'abc' }],
        ['idsede objeto (entraría como [object Object])', { ...bodyOK, idsede: { a: 1 } }],
    ])('rechaza: %s', async (_, body) => {
        const res = fakeRes();
        await chatbotEmitir.emitir({ body }, res);
        expect(mockEmitToRoom).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(400);
    });
});
