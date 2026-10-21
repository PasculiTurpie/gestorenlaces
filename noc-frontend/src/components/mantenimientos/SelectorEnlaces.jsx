import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTopology } from '../../store/topologyStore.js';
import EstadoBadge from '../EstadoBadge.jsx';
import { entrada } from '../admin/ui.jsx';

/** Busca enlaces por su código o por los nodos que une, y los va agregando como etiquetas. */
export default function SelectorEnlaces({ seleccion, onChange, deshabilitado = false, id = 'm-enlaces' }) {
  const enlaces = useTopology((s) => s.enlaces);
  const [q, setQ] = useState('');
  const elegidos = useMemo(() => seleccion.map((i) => enlaces[i]).filter(Boolean), [seleccion, enlaces]);
  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return Object.values(enlaces)
      .filter((l) => !seleccion.includes(l._id) && `${l.id_enlace} ${l.origen ?? ''} ${l.destino ?? ''}`.toLowerCase().includes(t))
      .sort((a, b) => a.id_enlace.localeCompare(b.id_enlace))
      .slice(0, 8);
  }, [q, enlaces, seleccion]);

  return (
    <div>
      {elegidos.length > 0 && (
        <ul aria-label="Enlaces del mantenimiento" className="mb-2 flex flex-wrap gap-1.5">
          {elegidos.map((l) => (
            <li key={l._id} className="flex items-center gap-1.5 rounded-md border border-noc-line bg-noc-raised py-0.5 pl-2 pr-1 text-xs">
              <span className="font-mono">{l.id_enlace}</span>
              {l.estado !== 'OK' && <EstadoBadge estado={l.estado} />}
              {!deshabilitado && <button type="button" onClick={() => onChange(seleccion.filter((i) => i !== l._id))} aria-label={`Quitar ${l.id_enlace}`} className="rounded p-0.5 text-noc-muted hover:bg-noc-line hover:text-noc-text"><X size={12} /></button>}
            </li>
          ))}
        </ul>
      )}
      {!deshabilitado && (
        <>
          <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código de enlace o nodo (mín. 2 letras)…" autoComplete="off" className={entrada} />
          {q.trim().length >= 2 && (
            <ul aria-label="Resultados" className="mt-1 max-h-44 overflow-auto rounded-md border border-noc-line">
              {resultados.length === 0 && <li className="px-3 py-2 text-sm text-noc-muted">Ningún enlace coincide.</li>}
              {resultados.map((l) => (
                <li key={l._id}>
                  <button type="button" onClick={() => { onChange([...seleccion, l._id]); setQ(''); }} className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-noc-raised">
                    <span><span className="font-mono text-xs">{l.id_enlace}</span> <span className="text-xs text-noc-muted">{l.origen} ⇄ {l.destino}</span></span>
                    {l.estado !== 'OK' && <EstadoBadge estado={l.estado} />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
