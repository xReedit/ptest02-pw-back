jest.mock('../utilitarios/logger', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../_config', () => ({ SEED: 'semilla-colaborador-de-prueba', SEED_SMS: 'x' }));

const jwt = require('jsonwebtoken');
const SEMILLA = 'semilla-cliente-de-prueba-sprint5';

function cargar(modo) {
  jest.resetModules();
  process.env.AUTH_CLIENTE_MODO = modo;
  process.env.SEED_CLIENTE = SEMILLA;
  return require('../middleware/autentificacion.cliente');
}

const token = (idcliente) => jwt.sign({ idcliente, tipo: 'cliente' }, SEMILLA, { expiresIn: '180d' });

afterEach(() => {
  delete process.env.AUTH_CLIENTE_MODO;
  delete process.env.SEED_CLIENTE;
});

// Copia exacta de la lectura del payload que hace sockets.js en join-cliente.
// Si cambia alla, tiene que cambiar aca.
function leerPayloadJoin(payload, tokenHandshake) {
  const esObjeto = payload && typeof payload === 'object';
  return {
    idcliente: esObjeto ? payload.idcliente : payload,
    token: (esObjeto && payload.tokenCliente) ? payload.tokenCliente : tokenHandshake
  };
}

describe('join-cliente: formas del payload', () => {
  it('app vieja: numero suelto, usa el token del handshake', () => {
    expect(leerPayloadJoin(15, 'tk-handshake')).toEqual({ idcliente: 15, token: 'tk-handshake' });
  });

  it('app nueva: objeto, el token del payload gana', () => {
    expect(leerPayloadJoin({ idcliente: 15, tokenCliente: 'tk-nuevo' }, 'tk-handshake'))
      .toEqual({ idcliente: 15, token: 'tk-nuevo' });
  });

  it('objeto sin token cae al del handshake', () => {
    expect(leerPayloadJoin({ idcliente: 15 }, 'tk-handshake')).toEqual({ idcliente: 15, token: 'tk-handshake' });
  });

  it('payload nulo no revienta', () => {
    expect(leerPayloadJoin(null, '')).toEqual({ idcliente: null, token: '' });
  });
});

describe('salaCliente aplicada al socket', () => {
  it('log: el intruso entra igual (compatibilidad) pero queda el aviso', () => {
    const auth = cargar('log');
    expect(auth.salaCliente('', 99)).toEqual({ idcliente: 99, motivo: 'sin token' });
  });

  it('enforce: el intruso sin token no entra a ninguna sala', () => {
    const auth = cargar('enforce');
    expect(auth.salaCliente('', 99).idcliente).toBe(0);
  });

  it('enforce: el intruso con token propio no puede entrar a la sala de otro', () => {
    const auth = cargar('enforce');
    expect(auth.salaCliente(token(15), 99)).toEqual({ idcliente: 0, motivo: 'idcliente no coincide' });
  });

  it('enforce: tras nuevoPedido el token nuevo abre la sala nueva', () => {
    const auth = cargar('enforce');
    // el handshake se hizo con el cliente 15 y el SP reasigno el pedido al 20
    expect(auth.salaCliente(token(20), 20)).toEqual({ idcliente: 20, motivo: null });
    expect(auth.salaCliente(token(15), 20).idcliente).toBe(0);
  });

  it('enforce: el token del handshake sin pedir sala explicita une a la propia', () => {
    const auth = cargar('enforce');
    expect(auth.salaCliente(token(15), 0)).toEqual({ idcliente: 15, motivo: null });
  });
});
