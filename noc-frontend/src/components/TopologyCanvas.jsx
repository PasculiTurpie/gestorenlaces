import { Background, Controls, MiniMap, Panel, ReactFlow, applyNodeChanges, useStore } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ESTADO_META, puedeMoverNodos } from '../lib/estados.js';
import { construirAristas, construirNodos } from '../lib/rfBuilders.js';
import { estadoPorNodo, offsetsParalelos } from '../lib/selectors.js';
import { useAuth } from '../store/authStore.js';
import { useTopology } from '../store/topologyStore.js';
import EnlaceNOC from './EnlaceNOC.jsx';
import NodoNOC from './NodoNOC.jsx';

// Definidos fuera del componente: React Flow exige referencias estables
const nodeTypes = { nodo: NodoNOC };
const edgeTypes = { enlace: EnlaceNOC };

const LEYENDA = [
  { estado: 'OK', texto: 'OK', estilo: { borderTop: '2px solid #22c55e' } },
  { estado: 'Degradado', texto: 'Degradado', estilo: { borderTop: '3px solid #f97316' } },
  { estado: 'Caido', texto: 'Caído', estilo: { borderTop: '3px dashed #ef4444' } },
  { estado: 'Mantenimiento', texto: 'Mantenimiento', estilo: { borderTop: '3px dotted #3b82f6' } },
];

export default function TopologyCanvas() {
  const nodos = useTopology((s) => s.nodos);
  const enlaces = useTopology((s) => s.enlaces);
  const ocultarOK = useTopology((s) => s.filtros.ocultarOK);
  const enlaceSel = useTopology((s) => s.seleccion.enlaceId);
  const nodoSel = useTopology((s) => s.seleccion.nodoId);
  const expandidos = useTopology((s) => s.expandidos);
  const tipoFiltro = useTopology((s) => s.filtros.tipo);
  const tipos = useTopology((s) => s.tipos);
  const { seleccionarEnlace, seleccionarNodo, moverNodo } = useTopology.getState();

  const rol = useAuth((s) => s.user?.rol);
  const puedeMover = puedeMoverNodos(rol);

  const estados = useMemo(() => estadoPorNodo(enlaces), [enlaces]);
  const offsets = useMemo(() => offsetsParalelos(enlaces), [enlaces]);

  // Estado local de React Flow (necesario para arrastrar con fluidez). Se inicializa ya con los nodos
  // para que `fitView` encuadre toda la red en el primer render.
  const [rfNodes, setRfNodes] = useState(() => construirNodos({ nodos, estados, nodoSel, puedeMover }));
  useEffect(() => {
    setRfNodes((previos) => construirNodos({ nodos, estados, nodoSel, puedeMover, previos }));
  }, [nodos, estados, nodoSel, puedeMover]);

  const rfAristas = useMemo(
    () => construirAristas({ enlaces, nodos, offsets, enlaceSel, ocultarOK, expandidos, tipoFiltro }),
    [enlaces, nodos, offsets, enlaceSel, ocultarOK, expandidos, tipoFiltro],
  );

  const onNodesChange = useCallback((cambios) => setRfNodes((n) => applyNodeChanges(cambios, n)), []);

  // Se guarda UNA vez, al soltar el nodo (no en cada movimiento del arrastre)
  const onNodeDragStop = useCallback(
    (_e, nodo) => {
      if (puedeMover) moverNodo(nodo.id, { x: Math.round(nodo.position.x), y: Math.round(nodo.position.y) });
    },
    [puedeMover, moverNodo],
  );

  const alejado = useStore((s) => s.transform[2] < 0.55); // solo cambia al cruzar el umbral
  const colorMini = useCallback((n) => (n.data?.status === 'OK' ? '#2b6a47' : ESTADO_META[n.data?.status]?.color), []);

  return (
    <div className={`h-full w-full ${alejado ? 'etiquetas-ocultas' : ''}`}>
      <ReactFlow
        nodes={rfNodes}
        edges={rfAristas}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_e, n) => seleccionarNodo(n.id)}
        onEdgeClick={(_e, e) => seleccionarEnlace(e.id)}
        onPaneClick={() => seleccionarNodo(null)}
        nodeOrigin={[0.5, 0.5]}
        nodesConnectable={false}
        deleteKeyCode={null}
        colorMode="dark"
        minZoom={0.15}
        maxZoom={2.5}
        fitView
        fitViewOptions={{ padding: 0.06 }}
      >
        <Background gap={28} size={1} color="#1a2635" />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap pannable zoomable nodeColor={colorMini} nodeStrokeWidth={0} position="bottom-right" />

        <Panel position="top-left">
          <div className="flex items-center gap-3 rounded-md border border-noc-line bg-noc-panel/90 px-2.5 py-1.5 text-xs text-noc-muted backdrop-blur">
            {LEYENDA.map((l) => (
              <span key={l.estado} className="flex items-center gap-1.5">
                <span className="inline-block w-5" style={l.estilo} />
                {l.texto}
              </span>
            ))}
            <label className="flex items-center gap-1.5 border-l border-noc-line pl-3">
              Línea
              <select
                value={tipoFiltro ?? ''}
                onChange={(e) => useTopology.getState().setFiltro('tipo', e.target.value || null)}
                className="rounded border border-noc-line bg-noc-bg px-1.5 py-0.5 text-xs text-noc-text"
              >
                <option value="">Todas</option>
                {tipos.filter((t) => t.activo || t.clave === tipoFiltro).map((t) => <option key={t.clave} value={t.clave}>{t.nombre}</option>)}
              </select>
            </label>
            {!puedeMover && <span className="border-l border-noc-line pl-3">Disposición de solo lectura</span>}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
