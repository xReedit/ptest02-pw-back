// Evita abrir conexiones reales al cargar el controlador
jest.mock('../config/database', () => ({ sequelize: {}, Sequelize: {}, QueryTypes: {} }));
jest.mock('../service/query.service.v1', () => ({ ejecutarProcedimiento: jest.fn() }));

const QueryServiceV1 = require('../service/query.service.v1');
const {
  getMisPedido,
  verificarCodigoSMS,
  setCalificarServicio,
  getComnisionAtm
} = require('../controllers/apiDelivery');

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

describe('setCalificarServicio', () => {
  beforeEach(() => { QueryServiceV1.ejecutarProcedimiento.mockReset(); });

  it('manda el comentario del cliente intacto como parámetro, sin interpolarlo en el SQL', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ response: 1 }]);
    const res = mockRes();
    // Comentario real de un cliente: comilla simple + backslash, lo que antes rompía o mutilaba el SQL
    const comentario = "no me gustó el envío, dijo O'Brien \\ tardó 1h";
    const dataCalificacion = { idpedido: 77, calificacion: 2, comentario };

    await setCalificarServicio({ body: { dataCalificacion } }, res);

    expect(QueryServiceV1.ejecutarProcedimiento).toHaveBeenCalledTimes(1);
    const [sql, params, contexto] = QueryServiceV1.ejecutarProcedimiento.mock.calls[0];

    // El SQL es una plantilla fija: sólo el marcador, nada del body interpolado
    expect(sql).toContain('procedure_pwa_delivery_calificacion(?)');
    expect(sql).not.toContain(comentario);
    expect(sql).not.toContain("O'Brien");
    expect(sql).not.toContain('77');
    expect(contexto).toBe('setCalificarServicio');

    // El comentario llega al procedimiento tal cual lo escribió el cliente
    expect(params).toHaveLength(1);
    expect(typeof params[0]).toBe('string');
    expect(JSON.parse(params[0])).toEqual(dataCalificacion);
    expect(JSON.parse(params[0]).comentario).toBe(comentario);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [{ response: 1 }] }));
  });

  it('rechaza dataCalificacion ausente sin tocar la base', async () => {
    const res = mockRes();
    await setCalificarServicio({ body: {} }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

describe('getComnisionAtm', () => {
  beforeEach(() => { QueryServiceV1.ejecutarProcedimiento.mockReset(); });

  it('rechaza un importe no numérico sin tocar la base', async () => {
    const res = mockRes();
    await getComnisionAtm({ body: { importe: '10) or 1=1 -- ' } }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('rechaza un importe ausente sin tocar la base', async () => {
    const res = mockRes();
    await getComnisionAtm({ body: {} }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it('usa parámetro preparado con el importe numérico', async () => {
    QueryServiceV1.ejecutarProcedimiento.mockResolvedValue([{ comision: 1.5 }]);
    const res = mockRes();
    await getComnisionAtm({ body: { importe: '25.50' } }, res);
    expect(QueryServiceV1.ejecutarProcedimiento).toHaveBeenCalledWith(
      expect.stringContaining('procedure_calc_comsion_visa_atm(?)'),
      [25.5],
      'getComnisionAtm'
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: [{ comision: 1.5 }] }));
  });
});
