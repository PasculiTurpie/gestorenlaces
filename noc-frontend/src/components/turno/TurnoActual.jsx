import { CheckCircle2, FileText, Loader2, Play, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../lib/api.js';
import { TURNOS } from '../../lib/catalogos.js';
import { describirError } from '../../lib/errores.js';
import { fechaDia, fechaHora, hace } from '../../lib/format.js';
import { contarARecibir, describirErroresCierre, duracionTurnoMin, enlacesNuevos, fmtDuracion, itemResuelto, normalizarActa, notasPorEnlace, pendientesDeCierre, resumenActa } from '../../lib/turno.js';
import { useNow } from '../../hooks/useNow.js';
import { useAuth } from '../../store/authStore.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Campo, Dialogo, entrada } from '../admin/ui.jsx';
import ChecklistTabla from './ChecklistTabla.jsx';
import { avisoContinuidad, etiquetaTurno, rangoTurno } from '../../lib/horarios.js';
import MantenimientosTurno from '../mantenimientos/MantenimientosTurno.jsx';
import ItemsAtencion from './ItemsAtencion.jsx';
import TurnoAnterior from './TurnoAnterior.jsx';
import VistaPreviaActa from './VistaPreviaActa.jsx';

const avisar = (nivel, texto) => useTopology.getState().pushToast({ nivel, texto });

function CerrarTurno({ acta, esperarGuardados, onClose, onCerrado }) {
  const pendientes = pendientesDeCierre(acta);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState([]);

  async function cerrar() {
    setEnviando(true); setErrores([]);
    try {
      await esperarGuardados(); // que no se cierre con un guardado todavía en vuelo
      const { data } = await api.cerrarTurno(acta._id, { bitacora_general: acta.bitacora_general });
      onCerrado(normalizarActa(data));
    } catch (err) {
      setErrores(describirErroresCierre(err, acta));
      setEnviando(false);
    }
  }

  return (
    <Dialogo titulo="Cerrar el turno" descripcion="Al cerrarlo, el acta queda registrada y ya no se puede modificar." onClose={onClose} ancho="max-w-lg">
      {pendientes.length > 0 ? (
        <>
          <Aviso>No se puede cerrar: {pendientes.length} enlace(s) sin resolver.</Aviso>
          <ul className="mb-4 space-y-1.5 text-sm">
            {pendientes.map(({ item, motivo }) => <li key={item.id_enlace}><span className="font-mono text-xs">{item.id_enlace}</span> <span className="text-noc-muted">— {motivo}</span></li>)}
          </ul>
        </>
      ) : (
        <p className="mb-4 text-sm">Todos los enlaces recibidos están gestionados. Se cerrará el turno <b className="font-medium">{acta.tipo_turno.toLowerCase()}</b> con {acta.items.length} enlace(s) en el checklist.</p>
      )}
      {errores.length > 0 && <Aviso>{errores.map((e) => <span key={e} className="block">{e}</span>)}</Aviso>}
      <div className="flex justify-end gap-2">
        <Boton onClick={onClose}>{pendientes.length ? 'Volver al checklist' : 'Cancelar'}</Boton>
        <Boton variante="primario" cargando={enviando} disabled={pendientes.length > 0} onClick={cerrar}>Cerrar turno</Boton>
      </div>
    </Dialogo>
  );
}

function AbrirTurno({ onAbierto, tipo, setTipo, horarios }) {
  const enlaces = useTopology((s) => s.enlaces);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const aRecibir = contarARecibir(enlaces);

  async function abrir(e) {
    e.preventDefault();
    setEnviando(true); setError(null);
    try { onAbierto(normalizarActa((await api.abrirTurno({ tipo_turno: tipo })).data)); }
    catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <form onSubmit={abrir} className="mx-auto max-w-md rounded-lg border border-noc-line bg-noc-panel p-6">
      <h2 className="mb-1 text-base font-semibold">No tienes un turno abierto</h2>
      <p className="mb-4 text-sm text-noc-muted">
        {aRecibir > 0
          ? <>Hoy hay <b className="font-medium text-noc-text">{aRecibir}</b> enlace(s) que no están en OK. Al abrir el turno se cargan automáticamente en un checklist para que los verifiques.</>
          : 'Hoy todos los enlaces están en OK. Al abrir el turno recibirás un checklist vacío.'}
      </p>
      <Campo id="t-turno" etiqueta="Turno">
        <select id="t-turno" value={tipo} onChange={(e) => setTipo(e.target.value)} className={entrada}>{TURNOS.map((t) => <option key={t} value={t}>{etiquetaTurno(horarios, t)}</option>)}</select>
        {horarios && tipo !== horarios.ahora.sugerido && (
          <p className="mt-1.5 text-xs text-orange-300">Por la hora corresponde el turno {horarios.ahora.sugerido.toLowerCase()} ({rangoTurno(horarios, horarios.ahora.sugerido)}).</p>
        )}
      </Campo>
      {error && <Aviso>{error}</Aviso>}
      <Boton type="submit" variante="primario" cargando={enviando} className="w-full"><Play size={14} /> Abrir turno</Boton>
    </form>
  );
}

export default function TurnoActual() {
  const enlaces = useTopology((s) => s.enlaces);
  const ahora = useNow();
  const [estado, setEstado] = useState({ cargando: true, acta: null, error: null });
  const [dialogo, setDialogo] = useState(null); // 'cerrar' | 'imprimir'
  const [sincronizando, setSincronizando] = useState(false);
  const [bitacora, setBitacora] = useState(null); // borrador de la bitácora
  const guardados = useRef(new Set()); // guardados en vuelo
  const [anterior, setAnterior] = useState(null); // traspaso: último turno cerrado
  const user = useAuth((s) => s.user);
  const [horarios, setHorarios] = useState(null); // horario de los turnos (lo define el backend)
  const [tipoManual, setTipoManual] = useState(null);
  // Turno propuesto al abrir: el que corresponde por la hora; si no se pudo cargar el horario, el asignado al usuario
  const tipoAbrir = tipoManual ?? horarios?.ahora.sugerido ?? user?.turno ?? 'Mañana';

  const { acta } = estado;
  const setActa = (a) => setEstado((e) => ({ ...e, acta: a, error: null }));

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.turnoActual();
      setEstado({ cargando: false, acta: data ? normalizarActa(data) : null, error: null });
    } catch (err) { setEstado({ cargando: false, acta: null, error: describirError(err) }); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  // Traspaso: antes de abrir, el último turno cerrado; con el turno abierto, el último que terminó ANTES de que empezara el mío
  useEffect(() => {
    if (estado.cargando || estado.acta?.cerrado) return undefined;
    let vigente = true;
    api.turnoAnterior(estado.acta?.fecha_inicio)
      .then(({ data }) => vigente && setAnterior(data ? normalizarActa(data) : null))
      .catch(() => vigente && setAnterior(null)); // el traspaso es una ayuda: si falla, el turno sigue funcionando
    return () => { vigente = false; };
  }, [estado.cargando, estado.acta?._id, estado.acta?.fecha_inicio, estado.acta?.cerrado]);
  const notasPrevias = useMemo(() => notasPorEnlace(anterior), [anterior]);
  useEffect(() => { api.horariosTurnos().then(({ data }) => setHorarios(data)).catch(() => {}); }, []); // si falla, la pantalla funciona sin horarios

  // Registra un guardado para poder esperarlo antes de cerrar
  const guardar = (promesa) => {
    guardados.current.add(promesa);
    return promesa.finally(() => guardados.current.delete(promesa));
  };
  const esperarGuardados = () => Promise.allSettled([...guardados.current]);

  const reemplazarItem = (enlaceId, cambios) => setEstado((e) => ({ ...e, acta: { ...e.acta, items: e.acta.items.map((i) => (i.enlaceId === enlaceId ? { ...i, ...cambios } : i)) } }));

  // Actualización optimista: se refleja ya y se confirma (o revierte) con la respuesta del servidor
  async function cambiarItem(item, cambios, body) {
    const previo = { gestionado: item.gestionado, accion_tomada: item.accion_tomada };
    reemplazarItem(item.enlaceId, cambios);
    try {
      const { data } = await guardar(api.actualizarChecklist(acta._id, item.enlaceId, body));
      setActa(normalizarActa(data));
    } catch (err) {
      reemplazarItem(item.enlaceId, previo);
      avisar('critico', `No se guardó el cambio en ${item.id_enlace}: ${describirError(err)}`);
    }
  }
  const onGestionado = (item, gestionado) => cambiarItem(item, { gestionado }, { gestionado });
  const onAccion = (item, texto) => cambiarItem(item, { accion_tomada: texto }, { accion_tomada: texto });

  async function guardarBitacora() {
    if (bitacora == null || bitacora === acta.bitacora_general) return setBitacora(null);
    const texto = bitacora;
    setEstado((e) => ({ ...e, acta: { ...e.acta, bitacora_general: texto } }));
    setBitacora(null);
    try { await guardar(api.actualizarBitacora(acta._id, texto)); }
    catch (err) { avisar('critico', `No se guardó la bitácora: ${describirError(err)}`); }
  }

  async function sincronizar() {
    setSincronizando(true);
    try {
      const { data, meta } = await api.sincronizarChecklist(acta._id);
      setActa(normalizarActa(data));
      avisar('ok', `${meta?.agregados ?? 0} enlace(s) incorporados al checklist`);
    } catch (err) { avisar('critico', describirError(err)); }
    setSincronizando(false);
  }

  if (estado.cargando) return <p className="flex items-center gap-2 text-sm text-noc-muted"><Loader2 size={15} className="animate-spin" /> Cargando turno…</p>;
  if (estado.error) return <><Aviso>{estado.error}</Aviso><Boton onClick={cargar}>Reintentar</Boton></>;
  if (!acta) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <ItemsAtencion />
        <MantenimientosTurno />
        {anterior ? (
          <>
            <p className="text-sm text-noc-muted">Antes de abrir tu turno, lee lo que dejó el turno anterior.</p>
            <TurnoAnterior acta={anterior} aviso={avisoContinuidad(horarios, tipoAbrir, anterior)} />
          </>
        ) : (
          <p className="text-center text-sm text-noc-muted">Aún no hay turnos cerrados anteriores.</p>
        )}
        <AbrirTurno tipo={tipoAbrir} setTipo={setTipoManual} horarios={horarios} onAbierto={(a) => { setActa(a); avisar('ok', `Turno ${a.tipo_turno.toLowerCase()} abierto`); }} />
      </div>
    );
  }

  const { total, resueltos } = resumenActa(acta);
  const nuevos = acta.cerrado ? [] : enlacesNuevos(acta, enlaces);
  const estadoActual = (i) => (i.enlaceId ? enlaces[i.enlaceId] : null);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Turno {acta.tipo_turno.toLowerCase()} {rangoTurno(horarios, acta.tipo_turno) && <span className="font-normal text-noc-muted">· {rangoTurno(horarios, acta.tipo_turno)}</span>} {acta.cerrado ? <span className="ml-1 rounded bg-noc-raised px-1.5 py-0.5 text-xs font-normal text-noc-muted">cerrado</span> : <span className="ml-1 rounded bg-estado-ok/15 px-1.5 py-0.5 text-xs font-normal text-estado-ok">abierto</span>}</h2>
          <p className="text-sm text-noc-muted">
            {acta.operador?.nombre} · turno del {fechaDia(acta.fecha_turno)} · desde {fechaHora(acta.fecha_inicio)} ({acta.cerrado ? `duró ${fmtDuracion(duracionTurnoMin(acta))}` : hace(acta.fecha_inicio, ahora)})
          </p>
        </div>
        <div className="flex gap-2">
          <Boton onClick={() => setDialogo('imprimir')}><FileText size={14} /> Vista imprimible</Boton>
          {!acta.cerrado && <Boton variante="primario" onClick={() => setDialogo('cerrar')}><CheckCircle2 size={14} /> Cerrar turno</Boton>}
        </div>
      </div>

      {/* Desplegado mientras el operador no empieza el checklist; plegado si ya avanzó (p. ej. al recargar la página) */}
      {!acta.cerrado && <ItemsAtencion className="mb-4" />}
      {!acta.cerrado && <MantenimientosTurno className="mb-4" />}
      {anterior && !acta.cerrado && <div className="mb-4"><TurnoAnterior acta={anterior} aviso={avisoContinuidad(horarios, acta.tipo_turno, anterior)} inicialAbierto={!acta.items.some(itemResuelto)} /></div>}

      <div className="mb-4 rounded-lg border border-noc-line bg-noc-panel px-4 py-3">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span>Checklist de enlaces recibidos</span>
          <span className="font-mono tabular-nums text-noc-muted">{resueltos} de {total} resueltos</span>
        </div>
        <div role="progressbar" aria-label="Enlaces resueltos" aria-valuemin={0} aria-valuemax={total} aria-valuenow={resueltos} className="h-1.5 overflow-hidden rounded-full bg-noc-raised">
          <div className="h-full rounded-full bg-estado-ok transition-all" style={{ width: total ? `${(resueltos / total) * 100}%` : '100%' }} />
        </div>
      </div>

      {nuevos.length > 0 && (
        <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-estado-deg/50 bg-estado-deg/10 px-4 py-3 text-sm">
          <span>
            <b className="font-medium">{nuevos.length} enlace(s) cayeron después de abrir el turno</b> y no están en el checklist:{' '}
            <span className="font-mono text-xs">{nuevos.slice(0, 4).map((l) => l.id_enlace).join(', ')}{nuevos.length > 4 ? '…' : ''}</span>
          </span>
          <Boton cargando={sincronizando} onClick={sincronizar}><RefreshCw size={14} /> Incorporar al checklist</Boton>
        </div>
      )}

      <ChecklistTabla items={acta.items} editable={!acta.cerrado} estadoActual={estadoActual} onGestionado={onGestionado} onAccion={onAccion} notasPrevias={acta.cerrado ? {} : notasPrevias} />

      <section className="mt-5" aria-label="Bitácora general">
        <label htmlFor="bitacora" className="mb-1 block text-sm font-semibold">Bitácora general</label>
        {acta.cerrado ? (
          <p className="whitespace-pre-wrap rounded-md border border-noc-line px-3 py-2 text-sm">{acta.bitacora_general || <span className="text-noc-muted">Sin observaciones.</span>}</p>
        ) : (
          <textarea
            id="bitacora" rows={4} maxLength={10000} className={entrada}
            placeholder="Novedades del turno, contexto para quien recibe…"
            value={bitacora ?? acta.bitacora_general}
            onChange={(e) => setBitacora(e.target.value)} onBlur={guardarBitacora}
          />
        )}
        {!acta.cerrado && <p className="mt-1 text-xs text-noc-muted">Se guarda al salir del campo.</p>}
      </section>

      {acta.cerrado && (
        <div className="mt-5 flex justify-end gap-2">
          <Boton onClick={() => setEstado({ cargando: false, acta: null, error: null })}>Abrir un nuevo turno</Boton>
        </div>
      )}

      {dialogo === 'cerrar' && <CerrarTurno acta={acta} esperarGuardados={esperarGuardados} onClose={() => setDialogo(null)} onCerrado={(a) => { setActa(a); setDialogo('imprimir'); avisar('ok', 'Turno cerrado'); }} />}
      {dialogo === 'imprimir' && <VistaPreviaActa actaId={acta._id} onClose={() => setDialogo(null)} />}
    </div>
  );
}
