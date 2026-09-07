// Evita guardar dos veces el mismo pedido cuando la app reintenta por señal lenta.
// ponytail: Map en memoria, suficiente con pm2 fork instances:1. Si se pasa a cluster, mover a Redis.
const enCurso = new Map();
const TTL_MS = 10 * 60 * 1000;

// Ejecuta fn() una sola vez por clave; las repeticiones reciben la misma promesa.
// Si fn falla, la clave se libera para que un reintento real vuelva a intentar.
function unaVez(clave, fn) {
  if (!clave) return Promise.resolve().then(fn);
  if (enCurso.has(clave)) return enCurso.get(clave);

  const p = Promise.resolve().then(fn);
  enCurso.set(clave, p);
  // los guardados devuelven false / [] / {success:false} en vez de lanzar: tambien liberan la clave
  p.then(r => { if (esFallo(r)) enCurso.delete(clave); }, () => enCurso.delete(clave));
  setTimeout(() => enCurso.delete(clave), TTL_MS).unref();
  return p;
}

const esFallo = (r) => !r || (Array.isArray(r) && (r.length === 0 || r.some(x => x && x.success === false)));

const esRepetida = (clave) => !!clave && enCurso.has(clave);

module.exports = { unaVez, esRepetida };
