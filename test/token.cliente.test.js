// El emisor lee process.env.SEED_CLIENTE en cada llamada, asi que el spec puede
// cambiar el secreto sin resetear modulos.
const jwt = require('jsonwebtoken');

const SEMILLA = 'semilla-de-prueba-sprint5-no-es-la-real';
const OTRA_SEMILLA = 'otra-semilla-distinta-de-prueba';

const svc = require('../service/token.cliente');

describe('emitir', () => {
  beforeEach(() => { process.env.SEED_CLIENTE = SEMILLA; });
  afterEach(() => { delete process.env.SEED_CLIENTE; });

  it('firma un JWT con idcliente y tipo cliente', () => {
    const token = svc.emitir(15);
    expect(typeof token).toBe('string');
    const decode = jwt.verify(token, SEMILLA);
    expect(decode.idcliente).toBe(15);
    expect(decode.tipo).toBe('cliente');
  });

  it('acepta el idcliente como texto', () => {
    expect(jwt.verify(svc.emitir('15'), SEMILLA).idcliente).toBe(15);
  });

  it('vence a los 180 dias', () => {
    const decode = jwt.verify(svc.emitir(15), SEMILLA);
    expect(decode.exp - decode.iat).toBe(180 * 24 * 60 * 60);
  });

  it('devuelve null con un idcliente que no sirve', () => {
    expect(svc.emitir(0)).toBeNull();
    expect(svc.emitir(-2)).toBeNull();
    expect(svc.emitir(null)).toBeNull();
    expect(svc.emitir('abc')).toBeNull();
    expect(svc.emitir(1.5)).toBeNull();
  });

  it('devuelve null si no hay SEED_CLIENTE en el entorno', () => {
    delete process.env.SEED_CLIENTE;
    expect(svc.emitir(15)).toBeNull();
  });
});

describe('verificar', () => {
  beforeEach(() => { process.env.SEED_CLIENTE = SEMILLA; });
  afterEach(() => { delete process.env.SEED_CLIENTE; });

  it('devuelve el idcliente de un token propio', () => {
    expect(svc.verificar(svc.emitir(15))).toEqual({ idcliente: 15 });
  });

  it('acepta el token con prefijo Bearer', () => {
    expect(svc.verificar(`Bearer ${svc.emitir(15)}`)).toEqual({ idcliente: 15 });
    expect(svc.verificar(`bearer ${svc.emitir(15)}`)).toEqual({ idcliente: 15 });
  });

  it('rechaza un token firmado con otra semilla (el de colaborador nunca pasa)', () => {
    const ajeno = jwt.sign({ idcliente: 15, tipo: 'cliente' }, OTRA_SEMILLA, { expiresIn: '180d' });
    expect(svc.verificar(ajeno)).toBeNull();
  });

  it('rechaza un token de otro tipo aunque este firmado con la semilla correcta', () => {
    const otroTipo = jwt.sign({ usuario: { idusuario: 3 }, tipo: 'usuario' }, SEMILLA, { expiresIn: '2d' });
    expect(svc.verificar(otroTipo)).toBeNull();
  });

  it('rechaza un token firmado HS512 con la semilla correcta', () => {
    const otroAlg = jwt.sign({ idcliente: 15, tipo: 'cliente' }, SEMILLA, { expiresIn: '180d', algorithm: 'HS512' });
    expect(svc.verificar(otroAlg)).toBeNull();
  });

  it('rechaza un token vencido', () => {
    const vencido = jwt.sign({ idcliente: 15, tipo: 'cliente' }, SEMILLA, { expiresIn: '-1s' });
    expect(svc.verificar(vencido)).toBeNull();
  });

  it('rechaza vacio, basura y valores que no son texto', () => {
    expect(svc.verificar('')).toBeNull();
    expect(svc.verificar('   ')).toBeNull();
    expect(svc.verificar('no.es.jwt')).toBeNull();
    expect(svc.verificar(null)).toBeNull();
    expect(svc.verificar(undefined)).toBeNull();
    expect(svc.verificar({ idcliente: 15 })).toBeNull();
  });

  it('rechaza un token con idcliente invalido en el payload', () => {
    const raro = jwt.sign({ idcliente: 0, tipo: 'cliente' }, SEMILLA, { expiresIn: '1d' });
    expect(svc.verificar(raro)).toBeNull();
  });

  it('devuelve null si no hay SEED_CLIENTE aunque el token exista', () => {
    const token = svc.emitir(15);
    delete process.env.SEED_CLIENTE;
    expect(svc.verificar(token)).toBeNull();
  });
});

describe('conTokenCliente', () => {
  beforeEach(() => { process.env.SEED_CLIENTE = SEMILLA; });
  afterEach(() => { delete process.env.SEED_CLIENTE; });

  it('agrega tokenCliente a la primera fila sin tocar el original', () => {
    const filas = [{ idpedido: 77, idcliente: 15 }, { print: 'x' }];
    const salida = svc.conTokenCliente(filas);

    expect(salida).not.toBe(filas);
    expect(filas[0].tokenCliente).toBeUndefined();
    expect(salida[0].idpedido).toBe(77);
    expect(svc.verificar(salida[0].tokenCliente)).toEqual({ idcliente: 15 });
    expect(salida[1]).toBe(filas[1]);
  });

  it('deja las filas tal cual si la primera no trae idcliente valido', () => {
    const filas = [{ idpedido: 77, idcliente: 0 }];
    expect(svc.conTokenCliente(filas)).toBe(filas);
  });

  it('tolera false, null, vacio y valores que no son arreglo', () => {
    expect(svc.conTokenCliente(false)).toBe(false);
    expect(svc.conTokenCliente(null)).toBeNull();
    expect(svc.conTokenCliente([])).toEqual([]);
    expect(svc.conTokenCliente('texto')).toBe('texto');
    expect(svc.conTokenCliente([null])).toEqual([null]);
  });
});
