// Evita abrir conexiones reales al cargar el controlador
jest.mock('../config/database', () => ({ sequelize: {}, Sequelize: {}, QueryTypes: {} }));
jest.mock('../service/query.service.v1', () => ({ ejecutarProcedimiento: jest.fn() }));

const QueryServiceV1 = require('../service/query.service.v1');
const { getMisPedido, verificarCodigoSMS } = require('../controllers/apiDelivery');

function mockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
}

describe('getMisPedido', () => {
  beforeEach(() => { QueryServiceV1.ejecutarProcedimiento.mockReset(); });

  it('rechaza idcliente inválido sin tocar la base', async () => {
    const res = mockRes();
    await getMisPedido({ body: { idcliente: '1 or 1=1' } }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
    // ReE de service/uitl.service.js asigna res.statusCode y responde con success:false
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('rechaza idcliente ausente sin tocar la base', async () => {
    const res = mockRes();
    await getMisPedido({ body: {} }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('usa parámetro preparado con el id numérico', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ idpedido: 1 }]);
    const res = mockRes();
    await getMisPedido({ body: { idcliente: '15' } }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).toHaveBeenCalledWith(
      expect.stringContaining('procedure_pwa_delivery_mis_pedidos(?)'),
      [15],
      'getMisPedido'
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [{ idpedido: 1 }] }));
  });
});

describe('verificarCodigoSMS', () => {
  beforeEach(() => { QueryServiceV1.ejecutarProcedimiento.mockReset(); });

  it('rechaza un código no numérico sin tocar la base', async () => {
    const res = mockRes();
    await verificarCodigoSMS({ body: { idcliente: 5, numberphone: '987654321', codigo: "1' or '1'='1" } }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('rechaza un teléfono con comillas sin tocar la base', async () => {
    const res = mockRes();
    await verificarCodigoSMS({ body: { idcliente: 5, numberphone: "9876', '1", codigo: '1234' } }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('rechaza idcliente inválido sin tocar la base', async () => {
    const res = mockRes();
    await verificarCodigoSMS({ body: { idcliente: '3 or 1=1', numberphone: '987654321', codigo: '1234' } }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('llama al procedimiento con parámetros y conserva la forma { data: [...] }', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ response: 1 }]);
    const res = mockRes();
    await verificarCodigoSMS({ body: { idcliente: '5', numberphone: '987654321', codigo: '1234' } }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).toHaveBeenCalledWith(
      expect.stringContaining('porcedure_pwa_update_phono_sms_cliente(?,?,?)'),
      [5, '987654321', '1234'],
      'verificarCodigoSMS'
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [{ response: 1 }] }));
  });
});
