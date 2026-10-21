import { CalendarClock, Pencil, Play, Plus, Square, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNow } from '../../hooks/useNow.js';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { cn, fechaHora } from '../../lib/format.js';
import { avisoResultado, situacion, ventanaTexto } from '../../lib/mantenimientos.js';
import { useTopology } from '../../store/topologyStore.js';
import EstadoBadge from '../EstadoBadge.jsx';
import { Aviso, Boton, Insignia } from '../admin/ui.jsx';
import AccionDialog from './AccionDialog.jsx';
import FormMantenimiento from './FormMantenimiento.jsx';
import { SituacionBadge } from './Lista.jsx';

const VISTAS = [['activos', 'Activos'], ['historial', 'Historial']];

function Tarjeta({ m, onAccion, onEditar, historial }) {
  const enlaces = useTopology((s) => s.enlaces);
  const s = situacion(m, useNow());
  return (
    <li className={cn('rounded-lg border bg-noc-panel p-4', s.nivel === 'warn' ? 'border-estado-deg/50' : 'border-noc-line')} aria-label={`Mantenimiento ${m.titulo}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">{m.titulo} <SituacionBadge m={m} />{m.con_corte && <Insignia color="#f97316">Con corte</Insignia>}</h3>
          <p className="mt-1 text-xs tabular-nums text-noc-muted"><CalendarClock size={12} className="mr-1 inline align-[-2px]" aria-hidden="true" />{ventanaTexto(m)}
            {m.inicio_real && <> · inició {fechaHora(m.inicio_real)}</>}{m.fin_real && <> · terminó {fechaHora(m.fin_real)}</>}</p>
        </div>
        {!historial && (
          <div className="flex shrink-0 gap-1.5">
            {m.estado === 'Programado' && <Boton variante="primario" onClick={() => onAccion('iniciar', m)}><Play size={13} /> Iniciar</Boton>}
            {m.estado === 'En curso' && <Boton variante="primario" onClick={() => onAccion('finalizar', m)}><Square size={13} /> Finalizar</Boton>}
            <Boton onClick={() => onEditar(m)} aria-label={`Editar ${m.titulo}`}><Pencil size={13} /> Editar</Boton>
            {m.estado === 'Programado' && <Boton variante="peligro" onClick={() => onAccion('cancelar', m)} aria-label={`Cancelar ${m.titulo}`}><X size={13} /> Cancelar</Boton>}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-noc-muted"><span className="font-mono">{m.tipificacion?.codigo}</span> · {m.tipificacion?.nombre}{m.ticket && <> · ticket <span className="font-mono">{m.ticket}</span></>} · registró {m.creado_por?.nombre ?? '—'}</p>
      {m.descripcion && <p className="mt-2 whitespace-pre-wrap text-sm">{m.descripcion}</p>}
      {m.motivo_cancelacion && <p className="mt-2 text-sm text-noc-muted">Motivo de la cancelación: {m.motivo_cancelacion}</p>}
      <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Enlaces">
        {m.enlaces.map((e) => {
          const vivo = enlaces[e._id ?? e];
          return <li key={e._id ?? e} className="flex items-center gap-1.5 rounded-md border border-noc-line bg-noc-raised px-2 py-0.5 text-xs"><span className="font-mono">{e.id_enlace ?? vivo?.id_enlace}</span>{vivo && vivo.estado !== 'OK' && <EstadoBadge estado={vivo.estado} />}</li>;
        })}
      </ul>
    </li>
  );
}

function Seccion({ titulo, lista, ...props }) {
  if (!lista.length) return null;
  return (
    <section className="mb-6" aria-label={titulo}>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-noc-muted">{titulo} <span className="font-normal normal-case">· {lista.length}</span></h2>
      <ul className="space-y-3">{lista.map((m) => <Tarjeta key={m._id} m={m} {...props} />)}</ul>
    </section>
  );
}

export default function MantenimientosPage() {
  const activos = useTopology((s) => s.mantenimientos);
  const [vista, setVista] = useState('activos');
  const [form, setForm] = useState(null); // { m } | {} (nuevo)
  const [accion, setAccion] = useState(null); // { tipo, m }
  const [aviso, setAviso] = useState(null);
  const [hist, setHist] = useState({ cargando: false, lista: [], error: null });

  useEffect(() => { useTopology.getState().cargarMantenimientos(); }, []);
  useEffect(() => {
    if (vista !== 'historial') return undefined;
    let vigente = true;
    setHist((h) => ({ ...h, cargando: true, error: null }));
    api.mantenimientos({ estado: 'Finalizado,Cancelado', limit: 50 })
      .then((r) => vigente && setHist({ cargando: false, lista: r.data, error: null }))
      .catch((e) => vigente && setHist({ cargando: false, lista: [], error: describirError(e) }));
    return () => { vigente = false; };
  }, [vista, activos]); // al terminar o cancelar uno, el historial se actualiza

  const enCurso = useMemo(() => activos.filter((m) => m.estado === 'En curso'), [activos]);
  const programados = useMemo(() => activos.filter((m) => m.estado === 'Programado'), [activos]);

  function hecho(tipo, r) {
    const nota = avisoResultado(tipo === 'iniciar' ? 'iniciar' : 'finalizar', r.resultado);
    if (tipo === 'finalizar' && r.completo === false) setAviso({ tipo: 'error', texto: `El mantenimiento sigue En curso porque no se pudieron restablecer todos los enlaces. ${nota ?? ''}` });
    else if (nota) setAviso({ tipo: 'error', texto: nota });
    else setAviso({ tipo: 'info', texto: { iniciar: 'Mantenimiento iniciado: los enlaces pasaron a Mantenimiento.', finalizar: 'Mantenimiento finalizado: los enlaces volvieron a OK.', cancelar: 'Mantenimiento cancelado.' }[tipo] });
  }

  return (
    <section className="min-w-0 flex-1 overflow-auto p-6 max-sm:p-4" aria-label="Mantenimientos">
      <div className="mx-auto max-w-4xl">
        <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-lg font-semibold">Mantenimientos</h1>
          <Boton variante="primario" onClick={() => setForm({})}><Plus size={14} /> Programar mantenimiento</Boton>
        </div>
        <p className="mb-4 max-w-prose text-sm text-noc-muted">Trabajos que se van a hacer o se están haciendo en los enlaces. Todo el NOC los ve, en el mapa y en el cambio de turno. Al iniciar uno, sus enlaces pasan a Mantenimiento; al finalizarlo, vuelven a OK.</p>

        <div role="tablist" aria-label="Vistas de mantenimientos" className="mb-5 flex gap-1 border-b border-noc-line">
          {VISTAS.map(([clave, etiqueta]) => (
            <button key={clave} type="button" role="tab" aria-selected={vista === clave} onClick={() => setVista(clave)}
              className={cn('-mb-px border-b-2 px-3 py-2 text-sm', vista === clave ? 'border-noc-focus text-noc-text' : 'border-transparent text-noc-muted hover:text-noc-text')}>{etiqueta}</button>
          ))}
        </div>

        {aviso && <div className="mb-4 flex items-start justify-between gap-3"><div className="flex-1"><Aviso tipo={aviso.tipo}>{aviso.texto}</Aviso></div><button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="rounded p-1 text-noc-muted hover:bg-noc-raised"><X size={14} /></button></div>}

        {vista === 'activos' ? (
          activos.length === 0
            ? <p className="rounded-lg border border-dashed border-noc-line px-4 py-10 text-center text-sm text-noc-muted">No hay mantenimientos programados ni en curso.</p>
            : <>
                <Seccion titulo="En curso" lista={enCurso} onAccion={(tipo, m) => setAccion({ tipo, m })} onEditar={(m) => setForm({ m })} />
                <Seccion titulo="Programados" lista={programados} onAccion={(tipo, m) => setAccion({ tipo, m })} onEditar={(m) => setForm({ m })} />
              </>
        ) : (
          <>
            {hist.error && <Aviso>{hist.error}</Aviso>}
            {hist.cargando ? <p className="text-sm text-noc-muted">Cargando…</p>
              : hist.lista.length === 0 ? <p className="rounded-lg border border-dashed border-noc-line px-4 py-10 text-center text-sm text-noc-muted">Todavía no hay mantenimientos finalizados ni cancelados.</p>
                : <ul className="space-y-3">{hist.lista.map((m) => <Tarjeta key={m._id} m={m} historial />)}</ul>}
          </>
        )}
      </div>

      {form && <FormMantenimiento mantenimiento={form.m ?? null} onClose={() => setForm(null)} />}
      {accion && <AccionDialog accion={accion.tipo} mantenimiento={accion.m} onClose={() => setAccion(null)} onHecho={hecho} />}
    </section>
  );
}
