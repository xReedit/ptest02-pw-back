// Encadena el middleware de cliente con el handler real, como hace Express, para que una
// ruta protegida quede probada de punta a punta sin levantar el servidor.
jest.mock('../config/database', () => ({ sequelize: {}, Sequelize: {}, QueryTypes: {} }));
jest.mock('../service/query.service.v1', () => ({ ejecutarProcedimiento: jest.fn(), ejecutarConsulta: jest.fn() }));
jest.mock('../service/estado-pedido.service', () => ({ leerEstado: jest.fn(), setIo: jest.fn() }));
jest.mock('../utilitarios/logger', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../_config', () => ({ SEED: 'semilla-colaborador-de-prueba', SEED_SMS: 'x' }));

const jwt = require('jsonwebtoken');
const SEMILLA = 'semilla-cliente-de-prueba-sprint5';
const SEMILLA_COLABORADOR = 'semilla-colaborador-de-prueba';

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

// Encadena como lo hace Express: middleware -> handler. El middleware es sincrono,
// asi que basta con anotar si llamo a next y, si lo hizo, ejecutar el handler despues.
async function llamar(modo, cabecera, body) {
  jest.resetModules();
  process.env.AUTH_CLIENTE_MODO = modo;
  process.env.SEED_CLIENTE = SEMILLA;

  const QueryServiceV1 = require('../service/query.service.v1');
  QueryServiceV1.ejecutarProcedimiento.mockReset();
  QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ idpedido: 1, importe: 30 }]);

  const logger = require('../utilitarios/logger');
  logger.warn.mockReset();

  const authCliente = require('../middleware/autentificacion.cliente');
  const { getMisPedido } = require('../controllers/apiDelivery');

  const req = { headers: cabecera ? { authorization: cabecera } : {}, body, query: {}, originalUrl: '/v3/delivery/get-mis-pedidos' };
  const res = mockRes();

  let siguio = false;
  authCliente.verificarTokenCliente(req, res, () => { siguio = true; });
  if (siguio) { await getMisPedido(req, res); }

  return { req, res, siguio, QueryServiceV1, logger };
}

const token = (idcliente) => `Bearer ${jwt.sign({ idcliente, tipo: 'cliente' }, SEMILLA, { expiresIn: '180d' })}`;
const tokenColaborador = () => jwt.sign({ usuario: { idusuario: 3, idsede: 1 } }, SEMILLA_COLABORADOR, { expiresIn: '2d' });

afterEach(() => {
  delete process.env.AUTH_CLIENTE_MODO;
  delete process.env.SEED_CLIENTE;
});

describe('delivery/get-mis-pedidos protegida', () => {
  it('modo log: sin token responde 200 igual que antes y deja el aviso', async () => {
    const { res, siguio, QueryServiceV1, logger } = await llamar('log', null, { idcliente: 99 });
    expect(siguio).toBe(true);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(QueryServiceV1.ejecutarProcedimiento).toHaveBeenCalledWith(expect.any(String), [99], 'getMisPedido');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('modo enforce: sin token responde 401 y no toca la base', async () => {
    const { res, siguio, QueryServiceV1 } = await llamar('enforce', null, { idcliente: 99 });
    expect(siguio).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'no autorizado' });
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
  });

  it('modo enforce: token de otro cliente responde 403 y no toca la base', async () => {
    const { res, siguio, QueryServiceV1 } = await llamar('enforce', token(15), { idcliente: 99 });
    expect(siguio).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
  });

  it('modo enforce: idcliente presente pero invalido responde 403 y no toca la base', async () => {
    const { res, siguio, QueryServiceV1 } = await llamar('enforce', token(15), { idcliente: '99abc' });
    expect(siguio).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
  });

  it('modo enforce: token propio responde los pedidos y deja req.cliente', async () => {
    const { req, res, QueryServiceV1 } = await llamar('enforce', token(15), { idcliente: 15 });
    expect(req.cliente).toEqual({ idcliente: 15 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(QueryServiceV1.ejecutarProcedimiento).toHaveBeenCalledWith(expect.any(String), [15], 'getMisPedido');
  });

  // La misma PWA la usa el comercio con el idcliente del cliente que atiende: su JWT de
  // colaborador tiene que seguir pasando o enforce romperia la toma de pedidos.
  it('modo enforce: el token de colaborador pasa aunque el idcliente sea de otro', async () => {
    const { res, siguio, QueryServiceV1 } = await llamar('enforce', tokenColaborador(), { idcliente: 99 });
    expect(siguio).toBe(true);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(QueryServiceV1.ejecutarProcedimiento).toHaveBeenCalledWith(expect.any(String), [99], 'getMisPedido');
  });

  it('modo off: no mira nada y no avisa', async () => {
    const { res, siguio, logger } = await llamar('off', null, { idcliente: 99 });
    expect(siguio).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
