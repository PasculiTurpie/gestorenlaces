const EPS = 1e-6;

/** Los km se guardan con 3 decimales (metros) para evitar ruido de coma flotante (45.1 + 0.2). */
export const redondearKm = (n) => Math.round(n * 1000) / 1000;

export const ordenarTramos = (tramos) => [...tramos].sort((a, b) => a.km_desde - b.km_desde || a.km_hasta - b.km_hasta);

/**
 * Reglas de los tramos por zonal de un enlace (km medidos desde el nodo origen, km 0, hacia el destino):
 *  - cada tramo termina después de empezar;
 *  - no se solapan (pueden quedar huecos sin asignar);
 *  - si el enlace tiene longitud, ningún tramo la excede.
 * Devuelve la lista de errores (vacía = válido).
 */
export function validarTramos(tramos, longitud = null) {
  const errores = [];
  const ordenados = ordenarTramos(tramos);

  ordenados.forEach((t, i) => {
    if (!(t.km_hasta > t.km_desde + EPS)) {
      errores.push(`Tramo ${i + 1}: el km final (${t.km_hasta}) debe ser mayor que el km inicial (${t.km_desde})`);
    }
    if (i > 0 && t.km_desde < ordenados[i - 1].km_hasta - EPS) {
      errores.push(`Los tramos ${i} y ${i + 1} se solapan entre el km ${t.km_desde} y el km ${ordenados[i - 1].km_hasta}`);
    }
  });

  const fin = Math.max(0, ...ordenados.map((t) => t.km_hasta));
  if (longitud != null && ordenados.length && fin > longitud + EPS) {
    errores.push(`Hay tramos que terminan en el km ${fin}, más allá de la longitud del enlace (${longitud} km)`);
  }
  return errores;
}
