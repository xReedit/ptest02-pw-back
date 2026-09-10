const rateLimit = require('../service/rate-limit');

// ReE hace res.statusCode = code (no res.status()), por eso se verifica statusCode.
function mockRes() {
	const r = {};
	r.statusCode = 200;
	r.json = jest.fn(() => r);
	return r;
}

describe('rate-limit', () => {
	beforeEach(() => { jest.useFakeTimers(); });
	afterEach(() => { jest.useRealTimers(); });

	it('deja pasar 20 llamadas y corta la 21 dentro de la ventana', () => {
		const limitar = rateLimit(20, 60000);
		const req = { ip: '1.1.1.1' };
		const next = jest.fn();

		for (let i = 0; i < 20; i++) { limitar(req, mockRes(), next); }
		expect(next).toHaveBeenCalledTimes(20);

		const res = mockRes();
		limitar(req, res, next);
		expect(next).toHaveBeenCalledTimes(20);
		expect(res.statusCode).toBe(429);
		expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
	});

	it('vuelve a permitir cuando pasa la ventana', () => {
		const limitar = rateLimit(20, 60000);
		const req = { ip: '2.2.2.2' };
		const next = jest.fn();

		for (let i = 0; i < 21; i++) { limitar(req, mockRes(), next); }
		expect(next).toHaveBeenCalledTimes(20);

		jest.advanceTimersByTime(60001);

		const res = mockRes();
		limitar(req, res, next);
		expect(next).toHaveBeenCalledTimes(21);
		expect(res.statusCode).toBe(200);
	});

	it('cuenta por IP: otra IP no hereda el limite', () => {
		const limitar = rateLimit(1, 60000);
		const next = jest.fn();

		limitar({ ip: '3.3.3.3' }, mockRes(), next);
		limitar({ ip: '3.3.3.3' }, mockRes(), next);
		limitar({ ip: '4.4.4.4' }, mockRes(), next);

		expect(next).toHaveBeenCalledTimes(2);
	});

	it('detras del proxy cuenta por el ultimo salto de x-forwarded-for', () => {
		const limitar = rateLimit(1, 60000);
		const next = jest.fn();
		// misma IP de socket (el proxy), clientes distintos; nginx agrega el peer real al final
		const reqProxy = (xff) => ({ ip: '10.0.0.9', headers: { 'x-forwarded-for': xff } });

		limitar(reqProxy('5.5.5.5'), mockRes(), next);
		limitar(reqProxy('6.6.6.6'), mockRes(), next);
		expect(next).toHaveBeenCalledTimes(2);

		// el segundo intento del mismo cliente si se corta
		const res = mockRes();
		limitar(reqProxy('5.5.5.5'), res, next);
		expect(next).toHaveBeenCalledTimes(2);
		expect(res.statusCode).toBe(429);
	});

	it('un primer salto falsificado no libera cupo: manda el ultimo salto', () => {
		const limitar = rateLimit(1, 60000);
		const next = jest.fn();
		const reqProxy = (xff) => ({ ip: '10.0.0.9', headers: { 'x-forwarded-for': xff } });

		// el mismo cliente (7.7.7.7 lo pone nuestro nginx) cambia el salto que el controla
		limitar(reqProxy('1.1.1.1, 7.7.7.7'), mockRes(), next);
		expect(next).toHaveBeenCalledTimes(1);

		const res = mockRes();
		limitar(reqProxy('2.2.2.2, 7.7.7.7'), res, next);
		expect(next).toHaveBeenCalledTimes(1);
		expect(res.statusCode).toBe(429);

		// otro cliente real si tiene su propio cupo
		limitar(reqProxy('1.1.1.1, 8.8.8.8'), mockRes(), next);
		expect(next).toHaveBeenCalledTimes(2);
	});

	it('sin x-forwarded-for usa req.ip', () => {
		const limitar = rateLimit(1, 60000);
		const next = jest.fn();

		limitar({ ip: '9.9.9.9', headers: {} }, mockRes(), next);
		const res = mockRes();
		limitar({ ip: '9.9.9.9', headers: {} }, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.statusCode).toBe(429);
	});
});
