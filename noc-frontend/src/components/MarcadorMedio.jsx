import { Minus, Plus } from 'lucide-react';

/**
 * El "+" del punto medio de cada enlace (como en el NMS): despliega/pliega sus dos filamentos.
 * Los enlaces de otra telco llevan el color de su tipo para distinguirlos de la red propia.
 */
export default function MarcadorMedio({ x, y, expandido, tipo, idEnlace, onToggle, parcial = null }) {
  const ajeno = tipo && !tipo.propio;
  const color = ajeno ? tipo.color : '#5b7088';

  return (
    <button
      type="button"
      aria-expanded={expandido}
      aria-label={`${expandido ? 'Plegar' : 'Desplegar'} los filamentos de ${idEnlace}`}
      title={`${idEnlace}${ajeno ? ` · ${tipo.nombre}` : ''}${parcial ? ` · alarma solo en la ${parcial.sentido}` : ''}`}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="nodrag nopan flex h-4 w-4 items-center justify-center rounded-[3px] border bg-noc-panel text-noc-text hover:brightness-125"
      style={{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        pointerEvents: 'all',
        borderColor: color,
        background: ajeno ? `${color}38` : undefined,
        color: ajeno ? color : undefined,
      }}
    >
      {expandido ? <Minus size={10} strokeWidth={3} /> : <Plus size={10} strokeWidth={3} />}
      {/* alarma en un solo filamento: punto del color de su estado (el detalle está al desplegar) */}
      {parcial && <span aria-hidden="true" className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-noc-bg" style={{ background: parcial.color }} />}
    </button>
  );
}
