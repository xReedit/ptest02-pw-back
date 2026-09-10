jest.mock('../service/query.service.v1', () => ({ ejecutarConsulta: jest.fn() }));
jest.mock('../service/push.cliente.service', () => ({ notificarEstado: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utilitarios/logger', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const QueryServiceV1 = require('../service/query.service.v1');
const pushCliente = require('../service/push.cliente.service');
const svc = require('../service/estado-pedido.service');

function ioMock() {
  const emitted = [];
  return { emitted, to: (room) => ({ emit: (evt, payload) => emitted.push({ room, evt, payload }) }) };
}

describe('estado-pedido.service.notificar + push', () => {
  beforeEach(() => {
    QueryServiceV1.ejecutarConsulta.mockReset();
    pushCliente.notificarEstado.mockClear();
    pushCliente.notificarEstado.mockResolvedValue(undefined);
    svc._resetDedupe();
  });

  it('manda el push con el estado del pedido despues de emitir el socket', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { idpedido: 77, idcliente: 15, pwa_estado: 'A', pwa_delivery_status: '3', idrepartidor: 3, position_now: null }
    ]);
    const io = ioMock();
    svc.setIo(io);

    await svc.notificar(77);

    expect(io.emitted.length).toBe(1);
    expect(pushCliente.notificarEstado).toHaveBeenCalledWith({
      idpedido: 77, idcliente: 15, pwa_estado: 'A', pwa_delivery_status: '3'
    });
  });

  it('no manda push si el pedido no tiene cliente', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([{ idpedido: 77, idcliente: 0 }]);
    svc.setIo(ioMock());
    await svc.notificar(77);
    expect(pushCliente.notificarEstado).not.toHaveBeenCalled();
  });

  it('si el push falla, notificar igual resuelve', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { idpedido: 77, idcliente: 15, pwa_estado: 'E', pwa_delivery_status: '4', position_now: null }
    ]);
    pushCliente.notificarEstado.mockRejectedValueOnce(new Error('fcm caido'));
    svc.setIo(ioMock());
    await expect(svc.notificar(77)).resolves.toBeUndefined();
  });

  it('no repite el push si el estado no cambio, pero si repite el socket', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { idpedido: 77, idcliente: 15, pwa_estado: 'A', pwa_delivery_status: '0', position_now: null }
    ]);
    const io = ioMock();
    svc.setIo(io);

    await svc.notificar(77);
    await svc.notificar(77);

    expect(pushCliente.notificarEstado).toHaveBeenCalledTimes(1);
    expect(io.emitted.length).toBe(2);
  });

  it('manda un push por cada estado distinto', async () => {
    const io = ioMock();
    svc.setIo(io);

    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { idpedido: 77, idcliente: 15, pwa_estado: 'P', pwa_delivery_status: '0', position_now: null }
    ]);
    await svc.notificar(77);

    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { idpedido: 77, idcliente: 15, pwa_estado: 'A', pwa_delivery_status: '0', position_now: null }
    ]);
    await svc.notificar(77);

    expect(pushCliente.notificarEstado).toHaveBeenCalledTimes(2);
    expect(pushCliente.notificarEstado).toHaveBeenNthCalledWith(1, {
      idpedido: 77, idcliente: 15, pwa_estado: 'P', pwa_delivery_status: '0'
    });
    expect(pushCliente.notificarEstado).toHaveBeenNthCalledWith(2, {
      idpedido: 77, idcliente: 15, pwa_estado: 'A', pwa_delivery_status: '0'
    });
  });

  it('el estado final tampoco se repite: sockets.js avisa entregado desde tres manejadores', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { idpedido: 77, idcliente: 15, pwa_estado: 'E', pwa_delivery_status: '4', position_now: null }
    ]);
    svc.setIo(ioMock());

    await svc.notificar(77);
    expect(pushCliente.notificarEstado).toHaveBeenCalledTimes(1);

    await svc.notificar(77);
    await svc.notificar(77);
    expect(pushCliente.notificarEstado).toHaveBeenCalledTimes(1);
  });

  it('no espera al envio: notificar() resuelve sin que FCM haya respondido', async () => {
    QueryServiceV1.ejecutarConsulta.mockResolvedValue([
      { idpedido: 78, idcliente: 15, pwa_estado: 'A', pwa_delivery_status: '1', position_now: null }
    ]);
    let liberar;
    pushCliente.notificarEstado.mockReturnValueOnce(new Promise((resolve) => { liberar = resolve; }));
    svc.setIo(ioMock());

    await svc.notificar(78);

    expect(pushCliente.notificarEstado).toHaveBeenCalledTimes(1);
    liberar(undefined);
    await Promise.resolve();
  });
});
