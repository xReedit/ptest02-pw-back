const hooks = require('../service/repartidor.socket.hooks');

describe('debeGuardarPosicion', () => {
    beforeEach(() => hooks._limpiarThrottle());

    test('permite el primer guardado de un repartidor', () => {
        expect(hooks.debeGuardarPosicion(7, 1_000_000)).toBe(true);
    });

    test('bloquea un segundo guardado antes de los 30 s', () => {
        hooks.debeGuardarPosicion(7, 1_000_000);
        expect(hooks.debeGuardarPosicion(7, 1_000_000 + 29_999)).toBe(false);
    });

    test('permite guardar de nuevo pasados los 30 s', () => {
        hooks.debeGuardarPosicion(7, 1_000_000);
        expect(hooks.debeGuardarPosicion(7, 1_000_000 + 30_000)).toBe(true);
    });

    test('un repartidor no bloquea a otro', () => {
        hooks.debeGuardarPosicion(7, 1_000_000);
        expect(hooks.debeGuardarPosicion(8, 1_000_000)).toBe(true);
    });

    test('sin idrepartidor no guarda nada', () => {
        expect(hooks.debeGuardarPosicion(null, 1_000_000)).toBe(false);
        expect(hooks.debeGuardarPosicion(0, 1_000_000)).toBe(false);
    });

    test('olvidar a un repartidor le permite guardar de inmediato', () => {
        hooks.debeGuardarPosicion(7, 1_000_000);
        hooks._olvidarRepartidor(7);
        expect(hooks.debeGuardarPosicion(7, 1_000_001)).toBe(true);
    });
});
