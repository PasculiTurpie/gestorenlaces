import { BookOpen, History, Loader2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNow } from '../hooks/useNow.js';
import { api } from '../lib/api.js';
import { OPCIONES_FILAMENTOS, alarmasParaEstado, requiereTipificacion, sentidosDe } from '../lib/alarmas.js';
import { ESTADO_META, ESTADOS, esFalla } from '../lib/estados.js';
import { cn, fechaHora, hace } from '../lib/format.js';
import { ETIQUETA_SENTIDO, fmtDb, fmtDbm } from '../lib/levantamiento.js';
import { fmtKm, fmtRango } from '../lib/tramos.js';
import { useAuth } from '../store/authStore.js';
import { useTopology } from '../store/topologyStore.js';
import { Campo, entrada } from './admin/ui.jsx';
import DetalleAlarma from './alarmas/DetalleAlarma.jsx';
import EstadoBadge from './EstadoBadge.jsx';

const ORDEN = ['OK', 'Degradado', 'Caido', 'Mantenimiento'].filter((e) => ESTADOS.includes(e));

/** Un filamento: su estado propio, la alarma activa (tipificación + procedimiento a la vista) y su levantamiento. */
function TarjetaFilamento({ enlace, filamento: f, catalogo, ahora, abierto, onToggle }) {
  const l = f.levantamiento;
  const tip = f.alarma?.tipificacion;
  const alarma = tip ? catalogo.find((a) => a._id === tip._id) : null;
  const color = ESTADO_META[f.estado].color;
  const ruta = f.sentido === 'ida' ? `${enlace.origen} → ${enlace.destino}` : `${enlace.destino} → ${enlace.origen}`;

  return (
    <div className="rounded-md border p-3" style={{ borderColor: f.estado === 'OK' ? '#223043' : `${color}66`, background: f.estado === 'OK' ? 'transparent' : `${color}0d` }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div><span className="text-sm font-medium">{ETIQUETA_SENTIDO[f.sentido]}</span> <span className="font-mono text-xs text-noc-muted">{ruta}</span></div>
        <EstadoBadge estado={f.estado} />
      </div>
      <p className="text-xs text-noc-muted">{f.estado === 'OK' ? 'Sin alarma' : `Desde ${hace(f.estado_desde, ahora)}`}</p>

      {f.estado !== 'OK' && (
        <div className="mt-2">
          {tip ? (
            <>
              <p className="text-sm"><span className="mr-1.5 rounded border border-noc-line-strong bg-noc-raised px-1.5 py-0.5 font-mono text-xs">{tip.codigo ?? '?'}</span>{tip.nombre}</p>
              {f.alarma.observacion && <p className="mt-1 text-xs text-noc-muted">«{f.alarma.observacion}»</p>}
              {alarma && (
                <button type="button" aria-expanded={abierto} onClick={onToggle} className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-noc-focus hover:underline">
                  <BookOpen size={13} /> {abierto ? 'Ocultar el procedimiento' : 'Ver significado y procedimiento'}
                </button>
              )}
            </>
          ) : <p className="text-sm text-noc-muted">Alarma sin tipificar.</p>}
        </div>
      )}

      <p className="mt-2 border-t border-noc-line/60 pt-2 font-mono text-xs tabular-nums text-noc-muted">
        {l.tx == null && l.rx == null ? 'Sin levantamiento de potencias' : <>Tx {fmtDbm(l.tx)} · Rx {fmtDbm(l.rx)} dBm{l.atenuacion != null && <> · {fmtDb(l.atenuacion)} dB</>}</>}
      </p>
    </div>
  );
}

function ModalEnlace({ enlace, onClose }) {
  const ahora = useNow();
  const navigate = useNavigate();
  const rol = useAuth((s) => s.user?.rol);
  const catalogo = useTopology((s) => s.alarmas);
  const puedeEditar = rol === 'Supervisor' || rol === 'Admin';
  const dialogo = useRef(null);
  const [detalle, setDetalle] = useState(null);
  const [errorDetalle, setErrorDetalle] = useState(null);
  const [procDe, setProcDe] = useState(null); // filamento cuyo procedimiento se está leyendo
  const [fibras, setFibras] = useState('ambos');
  const [nuevo, setNuevo] = useState(null);
  const [tipId, setTipId] = useState('');
  const [observacion, setObservacion] = useState('');
  const [ticket, setTicket] = useState(enlace.ticket_actual);
  const [causa, setCausa] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  // Detalle (timeline + incidencia abierta). Se relee si el estado cambia (por mí o por otro operador).
  useEffect(() => {
    let vigente = true;
    api.enlace(enlace._id)
      .then(({ data }) => vigente && (setDetalle(data), setErrorDetalle(null)))
      .catch((e) => vigente && setErrorDetalle(e.message));
    return () => { vigente = false; };
  }, [enlace._id, enlace.estado, enlace.updatedAt]);

  useEffect(() => { dialogo.current?.focus(); }, []);

  const sentidos = sentidosDe(fibras);
  const seleccion = enlace.filamentos.filter((f) => sentidos.includes(f.sentido));
  const yaEnEseEstado = nuevo ? seleccion.filter((f) => f.estado === nuevo) : [];
  const cambiaAlgo = nuevo && seleccion.some((f) => f.estado !== nuevo);
  const opcionesAlarma = useMemo(() => (nuevo ? alarmasParaEstado(catalogo, nuevo) : []), [catalogo, nuevo]);
  const exigeAlarma = nuevo ? requiereTipificacion(nuevo, opcionesAlarma) : false;
  const alarma = catalogo.find((a) => a._id === tipId) ?? null;
  const cierraFalla = nuevo && seleccion.some((f) => esFalla(f.estado)) && !esFalla(nuevo);
  const puedeEnviar = cambiaAlgo && (!exigeAlarma || tipId) && !enviando;

  const elegirEstado = (e) => { setNuevo(e); setTipId(''); setError(null); };

  async function aplicar(ev) {
    ev.preventDefault();
    if (!puedeEnviar) return;
    setEnviando(true); setError(null);
    const payload = { estado: nuevo, filamentos: sentidos };
    if (observacion.trim()) payload.observacion = observacion.trim();
    if (ticket.trim()) payload.ticket = ticket.trim();
    if (nuevo !== 'OK' && alarma) payload.tipificacion = alarma.codigo;
    if (cierraFalla && causa.trim()) payload.causa_raiz = causa.trim();
    try {
      await useTopology.getState().cambiarEstado(enlace._id, payload);
      const quien = sentidos.length === 2 ? 'ida y vuelta' : `solo ${sentidos[0]}`;
      useTopology.getState().pushToast({ nivel: 'ok', texto: `${enlace.id_enlace} (${quien}): ${ESTADO_META[nuevo].label}${alarma ? ` · ${alarma.codigo}` : ''}` });
      onClose();
    } catch (err) {
      setError(err.message);
      setEnviando(false);
    }
  }

  const filamentoAbierto = enlace.filamentos.find((f) => f.sentido === procDe);
  const procedimientoAbierto = filamentoAbierto?.alarma ? catalogo.find((a) => a._id === filamentoAbierto.alarma.tipificacion._id) : null;
  const timeline = detalle ? [...(detalle.timeline ?? [])].reverse().slice(0, 12) : [];
  const abierta = detalle?.incidencia_abierta;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialogo} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="titulo-enlace"
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className="entra flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-noc-line-strong bg-noc-panel shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-4 border-b border-noc-line px-5 py-4">
          <div>
            <h2 id="titulo-enlace" className="font-mono text-base font-semibold">{enlace.id_enlace}</h2>
            <p className="mt-0.5 text-sm text-noc-muted">
              {enlace.origen} ⇄ {enlace.destino}{enlace.proveedor ? ` · ${enlace.proveedor}` : ''}
              {enlace.tipo && !enlace.tipo.propio && (
                <span className="ml-2 rounded px-1.5 py-0.5 text-xs" style={{ color: enlace.tipo.color, background: `${enlace.tipo.color}26`, border: `1px solid ${enlace.tipo.color}66` }}>Línea {enlace.tipo.nombre}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <EstadoBadge estado={enlace.estado} />
            <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-noc-muted hover:bg-noc-raised hover:text-noc-text"><X size={16} /></button>
          </div>
        </div>

        <div className="overflow-auto px-5 py-4">
          <p className="mb-4 text-sm text-noc-muted">
            El enlace está en <b className="font-medium text-noc-text">{ESTADO_META[enlace.estado].label}</b> {hace(enlace.estado_desde, ahora)}
            {enlace.ticket_actual && <> · ticket <span className="font-mono text-noc-text">{enlace.ticket_actual}</span></>}
            {abierta && <> · incidencia abierta desde {fechaHora(abierta.inicio)}</>}
            {' '}(el estado del enlace es el peor de sus dos filamentos)
          </p>

          <section aria-label="Filamentos del enlace" className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Filamentos</h3>
              {puedeEditar && (
                <button type="button" onClick={() => { onClose(); navigate(`/admin/enlaces?enlace=${enlace._id}`); }} className="text-xs text-noc-focus hover:underline">Editar levantamiento</button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {enlace.filamentos.map((f) => (
                <TarjetaFilamento key={f.sentido} enlace={enlace} filamento={f} catalogo={catalogo} ahora={ahora} abierto={procDe === f.sentido} onToggle={() => setProcDe((d) => (d === f.sentido ? null : f.sentido))} />
              ))}
            </div>
            {/* el procedimiento se lee mejor a todo el ancho, no dentro de media columna */}
            {procDe && procedimientoAbierto && (
              <div className="mt-3 rounded-lg border border-noc-line bg-noc-bg/40 p-4">
                <p className="mb-2 text-xs text-noc-muted">Procedimiento · alarma del filamento de {procDe}</p>
                <DetalleAlarma alarma={procedimientoAbierto} compacto />
              </div>
            )}
          </section>

          <form onSubmit={aplicar} aria-label="Registrar cambio de estado" className="rounded-lg border border-noc-line p-4">
            <h3 className="mb-3 text-sm font-semibold">Registrar alarma o cambio de estado</h3>

            <fieldset className="mb-4">
              <legend className="mb-1.5 text-sm">1. Filamentos afectados</legend>
              <div className="grid grid-cols-3 gap-2" role="group">
                {OPCIONES_FILAMENTOS.map(([valor, etiqueta]) => (
                  <button key={valor} type="button" aria-pressed={fibras === valor} onClick={() => { setFibras(valor); setError(null); }}
                    className={cn('rounded-md border px-2 py-2 text-sm', fibras === valor ? 'border-noc-focus bg-noc-focus/10 text-noc-focus' : 'border-noc-line hover:bg-noc-raised')}>
                    {etiqueta}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="mb-4">
              <legend className="mb-1.5 text-sm">2. Nuevo estado</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ORDEN.map((e) => {
                  const m = ESTADO_META[e];
                  const igual = seleccion.every((f) => f.estado === e);
                  const elegido = nuevo === e;
                  return (
                    <button key={e} type="button" disabled={igual} aria-pressed={elegido} onClick={() => elegirEstado(e)}
                      className={cn('rounded-md border px-2 py-2 text-sm transition-colors', igual && 'cursor-not-allowed opacity-40')}
                      style={{ borderColor: elegido ? m.color : '#223043', background: elegido ? `${m.color}22` : 'transparent', color: elegido ? m.color : undefined }}>
                      {m.label}
                      {igual && <span className="block text-[11px] text-noc-muted">actual</span>}
                    </button>
                  );
                })}
              </div>
              {yaEnEseEstado.length > 0 && cambiaAlgo && (
                <p className="mt-1.5 text-xs text-noc-muted">El filamento de {yaEnEseEstado.map((f) => f.sentido).join(' y ')} ya está en {ESTADO_META[nuevo].label}: solo cambiará el otro.</p>
              )}
            </fieldset>

            {nuevo && nuevo !== 'OK' && (
              <div className="mb-4">
                <Campo id="tipificacion" etiqueta={`3. Tipificación de la alarma${exigeAlarma ? '' : ' (opcional)'}`}>
                  <select id="tipificacion" value={tipId} onChange={(e) => setTipId(e.target.value)} className={entrada}>
                    <option value="">{exigeAlarma ? 'Elija el tipo de alarma…' : 'Sin tipificar'}</option>
                    {opcionesAlarma.map((a) => <option key={a._id} value={a._id}>{a.codigo} · {a.nombre}</option>)}
                  </select>
                </Campo>
                {opcionesAlarma.length === 0 && <p className="text-xs text-noc-muted">No hay tipos de alarma activos. Un Administrador puede crearlos en Administración → Alarmas.</p>}
                {alarma && (
                  <div className="mt-2 rounded-md border border-noc-focus/30 bg-noc-focus/5 p-3">
                    <p className="mb-2 text-xs font-medium text-noc-focus">Qué significa y qué hacer</p>
                    <DetalleAlarma alarma={alarma} compacto />
                  </div>
                )}
              </div>
            )}

            {nuevo && (
              <>
                <Campo id="obs" etiqueta={nuevo === 'OK' ? 'Observación' : '4. Observación'}>
                  <textarea id="obs" rows={2} maxLength={2000} value={observacion} onChange={(e) => setObservacion(e.target.value)} className={entrada} placeholder="Qué se observó o qué se hizo" />
                </Campo>
                <Campo id="ticket" etiqueta="Ticket" ayuda={esFalla(nuevo) && !esFalla(enlace.estado) ? 'Registre el ticket del proveedor para dar seguimiento a la falla.' : undefined}>
                  <input id="ticket" maxLength={60} value={ticket} onChange={(e) => setTicket(e.target.value)} className={cn(entrada, 'font-mono')} placeholder="INC0012345" />
                </Campo>
                {cierraFalla && (
                  <Campo id="causa" etiqueta="Causa raíz" ayuda="Se guarda en la incidencia cuando el enlace queda sin fallas. Puede completarse después.">
                    <input id="causa" maxLength={1000} value={causa} onChange={(e) => setCausa(e.target.value)} className={entrada} placeholder="Ej. fibra reparada tras corte por obras" />
                  </Campo>
                )}
              </>
            )}

            {error && <p role="alert" className="mb-3 rounded-md border border-estado-down/40 bg-estado-down/10 px-3 py-2 text-sm text-red-300">{error}</p>}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-noc-line px-3 py-2 text-sm text-noc-muted hover:text-noc-text">Cancelar</button>
              <button type="submit" disabled={!puedeEnviar} className="flex items-center gap-2 rounded-md bg-noc-focus px-4 py-2 text-sm font-semibold text-noc-bg hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
                {enviando && <Loader2 size={15} className="animate-spin" />}
                {!nuevo ? 'Elija un estado' : exigeAlarma && !tipId ? 'Elija la tipificación' : !cambiaAlgo ? 'Sin cambios' : `Registrar ${ESTADO_META[nuevo].label.toLowerCase()} · ${sentidos.length === 2 ? 'ida y vuelta' : `solo ${sentidos[0]}`}`}
              </button>
            </div>
          </form>

          {enlace.tramos.length > 0 && (
            <section className="mt-5 border-t border-noc-line pt-4" aria-label="Tramos por zonal">
              <h3 className="mb-2 text-sm font-semibold">Tramos por zonal {enlace.longitud_km != null && <span className="font-normal text-noc-muted">· {fmtKm(enlace.longitud_km)} en total</span>}</h3>
              <ul className="space-y-1.5 text-sm">
                {enlace.tramos.map((t) => (
                  <li key={`${t.zonal._id}-${t.km_desde}`} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.zonal.color }} />{t.zonal.nombre}</span>
                    <span className="font-mono text-xs tabular-nums text-noc-muted">{fmtRango(t.km_desde, t.km_hasta)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-5 border-t border-noc-line pt-4" aria-label="Historial del enlace">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><History size={15} className="text-noc-muted" /> Historial</h3>
            {errorDetalle && <p className="text-sm text-red-300">No se pudo cargar el historial: {errorDetalle}</p>}
            {!detalle && !errorDetalle && <p className="text-sm text-noc-muted">Cargando…</p>}
            {detalle && timeline.length === 0 && <p className="text-sm text-noc-muted">Sin eventos registrados.</p>}
            <ul className="space-y-2">
              {timeline.map((t) => (
                <li key={t._id} className="text-sm">
                  <div className="flex justify-between gap-3"><span>{t.accion}</span><span className="shrink-0 text-xs tabular-nums text-noc-muted">{fechaHora(t.fecha)}</span></div>
                  <div className="text-xs text-noc-muted">{t.operador?.nombre ?? 'sistema'}{t.ticket ? ` · ${t.ticket}` : ''}{t.observacion ? ` — ${t.observacion}` : ''}</div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function StatusModal() {
  const id = useTopology((s) => s.seleccion.enlaceId);
  const enlace = useTopology((s) => s.enlaces[id]);
  if (!id || !enlace) return null;
  return <ModalEnlace key={id} enlace={enlace} onClose={() => useTopology.getState().seleccionarEnlace(null)} />;
}
