import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describirEvento } from '../src/lib/eventos.js';
import { frasesResumen, mapeoAPayload, mapeoInicial, plantillaTexto, validarArchivoTabla, validarMapeo } from '../src/lib/servicios.js';

const f = (name, size = 1000) => ({ name, size });

test('archivo de servicios: Excel (.xlsx) o texto, no .xls ni otros', () => {
  for (const n of ['servicios.xlsx', 'SERVICIOS.XLSX', 'lista.txt', 'lista.csv']) assert.equal(validarArchivoTabla(f(n)), null, n);
  assert.match(validarArchivoTabla(f('viejo.xls')), /\.xls \(Excel antiguo\).*\.xlsx/); assert.match(validarArchivoTabla(f('datos.pdf')), /Solo se admiten archivos Excel/); assert.match(validarArchivoTabla(f('sin-extension')), /Solo se admiten/);
  assert.match(validarArchivoTabla(f('vacio.txt', 0)), /vacío/); assert.match(validarArchivoTabla(f('grande.xlsx', 6 * 1024 * 1024)), /Supera el máximo de 5 MB/); assert.equal(validarArchivoTabla(f('justo.xlsx', 5 * 1024 * 1024)), null);
});

test('columnas: se parte de lo que el servidor sugiere y se valida antes de pedir la vista previa', () => {
  assert.deepEqual(mapeoInicial({ servicio: 0, cliente: 1, tipo: 2, capacidad: 3, enlace: 4, observacion: 5 }), { servicio: '0', cliente: '1', tipo: '2', capacidad: '3', codigo: '', observacion: '5', enlaceModo: 'enlace', enlace: '4', origen: '', destino: '' });
  const nodos = mapeoInicial({ servicio: 0, origen: 1, destino: 2 }); assert.deepEqual([nodos.enlaceModo, nodos.origen, nodos.destino, nodos.enlace], ['nodos', '1', '2', '']);
  assert.equal(mapeoInicial({ servicio: 0, enlace: 3, origen: 1, destino: 2 }).enlaceModo, 'enlace', 'si hay columna de enlace, esa manda');
  assert.deepEqual(mapeoInicial({}), { servicio: '', cliente: '', tipo: '', capacidad: '', codigo: '', observacion: '', enlaceModo: 'enlace', enlace: '', origen: '', destino: '' }, 'sin sugerencia: todo vacío');
  assert.deepEqual(Object.keys(validarMapeo(mapeoInicial({}))).sort(), ['enlace', 'servicio']);
  assert.deepEqual(validarMapeo(mapeoInicial({ servicio: 0, enlace: 1 })), {});
  assert.deepEqual(Object.keys(validarMapeo({ ...mapeoInicial({ servicio: 0 }), enlaceModo: 'nodos' })).sort(), ['destino', 'origen'], 'por nodos hacen falta origen y destino');
  assert.equal(validarMapeo({ ...mapeoInicial({ servicio: 0, origen: 1, destino: 1 }), enlaceModo: 'nodos' }).destino, 'El destino debe ser otra columna');
  assert.equal(validarMapeo(mapeoInicial({ servicio: 0, cliente: 0, enlace: 1 })).cliente, 'Esa columna ya se usa para otro dato', 'una columna no sirve para dos datos');
  assert.deepEqual(validarMapeo({ ...mapeoInicial({ servicio: 0, enlace: 1 }), enlaceModo: 'nodos', origen: '2', destino: '3', enlace: '1' }), {}, 'el modo «nodos» ignora la columna de enlace aunque quede elegida');
});

test('cuerpo de la API: solo lo elegido, y el enlace por una columna o por origen+destino', () => {
  assert.deepEqual(mapeoAPayload(mapeoInicial({ servicio: 0, cliente: 1, enlace: 4 })), { servicio: 0, cliente: 1, enlace: 4 });
  assert.deepEqual(mapeoAPayload({ ...mapeoInicial({ servicio: 0, origen: 1, destino: 2 }), enlace: '7' }), { servicio: 0, origen: 1, destino: 2 }, 'nodos: no viaja la columna de enlace');
  assert.deepEqual(mapeoAPayload(mapeoInicial({ servicio: 2, enlace: 0, observacion: 5 })), { servicio: 2, observacion: 5, enlace: 0 }, 'la columna 0 es válida');
});

test('resumen de la importación en frases', () => {
  const r = { servicios: 5, nuevos: 3, actualizados: 1, sin_cambios: 1, asignaciones_nuevas: 7, asignaciones_quitadas: 0, filas_con_problemas: 0, sin_enlaces: 0 };
  assert.deepEqual(frasesResumen(r), ['5 servicios en el archivo: 3 nuevos, 1 por actualizar, 1 sin cambios', '7 enlaces nuevos asignados']);
  const g = frasesResumen({ ...r, servicios: 1, nuevos: 1, actualizados: 0, sin_cambios: 0, asignaciones_nuevas: 1, asignaciones_quitadas: 2, filas_con_problemas: 1, sin_enlaces: 1 });
  assert.deepEqual(g, ['1 servicio en el archivo: 1 nuevo, 0 por actualizar, 0 sin cambios', '1 enlace nuevo asignado y 2 enlaces quitados (modo reemplazar)', '1 fila con problemas: se omiten', '1 servicio queda sin enlaces']);
});

test('plantilla de ejemplo: con enlaces reales si los hay, y apta para Excel (BOM y «;»)', () => {
  const t = plantillaTexto([{ id_enlace: 'ENL-VLDV-LANC-01', origen: 'VLDV', destino: 'LANC' }, { id_enlace: 'ENL-LANC-PNGP-01', origen: 'LANC', destino: 'PNGP' }]);
  assert.ok(t.startsWith('\uFEFFServicio;Cliente;Tipo de servicio;Capacidad;Enlace;Observación\r\n')); const filas = t.trim().split('\r\n');
  assert.equal(filas.length, 4); assert.match(filas[1], /ENL-VLDV-LANC-01, ENL-LANC-PNGP-01/); assert.match(filas[3], /VLDV → LANC/); assert.ok(filas.every((x) => x.replace('\uFEFF', '').split(';').length === 6), 'todas con 6 columnas');
  assert.match(plantillaTexto(), /ENL-NODO1-NODO2-01/, 'sin catálogo usa nombres genéricos');
});

test('tiempo real: los cambios de servicios se anotan sin molestar con avisos', () => {
  const p = (accion, extra = {}) => ({ accion, por: { id: 'u9', nombre: 'Sofía' }, ...extra });
  assert.deepEqual(describirEvento('services:changed', p('importado', { creados: 3, actualizados: 2 }), 'u1'), { texto: 'Sofía importó servicios (3 nuevos, 2 actualizados)', nivel: 'info', notificar: false });
  assert.equal(describirEvento('services:changed', p('editado'), 'u1').texto, 'Sofía editó un servicio'); assert.equal(describirEvento('services:changed', p('otra-cosa'), 'u1').texto, 'Sofía actualizó los servicios');
});

// ===================================================================== integración con iMaster NCE
import { enriquecerAlarmas, estadoConexion, marcaPaso, resumenAlarmas, tipificacionDe } from '../src/lib/nce.js';

test('NCE: estado de la conexión, de menos a más grave', () => {
  const base = { configurado: true, habilitado: true, ultima_ok: '2026-10-21T15:00:00Z', ultimo_error: null };
  assert.equal(estadoConexion(null).clave, 'cargando'); assert.deepEqual(estadoConexion({ error_configuracion: 'x', configurado: true }), { clave: 'config', etiqueta: 'Configuración inválida', nivel: 'error' }, 'una configuración inválida manda sobre todo');
  assert.equal(estadoConexion({ configurado: false, habilitado: false }).clave, 'sin_config'); assert.equal(estadoConexion({ ...base, habilitado: false }).clave, 'desactivada');
  assert.equal(estadoConexion({ ...base, ultima_ok: null }).clave, 'esperando'); assert.deepEqual(estadoConexion(base), { clave: 'ok', etiqueta: 'Conectado', nivel: 'ok' });
  assert.equal(estadoConexion({ ...base, ultimo_error: { codigo: 'RED' } }).etiqueta, 'Con errores (mostrando la última lectura)'); assert.equal(estadoConexion({ ...base, ultima_ok: null, ultimo_error: { codigo: 'AUTH' } }).etiqueta, 'Con errores');
});

test('NCE: cada alarma leída se une a su tipificación y a su enlace de la app', () => {
  const cat = [{ _id: 't1', codigo: 'R_LOS', activo: true }, { _id: 't2', codigo: 'OSC_LOS', activo: false }, { _id: 't3', codigo: 'FAN_FAIL' }];
  const enlaces = { e1: { _id: 'e1', id_enlace: 'ENL-VLDV-LANC-01' } };
  assert.equal(tipificacionDe({ codigo: 'R_LOS' }, cat)._id, 't1'); assert.equal(tipificacionDe({ codigo: 'OSC_LOS' }, cat), null, 'una tipificación desactivada no cuenta'); assert.equal(tipificacionDe({ codigo: 'FAN_FAIL' }, cat)._id, 't3', 'sin campo activo = activa'); assert.equal(tipificacionDe({ codigo: 'RARA' }, cat), null);
  const lista = enriquecerAlarmas([{ codigo: 'R_LOS', enlace: { enlace: 'ENL-VLDV-LANC-01', sentido: 'ida' } }, { codigo: 'RARA', enlace: { enlace: 'ENL-NO-EXISTE-01', sentido: null } }, { codigo: 'FAN_FAIL', enlace: null }], cat, enlaces);
  assert.deepEqual([lista[0].tipificacion._id, lista[0].enlaceApp._id], ['t1', 'e1']); assert.deepEqual([lista[1].tipificacion, lista[1].enlaceApp], [null, null], 'una regla que apunta a un enlace que no existe no inventa nada'); assert.equal(lista[2].enlaceApp, null);
  assert.deepEqual(resumenAlarmas(lista), { total: 3, conEnlace: 2, sinEnlace: 1, sinTipificar: 1 });
  assert.deepEqual([{ ok: true }, { ok: false }, { omitido: true }].map(marcaPaso), ['✓', '✗', '–']);
});

// ===================================================================== ítems de atención del turno
import { aPayloadItem, cambiosItem, etiquetaTurnoIngreso, formularioItem, TITULOS_SUGERIDOS, ultimoSeguimiento, validarItem } from '../src/lib/items.js';

test('ítems de atención: ticket y descripción son obligatorios, el título es libre', () => {
  assert.deepEqual(validarItem(formularioItem()), { titulo: 'Escriba qué hay que atender (mín. 3 caracteres)', ticket: 'El número de ticket es obligatorio', descripcion: 'Describa el ítem (mín. 3 caracteres)' });
  const ok = { titulo: 'Corte de cable secundario', ticket: 'INC0012999', descripcion: 'Tramo norte' };
  assert.deepEqual(validarItem(ok), {}); assert.deepEqual(Object.keys(validarItem({ ...ok, ticket: '   ' })), ['ticket'], 'un ticket en blanco no vale');
  assert.deepEqual(validarItem({ ...ok, titulo: 'Algo que no está en la lista' }), {}, 'cualquier título sirve');
  assert.ok(TITULOS_SUGERIDOS.includes('Corte de cable secundario') && TITULOS_SUGERIDOS.includes('Corte de energía') && TITULOS_SUGERIDOS.includes('Otro'));
  assert.deepEqual(aPayloadItem({ titulo: '  Corte de energía ', ticket: ' T1 ', descripcion: ' Sin luz ' }), { titulo: 'Corte de energía', ticket: 'T1', descripcion: 'Sin luz' }, 'sin espacios sobrantes');
});

test('ítems de atención: solo se envía lo que cambió', () => {
  const item = { titulo: 'Corte de energía', ticket: 'T1', descripcion: 'Sin luz' };
  assert.deepEqual(cambiosItem(item, formularioItem(item)), {}); assert.deepEqual(cambiosItem(item, { ...formularioItem(item), ticket: ' T2 ' }), { ticket: 'T2' });
  assert.deepEqual(cambiosItem(item, { titulo: 'Corte de energía en sala 2', ticket: 'T1', descripcion: 'Sin luz' }), { titulo: 'Corte de energía en sala 2' });
});

test('ítems de atención: en qué turno se ingresó y la última nota', () => {
  assert.equal(etiquetaTurnoIngreso({ turno_ingreso: { tipo_turno: 'Noche', fecha_turno: '2026-10-20' } }), 'turno noche del 20-10-26'); assert.equal(etiquetaTurnoIngreso({ turno_ingreso: { tipo_turno: 'Mañana' } }), 'turno mañana');
  assert.equal(etiquetaTurnoIngreso({}), null); assert.equal(ultimoSeguimiento({ seguimiento: [] }), null); assert.equal(ultimoSeguimiento({ seguimiento: [{ texto: 'a' }, { texto: 'b' }] }).texto, 'b');
});

test('ítems de atención: todos se enteran en vivo, salvo quien hizo el cambio', () => {
  const p = (accion, por) => ({ accion, titulo: 'Corte de energía', ticket: 'INC1', por });
  const e = describirEvento('item:changed', p('creado', { id: 'u9', nombre: 'Marcos' }), 'u1'); assert.deepEqual([e.texto, e.nivel, e.notificar], ['Marcos ingresó el ítem «Corte de energía» (ticket INC1)', 'warn', true]);
  assert.equal(describirEvento('item:changed', p('creado', { id: 'u1', nombre: 'Yo' }), 'u1').notificar, false);
  assert.match(describirEvento('item:changed', p('resuelto', { id: 'u9', nombre: 'Marcos' }), 'u1').texto, /Marcos resolvió el ítem/); assert.equal(describirEvento('item:changed', p('resuelto', { id: 'u9', nombre: 'M' }), 'u1').nivel, 'info');
  assert.match(describirEvento('item:changed', p('seguimiento', { id: 'u9', nombre: 'M' }), 'u1').texto, /agregó seguimiento al ítem/);
});
