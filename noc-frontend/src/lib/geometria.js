/**
 * Trazado de una arista entre dos puntos. offset = 0 -> recta; offset != 0 -> curva cuadrática
 * cuyo punto medio se desplaza `offset` px en perpendicular (enlaces paralelos).
 */
export function trazadoEnlace(sx, sy, tx, ty, offset = 0) {
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  if (!offset) {
    return { path: `M ${sx} ${sy} L ${tx} ${ty}`, labelX: mx, labelY: my, p: { sx, sy, cx: mx, cy: my, tx, ty, recta: true } };
  }

  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  // el punto de control está al doble de distancia: el pico de la curva queda a `offset` px
  const cx = mx + nx * offset * 2;
  const cy = my + ny * offset * 2;
  return {
    path: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`,
    labelX: mx + nx * offset,
    labelY: my + ny * offset,
    p: { sx, sy, cx, cy, tx, ty, recta: false },
  };
}

/**
 * Trazado de UN filamento: el mismo trazado del enlace desplazado `d` px en perpendicular
 * (d > 0 a un lado, d < 0 al otro). Admite enlaces paralelos curvos (offsetEnlace != 0).
 */
export function trazadoFilamento(sx, sy, tx, ty, offsetEnlace, d) {
  const len = Math.hypot(tx - sx, ty - sy) || 1;
  const nx = -(ty - sy) / len;
  const ny = (tx - sx) / len;
  return trazadoEnlace(sx + nx * d, sy + ny * d, tx + nx * d, ty + ny * d, offsetEnlace);
}

/** Punto y ángulo (grados) de un trazado en t ∈ [0,1]; invertir = flecha en sentido contrario. */
export function puntoEnTrazado(p, t, invertir = false) {
  const u = 1 - t;
  const x = p.recta ? p.sx + (p.tx - p.sx) * t : u * u * p.sx + 2 * u * t * p.cx + t * t * p.tx;
  const y = p.recta ? p.sy + (p.ty - p.sy) * t : u * u * p.sy + 2 * u * t * p.cy + t * t * p.ty;
  const dx = p.recta ? p.tx - p.sx : 2 * u * (p.cx - p.sx) + 2 * t * (p.tx - p.cx);
  const dy = p.recta ? p.ty - p.sy : 2 * u * (p.cy - p.sy) + 2 * t * (p.ty - p.cy);
  return { x, y, ang: (Math.atan2(dy, dx) * 180) / Math.PI + (invertir ? 180 : 0) };
}

/**
 * Desplazamiento (px) con que se coloca una tarjeta de tamaño w×h junto al punto medio de un enlace sin
 * taparlo: perpendicular a la línea, preferentemente hacia arriba (o a la derecha en verticales).
 */
export function desplazamientoTarjeta(sx, sy, tx, ty, w, h, margen = 14) {
  const len = Math.hypot(tx - sx, ty - sy) || 1;
  let nx = -(ty - sy) / len;
  let ny = (tx - sx) / len;
  if (ny > 0.0001 || (Math.abs(ny) <= 0.0001 && nx < 0)) { nx = -nx; ny = -ny; }
  const dist = Math.abs(nx) * (w / 2) + Math.abs(ny) * (h / 2) + margen;
  return { x: nx * dist, y: ny * dist };
}
