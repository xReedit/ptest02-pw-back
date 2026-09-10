jest.mock('../service/query.service.v1', () => ({ ejecutarConsulta: jest.fn() }));
const QueryServiceV1 = require('../service/query.service.v1');
const svc = require('../service/estado-pedido.service');

function ioMock() {
  const emitted = [];
  return { emitted, to: (room) => ({ emit: (evt, payload) => emitted.push({ room, evt, payload }) }) };
}

describe('estado-pedido.service.notificar', () => {
  beforeEach(() => QueryServiceV1.ejecutarConsulta.mockReset());

  it('emite pedido-cambio-estado a la sala del cliente', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([{ idpedido: 10, idcliente: 7, pwa_estado: 'A', pwa_delivery_status: '1', idrepartidor: 3, nom_repartidor: 'Luis', telefono_repartidor: '999', position_now: '{"lat":-12,"lng":-77}' }]);
    const io = ioMock(); svc.setIo(io);
    await svc.notificar(10);
    expect(io.emitted).toEqual([{ room: 'cliente_7', evt: 'pedido-cambio-estado', payload: expect.objectContaining({ idpedido: 10, pwa_estado: 'A', pwa_delivery_status: '1', position_now: { lat: -12, lng: -77 } }) }]);
  });

  it('no emite si el pedido no tiene cliente y nunca lanza', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([{ idpedido: 10, idcliente: 0 }]);
    const io = ioMock(); svc.setIo(io);
    await expect(svc.notificar(10)).resolves.toBeUndefined();
    expect(io.emitted.length).toBe(0);
    QueryServiceV1.ejecutarConsulta.mockRejectedValue(new Error('db'));
    await expect(svc.notificar(10)).resolves.toBeUndefined();
  });
});
