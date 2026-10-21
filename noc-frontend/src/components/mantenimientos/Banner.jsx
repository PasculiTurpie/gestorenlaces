import { Wrench } from 'lucide-react';
import { useMemo } from 'react';
import { useNow } from '../../hooks/useNow.js';
import { porEnlace, situacion, ventanaTexto } from '../../lib/mantenimientos.js';
import { useTopology } from '../../store/topologyStore.js';

/** Aviso dentro del enlace: se está trabajando (o se va a trabajar) en él. */
export default function BannerMantenimiento({ enlaceId }) {
  const lista = useTopology((s) => s.mantenimientos);
  const ahora = useNow();
  const propios = useMemo(() => porEnlace(lista)[enlaceId] ?? [], [lista, enlaceId]);
  if (!propios.length) return null;
  return (
    <section aria-label="Mantenimientos de este enlace" className="mb-4 space-y-2">
      {propios.map((m) => {
        const enCurso = m.estado === 'En curso';
        return (
          <div key={m._id} className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-2.5">
            <p className="flex items-center gap-2 text-sm font-medium text-sky-200"><Wrench size={14} aria-hidden="true" />{enCurso ? 'Se está trabajando en este enlace' : 'Se va a trabajar en este enlace'}: {m.titulo}</p>
            <p className="mt-0.5 text-xs text-sky-100/80">{situacion(m, ahora).etiqueta} · {ventanaTexto(m)}{m.ticket ? ` · ${m.ticket}` : ''}{m.con_corte ? ' · con corte de servicio' : ''}</p>
          </div>
        );
      })}
    </section>
  );
}
