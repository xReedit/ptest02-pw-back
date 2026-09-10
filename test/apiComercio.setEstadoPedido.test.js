// Evita abrir conexiones reales al cargar el controlador
jest.mock('../config/database', () => ({ sequelize: { getQueryInterface: () => ({ escape: (s) => s }) }, Sequelize: {}, QueryTypes: {} }));
jest.mock('../service/query.service.v1', () => ({ ejecutarProcedimiento: jest.fn(), ejecutarConsulta: jest.fn() }));
jest.mock('../service/estado-pedido.service', () => ({ notificar: jest.fn(), leerEstado: jest.fn() }));

const QueryServiceV1 = require('../service/query.service.v1');
const estadoPedidoService = require('../service/estado-pedido.service');
const { setEstadoPedido } = require('../controllers/apiComercio');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

describe('setEstadoPedido', () => {
  beforeEach(() => {
    QueryServiceV1.ejecutarProcedimiento.mockReset();
    estadoPedidoService.notificar.mockReset();
  });

  it('rechaza un estado no permitido sin tocar la base', async () => {
    const res = mockRes();
    await setEstadoPedido({ body: { idpedido: 10, estado: 'Z' } }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('responde 500 y no notifica cuando el procedimiento falla (null)', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue(null);
    const res = mockRes();

    await setEstadoPedido({ body: { idpedido: 10, estado: 'A' } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(estadoPedidoService.notificar).not.toHaveBeenCalled();
  });

  it('notifica y responde exito cuando el procedimiento devuelve filas', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ response: 1 }]);
    const res = mockRes();

    await setEstadoPedido({ body: { idpedido: '10', estado: 'a' } }, res);

    expect(QueryServiceV1.ejecutarProcedimiento).toHaveBeenCalledWith(
      expect.stringContaining('procedure_delivery_set_estado_set_estado_pedido(?, ?)'),
      [10, 'A'],
      'setEstadoPedido'
    );
    expect(estadoPedidoService.notificar).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [{ response: 1 }] }));
  });
});
