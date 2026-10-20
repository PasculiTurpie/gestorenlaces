import { ESTADO_META } from './estados.js';

const peso = (estado) => ESTADO_META[estado]?.peso ?? 0;

/** { id_nodo: peor estado entre los enlaces que lo tocan } (nodos sin enlaces quedan fuera => OK) */
export function estadoPorNodo(enlaces) {
  const out = {};
  for (const l of Object.values(enlaces)) {
    for (const n of [l.origen, l.destino]) {
      if (!n) continue;
      const actual = out[n] ?? 'OK';
      out[n] = peso(l.estado) > peso(actual) ? l.estado : actual;
    }
  }
  return out;
}

export function contarPorEstado(enlaces) {
  const c = { OK: 0, Degradado: 0, Caido: 0, Mantenimiento: 0 };
  for (const l of Object.values(enlaces)) c[l.estado] = (c[l.estado] ?? 0) + 1;
  return c;
}

/** Enlaces != OK: primero los más severos y, a igual severidad, los más antiguos (llevan más tiempo en falla). */
export function alarmas(enlaces) {
  return Object.values(enlaces)
    .filter((l) => l.estado !== 'OK')
    .sort((a, b) => peso(b.estado) - peso(a.estado) || new Date(a.estado_desde) - new Date(b.estado_desde));
}

export function enlacesDeNodo(enlaces, idNodo) {
  return Object.values(enlaces)
    .filter((l) => l.origen === idNodo || l.destino === idNodo)
    .sort((a, b) => a.id_enlace.localeCompare(b.id_enlace));
}

/**
 * Separación de enlaces paralelos (misma pareja de nodos) para que no se dibujen encimados.
 * Devuelve { enlaceId: offset }; un enlace único tiene offset 0.
 */
export function offsetsParalelos(enlaces, paso = 26) {
  const grupos = new Map();
  for (const l of Object.values(enlaces)) {
    if (!l.origen || !l.destino) continue;
    const clave = [l.origen, l.destino].sort().join('|');
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(l);
  }
  const out = {};
  for (const lista of grupos.values()) {
    lista.sort((a, b) => a.id_enlace.localeCompare(b.id_enlace));
    lista.forEach((l, i) => {
      // el signo depende del sentido para que la curva quede del mismo lado en ambos sentidos
      const sentido = l.origen <= l.destino ? 1 : -1;
      out[l._id] = (i - (lista.length - 1) / 2) * paso * sentido;
    });
  }
  return out;
}

export function buscarNodos(nodos, texto, max = 8) {
  const q = texto.trim().toLowerCase();
  if (!q) return [];
  return Object.values(nodos)
    .filter((n) => n.id_nodo.toLowerCase().includes(q) || n.nombre.toLowerCase().includes(q))
    .sort((a, b) => {
      const ap = a.id_nodo.toLowerCase().startsWith(q) ? 0 : 1;
      const bp = b.id_nodo.toLowerCase().startsWith(q) ? 0 : 1;
      return ap - bp || a.id_nodo.localeCompare(b.id_nodo);
    })
    .slice(0, max);
}

/** { id_nodo: nº de enlaces que lo tocan } */
export function contarEnlacesPorNodo(enlaces) {
  const c = {};
  for (const l of Object.values(enlaces)) for (const n of [l.origen, l.destino]) if (n) c[n] = (c[n] ?? 0) + 1;
  return c;
}

/** Estado del levantamiento de un enlace: 'completo' (ambos filamentos con Tx y Rx), 'parcial' o 'sin'. */
export function estadoLevantamiento(enlace) {
  const completos = enlace.filamentos.filter((f) => f.levantamiento.completo).length;
  const algo = enlace.filamentos.some((f) => f.levantamiento.tx != null || f.levantamiento.rx != null);
  return completos === 2 ? 'completo' : algo ? 'parcial' : 'sin';
}
