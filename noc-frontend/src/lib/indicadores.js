/** Utilidades puras del dashboard de indicadores (uptime, MTTR, objetivos). */

export const OBJETIVOS = [99, 99.5, 99.9, 99.95, 99.99];

/** 99.987 -> "99,987 %" (3 decimales: a 99,9 % una hora de caída ya se nota) */
export const fmtPct = (n) => (n == null ? '—' : `${n.toFixed(3).replace('.', ',')} %`);
export const fmtPctCorto = (n) => (n == null ? '—' : `${n.toFixed(2).replace('.', ',')} %`);

/** "2026-10" -> { year: 2026, month: 10 } */
export function leerMes(valor) {
  const m = /^(\d{4})-(\d{2})$/.exec(valor ?? '');
  return m ? { year: Number(m[1]), month: Number(m[2]) } : null;
}
export const mesComoTexto = ({ year, month }) => `${year}-${String(month).padStart(2, '0')}`;

/** Los `n` meses que terminan en `hasta` (inclusive), del más antiguo al más reciente. */
export function ultimosMeses(hasta, n = 6) {
  const out = [];
  let { year, month } = hasta;
  for (let i = 0; i < n; i++) {
    out.unshift({ year, month });
    month -= 1;
    if (month === 0) { month = 12; year -= 1; }
  }
  return out;
}

const NOMBRES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const etiquetaMes = ({ year, month }) => `${NOMBRES[month - 1]} ${String(year).slice(2)}`;

/** Uptime promedio (media aritmética de los enlaces con tiempo medido, igual que el backend). */
export function promedioUptime(filas) {
  const validas = filas.filter((f) => f.total_minutos > 0);
  if (!validas.length) return null;
  return Math.round((validas.reduce((a, f) => a + f.uptime_pct, 0) / validas.length) * 1000) / 1000;
}

/**
 * Filtra las filas de métricas por tipo de línea y/o zonal usando el mapa de enlaces del store
 * (las métricas del servidor no traen esa información).
 */
export function filtrarFilas(filas, enlaces, { tipo = '', zonal = '' } = {}) {
  if (!tipo && !zonal) return filas;
  return filas.filter((f) => {
    const l = enlaces[f.enlace];
    if (!l) return false;
    if (tipo && l.tipo?.clave !== tipo) return false;
    if (zonal && !l.tramos.some((t) => t.zonal._id === zonal)) return false;
    return true;
  });
}

export const estaBajoObjetivo = (fila, objetivo) => fila.total_minutos > 0 && fila.uptime_pct < objetivo;

/** Resumen para las tarjetas. */
export function resumenFilas(filas, objetivo) {
  const medidas = filas.filter((f) => f.total_minutos > 0);
  return {
    enlaces: filas.length,
    uptimePromedio: promedioUptime(filas),
    bajoObjetivo: medidas.filter((f) => estaBajoObjetivo(f, objetivo)).length,
    minutosFalla: Math.round(filas.reduce((a, f) => a + f.minutos_falla, 0) * 100) / 100,
    sinFallas: medidas.filter((f) => f.minutos_falla === 0).length,
  };
}

/** Peores N enlaces por minutos de falla (los de 0 no aparecen). */
export function peoresEnlaces(filas, n = 15) {
  return [...filas].filter((f) => f.minutos_falla > 0).sort((a, b) => b.minutos_falla - a.minutos_falla || a.uptime_pct - b.uptime_pct).slice(0, n);
}

/** Uptime y minutos de falla promedio por tipo de línea. Los enlaces sin tipo van aparte. */
export function agregarPorTipo(filas, enlaces) {
  const grupos = new Map();
  for (const f of filas) {
    const l = enlaces[f.enlace];
    const clave = l?.tipo?.clave ?? '_SIN_TIPO';
    if (!grupos.has(clave)) grupos.set(clave, { clave, nombre: l?.tipo?.nombre ?? 'Sin clasificar', color: l?.tipo?.color ?? '#8296ab', filas: [] });
    grupos.get(clave).filas.push(f);
  }
  return [...grupos.values()]
    .map((g) => ({ clave: g.clave, nombre: g.nombre, color: g.color, enlaces: g.filas.length, uptime: promedioUptime(g.filas), minutosFalla: Math.round(g.filas.reduce((a, f) => a + f.minutos_falla, 0) * 100) / 100 }))
    .sort((a, b) => b.enlaces - a.enlaces);
}

/**
 * Ordena filas de la tabla. `columna`: id_enlace | uptime_pct | minutos_falla | incidentes | mttr_minutos.
 * Los valores nulos (p. ej. MTTR sin incidencias cerradas) siempre van al final.
 */
export function ordenarFilas(filas, columna, direccion = 'asc') {
  const signo = direccion === 'asc' ? 1 : -1;
  return [...filas].sort((a, b) => {
    const x = a[columna], y = b[columna];
    if (x == null && y == null) return 0;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
    return c * signo || a.id_enlace.localeCompare(b.id_enlace);
  });
}

/**
 * Indicadores de las incidencias del período. Una incidencia "pertenece" al mes en que COMENZÓ; MTTR = media de la
 * duración de las cerradas. `severidades` sigue la opción "incluir degradados".
 */
export function resumenIncidencias(incidencias, { desde, hasta, incluirDegradado = false }) {
  const t0 = new Date(desde).getTime(), t1 = new Date(hasta).getTime();
  const severidades = incluirDegradado ? ['Caido', 'Degradado'] : ['Caido'];
  const delMes = incidencias.filter((i) => severidades.includes(i.severidad) && new Date(i.inicio).getTime() >= t0 && new Date(i.inicio).getTime() < t1);
  const cerradas = delMes.filter((i) => !i.abierta && i.duracion_minutos != null);
  return {
    total: delMes.length,
    abiertas: delMes.filter((i) => i.abierta).length,
    cerradas: cerradas.length,
    mttr: cerradas.length ? Math.round((cerradas.reduce((a, i) => a + i.duracion_minutos, 0) / cerradas.length) * 100) / 100 : null,
    sinCausa: cerradas.filter((i) => !i.causa_raiz?.trim()).length,
    lista: [...delMes].sort((a, b) => new Date(b.inicio) - new Date(a.inicio)),
  };
}

/** Mismo filtro por tipo de línea / zonal, aplicado a incidencias (cada una trae su enlace poblado). */
export function filtrarIncidencias(incidencias, enlaces, { tipo = '', zonal = '' } = {}) {
  if (!tipo && !zonal) return incidencias;
  return incidencias.filter((i) => {
    const l = enlaces[i.enlace?._id];
    if (!l) return false;
    if (tipo && l.tipo?.clave !== tipo) return false;
    if (zonal && !l.tramos.some((t) => t.zonal._id === zonal)) return false;
    return true;
  });
}

/**
 * Incidencias agrupadas por tipificación de la alarma que las originó. `lista` = incidencias ya filtradas del período.
 * Las que no tienen tipificación van aparte ("Sin tipificar"): son trabajo pendiente de clasificar.
 */
export function resumenPorTipificacion(lista) {
  const grupos = new Map();
  for (const i of lista) {
    const clave = i.tipificacion?.codigo ?? '_SIN_TIPIFICAR';
    if (!grupos.has(clave)) grupos.set(clave, { codigo: i.tipificacion?.codigo ?? null, nombre: i.tipificacion?.nombre ?? 'Sin tipificar', incidencias: 0, cerradas: 0, minutos: 0 });
    const g = grupos.get(clave);
    g.incidencias += 1;
    if (!i.abierta && i.duracion_minutos != null) { g.cerradas += 1; g.minutos += i.duracion_minutos; }
  }
  return [...grupos.values()]
    .map((g) => ({ ...g, minutos: Math.round(g.minutos * 100) / 100, mttr: g.cerradas ? Math.round((g.minutos / g.cerradas) * 100) / 100 : null }))
    .sort((a, b) => b.incidencias - a.incidencias || a.nombre.localeCompare(b.nombre));
}
