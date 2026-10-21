import { BookOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Wrench } from 'lucide-react';
import { alarmasConProcedimiento, resumenAlarmas } from '../../lib/alarmas.js';
import { porEnlace, situacion, ventanaTexto } from '../../lib/mantenimientos.js';
import { ESTADO_META } from '../../lib/estados.js';
import { useTopology } from '../../store/topologyStore.js';
import ProcedimientoDialog from '../alarmas/ProcedimientoDialog.jsx';
import { cn, hace } from '../../lib/format.js';
import { useNow } from '../../hooks/useNow.js';
import EstadoBadge from '../EstadoBadge.jsx';

/**
 * Checklist del turno. `editable` = turno abierto; en el historial es de solo lectura.
 * `estadoActual(item)` devuelve el estado en vivo del enlace (del store) para ver si ya se recuperó o empeoró.
 */
export default function ChecklistTabla({ items, editable, estadoActual, onGestionado, onAccion, notasPrevias = {} }) {
  const ahora = useNow();
  const [borradores, setBorradores] = useState({}); // texto en edición por enlace
  const [verProcedimiento, setVerProcedimiento] = useState(null); // enlace cuyo procedimiento se consulta
  const catalogo = useTopology((s) => s.alarmas);
  const mantenimientos = useTopology((s) => s.mantenimientos);
  const mantPorEnlace = useMemo(() => porEnlace(mantenimientos), [mantenimientos]); // se está trabajando / se va a trabajar en el enlace

  if (items.length === 0) {
    return <p className="rounded-lg border border-noc-line px-4 py-8 text-center text-sm text-noc-muted">Se recibió el turno sin enlaces con falla. No hay nada que verificar.</p>;
  }

  const confirmarAccion = (item) => {
    const texto = (borradores[item.enlaceId] ?? item.accion_tomada).trim();
    setBorradores(({ [item.enlaceId]: _descartado, ...resto }) => resto);
    if (texto !== item.accion_tomada.trim()) onAccion(item, texto);
  };

  return (
    <div className="overflow-auto rounded-lg border border-noc-line">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="bg-noc-panel text-left text-xs text-noc-muted">
          <tr>
            <th scope="col" className="w-24 border-b border-noc-line px-3 py-2 font-medium">Gestionado</th>
            <th scope="col" className="border-b border-noc-line px-3 py-2 font-medium">Enlace</th>
            <th scope="col" className="border-b border-noc-line px-3 py-2 font-medium">Recibido</th>
            <th scope="col" className="border-b border-noc-line px-3 py-2 font-medium">Ahora</th>
            <th scope="col" className="w-[40%] border-b border-noc-line px-3 py-2 font-medium">Acción tomada</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const actual = estadoActual(i);
            const cambio = actual && actual.estado !== i.estado_recibido;
            const faltaAccion = i.gestionado && !i.accion_tomada.trim();
            const bloqueado = !editable || i.eliminado;
            return (
              <tr key={i.enlaceId ?? i.id_enlace} className="border-b border-noc-line/60 last:border-0">
                <td className="px-3 py-2.5 align-top">
                  <input
                    type="checkbox" checked={i.gestionado} disabled={bloqueado}
                    aria-label={`Marcar ${i.id_enlace} como gestionado`}
                    onChange={(e) => onGestionado(i, e.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-[#7dd3fc] disabled:cursor-not-allowed"
                  />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <div className="font-mono text-xs">{i.id_enlace}</div>
                  <div className="text-xs text-noc-muted">{i.origen} ⇄ {i.destino}{actual?.ticket_actual ? ` · ${actual.ticket_actual}` : ''}</div>
                  {actual && actual.estado !== 'OK' && resumenAlarmas(actual) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[11px]" style={{ color: ESTADO_META[actual.estado].color }}>{resumenAlarmas(actual)}</span>
                      {alarmasConProcedimiento(actual, catalogo).length > 0 && (
                        <button type="button" onClick={() => setVerProcedimiento(actual)} aria-label={`Ver el procedimiento de ${i.id_enlace}`} className="inline-flex items-center gap-1 text-[11px] text-noc-focus hover:underline">
                          <BookOpen size={11} /> Procedimiento
                        </button>
                      )}
                    </div>
                  )}
                  {(mantPorEnlace[i.enlaceId] ?? []).map((m) => (
                    <p key={m._id} className="mt-1.5 flex max-w-[22rem] items-start gap-1.5 text-xs leading-snug text-sky-300">
                      <Wrench size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{m.estado === 'En curso' ? 'Se está trabajando' : 'Se va a trabajar'}: {m.titulo} · {situacion(m).etiqueta.toLowerCase()} · {ventanaTexto(m)}</span>
                    </p>
                  ))}
                  {notasPrevias[i.enlaceId] && (
                    <p className="mt-1.5 max-w-[22rem] text-xs leading-snug text-noc-muted">
                      <span className="font-medium text-noc-focus">Turno anterior:</span> {notasPrevias[i.enlaceId].accion}
                    </p>
                  )}
                  {i.eliminado && <div className="mt-0.5 text-xs text-estado-deg">El enlace fue eliminado; no se puede gestionar.</div>}
                </td>
                <td className="px-3 py-2.5 align-top"><EstadoBadge estado={i.estado_recibido} /></td>
                <td className="px-3 py-2.5 align-top">
                  {actual ? (
                    <div>
                      <EstadoBadge estado={actual.estado} />
                      {cambio && <div className="mt-0.5 text-xs text-noc-muted">cambió {hace(actual.estado_desde, ahora)}</div>}
                    </div>
                  ) : <span className="text-noc-muted">—</span>}
                </td>
                <td className="px-3 py-2.5 align-top">
                  {editable && !i.eliminado ? (
                    <>
                      {/* textarea de una línea que crece con el texto (field-sizing); Enter confirma, Mayús+Enter no hace salto */}
                      <textarea
                        rows={1} aria-label={`Acción tomada en ${i.id_enlace}`} maxLength={1000} placeholder="Qué se hizo (escalamiento, ticket, seguimiento…)"
                        value={borradores[i.enlaceId] ?? i.accion_tomada}
                        onChange={(e) => setBorradores((b) => ({ ...b, [i.enlaceId]: e.target.value.replace(/\n/g, ' ') }))}
                        onBlur={() => confirmarAccion(i)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                        style={{ fieldSizing: 'content' }}
                        className={cn('block min-h-[2.125rem] w-full resize-none rounded-md border bg-noc-bg px-2.5 py-1.5 text-sm leading-5 placeholder:text-noc-muted/60', faltaAccion ? 'border-estado-deg/70' : 'border-noc-line')}
                      />
                      {faltaAccion && <p className="mt-1 text-xs text-estado-deg">Describa la acción para poder cerrar el turno.</p>}
                    </>
                  ) : (
                    <span className="text-sm">{i.accion_tomada || <span className="text-noc-muted">—</span>}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {verProcedimiento && <ProcedimientoDialog enlace={verProcedimiento} onClose={() => setVerProcedimiento(null)} />}
    </div>
  );
}
