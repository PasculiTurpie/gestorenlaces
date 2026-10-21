import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describirEvento } from '../src/lib/eventos.js';
import {
  aInputLocal, aPayload, aPayloadEnCurso, avisoResultado, conflictosDe, formularioDesde, formularioInicial, nombresEnlaces, porEnlace, relevantes, situacion, validarFormulario, ventanaTexto,
} from '../src/lib/mantenimientos.js';

const L = (d, h = 0, mi = 0) => new Date(2026, 9, d, h, mi).getTime(); // 2026-10-<d> h:mi, hora local
const m = (extra = {}) => ({ _id: 'm1', titulo: 'Cambio de tarjeta', estado: 'Programado', inicio: new Date(L(21, 5)).toISOString(), fin: new Date(L(21, 7)).toISOString(), enlaces: [{ _id: 'e1', id_enlace: 'ENL-A' }], ...extra });

test('situación de un mantenimiento respecto de ahora', () => {
  const ahora = L(21, 4);
  assert.deepEqual(situacion(m(), ahora), { clave: 'programado', etiqueta: 'Programado', nivel: 'info' });
  assert.equal(situacion(m(), L(21, 5)).clave, 'por_iniciar', 'llegó la hora y nadie lo inició'); assert.equal(situacion(m(), L(21, 6)).clave, 'por_iniciar');
  assert.equal(situacion(m(), L(21, 8)).clave, 'vencido', 'la ventana terminó sin iniciarse'); assert.equal(situacion(m(), L(21, 8)).nivel, 'warn');
  assert.deepEqual([situacion(m({ estado: 'En curso' }), L(21, 6)).clave, situacion(m({ estado: 'En curso' }), L(21, 8)).clave], ['en_curso', 'excedido']);
  assert.equal(situacion(m({ estado: 'En curso' }), L(21, 8)).etiqueta, 'En curso · excede la ventana');
  assert.deepEqual([situacion(m({ estado: 'Finalizado' })).clave, situacion(m({ estado: 'Cancelado' })).etiqueta], ['finalizado', 'Cancelado']);
});

test('ventana y enlaces en texto', () => {
  assert.equal(ventanaTexto(m()), '21-10-26 05:00 → 07:00', 'mismo día: una sola fecha');
  assert.equal(ventanaTexto(m({ inicio: new Date(L(21, 23)).toISOString(), fin: new Date(L(22, 1, 30)).toISOString() })), '21-10-26 23:00 → 22-10-26 01:30', 'cruza la medianoche: las dos fechas');
  const muchos = m({ enlaces: ['A', 'B', 'C', 'D', 'E'].map((x) => ({ _id: x, id_enlace: `ENL-${x}` })) });
  assert.equal(nombresEnlaces(muchos), 'ENL-A, ENL-B, ENL-C +2'); assert.equal(nombresEnlaces(muchos, 5), 'ENL-A, ENL-B, ENL-C, ENL-D, ENL-E');
  assert.equal(nombresEnlaces(m({ enlaces: ['id1', 'id2'] })), 'id1, id2', 'sin poblar usa el id');
});

test('mantenimientos activos por enlace: el que está en curso primero; los cerrados no cuentan', () => {
  const lista = [m({ _id: 'a', inicio: new Date(L(22, 5)).toISOString() }), m({ _id: 'b', estado: 'En curso' }), m({ _id: 'c', estado: 'Finalizado' }), m({ _id: 'd', enlaces: [{ _id: 'e2' }, 'e1'] })];
  const mapa = porEnlace(lista);
  assert.deepEqual(mapa.e1.map((x) => x._id), ['b', 'd', 'a'], 'en curso, luego por inicio (d empieza el 21; a el 22)'); assert.deepEqual(mapa.e2.map((x) => x._id), ['d']);
  assert.deepEqual(porEnlace([m({ estado: 'Cancelado' })]), {});
});

test('qué conviene que todos vean ya: en curso, lo que debió iniciar y lo que empieza en 48 h', () => {
  const ahora = L(21, 6);
  const lista = [
    m({ _id: 'lejano', inicio: new Date(L(30, 5)).toISOString(), fin: new Date(L(30, 7)).toISOString() }),
    m({ _id: 'proximo', inicio: new Date(L(22, 5)).toISOString(), fin: new Date(L(22, 7)).toISOString() }),
    m({ _id: 'debio', inicio: new Date(L(21, 5)).toISOString(), fin: new Date(L(21, 9)).toISOString() }),
    m({ _id: 'vencido', inicio: new Date(L(20, 1)).toISOString(), fin: new Date(L(20, 3)).toISOString() }),
    m({ _id: 'curso', estado: 'En curso', inicio: new Date(L(21, 4)).toISOString(), fin: new Date(L(21, 8)).toISOString() }),
    m({ _id: 'excedido', estado: 'En curso', inicio: new Date(L(20, 22)).toISOString(), fin: new Date(L(21, 2)).toISOString() }),
    m({ _id: 'hecho', estado: 'Finalizado' }),
  ];
  assert.deepEqual(relevantes(lista, ahora, 48).map((x) => x._id), ['excedido', 'curso', 'debio', 'vencido', 'proximo'], 'lo más urgente primero; lejano y finalizado fuera');
  assert.deepEqual(relevantes(lista, ahora, 4).map((x) => x._id), ['excedido', 'curso', 'debio', 'vencido'], 'con 4 h, el de mañana aún no');
});

test('formulario: valores iniciales, validación y cuerpo para la API', () => {
  const f0 = formularioInicial(L(21, 4, 7));
  assert.deepEqual([f0.inicio, f0.fin, f0.enlaces, f0.con_corte], ['2026-10-21T04:15', '2026-10-21T06:15', [], false], 'empieza en el próximo cuarto de hora y dura 2 h');
  assert.equal(formularioInicial(L(21, 4, 15)).inicio, '2026-10-21T04:15', 'si ya es cuarto exacto, no se corre');
  const ahora = L(21, 4);
  assert.deepEqual(Object.keys(validarFormulario({ ...f0, titulo: 'ab' }, ahora)).sort(), ['enlaces', 'tipificacion', 'titulo']);
  const ok = { ...f0, titulo: 'Cambio de tarjeta', enlaces: ['e1'], tipificacion: 't1' };
  assert.deepEqual(validarFormulario(ok, ahora), {});
  assert.equal(validarFormulario({ ...ok, fin: ok.inicio }, ahora).fin, 'El fin debe ser posterior al inicio');
  assert.equal(validarFormulario({ ...ok, inicio: '2026-10-20T01:00', fin: '2026-10-20T02:00' }, ahora).fin, 'El fin ya pasó');
  assert.equal(validarFormulario({ ...ok, inicio: '' }, ahora).inicio, 'Indique el inicio'); assert.equal(validarFormulario({ ...ok, fin: '' }, ahora).fin, 'Indique el fin');
  assert.equal(validarFormulario({ ...ok, enlaces: Array.from({ length: 51 }, (_, i) => `e${i}`) }, ahora).enlaces, 'Máximo 50 enlaces');
  const p = aPayload({ ...ok, titulo: '  Cambio  ', ticket: ' CHG1 ', descripcion: ' x ' });
  assert.deepEqual([p.titulo, p.ticket, p.descripcion, p.enlaces, p.tipificacion], ['Cambio', 'CHG1', 'x', ['e1'], 't1']); assert.equal(p.inicio, new Date(L(21, 4, 15)).toISOString(), 'las fechas viajan en ISO (UTC)');
  assert.deepEqual(Object.keys(aPayloadEnCurso(ok)).sort(), ['con_corte', 'descripcion', 'fin', 'ticket', 'titulo'], 'en curso no se envían enlaces, tipificación ni inicio');
  const desde = formularioDesde(m({ tipificacion: { _id: 't9', codigo: 'MANT_PROG' }, ticket: 'CHG7', con_corte: true }));
  assert.deepEqual([desde.titulo, desde.enlaces, desde.tipificacion, desde.ticket, desde.inicio, desde.fin, desde.con_corte], ['Cambio de tarjeta', ['e1'], 't9', 'CHG7', '2026-10-21T05:00', '2026-10-21T07:00', true], 'ida y vuelta con el formulario');
  assert.equal(aInputLocal(new Date(L(5, 9, 5))), '2026-10-05T09:05', 'con ceros a la izquierda');
});

test('solapamientos y resumen del resultado de iniciar/finalizar', () => {
  const lista = [m({ _id: 'x', enlaces: [{ _id: 'e1' }] }), m({ _id: 'y', estado: 'Finalizado', enlaces: [{ _id: 'e1' }] }), m({ _id: 'z', enlaces: [{ _id: 'e9' }] })];
  assert.deepEqual(conflictosDe(['e1', 'e2'], lista).map((x) => x._id), ['x'], 'solo los activos que tocan esos enlaces');
  assert.deepEqual(conflictosDe(['e1'], lista, { excluir: 'x' }), [], 'al editar, no se compara consigo mismo');
  assert.equal(avisoResultado('iniciar', { aplicados: ['A'], ya_en_mantenimiento: [], fallidos: [] }), null);
  assert.match(avisoResultado('iniciar', { fallidos: [{ enlace: 'ENL-D', motivo: 'El enlace cambió mientras lo editabas' }] }), /No se pudo actualizar: ENL-D \(El enlace cambió/);
  const fin = avisoResultado('finalizar', { restablecidos: ['A'], omitidos: [{ enlace: 'ENL-B', motivo: 'ya no estaba en mantenimiento' }], fallidos: [] });
  assert.match(fin, /Se respetó el estado actual de: ENL-B \(ya no estaba en mantenimiento\)/);
  assert.equal(avisoResultado('iniciar', { omitidos: [{ enlace: 'X', motivo: 'm' }] }), null, 'al iniciar, "omitidos" no aplica');
});

test('tiempo real: todos se enteran de los mantenimientos (los propios no repiten aviso)', () => {
  const p = (por) => ({ accion: 'iniciado', titulo: 'Cambio de tarjeta', enlaces: 3, por });
  const otro = describirEvento('maintenance:changed', p({ id: 'u9', nombre: 'Marcos' }), 'u1');
  assert.deepEqual([otro.texto, otro.nivel, otro.notificar], ['Marcos inició el mantenimiento «Cambio de tarjeta» (3 enlaces)', 'warn', true]);
  assert.equal(describirEvento('maintenance:changed', p({ id: 'u1', nombre: 'Yo' }), 'u1').notificar, false);
  assert.equal(describirEvento('maintenance:changed', { ...p({ id: 'u9', nombre: 'Marcos' }), accion: 'programado', enlaces: 1 }, 'u1').texto, 'Marcos programó el mantenimiento «Cambio de tarjeta» (1 enlace)');
  assert.match(describirEvento('maintenance:changed', { ...p({ id: 'u9', nombre: 'Marcos' }), accion: 'cancelado' }, 'u1').texto, /canceló/);
});
