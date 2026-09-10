const mockSend = jest.fn();

jest.mock('../service/query.service.v1', () => ({ ejecutarConsulta: jest.fn() }));
jest.mock('../firebase_config', () => ({ admin: { messaging: () => ({ send: mockSend }) } }));
jest.mock('../utilitarios/logger', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const QueryServiceV1 = require('../service/query.service.v1');
const svc = require('../service/push.cliente.service');

const TOKEN = 'fZk1QwErTyUiOpAsDfGhJkLzXcVbNm0987654321';

describe('codigoEstado', () => {
  const casos = [
    ['P', '0', 'recibido'],
    ['A', '0', 'preparando'],
    ['D', '0', 'preparando'],
    ['R', '0', 'asignado'],
    ['A', 1, 'asignado'],
    ['A', '3', 'camino'],
    ['E', '3', 'entregado'],
    ['A', 4, 'entregado'],
    ['C', '0', 'cancelado'],
    ['A', '5', 'cancelado'],
    [null, null, 'recibido'],
  ];
  casos.forEach(([estado, delivery, esperado]) => {
    it(`${estado} / ${delivery} -> ${esperado}`, () => {
      expect(svc.codigoEstado(estado, delivery)).toBe(esperado);
    });
  });
});

describe('construirMensaje', () => {
  it('usa las etiquetas del cliente y el numero de pedido', () => {
    expect(svc.construirMensaje(77, 'A', '3')).toEqual({
      codigo: 'camino',
      title: 'En camino',
      body: 'Tu pedido #77 ya salio hacia tu direccion.'
    });
  });
  it('cubre los siete estados', () => {
    expect(Object.keys(svc.MENSAJES).sort()).toEqual(
      ['aceptado', 'asignado', 'camino', 'cancelado', 'entregado', 'preparando', 'recibido']
    );
  });
});

describe('leerTokenFcm', () => {
  it('lee el formato nuevo', () => {
    expect(svc.leerTokenFcm(JSON.stringify({ tipo: 'fcm', token: TOKEN, plataforma: 'android' })))
      .toEqual({ token: TOKEN, plataforma: 'android' });
  });
  it('acepta un token guardado como string suelto (apps viejas)', () => {
    expect(svc.leerTokenFcm(JSON.stringify(TOKEN))).toEqual({ token: TOKEN, plataforma: 'android' });
  });
  it('ignora una suscripcion web push', () => {
    expect(svc.leerTokenFcm(JSON.stringify({ endpoint: 'https://fcm.googleapis.com/x', keys: {} }))).toBeNull();
  });
  it('acepta un token crudo sin comillas json (filas viejas)', () => {
    expect(svc.leerTokenFcm(TOKEN)).toEqual({ token: TOKEN, plataforma: 'android' });
  });
  it('ignora vacio y basura', () => {
    expect(svc.leerTokenFcm(null)).toBeNull();
    expect(svc.leerTokenFcm('')).toBeNull();
    expect(svc.leerTokenFcm('no es json')).toBeNull();
    expect(svc.leerTokenFcm('x'.repeat(5000))).toBeNull();
  });
});

describe('notificarEstado', () => {
  beforeEach(() => {
    QueryServiceV1.ejecutarConsulta.mockReset();
    mockSend.mockReset();
    mockSend.mockResolvedValue('projects/x/messages/1');
  });

  it('envia al token del cliente con canal, data.idpedido y titulo del estado', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { key_suscripcion_push: JSON.stringify({ tipo: 'fcm', token: TOKEN, plataforma: 'android' }) }
    ]);

    await svc.notificarEstado({ idpedido: 77, idcliente: 15, pwa_estado: 'A', pwa_delivery_status: '3' });

    expect(mockSend).toHaveBeenCalledTimes(1);
    const mensaje = mockSend.mock.calls[0][0];
    expect(mensaje.token).toBe(TOKEN);
    expect(mensaje.notification.title).toBe('En camino');
    expect(mensaje.data).toEqual({ tipo: 'estado_pedido', idpedido: '77' });
    expect(mensaje.android.notification.channelId).toBe('pedidos');
  });

  it('no envia si el cliente no tiene token fcm', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { key_suscripcion_push: JSON.stringify({ endpoint: 'https://fcm.googleapis.com/x' }) }
    ]);
    await svc.notificarEstado({ idpedido: 77, idcliente: 15, pwa_estado: 'A', pwa_delivery_status: '3' });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('no envia ni consulta si el idcliente no es valido', async () => {
    await svc.notificarEstado({ idpedido: 77, idcliente: 0, pwa_estado: 'A', pwa_delivery_status: '3' });
    expect(QueryServiceV1.ejecutarConsulta).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('borra el token cuando FCM dice que ya no existe', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { key_suscripcion_push: JSON.stringify({ tipo: 'fcm', token: TOKEN, plataforma: 'android' }) }
    ]);
    const err = new Error('token muerto');
    err.code = 'messaging/registration-token-not-registered';
    mockSend.mockRejectedValue(err);

    await svc.notificarEstado({ idpedido: 77, idcliente: 15, pwa_estado: 'E', pwa_delivery_status: '4' });

    const ultima = QueryServiceV1.ejecutarConsulta.mock.calls.pop();
    expect(ultima[0]).toContain('key_suscripcion_push');
    expect(ultima[0].toUpperCase()).toContain('UPDATE');
    expect(ultima[1]).toEqual([15]);
  });

  it('NO borra el token si el error es de argumento (un mal deploy vaciaria la base)', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { key_suscripcion_push: JSON.stringify({ tipo: 'fcm', token: TOKEN, plataforma: 'android' }) }
    ]);
    const err = new Error('mensaje mal armado');
    err.code = 'messaging/invalid-argument';
    mockSend.mockRejectedValue(err);

    await svc.notificarEstado({ idpedido: 77, idcliente: 15, pwa_estado: 'E', pwa_delivery_status: '4' });

    const consultas = QueryServiceV1.ejecutarConsulta.mock.calls;
    expect(consultas).toHaveLength(1);
    expect(consultas[0][0].toUpperCase()).toContain('SELECT');
  });

  it('nunca lanza aunque falle la base', async () => {
    QueryServiceV1.ejecutarConsulta.mockRejectedValue(new Error('db caida'));
    await expect(svc.notificarEstado({ idpedido: 77, idcliente: 15, pwa_estado: 'P', pwa_delivery_status: '0' }))
      .resolves.toBeUndefined();
  });
});
