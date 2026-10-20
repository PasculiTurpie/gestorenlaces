import assert from 'node:assert/strict';
import { test } from 'node:test';
import { contarARecibir, describirErroresCierre, duracionTurnoMin, enlacesNuevos, fmtDuracion, itemResuelto, normalizarActa, pendientesDeCierre, resumenActa } from '../src/lib/turno.js';

const enlaceApi = (id, estado = 'Caido') => ({ _id: id, id_enlace: `ENL-${id}`, estado, origen_nodo: { id_nodo: 'A' }, destino_nodo: { id_nodo: 'B' } });
const actaApi = (items, extra = {}) => ({
  _id: 'a1', operador: { nombre: 'Nico' }, tipo_turno: 'Noche', fecha_inicio: '2026-10-17T01:00:00Z', cerrado: false, bitacora_general: '',
  checklist_enlaces: items, ...extra,
});
const item = (id, extra = {}) => ({ enlace: enlaceApi(id), estado_recibido: 'Caido', gestionado: false, accion_tomada: '', ...extra });

test('normalizarActa: ítems con ruta y enlace eliminado', () => {
  const a = normalizarActa(actaApi([item('e1'), { enlace: null, estado_recibido: 'Degradado', gestionado: true, accion_tomada: 'x' }]));
  assert.equal(a.items.length, 2); assert.equal(a.items[0].id_enlace, 'ENL-e1'); assert.equal(a.items[0].origen, 'A'); assert.equal(a.items[0].enlaceId, 'e1');
  assert.equal(a.items[1].eliminado, true); assert.equal(a.items[1].id_enlace, '(enlace eliminado)'); assert.equal(a.items[1].enlaceId, null);
  assert.equal(normalizarActa({ ...actaApi([]), cerrado: undefined }).cerrado, false);
});

test('un ítem solo está resuelto con gestión Y acción descrita (regla del cierre)', () => {
  assert.equal(itemResuelto({ estado_recibido: 'Caido', gestionado: false, accion_tomada: '' }), false);
  assert.equal(itemResuelto({ estado_recibido: 'Caido', gestionado: true, accion_tomada: '' }), false);
  assert.equal(itemResuelto({ estado_recibido: 'Caido', gestionado: true, accion_tomada: '   ' }), false);
  assert.equal(itemResuelto({ estado_recibido: 'Caido', gestionado: true, accion_tomada: 'Escalado' }), true);
  assert.equal(itemResuelto({ estado_recibido: 'OK', gestionado: false, accion_tomada: '' }), true);
});

test('pendientesDeCierre explica qué falta en cada ítem', () => {
  const a = normalizarActa(actaApi([item('e1'), item('e2', { gestionado: true }), item('e3', { gestionado: true, accion_tomada: 'ok' })]));
  const p = pendientesDeCierre(a);
  assert.deepEqual(p.map((x) => [x.item.id_enlace, x.motivo]), [['ENL-e1', 'Falta marcarlo como gestionado'], ['ENL-e2', 'Falta describir la acción tomada']]);
  assert.deepEqual(resumenActa(a), { total: 3, resueltos: 1, gestionados: 2, pendientes: 2 });
});

test('enlacesNuevos: los que cayeron después de abrir el turno', () => {
  const a = normalizarActa(actaApi([item('e1')]));
  const store = { e1: { _id: 'e1', id_enlace: 'ENL-e1', estado: 'Caido' }, e2: { _id: 'e2', id_enlace: 'ENL-e2', estado: 'Degradado' }, e3: { _id: 'e3', id_enlace: 'ENL-e3', estado: 'OK' }, e4: { _id: 'e4', id_enlace: 'ENL-a4', estado: 'Mantenimiento' } };
  assert.deepEqual(enlacesNuevos(a, store).map((l) => l._id), ['e4', 'e2']);       // ordenados por código; e1 ya está, e3 está OK
  assert.equal(contarARecibir(store), 3);
});

test('describirErroresCierre traduce el índice del checklist al enlace', () => {
  const a = normalizarActa(actaApi([item('e1'), item('e2')]));
  const err = { message: 'Error de validación', details: [{ campo: 'checklist_enlaces.1.gestionado', mensaje: 'Debe gestionarse antes de cerrar el turno' }, { campo: 'checklist_enlaces.0.accion_tomada', mensaje: 'Indique la acción tomada' }, { campo: 'fecha_fin', mensaje: 'Mala fecha' }] };
  assert.deepEqual(describirErroresCierre(err, a), ['ENL-e2: Debe gestionarse antes de cerrar el turno', 'ENL-e1: Indique la acción tomada', 'Mala fecha']);
  assert.deepEqual(describirErroresCierre({ message: 'Otro' }, a), ['Otro']);
});

test('duraciones', () => {
  assert.equal(fmtDuracion(0), '0 min'); assert.equal(fmtDuracion(42), '42 min'); assert.equal(fmtDuracion(185), '3 h 05 min'); assert.equal(fmtDuracion(60 * 52), '2 d 4 h'); assert.equal(fmtDuracion(null), '—');
  const cerrada = normalizarActa(actaApi([], { fecha_fin: '2026-10-17T09:05:00Z' }));
  assert.equal(duracionTurnoMin(cerrada), 8 * 60 + 5);
  assert.equal(duracionTurnoMin(normalizarActa(actaApi([])), new Date('2026-10-17T02:30:00Z').getTime()), 90);
});

// ===================================================================== traspaso (turno anterior)
import { TRASPASO_VIGENTE_HORAS, horasDesde, notasPorEnlace, resumenTurnoAnterior } from '../src/lib/turno.js';

const itemAnt = (id, accion, estado = 'Caido') => ({ enlace: enlaceApi(id, estado), estado_recibido: estado, gestionado: true, accion_tomada: accion });
const anteriorApi = () => normalizarActa(actaApi([
  itemAnt('e1', 'Escalado a Proveedor B (INC1). ETA 02:30.', 'Caido'),
  itemAnt('e2', '  Seguimiento: limpieza de conectores.  ', 'Degradado'),
  itemAnt('e3', 'Ventana CHG1 coordinada.', 'Mantenimiento'),
  itemAnt('e4', '', 'Degradado'),                                    // sin acción escrita
  { enlace: null, estado_recibido: 'Caido', gestionado: true, accion_tomada: 'enlace ya eliminado' },
], { cerrado: true, fecha_fin: '2026-10-19T08:00:00Z' }));

test('notas del turno anterior por enlace: solo los que tienen acción, sin espacios sobrantes', () => {
  const n = notasPorEnlace(anteriorApi());
  assert.deepEqual(Object.keys(n).sort(), ['e1', 'e2', 'e3']);                     // e4 sin acción y el eliminado no
  assert.equal(n.e2.accion, 'Seguimiento: limpieza de conectores.'); assert.equal(n.e1.estado_recibido, 'Caido');
  assert.deepEqual(notasPorEnlace(null), {}); assert.deepEqual(notasPorEnlace({ items: [] }), {});
});

test('qué sigue en seguimiento según el estado ACTUAL (más grave primero) y qué ya se recuperó', () => {
  const ahora = (id, estado, desde = '2026-10-19T09:00:00Z') => ({ _id: id, id_enlace: `ENL-${id}`, estado, estado_desde: desde });
  const store = { e1: ahora('e1', 'Caido'), e2: ahora('e2', 'OK'), e3: ahora('e3', 'Mantenimiento'), e4: ahora('e4', 'Degradado') };   // el turno anterior los vio Caído/Degr./Mant./Degr.
  const r = resumenTurnoAnterior(anteriorApi(), store);
  assert.deepEqual(r.seguimiento.map((i) => [i.id_enlace, i.estadoActual]), [['ENL-e1', 'Caido'], ['ENL-e4', 'Degradado'], ['ENL-e3', 'Mantenimiento']]);
  assert.deepEqual(r.recuperados.map((i) => i.id_enlace), ['ENL-e2'], 'e2 ya volvió a OK');
  assert.equal(r.total, 5); assert.equal(r.seguimiento[0].accion_tomada, 'Escalado a Proveedor B (INC1). ETA 02:30.');
  assert.equal(r.seguimiento[0].desdeActual, '2026-10-19T09:00:00Z', 'el "desde" es el del estado actual, no el del turno anterior');
  // enlaces que ya no existen en el store (eliminados) se ignoran
  assert.equal(resumenTurnoAnterior(anteriorApi(), {}).seguimiento.length, 0);
  assert.deepEqual(resumenTurnoAnterior(null, store), { seguimiento: [], recuperados: [], total: 0 });
});

test('un traspaso de hace más de 24 h se marca como posiblemente desactualizado', () => {
  const ahora = new Date('2026-10-20T12:00:00Z').getTime();
  assert.equal(horasDesde('2026-10-20T06:00:00Z', ahora), 6);
  assert.ok(horasDesde('2026-10-19T08:00:00Z', ahora) > TRASPASO_VIGENTE_HORAS);
  assert.ok(!(horasDesde('2026-10-20T00:00:00Z', ahora) > TRASPASO_VIGENTE_HORAS));
});

// ===================================================================== horario de los turnos
import { avisoContinuidad, etiquetaTurno, rangoTurno, turnoEsperadoAntes } from '../src/lib/horarios.js';

const HORARIOS = { zona_horaria: 'America/Santiago', ahora: { turno: 'Tarde', sugerido: 'Tarde' }, turnos: [
  { clave: 'Mañana', inicio: '08:00', fin: '15:30', cruza_medianoche: false, anterior: 'Noche' },
  { clave: 'Tarde', inicio: '15:30', fin: '23:00', cruza_medianoche: false, anterior: 'Mañana' },
  { clave: 'Noche', inicio: '23:00', fin: '08:00', cruza_medianoche: true, anterior: 'Tarde' }] };

test('horario de los turnos: etiquetas y de quién se recibe', () => {
  assert.equal(rangoTurno(HORARIOS, 'Noche'), '23:00–08:00'); assert.equal(etiquetaTurno(HORARIOS, 'Mañana'), 'Mañana (08:00–15:30)');
  assert.equal(etiquetaTurno(null, 'Tarde'), 'Tarde', 'sin horario cargado, solo el nombre'); assert.equal(rangoTurno(HORARIOS, 'X'), null);
  assert.deepEqual(['Mañana', 'Tarde', 'Noche'].map((t) => turnoEsperadoAntes(HORARIOS, t)), ['Noche', 'Mañana', 'Tarde']);
  assert.equal(turnoEsperadoAntes(null, 'Noche'), null);
});

test('continuidad: avisa si el último turno cerrado no es el que corresponde, sin bloquear', () => {
  const ant = (tipo, nombre = 'Marcos') => ({ tipo_turno: tipo, operador: { nombre } });
  assert.equal(avisoContinuidad(HORARIOS, 'Mañana', ant('Noche')), null);         // Noche → Mañana: correcto
  assert.equal(avisoContinuidad(HORARIOS, 'Tarde', ant('Mañana')), null);
  assert.equal(avisoContinuidad(HORARIOS, 'Noche', ant('Tarde')), null);
  const a = avisoContinuidad(HORARIOS, 'Mañana', ant('Tarde', 'Marcos'));         // falta el acta de la noche
  assert.match(a, /Para entrar al turno mañana se espera recibir del turno noche, pero el último turno cerrado es el tarde \(Marcos\)/); assert.match(a, /no se haya registrado/);
  assert.match(avisoContinuidad(HORARIOS, 'Noche', ant('Noche')), /se espera recibir del turno tarde/);            // doble noche seguida
  assert.equal(avisoContinuidad(HORARIOS, 'Mañana', null), null, 'sin turno anterior no hay nada que comparar');
  assert.equal(avisoContinuidad(null, 'Mañana', ant('Tarde')), null, 'sin horario cargado, no se opina');
  assert.doesNotMatch(avisoContinuidad(HORARIOS, 'Mañana', { tipo_turno: 'Tarde' }), /\(undefined\)/);
});
