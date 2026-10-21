import { normalizar } from './texto.js';

/**
 * Importación de servicios: reconocer a qué enlace se refiere cada celda y planificar el efecto sobre los servicios.
 * Todo es puro (sin base de datos): recibe el catálogo de enlaces y los servicios existentes y devuelve un plan y un informe.
 */

export const LIMITES = { nombre: 120, codigo: 60, cliente: 120, tipo: 60, capacidad: 40, observacion: 500, enlaces: 200 };
const CAMPOS_TEXTO = ['codigo', 'cliente', 'tipo', 'capacidad', 'observacion'];

const clave = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, '');
export const claveServicio = (nombre) => normalizar(nombre); // sin tildes ni mayúsculas: «Ñandú» = «nandu»

/** enlaces: [{ _id, id_enlace, origen: 'VLDV', destino: 'LANC' }] */
export function indexarEnlaces(enlaces) {
  const porId = new Map();
  const porPar = new Map();
  const nodos = new Set();
  for (const l of enlaces) {
    porId.set(clave(l.id_enlace), l);
    const o = clave(l.origen);
    const d = clave(l.destino);
    nodos.add(o); nodos.add(d);
    const k = [o, d].sort().join('\u0000');
    porPar.set(k, [...(porPar.get(k) ?? []), l]);
  }
  return { porId, porPar, nodos };
}

const SEPARADOR_NODOS = /\s*(?:→|⇄|↔|⟷|⇒|<=>|<->|=>|->|–|—|\/|>|<|:|~)\s*/;

/** Todas las formas de partir "HRPN-VIRT-LANC" en nodos conocidos (los ids de nodo pueden llevar guion). */
function segmentarNodos(texto, nodos) {
  const piezas = texto.split('-');
  const salidas = [];
  const ir = (i, acumulado) => {
    if (salidas.length > 50) return;
    if (i === piezas.length) { salidas.push(acumulado); return; }
    for (let j = i + 1; j <= piezas.length; j += 1) {
      const candidato = piezas.slice(i, j).join('-');
      if (nodos.has(candidato)) ir(j, [...acumulado, candidato]);
    }
  };
  ir(0, []);
  return salidas;
}

const unir = (ls) => ls.map((l) => l.id_enlace).join(', ');

function enlacesEntre(a, b, idx) {
  if (a === b) return { motivo: `«${a}» aparece dos veces seguidas en el recorrido` };
  const posibles = idx.porPar.get([a, b].sort().join('\u0000')) ?? [];
  if (posibles.length === 0) return { motivo: `No hay un enlace entre ${a} y ${b}` };
  if (posibles.length > 1) return { motivo: `Hay ${posibles.length} enlaces entre ${a} y ${b} (${unir(posibles)}): indique el código del enlace` };
  return { enlace: posibles[0] };
}

/** Convierte nombres de nodo (o grupos con guiones) en una lista de nodos conocidos. */
function nodosDe(partes, idx) {
  const salida = [];
  for (const p of partes) {
    if (idx.nodos.has(p)) { salida.push(p); continue; }
    const seg = segmentarNodos(p, idx.nodos);
    if (seg.length === 1) { salida.push(...seg[0]); continue; }
    if (seg.length > 1) return { motivo: `«${p}» es ambiguo: puede ser más de un nodo` };
    return { motivo: `No se reconoce «${p}» como enlace ni como nodo` };
  }
  return { nodos: salida };
}

/**
 * Resuelve UNA referencia a uno o más enlaces. Acepta:
 *  - el código del enlace: «ENL-VLDV-LANC-01» (o «VLDV-LANC-01», sin el prefijo);
 *  - los nodos que une: «VLDV-LANC», «VLDV → LANC», «VLDV ⇄ LANC»;
 *  - un recorrido: «A → B → C» (equivale a los enlaces A–B y B–C).
 * Devuelve { ok: true, enlaces } o { ok: false, motivo }. Si algo del recorrido no se reconoce, no se toma nada de esa referencia.
 */
export function resolverReferencia(texto, idx) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  const T = clave(t);
  const directo = idx.porId.get(T) ?? idx.porId.get(`ENL-${T}`);
  if (directo) return { ok: true, enlaces: [directo] };

  const partes = t.split(SEPARADOR_NODOS).map(clave).filter(Boolean);
  // «ENL-A-01 / ENL-B-01»: una lista de códigos con un separador que también sirve entre nodos
  if (partes.length >= 2) {
    const codigos = partes.map((p) => idx.porId.get(p) ?? idx.porId.get(`ENL-${p}`));
    if (codigos.every(Boolean)) return { ok: true, enlaces: [...new Map(codigos.map((l) => [l._id, l])).values()] };
  }

  const nodos = nodosDe(partes.length >= 2 ? partes : [T], idx);
  if (nodos.motivo) return { ok: false, motivo: partes.length >= 2 || !nodos.motivo.startsWith('No se reconoce') ? nodos.motivo : `No existe el enlace «${t}» ni nodos con ese nombre` };
  if (nodos.nodos.length < 2) return { ok: false, motivo: `«${t}» no indica un enlace: falta el otro extremo` };
  const enlaces = [];
  for (let i = 0; i < nodos.nodos.length - 1; i += 1) {
    const r = enlacesEntre(nodos.nodos[i], nodos.nodos[i + 1], idx);
    if (r.motivo) return { ok: false, motivo: r.motivo };
    enlaces.push(r.enlace);
  }
  return { ok: true, enlaces: [...new Map(enlaces.map((l) => [l._id, l])).values()] };
}

/** Una celda puede traer varias referencias separadas por coma, punto y coma o salto de línea. */
export const partirReferencias = (celda) => String(celda ?? '').split(/[,;\n\r]+/).map((x) => x.trim()).filter(Boolean);

// ------------------------------------------------------------------ plan de importación

/**
 * filas: matriz de texto (con la fila de encabezado en `filaEncabezado`).
 * mapeo: { servicio, codigo?, cliente?, tipo?, capacidad?, observacion?, enlace? | origen+destino }  (índices de columna).
 * existentes: Map(claveServicio → { _id, nombre, codigo, cliente, tipo, capacidad, observacion, enlaces: [ids] }).
 * modo: 'agregar' (suma enlaces a los que ya tiene) | 'reemplazar' (la ruta del archivo sustituye a la actual, solo si el archivo trae enlaces válidos).
 */
export function planificarImportacion({ filas, filaEncabezado = 0, mapeo, indice, existentes = new Map(), modo = 'agregar' }) {
  const celda = (fila, campo) => (mapeo[campo] === undefined ? '' : String(fila[mapeo[campo]] ?? '').trim());
  const grupos = new Map();
  const problemas = [];
  const advertencias = [];
  const filasProblema = new Set();
  const r = { filas_leidas: 0, filas_vacias: 0, truncados: 0 };

  for (let i = filaEncabezado + 1; i < filas.length; i += 1) {
    const fila = filas[i];
    const n = i + 1; // número de fila tal como lo ve el usuario
    const campos = Object.keys(mapeo);
    if (campos.every((c) => celda(fila, c) === '')) { r.filas_vacias += 1; continue; }
    r.filas_leidas += 1;

    const nombre = celda(fila, 'servicio');
    if (!nombre) { problemas.push({ fila: n, texto: '', motivo: 'Falta el nombre del servicio' }); filasProblema.add(n); continue; }
    if (nombre.length > LIMITES.nombre) { problemas.push({ fila: n, texto: nombre.slice(0, 40), motivo: `El nombre del servicio supera ${LIMITES.nombre} caracteres` }); filasProblema.add(n); continue; }

    const k = claveServicio(nombre);
    const g = grupos.get(k) ?? { clave: k, nombre, campos: {}, enlaces: [], filas: [] };
    grupos.set(k, g);
    g.filas.push(n);

    for (const c of CAMPOS_TEXTO) {
      let v = celda(fila, c);
      if (!v) continue;
      if (v.length > LIMITES[c]) { v = v.slice(0, LIMITES[c]); r.truncados += 1; advertencias.push({ fila: n, texto: c, motivo: `Texto demasiado largo: se recortó a ${LIMITES[c]} caracteres` }); }
      if (g.campos[c] === undefined) g.campos[c] = v;
      else if (g.campos[c] !== v) advertencias.push({ fila: n, texto: `${nombre} · ${c}`, motivo: `Valor distinto al de la primera fila del servicio («${g.campos[c]}»); se conserva el primero` });
    }

    const refs = mapeo.enlace !== undefined ? partirReferencias(celda(fila, 'enlace')) : (celda(fila, 'origen') && celda(fila, 'destino') ? [`${celda(fila, 'origen')} → ${celda(fila, 'destino')}`] : []);
    if (mapeo.enlace === undefined && (celda(fila, 'origen') ? !celda(fila, 'destino') : celda(fila, 'destino'))) { problemas.push({ fila: n, texto: `${celda(fila, 'origen')} / ${celda(fila, 'destino')}`, motivo: 'Falta el origen o el destino' }); filasProblema.add(n); }
    for (const ref of refs) {
      const res = resolverReferencia(ref, indice);
      if (!res) continue;
      if (!res.ok) { problemas.push({ fila: n, texto: ref, motivo: res.motivo }); filasProblema.add(n); continue; }
      for (const l of res.enlaces) if (!g.enlaces.includes(String(l._id))) g.enlaces.push(String(l._id));
    }
  }

  const servicios = [];
  let nuevos = 0; let actualizados = 0; let sinCambios = 0; let asignNuevas = 0; let asignQuitadas = 0; let sinEnlaces = 0;
  for (const g of grupos.values()) {
    const ex = existentes.get(g.clave) ?? null;
    const previos = (ex?.enlaces ?? []).map(String);
    let finales;
    if (modo === 'reemplazar' && ex && g.enlaces.length > 0) finales = g.enlaces;
    else {
      finales = [...previos, ...g.enlaces.filter((id) => !previos.includes(id))];
      if (modo === 'reemplazar' && ex && g.enlaces.length === 0 && previos.length) advertencias.push({ fila: g.filas[0], texto: g.nombre, motivo: 'El archivo no trae enlaces válidos para este servicio: se conservan los que ya tiene' });
    }
    if (finales.length > LIMITES.enlaces) { problemas.push({ fila: g.filas[0], texto: g.nombre, motivo: `Un servicio admite hasta ${LIMITES.enlaces} enlaces: se tomaron los primeros` }); finales = finales.slice(0, LIMITES.enlaces); }
    const agregados = finales.filter((id) => !previos.includes(id)).length;
    const quitados = previos.filter((id) => !finales.includes(id)).length;
    const cambios = Object.entries(g.campos).filter(([c, v]) => !ex || String(ex[c] ?? '') !== v).map(([c]) => c);
    const accion = !ex ? 'crear' : (cambios.length || agregados || quitados ? 'actualizar' : 'sin_cambios');
    if (accion === 'crear') nuevos += 1; else if (accion === 'actualizar') actualizados += 1; else sinCambios += 1;
    asignNuevas += agregados; asignQuitadas += quitados;
    if (finales.length === 0) sinEnlaces += 1;
    servicios.push({ clave: g.clave, nombre: ex?.nombre ?? g.nombre, existente: ex?._id ?? null, accion, campos: g.campos, cambios_campos: cambios, enlaces_finales: finales, agregados, quitados, filas: g.filas, sin_enlaces: finales.length === 0 });
  }

  return {
    servicios, problemas, advertencias,
    resumen: { ...r, servicios: servicios.length, nuevos, actualizados, sin_cambios: sinCambios, asignaciones_nuevas: asignNuevas, asignaciones_quitadas: asignQuitadas, filas_con_problemas: filasProblema.size, sin_enlaces: sinEnlaces },
  };
}
