import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agregarPorTipo, estaBajoObjetivo, etiquetaMes, filtrarFilas, fmtPct, leerMes, mesComoTexto, ordenarFilas, peoresEnlaces, promedioUptime, resumenFilas, resumenIncidencias, ultimosMeses } from '../src/lib/indicadores.js';

const fila = (id, uptime, falla, extra = {}) => ({ enlace: id, id_enlace: `ENL-${id}`, total_minutos: 1000, uptime_pct: uptime, minutos_falla: falla, incidentes: falla ? 1 : 0, mttr_minutos: falla || null, ...extra });
const filas = [fila('a', 100, 0), fila('b', 99.5, 5), fila('c', 98, 20), fila('d', 99.95, 0.5)];
const tipo = (clave, nombre = clave) => ({ clave, nombre, color: '#a855f7' });
const enlaces = {
  a: { tipo: tipo('PROPIO'), tramos: [] }, b: { tipo: tipo('WOM'), tramos: [{ zonal: { _id: 'zN' } }] },
  c: { tipo: tipo('WOM'), tramos: [{ zonal: { _id: 'zS' } }] }, d: { tipo: null, tramos: [{ zonal: { _id: 'zN' } }, { zonal: { _id: 'zS' } }] },
};

test('formatos y meses', () => {
  assert.equal(fmtPct(99.987), '99,987 %'); assert.equal(fmtPct(100), '100,000 %'); assert.equal(fmtPct(null), '—');
  assert.deepEqual(leerMes('2026-10'), { year: 2026, month: 10 }); assert.equal(leerMes('2026-1'), null); assert.equal(leerMes(''), null);
  assert.equal(mesComoTexto({ year: 2026, month: 3 }), '2026-03'); assert.equal(etiquetaMes({ year: 2026, month: 10 }), 'oct 26');
  assert.deepEqual(ultimosMeses({ year: 2026, month: 2 }, 4), [{ year: 2025, month: 11 }, { year: 2025, month: 12 }, { year: 2026, month: 1 }, { year: 2026, month: 2 }]);
  assert.equal(ultimosMeses({ year: 2026, month: 10 }).length, 6);
});

test('promedio y resumen (los enlaces sin tiempo medido no cuentan)', () => {
  assert.equal(promedioUptime(filas), 99.363);                          // (100 + 99.5 + 98 + 99.95) / 4
  assert.equal(promedioUptime([fila('x', 100, 0, { total_minutos: 0 })]), null); assert.equal(promedioUptime([]), null);
  assert.deepEqual(resumenFilas(filas, 99.9), { enlaces: 4, uptimePromedio: 99.363, bajoObjetivo: 2, minutosFalla: 25.5, sinFallas: 1 });
  assert.equal(estaBajoObjetivo(fila('z', 99.9, 1), 99.9), false);      // igual al objetivo cumple
  assert.equal(estaBajoObjetivo(fila('z', 99.89, 1), 99.9), true);
  assert.equal(estaBajoObjetivo(fila('z', 0, 0, { total_minutos: 0 }), 99.9), false);
});

test('peores enlaces: por minutos de falla, sin los que no fallaron', () => {
  assert.deepEqual(peoresEnlaces(filas).map((f) => f.enlace), ['c', 'b', 'd']);
  assert.equal(peoresEnlaces(filas, 2).length, 2);
});

test('filtrar por tipo de línea y zonal (usando el store)', () => {
  assert.deepEqual(filtrarFilas(filas, enlaces, { tipo: 'WOM' }).map((f) => f.enlace), ['b', 'c']);
  assert.deepEqual(filtrarFilas(filas, enlaces, { zonal: 'zN' }).map((f) => f.enlace), ['b', 'd']);
  assert.deepEqual(filtrarFilas(filas, enlaces, { tipo: 'WOM', zonal: 'zS' }).map((f) => f.enlace), ['c']);
  assert.equal(filtrarFilas(filas, enlaces).length, 4);
  assert.deepEqual(filtrarFilas([fila('desconocido', 100, 0)], enlaces, { tipo: 'WOM' }), []);
});

test('por tipo de línea (sin clasificar aparte)', () => {
  const t = agregarPorTipo(filas, enlaces);
  const wom = t.find((x) => x.clave === 'WOM');
  assert.equal(wom.enlaces, 2); assert.equal(wom.uptime, 98.75); assert.equal(wom.minutosFalla, 25);
  assert.equal(t.find((x) => x.clave === '_SIN_TIPO').nombre, 'Sin clasificar');
  assert.equal(t[0].clave, 'WOM');                                      // más enlaces primero
});

test('ordenarFilas: texto, números y nulos siempre al final', () => {
  const f = [fila('a', 100, 0), fila('b', 99.5, 5, { mttr_minutos: 5 }), fila('c', 98, 20, { mttr_minutos: 20 }), fila('d', 99.95, 0.5, { mttr_minutos: 0.5 })];
  assert.deepEqual(ordenarFilas(f, 'uptime_pct', 'asc').map((x) => x.enlace), ['c', 'b', 'd', 'a']);
  assert.deepEqual(ordenarFilas(f, 'uptime_pct', 'desc').map((x) => x.enlace), ['a', 'd', 'b', 'c']);
  assert.deepEqual(ordenarFilas(f, 'mttr_minutos', 'asc').map((x) => x.enlace), ['d', 'b', 'c', 'a']);     // 'a' no tiene MTTR
  assert.deepEqual(ordenarFilas(f, 'mttr_minutos', 'desc').map((x) => x.enlace), ['c', 'b', 'd', 'a']);    // y sigue al final
  assert.deepEqual(ordenarFilas(f, 'id_enlace', 'desc').map((x) => x.enlace), ['d', 'c', 'b', 'a']);
});

test('incidencias: pertenecen al mes en que comenzaron; MTTR de las cerradas', () => {
  const inc = (id, sev, inicio, dur, extra = {}) => ({ _id: id, severidad: sev, inicio, abierta: dur == null, duracion_minutos: dur ?? undefined, causa_raiz: 'x', ...extra });
  const lista = [
    inc('1', 'Caido', '2026-09-30T23:00:00Z', 120),              // empezó en septiembre: se excluye
    inc('2', 'Caido', '2026-10-05T10:00:00Z', 100),
    inc('3', 'Caido', '2026-10-10T10:00:00Z', 200, { causa_raiz: '' }),
    inc('4', 'Caido', '2026-10-17T10:00:00Z', null),             // abierta: no cuenta para el MTTR
    inc('5', 'Degradado', '2026-10-12T10:00:00Z', 30),
  ];
  const ventana = { desde: '2026-10-01T03:00:00Z', hasta: '2026-11-01T03:00:00Z' };
  const solo = resumenIncidencias(lista, ventana);
  assert.deepEqual([solo.total, solo.abiertas, solo.cerradas, solo.mttr, solo.sinCausa], [3, 1, 2, 150, 1]);
  assert.deepEqual(solo.lista.map((i) => i._id), ['4', '3', '2']);                       // más recientes primero
  const con = resumenIncidencias(lista, { ...ventana, incluirDegradado: true });
  assert.deepEqual([con.total, con.cerradas, con.mttr], [4, 3, 110]);
  assert.equal(resumenIncidencias([], ventana).mttr, null);
});

import { filtrarIncidencias } from '../src/lib/indicadores.js';

test('filtrarIncidencias: mismo criterio que las filas (tipo de línea y zonal)', () => {
  const lista = [{ _id: '1', enlace: { _id: 'b' } }, { _id: '2', enlace: { _id: 'c' } }, { _id: '3', enlace: { _id: 'a' } }, { _id: '4', enlace: { _id: 'zz' } }, { _id: '5' }];
  assert.deepEqual(filtrarIncidencias(lista, enlaces, { tipo: 'WOM' }).map((i) => i._id), ['1', '2']);
  assert.deepEqual(filtrarIncidencias(lista, enlaces, { zonal: 'zN' }).map((i) => i._id), ['1']);
  assert.equal(filtrarIncidencias(lista, enlaces).length, 5);                 // sin filtro: todas
  assert.deepEqual(filtrarIncidencias(lista, enlaces, { tipo: 'PROPIO' }).map((i) => i._id), ['3']);   // las de enlaces desconocidos no entran
});
