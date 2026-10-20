// Puerta del puente /vision/v1 (Cámaras IA). Quien pasa puede leer las cuentas
// abiertas de cualquier sede y, desde la Task 17, mandar push a los mozos: falla
// cerrado sin configuración, exige la clave y solo acepta las IPs del servidor Go.

jest.mock('../utilitarios/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const { verificarVision, ipDe } = require('../middleware/vision.auth');

const CLAVE = 'k'.repeat(40);
const IP_GO = '10.0.0.5';

function fakeRes() {
    return {
        statusCode: 200,
        body: null,
        json(payload) { this.body = payload; return this; },
    };
}

function req({ clave = CLAVE, sinClave = false, peer = IP_GO, xff } = {}) {
    const headers = {};
    if (!sinClave) headers['x-api-key'] = clave;
    if (xff !== undefined) headers['x-forwarded-for'] = xff;
    return { headers, socket: { remoteAddress: peer }, originalUrl: '/vision/v1/cuentas' };
}

function correr(r) {
    const res = fakeRes();
    const next = jest.fn();
    verificarVision(r, res, next);
    return { res, next };
}

beforeEach(() => {
    process.env.VISION_PUENTE_KEY = CLAVE;
    process.env.VISION_PUENTE_IPS = `${IP_GO}, 127.0.0.1`;
});

afterAll(() => {
    delete process.env.VISION_PUENTE_KEY;
    delete process.env.VISION_PUENTE_IPS;
});

describe('verificarVision: configuración (falla cerrado)', () => {
    test('sin VISION_PUENTE_KEY → 503 vision_no_configurado', () => {
        delete process.env.VISION_PUENTE_KEY;
        const { res, next } = correr(req());
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(503);
        expect(res.body).toEqual({ success: false, error: 'vision_no_configurado' });
    });

    test('VISION_PUENTE_KEY de menos de 32 caracteres → 503', () => {
        process.env.VISION_PUENTE_KEY = 'k'.repeat(31);
        const { res, next } = correr(req({ clave: 'k'.repeat(31) }));
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(503);
        expect(res.body.error).toBe('vision_no_configurado');
    });

    test('sin VISION_PUENTE_IPS → 503 (no hay "cualquier IP" por omisión)', () => {
        delete process.env.VISION_PUENTE_IPS;
        const { res, next } = correr(req());
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(503);
        expect(res.body.error).toBe('vision_no_configurado');
    });
});

describe('verificarVision: clave', () => {
    test('clave mala → 401 clave_invalida', () => {
        const { res, next } = correr(req({ clave: 'x'.repeat(40) }));
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ success: false, error: 'clave_invalida' });
    });

    test('sin cabecera x-api-key → 401', () => {
        const { res, next } = correr(req({ sinClave: true }));
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
    });

    test('clave correcta desde IP permitida → pasa', () => {
        const { res, next } = correr(req());
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.body).toBeNull();
    });
});

describe('verificarVision: IP', () => {
    test('IP fuera de la lista → 403 ip_no_permitida (aunque la clave sea buena)', () => {
        const { res, next } = correr(req({ peer: '203.0.113.9' }));
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ success: false, error: 'ip_no_permitida' });
    });

    test('XFF ignorado si el peer es público: no se puede fingir la IP del Go', () => {
        const { res, next } = correr(req({ peer: '203.0.113.9', xff: IP_GO }));
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
    });

    test('detrás de nginx propio (peer loopback) vale el ÚLTIMO salto de XFF', () => {
        // nginx agrega la IP que vio al final; lo de antes lo escribe el cliente.
        const ok = correr(req({ peer: '127.0.0.1', xff: `1.2.3.4, ${IP_GO}` }));
        expect(ok.next).toHaveBeenCalledTimes(1);

        const fingido = correr(req({ peer: '127.0.0.1', xff: `${IP_GO}, 1.2.3.4` }));
        expect(fingido.next).not.toHaveBeenCalled();
        expect(fingido.res.statusCode).toBe(403);
    });
});

describe('ipDe', () => {
    test('peer público: remoteAddress, sin mirar XFF', () => {
        expect(ipDe(req({ peer: '203.0.113.9', xff: '10.0.0.5' }))).toBe('203.0.113.9');
    });

    test('peer privado (red interna): último salto de XFF', () => {
        expect(ipDe(req({ peer: '192.168.1.10', xff: '8.8.8.8 , 10.0.0.5' }))).toBe('10.0.0.5');
        expect(ipDe(req({ peer: '172.20.0.2', xff: '10.0.0.6' }))).toBe('10.0.0.6');
    });

    test('peer loopback IPv6 / IPv4 mapeada', () => {
        expect(ipDe(req({ peer: '::1', xff: '10.0.0.5' }))).toBe('10.0.0.5');
        expect(ipDe(req({ peer: '::ffff:127.0.0.1', xff: '10.0.0.5' }))).toBe('10.0.0.5');
        expect(ipDe(req({ peer: '::ffff:203.0.113.9', xff: '10.0.0.5' }))).toBe('203.0.113.9');
    });

    test('peer loopback sin XFF: el propio peer (Go en la misma máquina)', () => {
        expect(ipDe(req({ peer: '127.0.0.1' }))).toBe('127.0.0.1');
    });

    test('172.32.x no es privada (fuera de 172.16/12)', () => {
        expect(ipDe(req({ peer: '172.32.0.1', xff: '10.0.0.5' }))).toBe('172.32.0.1');
    });
});
