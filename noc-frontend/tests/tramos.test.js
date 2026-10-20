import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analizarTramos, filasDesdeTramos, fmtKm, fmtRango, huecos, segmentosBarra, zonalesDeEnlace } from '../src/lib/tramos.js';

const f = (zonal, desde, hasta) => ({ zonal, desde, hasta });

test('formato de kilómetros', () => {
  assert.equal(fmtKm(45), '45 km'); assert.equal(fmtKm(45.5), '45,5 km'); assert.equal(fmtKm(null), '—'); assert.equal(fmtKm(0.125), '0,125 km');
  assert.equal(fmtRango(0, 45), '0–45 km'); assert.equal(fmtRango(45.5, 100), '45,5–100 km');
});

test('reparto válido completo: sin errores ni avisos', () => {
  const a = analizarTramos([f('N', '0', '45'), f('S', '45', '100')], '100');
  assert.deepEqual(a.errores, []); assert.deepEqual(a.avisos, []); assert.equal(a.longitud, 100);
  assert.deepEqual(a.tramos, [{ zonal: 'N', km_desde: 0, km_hasta: 45 }, { zonal: 'S', km_desde: 45, km_hasta: 100 }]);
});

test('acepta coma decimal, ordena y redondea a metros', () => {
  const a = analizarTramos([f('S', '45,5', '100'), f('N', '0', '45,5')], '100');
  assert.deepEqual(a.errores, []); assert.deepEqual(a.tramos.map((t) => t.zonal), ['N', 'S']); assert.equal(a.tramos[0].km_hasta, 45.5);
  assert.equal(analizarTramos([f('N', '0', '1.23456')], '').tramos[0].km_hasta, 1.235);
});

test('huecos: son avisos, no errores (se puede guardar un reparto parcial)', () => {
  const a = analizarTramos([f('N', '0', '30'), f('S', '50', '90')], '100');
  assert.deepEqual(a.errores, []);
  assert.deepEqual(a.avisos, ['Sin asignar: km 30 a 50 (20 km).', 'Sin asignar: km 90 a 100 (10 km).']);
  assert.ok(a.tramos);                                                                       // sigue siendo guardable
  assert.deepEqual(huecos([{ km_desde: 10, km_hasta: 20 }], 30), [{ desde: 0, hasta: 10 }, { desde: 20, hasta: 30 }]);
});

test('sin longitud: avisa que conviene indicarla y usa el último km como tope', () => {
  const a = analizarTramos([f('N', '0', '30')], '');
  assert.deepEqual(a.errores, []); assert.equal(a.longitud, null); assert.match(a.avisos[0], /Indique la longitud total/);
});

test('errores que impiden guardar', () => {
  assert.match(analizarTramos([f('N', '0', '60'), f('S', '50', '100')], '100').errores[0], /se solapan/);
  assert.match(analizarTramos([f('N', '0', '120')], '100').errores[0], /más allá de la longitud/);
  assert.match(analizarTramos([f('', '0', '10')], '').errores[0], /elija una zonal/);
  assert.match(analizarTramos([f('N', 'abc', '10')], '').errores[0], /como números/);
  assert.match(analizarTramos([f('N', '', '10')], '').errores[0], /como números/);
  assert.match(analizarTramos([f('N', '10', '10')], '').errores[0], /mayor que el km inicial/);
  assert.match(analizarTramos([f('N', '20', '10')], '').errores[0], /mayor que el km inicial/);
  assert.match(analizarTramos([f('N', '-5', '10')], '').errores[0], /negativos/);
  assert.match(analizarTramos([], 'x').errores[0], /número/);
  assert.match(analizarTramos([], '0').errores[0], /mayor a 0/);
  assert.equal(analizarTramos([f('N', '0', '60'), f('S', '50', '100')], '100').tramos, null, 'con errores no hay tramos para enviar');
});

test('sin tramos es válido (reparto vacío)', () => {
  const a = analizarTramos([], '');
  assert.deepEqual(a.errores, []); assert.deepEqual(a.tramos, []); assert.equal(a.longitud, null);
});

test('barra proporcional: tramos y huecos con posición y ancho en %', () => {
  const zonales = [{ _id: 'N', nombre: 'Norte', color: '#14b8a6' }, { _id: 'S', nombre: 'Sur', color: '#8b5cf6' }];
  const seg = segmentosBarra([{ zonal: 'S', km_desde: 50, km_hasta: 90 }, { zonal: 'N', km_desde: 0, km_hasta: 30 }], 100, zonales);
  assert.deepEqual(seg.map((s) => [s.tipo, s.izq, s.ancho]), [['tramo', 0, 30], ['hueco', 30, 20], ['tramo', 50, 40], ['hueco', 90, 10]]);
  assert.equal(seg[0].zonal.nombre, 'Norte'); assert.equal(seg[2].zonal.color, '#8b5cf6');
  assert.equal(segmentosBarra([{ zonal: 'N', km_desde: 0, km_hasta: 40 }], null, zonales).at(-1).tipo, 'tramo');          // sin longitud: tope = último km
  assert.deepEqual(segmentosBarra([], null, zonales), []);
  const suma = segmentosBarra([{ zonal: 'N', km_desde: 0, km_hasta: 45 }, { zonal: 'S', km_desde: 45, km_hasta: 100 }], 100, zonales).reduce((a, s) => a + s.ancho, 0);
  assert.equal(suma, 100);
});

test('zonalesDeEnlace y filas del formulario', () => {
  const norte = { _id: 'N', nombre: 'Norte' }, sur = { _id: 'S', nombre: 'Sur' };
  const enlace = { tramos: [{ zonal: norte, km_desde: 0, km_hasta: 20 }, { zonal: sur, km_desde: 20, km_hasta: 60 }, { zonal: norte, km_desde: 60, km_hasta: 100 }] };
  assert.deepEqual(zonalesDeEnlace(enlace).map((z) => z._id), ['N', 'S']);                       // sin repetir, en orden de aparición
  assert.deepEqual(filasDesdeTramos(enlace.tramos)[1], { zonal: 'S', desde: '20', hasta: '60' });
});
