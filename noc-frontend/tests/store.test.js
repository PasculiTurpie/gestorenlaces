import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { useTopology } from '../src/store/topologyStore.js';

const nodoApi = (id, x = 0, y = 0, tipo = 'ESTACION') => ({ _id: `n-${id}`, id_nodo: id, nombre: id, tipo, posicion: { x, y } });
const enlaceApi = (id, o, d, estado = 'OK', extra = {}) => ({
  _id: id, id_enlace: `ENL-${id}`, estado, estado_desde: '2026-10-17T10:00:00Z', proveedor: 'Prov', ticket_actual: '',
  origen_nodo: { _id: `n-${o}`, id_nodo: o }, destino_nodo: { _id: `n-${d}`, id_nodo: d }, updatedAt: '2026-10-17T10:00:00Z', ...extra,
});

let llamadas;
function simularRed(rutas) {
  llamadas = [];
  globalThis.fetch = async (url, opts = {}) => {
    llamadas.push({ url, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : undefined });
    const h = rutas[`${opts.method ?? 'GET'} ${url}`];
    if (!h) throw new Error(`ruta no simulada: ${url}`);
    const { status = 200, json } = await h(opts);
    return { ok: status < 400, status, json: async () => json };
  };
}

beforeEach(() => useTopology.getState().reset());
afterEach(() => { delete globalThis.fetch; });

test('cargar: indexa nodos por id_nodo y enlaces por _id, con origen/destino como id_nodo', async () => {
  simularRed({
    'GET /api/nodes': () => ({ json: { ok: true, data: [nodoApi('A', 10, 20), nodoApi('B', 30, 40, 'OLA')] } }),
    'GET /api/links?limit=500': () => ({ json: { ok: true, data: [enlaceApi('e1', 'A', 'B', 'Caido')] } }),
    'GET /api/alarm-types': () => ({ json: { ok: true, data: [{ _id: 'a1', codigo: 'LOS', nombre: 'Pérdida de señal', estado_sugerido: 'Caido', significado: 'x', procedimiento: ['p1'], activo: true }] } }),
    'GET /api/zonales': () => ({ json: { ok: true, data: [{ _id: 'z1', clave: 'ZNORTE', nombre: 'Zonal Norte', color: '#14b8a6', activo: true, enlaces: 0 }] } }),
    'GET /api/link-types': () => ({ json: { ok: true, data: [{ _id: 't1', clave: 'PROPIO', nombre: 'Propio', color: '#8296ab', propio: true, activo: true, enlaces: 1 }] } }),
  });
  await useTopology.getState().cargar();
  const s = useTopology.getState();
  assert.equal(s.cargando, false); assert.equal(s.error, null);
  assert.deepEqual(s.nodos.A.posicion, { x: 10, y: 20 });
  assert.equal(s.enlaces.e1.origen, 'A'); assert.equal(s.enlaces.e1.destino, 'B'); assert.equal(s.enlaces.e1.estado, 'Caido');
  assert.equal(s.tipos.length, 1); assert.equal(s.tipos[0].clave, 'PROPIO');
  assert.equal(s.zonales.length, 1); assert.equal(s.zonales[0].clave, 'ZNORTE');
  assert.equal(s.alarmas.length, 1); assert.equal(s.alarmas[0].codigo, 'LOS');
});

test('cargar: error de red deja un mensaje y apaga el spinner', async () => {
  globalThis.fetch = async () => { throw new Error('boom'); };
  await useTopology.getState().cargar();
  const s = useTopology.getState();
  assert.equal(s.cargando, false); assert.equal(s.error, 'No se pudo conectar con el servidor');
});

test('aplicarEnlace: actualiza, conserva nodos si el payload no los trae y descarta eventos atrasados', () => {
  const T = useTopology.getState();
  T.aplicarEnlace(enlaceApi('e1', 'A', 'B', 'OK'));
  T.aplicarEnlace({ _id: 'e1', id_enlace: 'ENL-e1', estado: 'Caido', updatedAt: '2026-10-17T11:00:00Z' }); // sin nodos poblados
  let e = useTopology.getState().enlaces.e1;
  assert.equal(e.estado, 'Caido'); assert.equal(e.origen, 'A'); assert.equal(e.destino, 'B');
  T.aplicarEnlace(enlaceApi('e1', 'A', 'B', 'OK', { updatedAt: '2026-10-17T10:30:00Z' }));               // más viejo que el actual
  assert.equal(useTopology.getState().enlaces.e1.estado, 'Caido');
});

test('quitarEnlace limpia la selección si estaba abierto', () => {
  const T = useTopology.getState();
  T.aplicarEnlace(enlaceApi('e1', 'A', 'B')); T.seleccionarEnlace('e1');
  T.quitarEnlace('e1');
  assert.equal(useTopology.getState().seleccion.enlaceId, null);
  assert.equal(useTopology.getState().enlaces.e1, undefined);
});

test('cambiarEstado: envía el PATCH y aplica la respuesta', async () => {
  simularRed({ 'PATCH /api/links/e1/status': () => ({ json: { ok: true, data: enlaceApi('e1', 'A', 'B', 'OK', { updatedAt: '2026-10-17T12:00:00Z' }) } }) });
  const T = useTopology.getState();
  T.aplicarEnlace(enlaceApi('e1', 'A', 'B', 'Caido'));
  await T.cambiarEstado('e1', { estado: 'OK', causa_raiz: 'fibra reparada' });
  assert.deepEqual(llamadas[0].body, { estado: 'OK', causa_raiz: 'fibra reparada' });
  assert.equal(useTopology.getState().enlaces.e1.estado, 'OK');
});

test('cambiarEstado: un 409 del backend llega como error con su mensaje', async () => {
  simularRed({ 'PATCH /api/links/e1/status': () => ({ status: 409, json: { ok: false, error: { message: 'El estado del enlace cambió mientras lo editabas.' } } }) });
  await assert.rejects(useTopology.getState().cambiarEstado('e1', { estado: 'OK' }), /cambió mientras lo editabas/);
});

test('moverNodo: optimista y, si el servidor rechaza, revierte y avisa', async () => {
  const T = useTopology.getState();
  T.aplicarNodo(nodoApi('A', 10, 20));

  simularRed({ 'PATCH /api/nodes/A/position': () => ({ json: { ok: true, data: {} } }) });
  await T.moverNodo('A', { x: 50, y: 60 });
  assert.deepEqual(useTopology.getState().nodos.A.posicion, { x: 50, y: 60 });
  assert.deepEqual(llamadas[0].body, { x: 50, y: 60 });

  simularRed({ 'PATCH /api/nodes/A/position': () => ({ status: 403, json: { ok: false, error: { message: 'Permisos insuficientes' } } }) });
  await T.moverNodo('A', { x: 999, y: 999 });
  const s = useTopology.getState();
  assert.deepEqual(s.nodos.A.posicion, { x: 50, y: 60 });          // revertido
  assert.match(s.toasts.at(-1).texto, /No se guardó la posición de A: Permisos insuficientes/);
});

test('moverNodoLocal ignora nodos desconocidos; eventos y toasts se acotan', () => {
  const T = useTopology.getState();
  T.moverNodoLocal('NOEXISTE', { x: 1, y: 1 });
  assert.deepEqual(useTopology.getState().nodos, {});
  for (let i = 0; i < 40; i++) T.pushEvento({ texto: `e${i}`, nivel: 'info' });
  for (let i = 0; i < 9; i++) T.pushToast({ texto: `t${i}` });
  const s = useTopology.getState();
  assert.equal(s.eventos.length, 30); assert.equal(s.eventos[0].texto, 'e39');
  assert.equal(s.toasts.length, 5);
});

test('normalizarEnlace: tipo de línea y filamentos (siempre ida y vuelta, aunque el servidor no los envíe)', async () => {
  const { normalizarEnlace } = await import('../src/store/topologyStore.js');
  const sinNada = normalizarEnlace(enlaceApi('e1', 'A', 'B'));
  assert.equal(sinNada.tipo, null);
  assert.deepEqual(sinNada.filamentos.map((f) => f.sentido), ['ida', 'vuelta']);
  assert.equal(sinNada.filamentos[0].levantamiento.completo, false);

  const conTodo = normalizarEnlace(enlaceApi('e2', 'A', 'B', 'OK', {
    tipo_enlace: { _id: 't2', clave: 'WOM', nombre: 'WOM', color: '#a855f7', propio: false },
    filamentos: [{ sentido: 'vuelta', levantamiento: { potencia_tx_dbm: 0.8, potencia_rx_dbm: -10.1, fecha: '2026-09-01T00:00:00Z' } }],
  }));
  assert.equal(conTodo.tipo.clave, 'WOM'); assert.equal(conTodo.tipo.propio, false);
  const vuelta = conTodo.filamentos.find((f) => f.sentido === 'vuelta').levantamiento;
  assert.equal(vuelta.tx, 0.8); assert.equal(vuelta.rx, -10.1); assert.equal(vuelta.atenuacion, 10.9); assert.equal(vuelta.completo, true);
  assert.equal(conTodo.filamentos.find((f) => f.sentido === 'ida').levantamiento.tx, null);   // el que falta queda vacío
});

test('aplicarEnlace conserva tipo y filamentos del evento remoto', () => {
  const T = useTopology.getState();
  T.aplicarEnlace(enlaceApi('e1', 'A', 'B', 'OK', { tipo_enlace: { _id: 't2', clave: 'TIGO', nombre: 'Tigo', color: '#06b6d4' }, filamentos: [{ sentido: 'ida', levantamiento: { potencia_tx_dbm: 2, potencia_rx_dbm: -8 } }] }));
  const e = useTopology.getState().enlaces.e1;
  assert.equal(e.tipo.nombre, 'Tigo'); assert.equal(e.filamentos[0].levantamiento.atenuacion, 10);
});

test('toggleExpandido despliega y pliega cada enlace por separado', () => {
  const T = useTopology.getState();
  T.toggleExpandido('e1'); T.toggleExpandido('e2');
  assert.deepEqual(useTopology.getState().expandidos, { e1: true, e2: true });
  T.toggleExpandido('e1');
  assert.deepEqual(useTopology.getState().expandidos, { e2: true });
});

test('recargarTipos y filtro por tipo', async () => {
  simularRed({ 'GET /api/link-types': () => ({ json: { ok: true, data: [{ _id: 't1', clave: 'WOM', nombre: 'WOM', color: '#a855f7', activo: true, enlaces: 5 }] } }) });
  await useTopology.getState().recargarTipos();
  assert.equal(useTopology.getState().tipos[0].clave, 'WOM');
  useTopology.getState().setFiltro('tipo', 'WOM');
  assert.equal(useTopology.getState().filtros.tipo, 'WOM'); assert.equal(useTopology.getState().filtros.ocultarOK, false);
});

test('normalizarEnlace: longitud y tramos por zonal, ordenados por km', async () => {
  const { normalizarEnlace } = await import('../src/store/topologyStore.js');
  const vacio = normalizarEnlace(enlaceApi('e1', 'A', 'B'));
  assert.equal(vacio.longitud_km, null); assert.deepEqual(vacio.tramos, []);

  const e = normalizarEnlace(enlaceApi('e2', 'A', 'B', 'OK', {
    longitud_km: 100,
    tramos: [
      { zonal: { _id: 'z2', clave: 'ZSUR', nombre: 'Zonal Sur', color: '#8b5cf6' }, km_desde: 45, km_hasta: 100 },
      { zonal: { _id: 'z1', clave: 'ZNORTE', nombre: 'Zonal Norte', color: '#14b8a6' }, km_desde: 0, km_hasta: 45 },
      { zonal: null, km_desde: 1, km_hasta: 2 },                                  // zonal borrada/no poblada: se ignora
    ],
  }));
  assert.equal(e.longitud_km, 100); assert.equal(e.tramos.length, 2);
  assert.deepEqual(e.tramos.map((t) => [t.zonal.nombre, t.km_desde, t.km_hasta]), [['Zonal Norte', 0, 45], ['Zonal Sur', 45, 100]]);
  assert.equal(normalizarEnlace(enlaceApi('e3', 'A', 'B', 'OK', { tramos: [{ zonal: 'z9', km_desde: 0, km_hasta: 5 }] })).tramos[0].zonal._id, 'z9'); // id sin poblar
});

test('aplicarEnlace conserva los tramos del evento remoto', () => {
  const T = useTopology.getState();
  T.aplicarEnlace(enlaceApi('e1', 'A', 'B', 'OK', { longitud_km: 12.5, tramos: [{ zonal: { _id: 'z1', clave: 'ZN', nombre: 'Norte', color: '#14b8a6' }, km_desde: 0, km_hasta: 12.5 }] }));
  const e = useTopology.getState().enlaces.e1;
  assert.equal(e.longitud_km, 12.5); assert.equal(e.tramos[0].zonal.nombre, 'Norte');
});

test('normalizarEnlace: cada filamento con su estado y alarma; los enlaces antiguos heredan el estado del enlace', async () => {
  const { normalizarEnlace } = await import('../src/store/topologyStore.js');
  // enlace anterior a las alarmas por filamento: sin estado propio -> hereda el del enlace
  const legado = normalizarEnlace(enlaceApi('e1', 'A', 'B', 'Degradado'));
  assert.deepEqual(legado.filamentos.map((f) => [f.sentido, f.estado]), [['ida', 'Degradado'], ['vuelta', 'Degradado']]);
  assert.equal(legado.filamentos[0].alarma, null);
  // alarma solo en la ida
  const parcial = normalizarEnlace(enlaceApi('e2', 'A', 'B', 'Caido', { filamentos: [
    { sentido: 'ida', estado: 'Caido', estado_desde: '2026-10-17T10:00:00Z', alarma: { tipificacion: { _id: 'a1', codigo: 'LOS', nombre: 'Pérdida de señal' }, observacion: 'Sin luz' } },
    { sentido: 'vuelta', estado: 'OK' },
  ] }));
  assert.deepEqual(parcial.filamentos.map((f) => [f.sentido, f.estado]), [['ida', 'Caido'], ['vuelta', 'OK']]);
  assert.equal(parcial.filamentos[0].alarma.tipificacion.codigo, 'LOS'); assert.equal(parcial.filamentos[0].alarma.observacion, 'Sin luz');
  assert.equal(parcial.filamentos[1].alarma, null);
  // tipificación sin poblar (solo el id): no rompe
  const sinPoblar = normalizarEnlace(enlaceApi('e3', 'A', 'B', 'Caido', { filamentos: [{ sentido: 'ida', estado: 'Caido', alarma: { tipificacion: 'a9' } }] }));
  assert.equal(sinPoblar.filamentos[0].alarma.tipificacion._id, 'a9');
});
