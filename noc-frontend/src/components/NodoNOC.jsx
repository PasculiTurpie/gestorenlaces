import { Handle, Position } from '@xyflow/react';
import { Network, Router, Server } from 'lucide-react';
import { memo } from 'react';
import { ESTADO_META } from '../lib/estados.js';
import { cn } from '../lib/format.js';

// Amplificador óptico: triángulo, como se dibuja en el NMS
const IconoOLA = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M4 4.5 21 12 4 19.5z" />
  </svg>
);

const ICONOS = { ESTACION: Server, OLA: IconoOLA, IBTP: Network, NE: Router };

function NodoNOC({ data, selected }) {
  const { id_nodo, nombre, tipo, status } = data;
  const meta = ESTADO_META[status] ?? ESTADO_META.OK;
  const esEstacion = tipo === 'ESTACION';
  const Icono = ICONOS[tipo] ?? Server;
  const sano = status === 'OK';

  return (
    <div className="relative" title={`${id_nodo} · ${nombre} · ${tipo} · ${meta.label}`}>
      <div
        className={cn(
          'flex items-center justify-center rounded-md border bg-noc-panel',
          esEstacion ? 'h-9 w-9' : 'h-7 w-7',
          status === 'Caido' && 'nodo-caido',
          selected && 'ring-2 ring-noc-focus',
        )}
        style={{
          borderColor: sano ? '#2b4a3a' : meta.color,
          color: sano ? '#4ade80' : meta.color,
          borderWidth: sano ? 1 : 2,
          boxShadow: status === 'Degradado' ? `0 0 10px ${meta.color}66` : undefined,
        }}
      >
        <Icono size={esEstacion ? 18 : 15} strokeWidth={2} />
        {/* anclas invisibles de las aristas (una de entrada y otra de salida, ambas en el centro) */}
        <Handle id="t" type="target" position={Position.Top} className="node-handle" />
        <Handle id="s" type="source" position={Position.Top} className="node-handle" />
      </div>
      <span className="nodo-etiqueta pointer-events-none absolute left-1/2 top-full mt-0.5 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] leading-none text-noc-muted">
        {id_nodo}
      </span>
    </div>
  );
}

export default memo(NodoNOC);
