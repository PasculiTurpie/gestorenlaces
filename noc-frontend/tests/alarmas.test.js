import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describirEvento } from '../src/lib/eventos.js';
import { alarmasConProcedimiento, alarmasParaEstado, esAlarmaParcial, filamentosAlarmados, requiereTipificacion, resumenAlarmas, sentidosDe, textoTiempoRespuesta } from '../src/lib/alarmas.js';
import { resumenPorTipificacion } from '../src/lib/indicadores.js';
import { normalizarFilamentos } from '../src/lib/levantamiento.js';

const fil = (ida, vuelta, tips = {}) => normalizarFilamentos([
  { sentido: 'ida', estado: ida, ...(tips.ida && { alarma: { tipificacion: { _id: tips.ida, codigo: tips.ida } } }) },
  { sentido: 'vuelta', estado: vuelta, ...(tips.vuelta && { alarma: { tipificacion: { _id: tips.vuelta, codigo: tips.vuelta } } }) },
]);
const enlace = (ida, vuelta, tips) => ({ filamentos: fil(ida, vuelta, tips) });

test('opciones de filamentos', () => {
  assert.deepEqual(sentidosDe('ambos'), ['ida', 'vuelta']); assert.deepEqual(sentidosDe('ida'), ['ida']); assert.deepEqual(sentidosDe('vuelta'), ['vuelta']);
});

test('tipos de alarma para un estado: activos, los del estado primero, luego por nombre', () => {
  const cat = [
    { _id: '1', codigo: 'ATEN', nombre: 'Alta atenuación', estado_sugerido: 'Degradado', activo: true },
    { _id: '2', codigo: 'LOS', nombre: 'Pérdida de señal', estado_sugerido: 'Caido', activo: true },
    { _id: '3', codigo: 'VIEJA', nombre: 'Antigua', estado_sugerido: 'Caido', activo: false },
    { _id: '4', codigo: 'CORTE', nombre: 'Corte de fibra', estado_sugerido: 'Caido', activo: true },
  ];
  assert.deepEqual(alarmasParaEstado(cat, 'Caido').map((a) => a.codigo), ['CORTE', 'LOS', 'ATEN']);          // sin la desactivada
  assert.deepEqual(alarmasParaEstado(cat, 'Degradado').map((a) => a.codigo), ['ATEN', 'CORTE', 'LOS']);
  assert.equal(requiereTipificacion('Caido', cat), true); assert.equal(requiereTipificacion('Degradado', cat), true);
  assert.equal(requiereTipificacion('Mantenimiento', cat), false); assert.equal(requiereTipificacion('OK', cat), false);
  assert.equal(requiereTipificacion('Caido', []), false, 'sin tipos configurados no se bloquea la operación');
});

test('qué filamentos están alarmados y si es parcial', () => {
  assert.equal(filamentosAlarmados(enlace('OK', 'OK')).length, 0);
  assert.deepEqual(filamentosAlarmados(enlace('Caido', 'OK')).map((f) => f.sentido), ['ida']);
  assert.equal(esAlarmaParcial(enlace('Caido', 'OK')), true); assert.equal(esAlarmaParcial(enlace('OK', 'Degradado')), true);
  assert.equal(esAlarmaParcial(enlace('Caido', 'Caido')), false); assert.equal(esAlarmaParcial(enlace('OK', 'OK')), false);
});

test('resumen textual de la alarma de un enlace', () => {
  assert.equal(resumenAlarmas(enlace('OK', 'OK')), null);
  assert.equal(resumenAlarmas(enlace('Caido', 'OK', { ida: 'LOS' })), 'Solo ida · LOS');
  assert.equal(resumenAlarmas(enlace('OK', 'Degradado', { vuelta: 'ATEN' })), 'Solo vuelta · ATEN');
  assert.equal(resumenAlarmas(enlace('Caido', 'Caido', { ida: 'CORTE', vuelta: 'CORTE' })), 'Ambos · CORTE');
  assert.equal(resumenAlarmas(enlace('Caido', 'Degradado', { ida: 'LOS', vuelta: 'ATEN' })), 'Ida · LOS, Vuelta · ATEN');
  assert.equal(resumenAlarmas(enlace('Caido', 'Caido')), 'Ambos', 'sin tipificar');
  assert.equal(resumenAlarmas(enlace('Caido', 'Degradado')), 'Ida, Vuelta', 'estados distintos sin tipificar');
  assert.equal(resumenAlarmas(enlace('Caido', 'OK')), 'Solo ida');
});

test('tiempo de respuesta y procedimiento de las alarmas activas', () => {
  assert.equal(textoTiempoRespuesta(15), '15 min'); assert.equal(textoTiempoRespuesta(60), '1 h'); assert.equal(textoTiempoRespuesta(90), '1 h 30 min'); assert.equal(textoTiempoRespuesta(null), null);
  const cat = [{ _id: 'LOS', codigo: 'LOS', procedimiento: ['a'] }];
  const r = alarmasConProcedimiento(enlace('Caido', 'OK', { ida: 'LOS' }), cat);
  assert.equal(r.length, 1); assert.equal(r[0].sentido, 'ida'); assert.equal(r[0].alarma.codigo, 'LOS');
  assert.equal(alarmasConProcedimiento(enlace('Caido', 'OK', { ida: 'DESCONOCIDA' }), cat)[0].alarma, null, 'tipo ya no existente en el catálogo: no rompe');
  assert.deepEqual(alarmasConProcedimiento(enlace('Caido', 'OK'), cat), [], 'sin tipificar no hay procedimiento que mostrar');
});

test('eventos: se explica qué filamento cambió', () => {
  const por = { id: 'u2', nombre: 'Sofía' };
  const parcial = describirEvento('link:updated', { link: { id_enlace: 'ENL-1' }, por, cambio: { de: 'OK', a: 'Caido', filamentos: ['ida'], fibraDe: 'OK', fibraA: 'Caido', tipificacion: 'LOS' } }, 'u1');
  assert.equal(parcial.texto, 'ENL-1: ida OK → Caído [LOS] (Sofía) · enlace Caído'); assert.equal(parcial.nivel, 'critico'); assert.equal(parcial.notificar, true);
  const sinCambioEnlace = describirEvento('link:updated', { link: { id_enlace: 'ENL-1' }, por, cambio: { de: 'Caido', a: 'Caido', filamentos: ['vuelta'], fibraDe: 'OK', fibraA: 'Degradado', tipificacion: 'ATEN' } }, 'u1');
  assert.equal(sinCambioEnlace.texto, 'ENL-1: vuelta OK → Degradado [ATEN] (Sofía)'); assert.equal(sinCambioEnlace.nivel, 'warn');
  const ambos = describirEvento('link:updated', { link: { id_enlace: 'ENL-1' }, por, cambio: { de: 'OK', a: 'Caido', filamentos: ['ida', 'vuelta'], fibraDe: 'OK', fibraA: 'Caido', tipificacion: 'CORTE' } }, 'u1');
  assert.equal(ambos.texto, 'ENL-1: OK → Caído [CORTE] (Sofía)');
  const viejo = describirEvento('link:updated', { link: { id_enlace: 'ENL-1' }, por, cambio: { de: 'OK', a: 'Caido' } }, 'u1');            // payload anterior a esta función
  assert.equal(viejo.texto, 'ENL-1: OK → Caído (Sofía)');
});

test('incidencias agrupadas por tipificación', () => {
  const inc = (cod, dur, abierta = false) => ({ tipificacion: cod ? { codigo: cod, nombre: `Nombre ${cod}` } : null, abierta, duracion_minutos: abierta ? undefined : dur });
  const r = resumenPorTipificacion([inc('LOS', 60), inc('LOS', 120), inc('CORTE', 300), inc('LOS', 0, true), inc(null, 30)]);
  const los = r.find((x) => x.codigo === 'LOS');
  assert.deepEqual([los.incidencias, los.cerradas, los.minutos, los.mttr], [3, 2, 180, 90]);
  assert.equal(r[0].codigo, 'LOS', 'más incidencias primero');
  assert.equal(r.find((x) => x.codigo === null).nombre, 'Sin tipificar');
  assert.equal(r.find((x) => x.codigo === 'CORTE').mttr, 300);
  assert.deepEqual(resumenPorTipificacion([]), []);
});

import { ordenarAlarmas } from '../src/lib/alarmas.js';

test('catálogo ordenado por gravedad y luego por nombre (lo más urgente primero)', () => {
  const cat = [
    { codigo: 'MANT', nombre: 'Mantenimiento programado', estado_sugerido: 'Mantenimiento' },
    { codigo: 'ATEN', nombre: 'Alta atenuación', estado_sugerido: 'Degradado' },
    { codigo: 'LOS', nombre: 'Pérdida de señal', estado_sugerido: 'Caido' },
    { codigo: 'CORTE', nombre: 'Corte de fibra', estado_sugerido: 'Caido' },
    { codigo: 'SD', nombre: 'Degradación de señal', estado_sugerido: 'Degradado' },
  ];
  assert.deepEqual(ordenarAlarmas(cat).map((a) => a.codigo), ['CORTE', 'LOS', 'ATEN', 'SD', 'MANT']);
  assert.equal(cat[0].codigo, 'MANT', 'no modifica el arreglo original');
});

import { extensionDe, fmtTamano, validarArchivoCliente } from '../src/lib/archivos.js';

test('archivos: solo .docx, .pdf y .xlsx, con tamaño razonable', () => {
  const f = (name, size = 1000) => ({ name, size });
  assert.equal(validarArchivoCliente(f('procedimiento.pdf')), null); assert.equal(validarArchivoCliente(f('Plan.DOCX')), null); assert.equal(validarArchivoCliente(f('datos.xlsx')), null);
  assert.match(validarArchivoCliente(f('programa.exe')), /Solo se admiten/); assert.match(validarArchivoCliente(f('macros.docm')), /Solo se admiten/);
  assert.match(validarArchivoCliente(f('sin-extension')), /Solo se admiten/); assert.match(validarArchivoCliente(f('doble.pdf.exe')), /Solo se admiten/);
  assert.match(validarArchivoCliente(f('vacio.pdf', 0)), /vacío/);
  assert.match(validarArchivoCliente(f('grande.pdf', 16 * 1024 * 1024)), /Supera el máximo de 15 MB/);
  assert.equal(validarArchivoCliente(f('justo.pdf', 15 * 1024 * 1024)), null);
  assert.equal(validarArchivoCliente(f('g.pdf', 3 * 1024 * 1024), { maxMb: 2 }), 'Supera el máximo de 2 MB');
  assert.equal(extensionDe('a.b.PDF'), 'pdf'); assert.equal(extensionDe('sinpunto'), '');
  assert.equal(fmtTamano(850), '850 B'); assert.equal(fmtTamano(42 * 1024), '42 KB'); assert.equal(fmtTamano(1.3 * 1024 * 1024), '1,3 MB');
});

import { describirError as describirErr } from '../src/lib/errores.js';
import { ApiError, request, configurarApi } from '../src/lib/api.js';

test('errores del servidor: con referencia para localizarlos y mensaje útil si no hay detalle', async () => {
  assert.equal(describirErr({ message: 'No se pudo guardar el archivo', ref: 'AB12CD' }), 'No se pudo guardar el archivo (ref. AB12CD)');
  assert.equal(describirErr({ message: 'Datos inválidos', details: [{ campo: 'x', mensaje: 'mal' }], ref: 'Z' }), 'Datos inválidos — x: mal (ref. Z)');
  assert.equal(describirErr({ message: 'sin ref' }), 'sin ref');
  const falso = (status, cuerpo) => { globalThis.fetch = async () => ({ ok: false, status, json: async () => { if (cuerpo === undefined) throw new Error('no es JSON'); return cuerpo; } }); };
  falso(500, undefined);                                                               // 500 sin cuerpo: lo que produce el proxy de Vite si el backend no responde
  await assert.rejects(request('/x', { auth: false }), (e) => e instanceof ApiError && e.status === 500 && /sin detalle/.test(e.message) && /http proxy error/.test(e.message));
  falso(500, { ok: false, error: { message: 'No se pudo guardar el archivo en el servidor: sin permisos', ref: 'Q1W2E3', codigo: 'EACCES' } });
  await assert.rejects(request('/x', { auth: false }), (e) => e.message.startsWith('No se pudo guardar') && e.ref === 'Q1W2E3');
  falso(404, undefined); await assert.rejects(request('/x', { auth: false }), (e) => e.message === 'Error 404');       // 4xx: sin cambios
  delete globalThis.fetch;
});
