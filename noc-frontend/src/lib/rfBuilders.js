import { ESTADO_META } from './estados.js';

/**
 * Construye los nodos de React Flow a partir del store. Conserva la posición de los nodos que
 * se están arrastrando en este momento (para que un evento remoto no los "teletransporte").
 */
export function construirNodos({ nodos, estados, nodoSel, puedeMover, previos = [] }) {
  const prev = new Map(previos.map((n) => [n.id, n]));
  return Object.values(nodos).map((n) => {
    const p = prev.get(n.id_nodo);
    return {
      id: n.id_nodo,
      type: 'nodo',
      position: p?.dragging ? p.position : { x: n.posicion.x, y: n.posicion.y },
      dragging: p?.dragging,
      selected: n.id_nodo === nodoSel,
      draggable: puedeMover,
      data: { id_nodo: n.id_nodo, nombre: n.nombre, tipo: n.tipo, status: estados[n.id_nodo] ?? 'OK' },
    };
  });
}

export function construirAristas({ enlaces, nodos, offsets, enlaceSel, ocultarOK, expandidos = {}, tipoFiltro = null }) {
  return Object.values(enlaces)
    .filter((l) => nodos[l.origen] && nodos[l.destino] && !(ocultarOK && l.estado === 'OK'))
    .filter((l) => !tipoFiltro || l.tipo?.clave === tipoFiltro)
    .map((l) => ({
      id: l._id,
      type: 'enlace',
      source: l.origen,
      target: l.destino,
      sourceHandle: 's',
      targetHandle: 't',
      zIndex: (ESTADO_META[l.estado]?.peso ?? 0) * 10, // las fallas se dibujan encima de las aristas OK
      selected: l._id === enlaceSel,
      data: {
        estado: l.estado,
        id_enlace: l.id_enlace,
        offset: offsets[l._id] ?? 0,
        expandido: Boolean(expandidos[l._id]),
        tipo: l.tipo,
        filamentos: l.filamentos,
      },
    }));
}
