// Niubiz desde el backend: las credenciales nunca deben salir en la respuesta al cliente.
jest.mock('node-fetch');
const fetch = require('node-fetch');
const { crearSesion, autorizar } = require('../controllers/apiNiubiz');

// ReE hace res.statusCode = code (no res.status()), por eso se verifica statusCode.
function mockRes() {
	const r = {};
	r.statusCode = 200;
	r.json = jest.fn(() => r);
	r.send = jest.fn(() => r);
	return r;
}

describe('apiNiubiz', () => {
	beforeEach(() => {
		process.env.NIUBIZ_ENV = 'sandbox';
		process.env.NIUBIZ_MERCHANT_ID = 'M1';
		process.env.NIUBIZ_USER = 'u';
		process.env.NIUBIZ_PASS = 'p';
		// El .env real puede traer juegos por entorno; se limpian para no depender de la maquina.
		['SANDBOX', 'PROD'].forEach((e) => {
			delete process.env[`NIUBIZ_${e}_MERCHANT_ID`];
			delete process.env[`NIUBIZ_${e}_USER`];
			delete process.env[`NIUBIZ_${e}_PASS`];
		});
		fetch.mockReset();
	});

	it('crearSesion devuelve sessionKey sin exponer credenciales', async () => {
		fetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'TOKEN' })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ sessionKey: 'SK', expirationTime: 1 }) });
		const res = mockRes();
		await crearSesion({ body: { idsede: 1, amount: 10 }, ip: '1.1.1.1' }, res);
		const respuesta = res.json.mock.calls[0][0];
		const payload = JSON.stringify(respuesta);
		expect(respuesta.success).toBe(true);
		expect(payload).toContain('SK');
		expect(payload).not.toContain('Basic');
		expect(payload).not.toContain('"u"');
		expect(payload).not.toContain('"p"');
		expect(fetch.mock.calls[0][1].headers.Authorization).toMatch(/^Basic /);
	});

	it('crearSesion rechaza amount invalido', async () => {
		const res = mockRes();
		await crearSesion({ body: { idsede: 1, amount: 'x' } }, res);
		expect(fetch).not.toHaveBeenCalled();
		expect(res.statusCode).toBe(400);
		expect(res.json.mock.calls[0][0].success).toBe(false);
	});

	it('crearSesion manda el mismo cuerpo que enviaba el frontend', async () => {
		fetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'TOKEN' })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ sessionKey: 'SK' }) });
		const res = mockRes();
		const clientData = { email: 'a@b.com', idcliente: '7', ip: '2.2.2.2', diasRegistrado: 3 };
		await crearSesion({ body: { idsede: 1, amount: 12.3, clientData }, ip: '1.1.1.1' }, res);
		const body = JSON.parse(fetch.mock.calls[1][1].body);
		expect(body).toEqual({
			amount: 12.3,
			antifraud: {
				clientIp: '2.2.2.2',
				merchantDefineData: { MDD4: 'a@b.com', MDD32: '7', MDD75: 'Invitado', MDD77: 3, MDD89: '1' }
			},
			channel: 'web',
			recurrenceMaxAmount: null
		});
	});

	it('crearSesion sin clientData manda antifraud null (paridad flujo mesa)', async () => {
		fetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'TOKEN' })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ sessionKey: 'SK' }) });
		const res = mockRes();
		await crearSesion({ body: { idsede: 1, amount: 12.3, purchaseNumber: '900' }, ip: '1.1.1.1' }, res);
		const body = JSON.parse(fetch.mock.calls[1][1].body);
		expect(body).toEqual({ amount: 12.3, antifraud: null, channel: 'web', recurrenceMaxAmount: null });
	});

	it('autorizar marca success solo con ACTION_CODE 000', async () => {
		fetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'TOKEN' })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ dataMap: { ACTION_CODE: '116' } }) });
		const res = mockRes();
		await autorizar({ body: { idsede: 1, purchaseNumber: '1', amount: 10, transactionToken: 't' } }, res);
		expect(res.json.mock.calls[0][0].success).toBe(false);
	});

	it('autorizar devuelve success true y la respuesta cruda de Niubiz', async () => {
		const niubiz = { dataMap: { ACTION_CODE: '000', CARD: '411111******1111' }, order: { purchaseNumber: '1' } };
		fetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'TOKEN' })
			.mockResolvedValueOnce({ ok: true, status: 200, json: async () => niubiz });
		const res = mockRes();
		await autorizar({ body: { idsede: 1, purchaseNumber: '1', amount: 10, transactionToken: 't' } }, res);
		const respuesta = res.json.mock.calls[0][0];
		expect(respuesta.success).toBe(true);
		expect(respuesta.data).toEqual(niubiz);
		const body = JSON.parse(fetch.mock.calls[1][1].body);
		expect(body.captureType).toBe('manual');
		expect(body.countable).toBe(false);
		expect(body.order).toEqual({ amount: 10, currency: 'PEN', purchaseNumber: '1', tokenId: 't' });
	});

	it('autorizar rechaza datos incompletos', async () => {
		const res = mockRes();
		await autorizar({ body: { idsede: 1, amount: 10 } }, res);
		expect(fetch).not.toHaveBeenCalled();
		expect(res.statusCode).toBe(400);
	});

	it('devuelve 500 si faltan las variables de entorno', async () => {
		delete process.env.NIUBIZ_MERCHANT_ID;
		const res = mockRes();
		await crearSesion({ body: { idsede: 1, amount: 10 } }, res);
		expect(fetch).not.toHaveBeenCalled();
		expect(res.statusCode).toBe(500);
		expect(res.json.mock.calls[0][0].error).toBe('Error al iniciar el pago');
	});
});
