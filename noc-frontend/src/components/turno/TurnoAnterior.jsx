import { AlertTriangle, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNow } from '../../hooks/useNow.js';
import { cn, fechaDia, fechaHora, hace } from '../../lib/format.js';
import { TRASPASO_VIGENTE_HORAS, horasDesde, resumenTurnoAnterior } from '../../lib/turno.js';
import { useTopology } from '../../store/topologyStore.js';
import EstadoBadge from '../EstadoBadge.jsx';

/**
 * Traspaso: lo que dejó el turno anterior (su bitácora y los enlaces que quedaron en seguimiento).
 * El estado de cada enlace es el de AHORA (en vivo), no el que tenía al cierre del otro turno.
 */
export default function TurnoAnterior({ acta, inicialAbierto = true, titulo = 'Turno anterior', aviso = null }) {
  const enlaces = useTopology((s) => s.enlaces);
  const ahora = useNow();
  const [abierto, setAbierto] = useState(inicialAbierto);
  const resumen = useMemo(() => resumenTurnoAnterior(acta, enlaces), [acta, enlaces]);
  const desactualizado = horasDesde(acta.fecha_fin, ahora) > TRASPASO_VIGENTE_HORAS;
  const Chevron = abierto ? ChevronDown : ChevronRight;

  return (
    <section aria-label={titulo} className="rounded-lg border border-noc-line bg-noc-panel">
      <button type="button" onClick={() => setAbierto((a) => !a)} aria-expanded={abierto} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <ClipboardList size={17} className="shrink-0 text-noc-focus" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-semibold">{titulo}{aviso && <span className="inline-flex items-center gap-1 rounded bg-estado-deg/15 px-1.5 py-0.5 text-xs font-normal text-orange-300"><AlertTriangle size={12} /> revisar</span>}</span>
          <span className="block truncate text-xs text-noc-muted">
            Turno {acta.tipo_turno.toLowerCase()} del {fechaDia(acta.fecha_turno)} · {acta.operador?.nombre ?? 'un operador'} · cerró {hace(acta.fecha_fin, ahora)} ({fechaHora(acta.fecha_fin)})
            {resumen.seguimiento.length > 0 && ` · ${resumen.seguimiento.length} enlace(s) en seguimiento`}
          </span>
        </span>
        <Chevron size={16} className="shrink-0 text-noc-muted" />
      </button>

      {abierto && (
        <div className="space-y-4 border-t border-noc-line px-4 py-4 text-sm">
          {aviso && <p role="note" className="rounded-md border border-estado-deg/40 bg-estado-deg/10 px-3 py-2 text-xs text-orange-200">{aviso}</p>}
          {desactualizado && (
            <p role="note" className="rounded-md border border-estado-deg/40 bg-estado-deg/10 px-3 py-2 text-xs text-orange-200">
              Este turno cerró hace más de {TRASPASO_VIGENTE_HORAS} horas: lo que dice puede estar desactualizado. Verifique el estado actual de cada enlace.
            </p>
          )}

          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-noc-muted">Bitácora</h3>
            <p className="whitespace-pre-wrap leading-relaxed">{acta.bitacora_general || <span className="text-noc-muted">El operador no dejó observaciones.</span>}</p>
          </div>

          <div>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-noc-muted">Enlaces que quedaron en seguimiento <span className="font-normal normal-case">· siguen sin estar en OK</span></h3>
            {resumen.seguimiento.length === 0 ? (
              <p className="text-noc-muted">{resumen.total === 0 ? 'Ese turno no recibió enlaces con falla.' : 'Todos los enlaces del turno anterior ya se recuperaron.'}</p>
            ) : (
              <ul className="space-y-2">
                {resumen.seguimiento.map((i) => (
                  <li key={i.enlaceId} className="rounded-md border border-noc-line px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span><span className="font-mono text-xs">{i.id_enlace}</span> <span className="text-xs text-noc-muted">{i.origen} ⇄ {i.destino}</span></span>
                      <span className="flex items-center gap-2 text-xs text-noc-muted">hace {hace(i.desdeActual, ahora).replace('hace ', '')}<EstadoBadge estado={i.estadoActual} /></span>
                    </div>
                    <p className={cn('mt-1 leading-snug', !i.accion_tomada && 'text-noc-muted')}>{i.accion_tomada || 'Sin acción registrada.'}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {resumen.recuperados.length > 0 && (
            <p className="text-xs text-noc-muted">
              Se recuperaron desde entonces ({resumen.recuperados.length}): <span className="font-mono">{resumen.recuperados.map((i) => i.id_enlace).join(', ')}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
