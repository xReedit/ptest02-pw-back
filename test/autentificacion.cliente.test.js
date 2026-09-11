jest.mock('../utilitarios/logger', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
// _config abre config.js local; se simula para no depender de la maquina
jest.mock('../_config', () => ({ SEED: 'semilla-colaborador-de-prueba', SEED_SMS: 'x' }));

const jwt = require('jsonwebtoken');
const logger = require('../utilitarios/logger');

const SEMILLA_CLIENTE = 'semilla-cliente-de-prueba-sprint5';
const SEMILLA_COLABORADOR = 'semilla-colaborador-de-prueba';

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

// El modo se lee en CADA llamada, asi que para probarlo basta con cambiar la variable de
// entorno sobre el mismo modulo. Se carga una sola vez a proposito: con jest.resetModules()
// el middleware se quedaria con un mock de logger distinto del que ve este spec.
process.env.SEED_CLIENTE = SEMILLA_CLIENTE;
const auth = require('../middleware/autentificacion.cliente');

function cargar(modo, conSecreto = true) {
  process.env.AUTH_CLIENTE_MODO = modo;
  if (conSecreto) { process.env.SEED_CLIENTE = SEMILLA_CLIENTE; } else { delete process.env.SEED_CLIENTE; }
  return auth;
}

// Solo el chequeo de arranque (enforce sin secreto) ocurre al cargar el modulo: ese si
// necesita un require aislado.
function recargar(modo, conSecreto = true) {
  jest.resetModules();
  process.env.AUTH_CLIENTE_MODO = modo;
  if (conSecreto) { process.env.SEED_CLIENTE = SEMILLA_CLIENTE; } else { delete process.env.SEED_CLIENTE; }
  return require('../middleware/autentificacion.cliente');
}

const tokenCliente = (idcliente, semilla = SEMILLA_CLIENTE) =>
  jwt.sign({ idcliente, tipo: 'cliente' }, semilla, { expiresIn: '180d' });

const tokenColaborador = () =>
  jwt.sign({ usuario: { idusuario: 3, idsede: 1 } }, SEMILLA_COLABORADOR, { expiresIn: '2d' });

const pedir = (cabecera, body = {}) => ({
  headers: cabecera ? { authorization: cabecera } : {},
  body,
  query: {},
  originalUrl: '/v3/delivery/get-mis-pedidos'
});

afterEach(() => {
  delete process.env.AUTH_CLIENTE_MODO;
  delete process.env.SEED_CLIENTE;
  logger.warn.mockReset();
});

describe('arranque', () => {
  it('falla cerrado si enforce no tiene SEED_CLIENTE', () => {
    expect(() => recargar('enforce', false)).toThrow(/SEED_CLIENTE/);
  });

  it('arranca en log aunque falte SEED_CLIENTE', () => {
    expect(() => recargar('log', false)).not.toThrow();
  });

  it('arranca en off aunque falte SEED_CLIENTE', () => {
    expect(() => recargar('off', false)).not.toThrow();
  });

  it('arranca en enforce cuando SEED_CLIENTE si esta', () => {
    expect(() => recargar('enforce', true)).not.toThrow();
  });

  it('un modo desconocido cae en log', () => {
    expect(cargar('sarasa').modo()).toBe('log');
  });

  it('sin la variable definida el modo es log', () => {
    delete process.env.AUTH_CLIENTE_MODO;
    expect(auth.modo()).toBe('log');
  });
});

describe('modo off', () => {
  it('deja pasar sin token y sin avisar', () => {
    const auth = cargar('off');
    const next = jest.fn();
    const res = mockRes();
    const req = pedir(null, { idcliente: 99 });

    auth.verificarTokenCliente(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(req.cliente).toBeUndefined();
  });
});

describe('modo log', () => {
  it('sin token: avisa con ruta e idcliente y deja pasar', () => {
    const auth = cargar('log');
    const next = jest.fn();
    const res = mockRes();

    auth.verificarTokenCliente(pedir(null, { idcliente: 99 }), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    const datos = logger.warn.mock.calls[0][0];
    expect(datos.ruta).toBe('/v3/delivery/get-mis-pedidos');
    expect(datos.idcliente).toBe(99);
    expect(datos.motivo).toBe('sin token');
  });

  it('token invalido: avisa y deja pasar', () => {
    const auth = cargar('log');
    const next = jest.fn();
    auth.verificarTokenCliente(pedir('Bearer no.es.jwt', { idcliente: 99 }), mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(logger.warn.mock.calls[0][0].motivo).toBe('token invalido');
  });

  it('idcliente que no coincide: avisa y deja pasar', () => {
    const auth = cargar('log');
    const next = jest.fn();
    auth.verificarTokenCliente(pedir(`Bearer ${tokenCliente(15)}`, { idcliente: 99 }), mockRes(), next);
    expect(next).toHaveBeenCalled();
    expect(logger.warn.mock.calls[0][0].motivo).toBe('idcliente no coincide');
  });

  it('token correcto: pasa sin avisar y deja req.cliente', () => {
    const auth = cargar('log');
    const next = jest.fn();
    const req = pedir(`Bearer ${tokenCliente(15)}`, { idcliente: 15 });

    auth.verificarTokenCliente(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(req.cliente).toEqual({ idcliente: 15 });
  });

  it('nunca escribe el token en el log', () => {
    const auth = cargar('log');
    const token = tokenCliente(15);
    auth.verificarTokenCliente(pedir(`Bearer ${token}`, { idcliente: 99 }), mockRes(), jest.fn());
    expect(JSON.stringify(logger.warn.mock.calls[0][0])).not.toContain(token);
  });
});

describe('modo enforce', () => {
  it('sin token: 401 y no llama a next', () => {
    const auth = cargar('enforce');
    const next = jest.fn();
    const res = mockRes();

    auth.verificarTokenCliente(pedir(null, { idcliente: 15 }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'no autorizado' });
  });

  it('token invalido, de otra semilla o vencido: 401', () => {
    const auth = cargar('enforce');
    const vencido = jwt.sign({ idcliente: 15, tipo: 'cliente' }, SEMILLA_CLIENTE, { expiresIn: '-1s' });
    ['Bearer no.es.jwt', `Bearer ${tokenCliente(15, 'otra-semilla')}`, `Bearer ${vencido}`].forEach((cabecera) => {
      const res = mockRes();
      const next = jest.fn();
      auth.verificarTokenCliente(pedir(cabecera, { idcliente: 15 }), res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(401);
    });
  });

  it('idcliente del body distinto al del token: 403', () => {
    const auth = cargar('enforce');
    const res = mockRes();
    const next = jest.fn();

    auth.verificarTokenCliente(pedir(`Bearer ${tokenCliente(15)}`, { idcliente: 99 }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'no autorizado' });
  });

  it('token correcto: pasa con req.cliente', () => {
    const auth = cargar('enforce');
    const next = jest.fn();
    const req = pedir(`Bearer ${tokenCliente(15)}`, { idcliente: '15' });

    auth.verificarTokenCliente(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.cliente).toEqual({ idcliente: 15 });
  });

  it('sin idcliente en el body basta con que el token sea valido', () => {
    const auth = cargar('enforce');
    const next = jest.fn();
    const req = pedir(`Bearer ${tokenCliente(15)}`, {});

    auth.verificarTokenCliente(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.cliente).toEqual({ idcliente: 15 });
  });

  it('lee tambien el idcliente del query string', () => {
    const auth = cargar('enforce');
    const res = mockRes();
    const req = { headers: { authorization: tokenCliente(15) }, body: {}, query: { idcliente: '99' }, originalUrl: '/v3/x' };

    auth.verificarTokenCliente(req, res, jest.fn());

    expect(res.statusCode).toBe(403);
  });

  // Un idcliente presente pero que no es un entero positivo NO puede tratarse como
  // ausente: seria la forma mas barata de saltarse la comparacion.
  [
    ['una cadena que no es numero', '99abc'],
    ['un arreglo (query repetido)', ['99', '15']],
    ['un objeto', {}],
    ['cero', 0],
    ['cero como texto', '0'],
    ['negativo', -15],
    ['decimal', '15.5'],
    ['cadena vacia', '']
  ].forEach(([caso, valor]) => {
    it(`idcliente invalido (${caso}): 403 y no llega al handler`, () => {
      const auth = cargar('enforce');
      const res = mockRes();
      const next = jest.fn();

      auth.verificarTokenCliente(pedir(`Bearer ${tokenCliente(15)}`, { idcliente: valor }), res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'no autorizado' });
    });

    it(`idcliente invalido (${caso}) en modo log: avisa y deja pasar`, () => {
      const auth = cargar('log');
      const next = jest.fn();
      const req = pedir(`Bearer ${tokenCliente(15)}`, { idcliente: valor });

      auth.verificarTokenCliente(req, mockRes(), next);

      expect(next).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0].motivo).toBe('idcliente invalido');
      expect(req.cliente).toBeUndefined();
    });
  });

  it('idcliente invalido en el query tambien es 403', () => {
    const auth = cargar('enforce');
    const res = mockRes();
    const req = { headers: { authorization: tokenCliente(15) }, body: {}, query: { idcliente: ['99', '15'] }, originalUrl: '/v3/x' };

    auth.verificarTokenCliente(req, res, jest.fn());

    expect(res.statusCode).toBe(403);
  });

  // La precedencia es por presencia de la clave: si el body trae idcliente manda el body
  // aunque su valor no sirva. Si no, bastaria con mandar body {idcliente: 0} y el id real
  // en el query para que la comparacion pasara por el valor "bueno".
  it('body con idcliente invalido gana sobre un query valido: 403', () => {
    const auth = cargar('enforce');
    const res = mockRes();
    const req = { headers: { authorization: tokenCliente(15) }, body: { idcliente: 0 }, query: { idcliente: '15' }, originalUrl: '/v3/x' };

    auth.verificarTokenCliente(req, res, jest.fn());

    expect(res.statusCode).toBe(403);
  });

  it('idcliente null o undefined si cuenta como ausente', () => {
    const auth = cargar('enforce');
    [{ idcliente: null }, { idcliente: undefined }].forEach((body) => {
      const next = jest.fn();
      const req = pedir(`Bearer ${tokenCliente(15)}`, body);
      auth.verificarTokenCliente(req, mockRes(), next);
      expect(next).toHaveBeenCalled();
      expect(req.cliente).toEqual({ idcliente: 15 });
    });
  });

  it('acepta el token sin prefijo Bearer', () => {
    const auth = cargar('enforce');
    const next = jest.fn();
    auth.verificarTokenCliente(pedir(tokenCliente(15), { idcliente: 15 }), mockRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('salida para el colaborador', () => {
  it('el JWT de colaborador pasa aunque el idcliente sea de otro (comercio toma el pedido)', () => {
    const auth = cargar('enforce');
    const next = jest.fn();
    const req = pedir(tokenColaborador(), { idcliente: 99 });

    auth.verificarTokenCliente(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.cliente).toBeUndefined();
  });

  it('un token de cliente NO cuenta como colaborador', () => {
    const auth = cargar('enforce');
    expect(auth.esColaborador(tokenCliente(15))).toBe(false);
  });

  it('un token de colaborador firmado HS512 con la misma semilla NO pasa', () => {
    const auth = cargar('enforce');
    const hs512 = jwt.sign({ usuario: { idusuario: 3 } }, SEMILLA_COLABORADOR, { expiresIn: '2d', algorithm: 'HS512' });
    expect(auth.esColaborador(hs512)).toBe(false);
  });
});

describe('exigirCliente con extractor propio', () => {
  it('lee el idcliente de body.user (user-account-remove)', () => {
    const auth = cargar('enforce');
    const medio = auth.exigirCliente({ idcliente: (req) => (req.body && req.body.user ? req.body.user.idcliente : 0) });
    const res = mockRes();

    medio({ headers: { authorization: tokenCliente(15) }, body: { user: { idcliente: 99 } }, query: {}, originalUrl: '/v3/ini/user-account-remove' }, res, jest.fn());

    expect(res.statusCode).toBe(403);
  });

  it('si el extractor no encuentra nada (undefined) basta el token valido', () => {
    const auth = cargar('enforce');
    const medio = auth.exigirCliente({ idcliente: (req) => (req.body && req.body.user ? req.body.user.idcliente : undefined) });
    const next = jest.fn();
    const req = { headers: { authorization: tokenCliente(15) }, body: {}, query: {}, originalUrl: '/v3/ini/user-account-remove' };

    medio(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.cliente).toEqual({ idcliente: 15 });
  });

  it('un idcliente invalido dentro de user tambien es 403', () => {
    const auth = cargar('enforce');
    const medio = auth.exigirCliente({ idcliente: (req) => (req.body && req.body.user ? req.body.user.idcliente : undefined) });
    const res = mockRes();

    medio({ headers: { authorization: tokenCliente(15) }, body: { user: { idcliente: '99abc' } }, query: {}, originalUrl: '/v3/ini/user-account-remove' }, res, jest.fn());

    expect(res.statusCode).toBe(403);
  });

  it('lee el idcliente de body.dataCalificacion (calificar-servicio)', () => {
    const auth = cargar('enforce');
    const medio = auth.exigirCliente({ idcliente: (req) => (req.body && req.body.dataCalificacion ? req.body.dataCalificacion.idcliente : 0) });
    const next = jest.fn();

    medio({ headers: { authorization: tokenCliente(15) }, body: { dataCalificacion: { idcliente: 15, idpedido: 7 } }, query: {}, originalUrl: '/v3/delivery/calificar-servicio' }, mockRes(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('salaCliente', () => {
  it('en off devuelve el idcliente pedido tal cual', () => {
    const auth = cargar('off');
    expect(auth.salaCliente('', 99)).toEqual({ idcliente: 99, motivo: null });
  });

  it('en log entra igual pero con motivo', () => {
    const auth = cargar('log');
    expect(auth.salaCliente('', 99)).toEqual({ idcliente: 99, motivo: 'sin token' });
    expect(auth.salaCliente('basura', 99)).toEqual({ idcliente: 99, motivo: 'token invalido' });
    expect(auth.salaCliente(tokenCliente(15), 99)).toEqual({ idcliente: 99, motivo: 'idcliente no coincide' });
  });

  it('en enforce sin token valido no entra a ninguna sala', () => {
    const auth = cargar('enforce');
    expect(auth.salaCliente('', 99)).toEqual({ idcliente: 0, motivo: 'sin token' });
    expect(auth.salaCliente('basura', 99)).toEqual({ idcliente: 0, motivo: 'token invalido' });
    expect(auth.salaCliente(tokenCliente(15), 99)).toEqual({ idcliente: 0, motivo: 'idcliente no coincide' });
  });

  it('con token valido entra a SU sala, aun si no pidio ninguna', () => {
    const auth = cargar('enforce');
    expect(auth.salaCliente(tokenCliente(15), 15)).toEqual({ idcliente: 15, motivo: null });
    expect(auth.salaCliente(tokenCliente(15), 0)).toEqual({ idcliente: 15, motivo: null });
    expect(auth.salaCliente(`Bearer ${tokenCliente(15)}`, '15')).toEqual({ idcliente: 15, motivo: null });
  });
});

// Va al final a proposito: jest.doMock('../_config') se queda en el registro de modulos
// del archivo y ensuciaria los describes de arriba.
describe('arranque sin SEED (colaboradores)', () => {
  afterAll(() => {
    jest.dontMock('../_config');
    jest.resetModules();
  });

  it('avisa en el log, sin lanzar: esColaborador rechazaria a todos', () => {
    jest.resetModules();
    jest.doMock('../_config', () => ({ SEED: '', SEED_SMS: 'x' }));
    process.env.AUTH_CLIENTE_MODO = 'log';
    process.env.SEED_CLIENTE = SEMILLA_CLIENTE;

    const loggerAislado = require('../utilitarios/logger');
    loggerAislado.warn.mockReset();

    let authAislado;
    expect(() => { authAislado = require('../middleware/autentificacion.cliente'); }).not.toThrow();

    expect(loggerAislado.warn).toHaveBeenCalledTimes(1);
    expect(String(loggerAislado.warn.mock.calls[0][1])).toContain('SEED');
    expect(authAislado.esColaborador('lo-que-sea')).toBe(false);
  });
});
