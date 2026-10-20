import { X } from 'lucide-react';
import { useMemo } from 'react';
import { useFocus } from '../hooks/useFocus.js';
import { useNow } from '../hooks/useNow.js';
import { ESTADO_META, ESTADOS } from '../lib/estados.js';
import { hace, hora } from '../lib/format.js';
import { resumenAlarmas } from '../lib/alarmas.js';
import { alarmas, contarPorEstado, enlacesDeNodo } from '../lib/selectors.js';
import { useTopology } from '../store/topologyStore.js';
import EstadoBadge from './EstadoBadge.jsx';

const ORDEN_RESUMEN = ['Caido', 'Degradado', 'Mantenimiento', 'OK'];
const COLOR_NIVEL = { critico: '#ef4444', warn: '#f97316', ok: '#22c55e', info: '#8296ab' };

function Resumen() {
  const enlaces = useTopology((s) => s.enlaces);
  const conteo = useMemo(() => contarPorEstado(enlaces), [enlaces]);
  const total = Object.keys(enlaces).length;
  return (
    <section aria-label="Resumen de enlaces" className="border-b border-noc-line p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Enlaces</h2>
        <span className="text-sm text-noc-muted">{total} en total</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {ORDEN_RESUMEN.filter((e) => ESTADOS.includes(e)).map((e) => {
          const m = ESTADO_META[e];
          const activo = conteo[e] > 0 && e !== 'OK';
          return (
            <div key={e} className="rounded-md border px-2 py-1.5" style={{ borderColor: activo ? `${m.color}66` : '#223043', background: activo ? `${m.color}12` : 'transparent' }}>
              <div className="font-mono text-xl font-medium leading-none tabular-nums" style={{ color: activo || e === 'OK' ? m.color : '#8296ab' }}>{conteo[e]}</div>
              <div className="mt-1 text-[11px] leading-tight text-noc-muted">{m.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ItemEnlace({ l, ahora, onClick }) {
  return (
    <li>
      <button type="button" onClick={() => onClick(l)} className="w-full border-b border-noc-line/60 px-4 py-2.5 text-left hover:bg-noc-raised">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm">{l.id_enlace}</span>
          <EstadoBadge estado={l.estado} />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-noc-muted">
          <span>{l.origen} ⇄ {l.destino}{l.ticket_actual ? ` · ${l.ticket_actual}` : ''}</span>
          <span className="shrink-0 tabular-nums">{hace(l.estado_desde, ahora)}</span>
        </div>
        {l.estado !== 'OK' && resumenAlarmas(l) && <div className="mt-0.5 font-mono text-[11px]" style={{ color: ESTADO_META[l.estado].color }}>{resumenAlarmas(l)}</div>}
      </button>
    </li>
  );
}

function Alarmas() {
  const enlaces = useTopology((s) => s.enlaces);
  const ahora = useNow();
  const foco = useFocus();
  const lista = useMemo(() => alarmas(enlaces), [enlaces]);

  const abrir = (l) => { foco.enlace(l); useTopology.getState().seleccionarEnlace(l._id); };

  return (
    <section aria-label="Alarmas activas" className="min-h-0 flex-1 overflow-auto">
      <h2 className="sticky top-0 z-10 border-b border-noc-line bg-noc-panel px-4 py-2 text-sm font-semibold">
        Alarmas activas <span className="ml-1 font-normal text-noc-muted">{lista.length}</span>
      </h2>
      {lista.length === 0 ? (
        <p className="px-4 py-6 text-sm text-noc-muted">Todos los enlaces están en OK. Las alarmas aparecerán aquí en cuanto cambie un estado.</p>
      ) : (
        <ul>{lista.map((l) => <ItemEnlace key={l._id} l={l} ahora={ahora} onClick={abrir} />)}</ul>
      )}
    </section>
  );
}

function PanelNodo() {
  const nodoId = useTopology((s) => s.seleccion.nodoId);
  const nodo = useTopology((s) => s.nodos[nodoId]);
  const enlaces = useTopology((s) => s.enlaces);
  const ahora = useNow();
  const foco = useFocus();
  const lista = useMemo(() => (nodoId ? enlacesDeNodo(enlaces, nodoId) : []), [enlaces, nodoId]);
  if (!nodo) return null;

  return (
    <section aria-label={`Nodo ${nodo.id_nodo}`} className="max-h-[45%] shrink-0 overflow-auto border-b border-noc-line">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-noc-line bg-noc-panel px-4 py-2">
        <div>
          <div className="font-mono text-sm font-semibold">{nodo.id_nodo}</div>
          <div className="text-xs text-noc-muted">{nodo.tipo === 'ESTACION' ? 'Estación' : nodo.tipo} · {lista.length} enlace{lista.length === 1 ? '' : 's'}</div>
        </div>
        <button type="button" aria-label="Cerrar detalle de nodo" onClick={() => useTopology.getState().seleccionarNodo(null)} className="rounded p-1 text-noc-muted hover:bg-noc-raised hover:text-noc-text">
          <X size={15} />
        </button>
      </div>
      {lista.length === 0 ? (
        <p className="px-4 py-3 text-sm text-noc-muted">Este nodo no tiene enlaces registrados todavía.</p>
      ) : (
        <ul>{lista.map((l) => <ItemEnlace key={l._id} l={l} ahora={ahora} onClick={(x) => { foco.enlace(x); useTopology.getState().seleccionarEnlace(x._id); }} />)}</ul>
      )}
    </section>
  );
}

function Actividad() {
  const eventos = useTopology((s) => s.eventos);
  return (
    <section aria-label="Actividad reciente" className="max-h-52 shrink-0 overflow-auto border-t border-noc-line">
      <h2 className="sticky top-0 border-b border-noc-line bg-noc-panel px-4 py-2 text-sm font-semibold">Actividad</h2>
      {eventos.length === 0 ? (
        <p className="px-4 py-3 text-sm text-noc-muted">Aún no hay cambios en esta sesión.</p>
      ) : (
        <ul className="py-1">
          {eventos.map((e) => (
            <li key={e.id} className="flex gap-2 px-4 py-1 text-xs">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: COLOR_NIVEL[e.nivel] }} />
              <span className="min-w-0 flex-1 break-words">{e.texto}</span>
              <span className="shrink-0 font-mono text-noc-muted">{hora(e.ts)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Sidebar() {
  const abierto = useTopology((s) => s.sidebarAbierto);
  if (!abierto) return null;
  return (
    <aside className="flex w-[22rem] max-w-[85vw] shrink-0 flex-col border-l border-noc-line bg-noc-panel max-lg:absolute max-lg:bottom-0 max-lg:right-0 max-lg:top-12 max-lg:z-20 max-lg:shadow-2xl">
      <Resumen />
      <PanelNodo />
      <Alarmas />
      <Actividad />
    </aside>
  );
}
