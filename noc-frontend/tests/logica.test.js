import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describirEvento } from '../src/lib/eventos.js';
import { estiloEnlace } from '../src/lib/estados.js';
import { hace } from '../src/lib/format.js';
import { trazadoEnlace } from '../src/lib/geometria.js';
import { construirAristas, construirNodos } from '../src/lib/rfBuilders.js';
import { alarmas, buscarNodos, contarPorEstado, enlacesDeNodo, estadoPorNodo, offsetsParalelos } from '../src/lib/selectors.js';

const L = (id, o, d, estado = 'OK', desde = '2026-10-17T10:00:00Z') => ({ _id: id, id_enlace: id, origen: o, destino: d, estado, estado_desde: desde });
const enlaces = Object.fromEntries([
  L('E1', 'A', 'B', 'OK'),
  L('E2', 'B', 'C', 'Caido', '2026-10-17T09:00:00Z'),
  L('E3', 'C', 'D', 'Degradado', '2026-10-17T08:00:00Z'),
  L('E4', 'D', 'E', 'Mantenimiento'),
  L('E5', 'B', 'C', 'OK'), // paralelo a E2
  L('E6', 'F', 'G', 'Caido', '2026-10-17T07:00:00Z'),
].map((l) => [l._id, l]));

test('estadoPorNodo: gana el estado más severo de los enlaces que tocan al nodo', () => {
  const e = estadoPorNodo(enlaces);
  assert.equal(e.A, 'OK');
  assert.equal(e.B, 'Caido');          // E1 OK + E2 Caído + E5 OK
  assert.equal(e.C, 'Caido');          // Caído > Degradado
  assert.equal(e.D, 'Degradado');      // Degradado > Mantenimiento
  assert.equal(e.E, 'Mantenimiento');
});

test('contarPorEstado y alarmas (severidad, luego antigüedad)', () => {
  assert.deepEqual(contarPorEstado(enlaces), { OK: 2, Degradado: 1, Caido: 2, Mantenimiento: 1 });
  assert.deepEqual(alarmas(enlaces).map((l) => l._id), ['E6', 'E2', 'E3', 'E4']); // caídos (más antiguo primero), degradado, mant.
});

test('enlacesDeNodo ordena por id', () => {
  assert.deepEqual(enlacesDeNodo(enlaces, 'B').map((l) => l._id), ['E1', 'E2', 'E5']);
});

test('offsetsParalelos: único = 0; dos paralelos quedan simétricos', () => {
  const o = offsetsParalelos(enlaces);
  assert.equal(o.E1, 0);
  assert.equal(o.E2 + o.E5, 0);
  assert.notEqual(o.E2, o.E5);
  // Enlaces paralelos en sentidos opuestos (B→C y C→B) deben verse a lados opuestos de la recta:
  // se mide la posición visual real con la misma geometría que usa la arista.
  const inv = offsetsParalelos({ X: L('X', 'C', 'B'), Y: L('Y', 'B', 'C') });
  const B = [0, 0], C = [100, 0];
  const yY = trazadoEnlace(...B, ...C, inv.Y).labelY;   // B→C
  const yX = trazadoEnlace(...C, ...B, inv.X).labelY;   // C→B
  assert.ok(Math.abs(yX) > 0 && Math.abs(yY) > 0);
  assert.equal(yX + yY, 0);                              // simétricos respecto a la recta
  assert.notEqual(yX, yY);
});

test('buscarNodos prioriza prefijo y limita', () => {
  const nodos = Object.fromEntries(['VLDV', 'LAMS', 'VLRC', 'CHIL1', 'PMTT'].map((id) => [id, { id_nodo: id, nombre: id }]));
  assert.deepEqual(buscarNodos(nodos, 'vl').map((n) => n.id_nodo), ['VLDV', 'VLRC']);
  assert.deepEqual(buscarNodos(nodos, ''), []);
  assert.equal(buscarNodos(nodos, 'l', 2).length, 2);
});

test('trazadoEnlace: recta y curva con pico a `offset` px', () => {
  assert.equal(trazadoEnlace(0, 0, 100, 0).path, 'M 0 0 L 100 0');
  const c = trazadoEnlace(0, 0, 100, 0, 20);
  assert.match(c.path, /^M 0 0 Q 50 40 100 0$/);   // control a 2*offset
  assert.equal(c.labelX, 50); assert.equal(c.labelY, 20);
  assert.ok(Number.isFinite(trazadoEnlace(5, 5, 5, 5, 10).labelX)); // nodos coincidentes no revientan
});

test('estiloEnlace: verde sólido / naranja / rojo punteado parpadeante / azul punteado', () => {
  assert.equal(estiloEnlace('OK').stroke, '#22c55e');
  assert.equal(estiloEnlace('OK').strokeDasharray, undefined);
  assert.equal(estiloEnlace('Degradado').stroke, '#f97316');
  const caido = estiloEnlace('Caido');
  assert.equal(caido.stroke, '#ef4444'); assert.ok(caido.strokeDasharray); assert.equal(caido.className, 'edge-blink');
  assert.equal(estiloEnlace('Mantenimiento').stroke, '#3b82f6');
  assert.ok(estiloEnlace('OK', true).strokeWidth > estiloEnlace('OK').strokeWidth);
});

test('construirNodos / construirAristas', () => {
  const nodos = { A: { id_nodo: 'A', nombre: 'A', tipo: 'ESTACION', posicion: { x: 10, y: 20 } }, B: { id_nodo: 'B', nombre: 'B', tipo: 'OLA', posicion: { x: 30, y: 40 } } };
  const previos = [{ id: 'A', dragging: true, position: { x: 99, y: 99 } }];
  const rf = construirNodos({ nodos, estados: { B: 'Caido' }, nodoSel: 'B', puedeMover: true, previos });
  assert.deepEqual(rf.find((n) => n.id === 'A').position, { x: 99, y: 99 });   // en arrastre: no se pisa
  assert.deepEqual(rf.find((n) => n.id === 'B').position, { x: 30, y: 40 });
  assert.equal(rf.find((n) => n.id === 'B').data.status, 'Caido');
  assert.equal(rf.find((n) => n.id === 'A').data.status, 'OK');
  assert.equal(rf.find((n) => n.id === 'B').selected, true);

  const en = { E1: L('E1', 'A', 'B', 'OK'), E2: L('E2', 'A', 'B', 'Caido'), E3: L('E3', 'A', 'ZZZ', 'OK') };
  const ar = construirAristas({ enlaces: en, nodos, offsets: {}, enlaceSel: 'E2', ocultarOK: false });
  assert.deepEqual(ar.map((a) => a.id), ['E1', 'E2']);                          // E3 apunta a un nodo inexistente
  assert.ok(ar.find((a) => a.id === 'E2').zIndex > ar.find((a) => a.id === 'E1').zIndex);
  assert.equal(construirAristas({ enlaces: en, nodos, offsets: {}, enlaceSel: null, ocultarOK: true }).length, 1);
});

test('describirEvento: texto, nivel y toast solo para cambios de otros', () => {
  const p = { link: { id_enlace: 'ENL-1' }, cambio: { de: 'OK', a: 'Caido' }, por: { id: 'u2', nombre: 'Sofía' } };
  const ajeno = describirEvento('link:updated', p, 'u1');
  assert.equal(ajeno.texto, 'ENL-1: OK → Caído (Sofía)');
  assert.equal(ajeno.nivel, 'critico'); assert.equal(ajeno.notificar, true);
  const propio = describirEvento('link:updated', p, 'u2');
  assert.match(propio.texto, /\(tú\)/); assert.equal(propio.notificar, false);
  assert.equal(describirEvento('node:moved', {}, 'u1'), null);
  assert.equal(describirEvento('link:updated', { link: { id_enlace: 'X' }, cambio: { campos: ['proveedor'] }, por: null }, 'u1').nivel, 'info');
});

test('hace()', () => {
  const t = (min) => new Date(Date.now() - min * 60_000).toISOString();
  assert.equal(hace(t(0)), 'ahora');
  assert.equal(hace(t(12)), 'hace 12 min');
  assert.equal(hace(t(185)), 'hace 3 h 05 min');
  assert.equal(hace(t(60 * 52)), 'hace 2 d 4 h');
  assert.equal(hace(null), '—');
});

// ===================================================================== Fase: tipos de línea y filamentos
import { claveDesdeNombre, siguienteIdEnlace } from '../src/lib/catalogos.js';
import { describirError } from '../src/lib/errores.js';
import { calcularAtenuacion, fechaParaInput, fmtDb, fmtDbm, leerNumero, normalizarFilamentos } from '../src/lib/levantamiento.js';
import { desplazamientoTarjeta, puntoEnTrazado, trazadoFilamento } from '../src/lib/geometria.js';
import { contarEnlacesPorNodo, estadoLevantamiento } from '../src/lib/selectors.js';

test('levantamiento: atenuación = Tx − Rx y formato con coma', () => {
  assert.equal(calcularAtenuacion(1.2, -9.8), 11);
  assert.equal(calcularAtenuacion(0.5, -10.25), 10.75);
  assert.equal(calcularAtenuacion(null, -9), null);
  assert.equal(fmtDbm(1.2), '+1,20'); assert.equal(fmtDbm(-9.8), '-9,80'); assert.equal(fmtDbm(0), '0,00'); assert.equal(fmtDbm(null), '—');
  assert.equal(fmtDb(10.75), '10,75');
});

test('levantamiento: normalizarFilamentos siempre entrega ida y vuelta, en ese orden', () => {
  assert.deepEqual(normalizarFilamentos(undefined).map((f) => f.sentido), ['ida', 'vuelta']);
  const f = normalizarFilamentos([{ sentido: 'vuelta', levantamiento: { potencia_tx_dbm: 1, potencia_rx_dbm: -9 } }, { sentido: 'ida' }]);
  assert.deepEqual(f.map((x) => x.sentido), ['ida', 'vuelta']);
  assert.equal(f[0].levantamiento.completo, false); assert.equal(f[1].levantamiento.atenuacion, 10);
  assert.equal(normalizarFilamentos([{ sentido: 'ida', levantamiento: { potencia_tx_dbm: '3' } }])[0].levantamiento.tx, null); // no-numérico se ignora
});

test('leerNumero: coma o punto, vacío = null, basura = NaN', () => {
  assert.equal(leerNumero('-9,80'), -9.8); assert.equal(leerNumero(' 1.5 '), 1.5); assert.equal(leerNumero(''), null);
  assert.ok(Number.isNaN(leerNumero('abc'))); assert.equal(fechaParaInput('2026-09-01T10:00:00Z'), '2026-09-01'); assert.equal(fechaParaInput(null), '');
});

test('filamentos: trazado paralelo al enlace, a ±d px, también en enlaces curvos', () => {
  const ida = trazadoFilamento(0, 0, 100, 0, 0, 7), vuelta = trazadoFilamento(0, 0, 100, 0, 0, -7);
  assert.equal(ida.path, 'M 0 7 L 100 7'); assert.equal(vuelta.path, 'M 0 -7 L 100 -7');
  assert.equal(ida.labelY + vuelta.labelY, 0);
  const curvo = trazadoFilamento(0, 0, 100, 0, 20, 7);   // enlace paralelo curvo: el filamento sigue la curva desplazada
  assert.equal(curvo.labelY, 27); assert.match(curvo.path, /^M 0 7 Q 50 47 100 7$/);
  assert.equal(trazadoFilamento(0, 0, 0, 100, 0, 7).path, 'M -7 0 L -7 100');   // vertical: el desplazamiento es horizontal
});

test('puntoEnTrazado: posición y ángulo (recta y curva); invertir gira 180°', () => {
  const r = trazadoEnlace(0, 0, 100, 0).p;
  assert.deepEqual(puntoEnTrazado(r, 0.5), { x: 50, y: 0, ang: 0 });
  assert.equal(puntoEnTrazado(r, 0.5, true).ang, 180);
  const c = trazadoEnlace(0, 0, 100, 0, 20).p;
  const m = puntoEnTrazado(c, 0.5);
  assert.equal(m.x, 50); assert.equal(m.y, 20); assert.ok(Math.abs(m.ang) < 1e-9);         // en el pico, la tangente es horizontal
  assert.ok(puntoEnTrazado(c, 0.1).ang > 0);                                                // al inicio sube hacia la curva
  assert.equal(puntoEnTrazado(trazadoEnlace(0, 0, 0, 100).p, 0.5).ang, 90);
});

test('desplazamientoTarjeta: junto a la línea, hacia arriba (derecha si es vertical), sin taparla', () => {
  const h = desplazamientoTarjeta(0, 0, 200, 0, 188, 66);
  assert.equal(h.x + 0, 0); assert.equal(h.y, -(33 + 14));                                       // sobre una línea horizontal
  const v = desplazamientoTarjeta(0, 0, 0, 200, 188, 66);
  assert.equal(v.y + 0, 0); assert.equal(v.x, 94 + 14);                                          // al costado de una vertical
  assert.ok(desplazamientoTarjeta(0, 0, 100, 100, 188, 66).y < 0);                          // diagonales: hacia arriba
  assert.ok(desplazamientoTarjeta(100, 100, 0, 0, 188, 66).y < 0);                          // y sin depender del sentido
});

test('rfBuilders: enlaces desplegados, tipo de línea y filtro por tipo', () => {
  const nodos = { A: { id_nodo: 'A', nombre: 'A', tipo: 'OLA', posicion: { x: 0, y: 0 } }, B: { id_nodo: 'B', nombre: 'B', tipo: 'OLA', posicion: { x: 1, y: 1 } } };
  const wom = { clave: 'WOM', nombre: 'WOM', color: '#a855f7', propio: false };
  const en = {
    E1: { ...L('E1', 'A', 'B'), tipo: wom, filamentos: normalizarFilamentos([]) },
    E2: { ...L('E2', 'A', 'B'), tipo: { clave: 'PROPIO', propio: true }, filamentos: normalizarFilamentos([]) },
    E3: { ...L('E3', 'A', 'B'), tipo: null, filamentos: normalizarFilamentos([]) },
  };
  const todos = construirAristas({ enlaces: en, nodos, offsets: {}, enlaceSel: null, ocultarOK: false, expandidos: { E1: true } });
  assert.equal(todos.length, 3);
  assert.equal(todos.find((a) => a.id === 'E1').data.expandido, true); assert.equal(todos.find((a) => a.id === 'E2').data.expandido, false);
  assert.equal(todos.find((a) => a.id === 'E1').data.tipo.clave, 'WOM'); assert.equal(todos.find((a) => a.id === 'E1').data.filamentos.length, 2);
  const soloWom = construirAristas({ enlaces: en, nodos, offsets: {}, enlaceSel: null, ocultarOK: false, tipoFiltro: 'WOM' });
  assert.deepEqual(soloWom.map((a) => a.id), ['E1']);
});

test('selectores: levantamiento completo/parcial/sin y enlaces por nodo', () => {
  const mk = (...tr) => ({ filamentos: normalizarFilamentos(tr.map((t, i) => t && { sentido: ['ida', 'vuelta'][i], levantamiento: { potencia_tx_dbm: t[0], potencia_rx_dbm: t[1] } }).filter(Boolean)) });
  assert.equal(estadoLevantamiento(mk()), 'sin');
  assert.equal(estadoLevantamiento(mk([1, -9])), 'parcial');                  // solo un filamento completo
  assert.equal(estadoLevantamiento(mk([1, null], null)), 'parcial');          // un valor suelto ya cuenta como parcial
  assert.equal(estadoLevantamiento(mk([1, -9], [0.8, -10])), 'completo');
  assert.deepEqual(contarEnlacesPorNodo(enlaces), { A: 1, B: 3, C: 3, D: 2, E: 1, F: 1, G: 1 });
});

test('catálogos: clave desde nombre e id de enlace siguiente', () => {
  assert.equal(claveDesdeNombre('Claro Chile'), 'CLARO_CHILE'); assert.equal(claveDesdeNombre('  Móvil Ñandú! '), 'MOVIL_NANDU'); assert.equal(claveDesdeNombre('a'.repeat(40)).length, 24);
  const ex = { x: { id_enlace: 'ENL-A-B-01' }, y: { id_enlace: 'ENL-A-B-02' }, z: { id_enlace: 'ENL-C-D-01' } };
  assert.equal(siguienteIdEnlace('A', 'B', ex), 'ENL-A-B-03'); assert.equal(siguienteIdEnlace('C', 'D', ex), 'ENL-C-D-02'); assert.equal(siguienteIdEnlace('X', 'Y', ex), 'ENL-X-Y-01');
});

test('describirError: mensaje + detalle por campo', () => {
  assert.equal(describirError({ message: 'Datos inválidos', details: [{ campo: 'potencia_tx_dbm', mensaje: 'Máximo +40 dBm' }] }), 'Datos inválidos — potencia_tx_dbm: Máximo +40 dBm');
  assert.equal(describirError({ message: 'Solo mensaje' }), 'Solo mensaje');
});

// ===================================================================== fecha del turno
import { fechaDia } from '../src/lib/format.js';
import { normalizarActa as normActa } from '../src/lib/turno.js';

test('fecha del turno: se muestra tal cual la entrega el servidor, sin convertir de zona horaria', () => {
  assert.equal(fechaDia('2026-10-20'), '20-10-26'); assert.equal(fechaDia('2027-01-01'), '01-01-27'); assert.equal(fechaDia('2028-02-29'), '29-02-28');
  assert.equal(fechaDia(null), '—'); assert.equal(fechaDia(undefined), '—'); assert.equal(fechaDia('20/10/2026'), '—'); assert.equal(fechaDia('2026-10-20T03:00:00Z'), '—');
  const a = normActa({ _id: 'x', tipo_turno: 'Noche', fecha_turno: '2026-10-20', fecha_inicio: '2026-10-20T02:05:00Z', checklist_enlaces: [] });
  assert.equal(a.fecha_turno, '2026-10-20'); assert.equal(normActa({ _id: 'y', tipo_turno: 'Noche', fecha_inicio: '2026-10-20T02:05:00Z' }).fecha_turno, null);
});
