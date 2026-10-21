import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useNow } from '../../hooks/useNow.js';
import { cn } from '../../lib/format.js';
import { nombresEnlaces, situacion, ventanaTexto } from '../../lib/mantenimientos.js';
import { Insignia } from '../admin/ui.jsx';

const COLOR = { info: '#60a5fa', curso: '#38bdf8', warn: '#f97316', muted: '#8296ab' };

export function SituacionBadge({ m }) {
  const s = situacion(m, useNow());
  return <Insignia color={COLOR[s.nivel]}>{s.etiqueta}</Insignia>;
}

/** Lista compacta de mantenimientos (barra lateral y cambio de turno). */
export default function ListaMantenimientos({ lista, compacto = false }) {
  return (
    <ul className="divide-y divide-noc-line">
      {lista.map((m) => (
        <li key={m._id} className={cn('px-4', compacto ? 'py-2' : 'py-3')}>
          <div className="flex items-start justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium"><Wrench size={13} className="shrink-0 text-sky-400" aria-hidden="true" /><span className="truncate">{m.titulo}</span></span>
            <SituacionBadge m={m} />
          </div>
          <p className="mt-0.5 text-xs tabular-nums text-noc-muted">{ventanaTexto(m)}{m.con_corte && <span className="ml-1.5 text-orange-300">· con corte</span>}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-noc-muted">{nombresEnlaces(m)}{m.ticket ? ` · ${m.ticket}` : ''}</p>
        </li>
      ))}
    </ul>
  );
}

/** Bloque con título para el cambio de turno: lo que se está trabajando o se va a trabajar. */
export function BloqueMantenimientos({ lista, titulo = 'Mantenimientos en curso y próximos', className }) {
  if (!lista.length) return null;
  return (
    <section aria-label={titulo} className={cn('rounded-lg border border-noc-line bg-noc-panel', className)}>
      <h2 className="flex items-center justify-between gap-3 border-b border-noc-line px-4 py-2.5 text-sm font-semibold">
        <span>{titulo} <span className="ml-1 font-normal text-noc-muted">{lista.length}</span></span>
        <Link to="/mantenimientos" className="text-xs font-normal text-noc-focus hover:underline">Ver todos</Link>
      </h2>
      <ListaMantenimientos lista={lista} />
    </section>
  );
}
