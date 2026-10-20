import { ArrowDown, ArrowUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { estaBajoObjetivo, fmtPct, ordenarFilas } from '../../lib/indicadores.js';
import { cn } from '../../lib/format.js';
import { fmtDuracion } from '../../lib/turno.js';
import { useTopology } from '../../store/topologyStore.js';

const COLUMNAS = [
  ['id_enlace', 'Enlace', 'asc'],
  ['uptime_pct', 'Uptime', 'asc'],
  ['minutos_falla', 'Tiempo de falla', 'desc'],
  ['incidentes', 'Incidencias', 'desc'],
  ['mttr_minutos', 'MTTR', 'desc'],
];

/** Detalle por enlace, ordenable. Peor uptime primero por defecto. */
export default function TablaMetricas({ filas, objetivo }) {
  const enlaces = useTopology((s) => s.enlaces);
  const [orden, setOrden] = useState({ columna: 'uptime_pct', direccion: 'asc' });
  const ordenadas = useMemo(() => ordenarFilas(filas, orden.columna, orden.direccion), [filas, orden]);

  const ordenarPor = (columna, inicial) =>
    setOrden((o) => (o.columna === columna ? { columna, direccion: o.direccion === 'asc' ? 'desc' : 'asc' } : { columna, direccion: inicial }));

  return (
    <div className="max-h-[28rem] overflow-auto rounded-lg border border-noc-line">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 bg-noc-panel text-left text-xs text-noc-muted">
          <tr>
            {COLUMNAS.map(([col, etiqueta, inicial]) => {
              const activa = orden.columna === col;
              return (
                <th key={col} scope="col" aria-sort={activa ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none'} className="border-b border-noc-line px-3 py-2 font-medium">
                  <button type="button" onClick={() => ordenarPor(col, inicial)} className={cn('inline-flex items-center gap-1 hover:text-noc-text', activa && 'text-noc-text')}>
                    {etiqueta}{activa && (orden.direccion === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((f) => {
            const bajo = estaBajoObjetivo(f, objetivo);
            const l = enlaces[f.enlace];
            return (
              <tr key={f.enlace} className="border-b border-noc-line/60 last:border-0">
                <td className="px-3 py-2">
                  <div className="font-mono text-xs">{f.id_enlace}</div>
                  {l && <div className="text-xs text-noc-muted">{l.origen} ⇄ {l.destino}</div>}
                </td>
                <td className={cn('px-3 py-2 font-mono tabular-nums', bajo ? 'text-red-300' : 'text-noc-text')} title={bajo ? 'Por debajo del objetivo' : undefined}>
                  {fmtPct(f.uptime_pct)}{bajo && <span className="sr-only"> (bajo el objetivo)</span>}
                </td>
                <td className="px-3 py-2 tabular-nums">{f.minutos_falla > 0 ? fmtDuracion(f.minutos_falla) : <span className="text-noc-muted">—</span>}</td>
                <td className="px-3 py-2 tabular-nums">{f.incidentes || <span className="text-noc-muted">—</span>}</td>
                <td className="px-3 py-2 tabular-nums">{f.mttr_minutos != null ? fmtDuracion(f.mttr_minutos) : <span className="text-noc-muted">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {ordenadas.length === 0 && <p className="px-3 py-8 text-center text-sm text-noc-muted">Ningún enlace coincide con los filtros.</p>}
    </div>
  );
}
