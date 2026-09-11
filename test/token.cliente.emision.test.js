// apiPwa_v1 arrastra handle.stock.v1 -> stock.porcion.service, que al cargarse lee
// Sequelize.Transaction.ISOLATION_LEVELS. El mock del brief (Sequelize: {}) no basta.
jest.mock('../config/database', () => ({
  sequelize: {},
  Sequelize: { Transaction: { ISOLATION_LEVELS: { READ_COMMITTED: 'READ COMMITTED' } } },
  QueryTypes: {}
}));
jest.mock('../service/query.service.v1', () => ({ ejecutarProcedimiento: jest.fn(), ejecutarConsulta: jest.fn().mockResolvedValue(true) }));
jest.mock('../service/estado-pedido.service', () => ({ leerEstado: jest.fn(), setIo: jest.fn() }));
jest.mock('../utilitarios/logger', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const SEMILLA = 'semilla-cliente-de-prueba-sprint5';
process.env.SEED_CLIENTE = SEMILLA;

const QueryServiceV1 = require('../service/query.service.v1');
const tokenClienteService = require('../service/token.cliente');
const { setRegisterClienteLogin } = require('../controllers/apiPwa_v1');
const { verificarCodigoSMS } = require('../controllers/apiDelivery');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('setRegisterClienteLogin', () => {
  beforeEach(() => { QueryServiceV1.ejecutarProcedimiento.mockReset(); });

  it('devuelve tokenCliente para el idcliente que asigno el procedimiento', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ idcliente: 15, nombres: 'Ana' }]);
    const res = mockRes();

    await setRegisterClienteLogin({ body: { datalogin: { name: 'Ana' } } }, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([{ idcliente: 15, nombres: 'Ana' }]);
    expect(tokenClienteService.verificar(payload.tokenCliente)).toEqual({ idcliente: 15 });
  });

  it('responde tokenCliente vacio si el procedimiento no devolvio idcliente', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ nombres: 'Ana' }]);
    const res = mockRes();

    await setRegisterClienteLogin({ body: { datalogin: {} } }, res);

    expect(res.json.mock.calls[0][0].tokenCliente).toBe('');
  });

  it('responde tokenCliente vacio si el procedimiento fallo', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue(false);
    const res = mockRes();

    await setRegisterClienteLogin({ body: {} }, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toEqual([]);
    expect(payload.tokenCliente).toBe('');
  });
});

describe('verificarCodigoSMS', () => {
  beforeEach(() => {
    QueryServiceV1.ejecutarProcedimiento.mockReset();
    QueryServiceV1.ejecutarConsulta.mockClear();
  });

  const cuerpo = { idcliente: '15', numberphone: '987654321', codigo: '1234' };

  it('emite el token solo cuando response es 1', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ response: 1 }]);
    const res = mockRes();

    await verificarCodigoSMS({ body: cuerpo }, res);

    const payload = res.json.mock.calls[0][0];
    expect(payload.data).toEqual([{ response: 1 }]);
    expect(tokenClienteService.verificar(payload.tokenCliente)).toEqual({ idcliente: 15 });
  });

  it('con response 0 no emite token', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ response: 0 }]);
    const res = mockRes();

    await verificarCodigoSMS({ body: cuerpo }, res);

    expect(res.json.mock.calls[0][0].tokenCliente).toBe('');
  });

  it('un codigo mal formado sigue siendo 400 y no emite nada', async () => {
    const res = mockRes();
    await verificarCodigoSMS({ body: { idcliente: 15, numberphone: '987654321', codigo: 'abcd' } }, res);
    expect(res.statusCode).toBe(400);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
  });

  // Defecto 3.1: la app manda idcliente -2 como centinela de "cliente todavia no registrado"
  // (dialog-verificar-telefono.component.ts:129). La validacion del Sprint 1 exigia > 0 y ese
  // flujo respondia 400. El centinela pasa; token no hay, porque todavia no hay cliente.
  it('acepta el centinela idcliente -2 y responde sin token', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ response: 1 }]);
    const res = mockRes();

    await verificarCodigoSMS({ body: { idcliente: -2, numberphone: '987654321', codigo: '1234' } }, res);

    expect(QueryServiceV1.ejecutarProcedimiento).toHaveBeenCalledWith(
      expect.stringContaining('porcedure_pwa_update_phono_sms_cliente(?,?,?)'),
      [-2, '987654321', '1234'],
      'verificarCodigoSMS'
    );
    expect(res.statusCode).toBe(200);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([{ response: 1 }]);
    expect(payload.tokenCliente).toBe('');
  });

  it('cualquier otro negativo sigue siendo 400', async () => {
    const res = mockRes();
    await verificarCodigoSMS({ body: { idcliente: -3, numberphone: '987654321', codigo: '1234' } }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  // Hallazgo del review Sprint 5: el procedimiento nunca limpiaba pwa_code_verification,
  // asi que un codigo de 4 digitos ya usado seguia siendo valido para siempre (fuerza bruta
  // sobre idcliente). Una verificacion correcta debe invalidarlo con un UPDATE parametrizado.
  it('con response 1 e idcliente real invalida el codigo con un UPDATE parametrizado', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ response: 1 }]);
    const res = mockRes();

    await verificarCodigoSMS({ body: cuerpo }, res);

    expect(QueryServiceV1.ejecutarConsulta).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE cliente SET pwa_code_verification'),
      [15],
      'UPDATE',
      expect.any(String)
    );
  });

  // El centinela CLIENTE_NUEVO (-2) no tiene fila de cliente: no hay nada que invalidar.
  it('con el centinela idcliente -2 no ejecuta ninguna invalidacion', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ response: 1 }]);
    const res = mockRes();

    await verificarCodigoSMS({ body: { idcliente: -2, numberphone: '987654321', codigo: '1234' } }, res);

    expect(QueryServiceV1.ejecutarConsulta).not.toHaveBeenCalled();
  });
});

describe('ack de nuevoPedido (conTokenCliente)', () => {
  it('el ack lleva el token en la primera fila junto al idcliente', () => {
    const rpt = [{ idpedido: 77, idcliente: 15 }, { print: 'ticket' }];
    const ack = tokenClienteService.conTokenCliente(rpt);

    expect(ack[0].idpedido).toBe(77);
    expect(tokenClienteService.verificar(ack[0].tokenCliente)).toEqual({ idcliente: 15 });
    expect(rpt[0].tokenCliente).toBeUndefined();
  });

  it('un ack en false (pedido no guardado) sigue siendo false', () => {
    expect(tokenClienteService.conTokenCliente(false)).toBe(false);
  });
});
