import { leerNumero } from './levantamiento.js';

const EPS = 1e-6;
const redondear = (n) => Math.round(n * 1000) / 1000;

/** "45 km" / "45,5 km" / "—" */
export const fmtKm = (n) => (n == null ? '—' : `${String(redondear(n)).replace('.', ',')} km`);

/** Rango "0–45 km" */
export const fmtRango = (desde, hasta) => `${String(redondear(desde)).replace('.', ',')}–${fmtKm(hasta)}`;

const ordenar = (t) => [...t].sort((a, b) => a.km_desde - b.km_desde || a.km_hasta - b.km_hasta);

/**
 * Convierte las filas del formulario ({ zonal, desde, hasta } como texto) en tramos válidos y
 * lista los problemas. `errores` impiden guardar; `avisos` solo informan (p. ej. kilómetros sin asignar).
 */
export function analizarTramos(filas, longitudTexto) {
  const errores = [];
  const avisos = [];

  const longitud = leerNumero(longitudTexto);
  if (Number.isNaN(longitud)) errores.push('La longitud total debe ser un número (ej. 100 o 45,5).');
  else if (longitud != null && longitud <= 0) errores.push('La longitud total debe ser mayor a 0.');
  const largo = Number.isNaN(longitud) ? null : longitud;

  const tramos = [];
  filas.forEach((f, i) => {
    const n = i + 1;
    const desde = leerNumero(f.desde);
    const hasta = leerNumero(f.hasta);
    if (!f.zonal) errores.push(`Tramo ${n}: elija una zonal.`);
    if (desde == null || hasta == null || Number.isNaN(desde) || Number.isNaN(hasta)) {
      errores.push(`Tramo ${n}: indique el km inicial y el km final como números.`);
      return;
    }
    if (desde < 0 || hasta < 0) errores.push(`Tramo ${n}: los kilómetros no pueden ser negativos.`);
    else if (hasta <= desde + EPS) errores.push(`Tramo ${n}: el km final debe ser mayor que el km inicial.`);
    else tramos.push({ zonal: f.zonal, km_desde: redondear(desde), km_hasta: redondear(hasta) });
  });

  const ordenados = ordenar(tramos);
  ordenados.forEach((t, i) => {
    if (i > 0 && t.km_desde < ordenados[i - 1].km_hasta - EPS) {
      errores.push(`Hay tramos que se solapan entre el km ${t.km_desde} y el km ${ordenados[i - 1].km_hasta}.`);
    }
  });
  const fin = Math.max(0, ...ordenados.map((t) => t.km_hasta));
  if (largo != null && fin > largo + EPS) errores.push(`Hay tramos que terminan en el km ${fin}, más allá de la longitud del enlace (${largo} km).`);

  if (!errores.length && ordenados.length) {
    if (largo == null) avisos.push('Indique la longitud total para controlar que el reparto cubra todo el enlace.');
    for (const h of huecos(ordenados, largo ?? fin)) avisos.push(`Sin asignar: km ${String(h.desde).replace('.', ',')} a ${String(h.hasta).replace('.', ',')} (${fmtKm(redondear(h.hasta - h.desde))}).`);
  }

  return { errores, avisos, longitud: largo, tramos: errores.length ? null : ordenados };
}

/** Intervalos del enlace [0, total] que ningún tramo cubre. Los tramos deben venir ordenados y sin solapes. */
export function huecos(tramos, total) {
  const out = [];
  let cursor = 0;
  for (const t of tramos) {
    if (t.km_desde > cursor + EPS) out.push({ desde: redondear(cursor), hasta: redondear(t.km_desde) });
    cursor = Math.max(cursor, t.km_hasta);
  }
  if (total > cursor + EPS) out.push({ desde: redondear(cursor), hasta: redondear(total) });
  return out;
}

/**
 * Segmentos para dibujar la barra proporcional del enlace (km 0 a la izquierda): tramos y huecos con su
 * posición y ancho en %. `zonales` = lista del catálogo para resolver nombre y color.
 */
export function segmentosBarra(tramos, longitud, zonales = []) {
  const ordenados = ordenar(tramos);
  const total = longitud ?? Math.max(0, ...ordenados.map((t) => t.km_hasta));
  if (!(total > 0)) return [];
  const pos = (desde, hasta) => ({ izq: (desde / total) * 100, ancho: ((hasta - desde) / total) * 100 });
  const porId = new Map(zonales.map((z) => [z._id, z]));
  const segmentos = [];
  let cursor = 0;
  for (const t of ordenados) {
    if (t.km_desde > cursor + EPS) segmentos.push({ tipo: 'hueco', desde: cursor, hasta: t.km_desde, ...pos(cursor, t.km_desde) });
    const z = porId.get(t.zonal) ?? (typeof t.zonal === 'object' ? t.zonal : null);
    segmentos.push({ tipo: 'tramo', zonal: z, desde: t.km_desde, hasta: t.km_hasta, ...pos(t.km_desde, t.km_hasta) });
    cursor = Math.max(cursor, t.km_hasta);
  }
  if (total > cursor + EPS) segmentos.push({ tipo: 'hueco', desde: cursor, hasta: total, ...pos(cursor, total) });
  return segmentos;
}

/** Zonales distintas de un enlace (ya normalizado), en orden de aparición a lo largo del enlace. */
export function zonalesDeEnlace(enlace) {
  const vistas = new Map();
  for (const t of enlace.tramos) if (t.zonal && !vistas.has(t.zonal._id)) vistas.set(t.zonal._id, t.zonal);
  return [...vistas.values()];
}

/** Filas del formulario a partir de los tramos guardados */
export const filasDesdeTramos = (tramos) => tramos.map((t) => ({ zonal: t.zonal?._id ?? '', desde: String(t.km_desde), hasta: String(t.km_hasta) }));
