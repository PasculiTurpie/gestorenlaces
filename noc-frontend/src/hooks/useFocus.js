import { useReactFlow } from '@xyflow/react';
import { useMemo } from 'react';
import { useTopology } from '../store/topologyStore.js';

const MEDIO_NODO = 22; // los nodos se posicionan por su centro; este margen cubre el icono y su etiqueta

/**
 * Mueve la cámara del canvas hacia un nodo o un enlace. Debe usarse dentro de <ReactFlowProvider>.
 * Usa las coordenadas del store (centro de cada nodo) con setCenter/fitBounds, que son explícitos y no dependen
 * de que React Flow haya medido los nodos (fitView con una lista de nodos no movía la cámara).
 */
export function useFocus() {
  const rf = useReactFlow();
  return useMemo(
    () => ({
      nodo: (id) => {
        const n = useTopology.getState().nodos[id];
        if (n) rf.setCenter(n.posicion.x, n.posicion.y, { zoom: 1.5, duration: 500 });
      },
      enlace: (l) => {
        const { nodos } = useTopology.getState();
        const a = nodos[l.origen], b = nodos[l.destino];
        if (!a || !b) return;
        const x = Math.min(a.posicion.x, b.posicion.x) - MEDIO_NODO;
        const y = Math.min(a.posicion.y, b.posicion.y) - MEDIO_NODO;
        rf.fitBounds(
          { x, y, width: Math.abs(a.posicion.x - b.posicion.x) + 2 * MEDIO_NODO, height: Math.abs(a.posicion.y - b.posicion.y) + 2 * MEDIO_NODO },
          { padding: 0.35, duration: 600, maxZoom: 1.6 },
        );
      },
    }),
    [rf],
  );
}
