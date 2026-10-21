import { useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { aPayload, aPayloadEnCurso, conflictosDe, formularioDesde, formularioInicial, nombresEnlaces, validarFormulario, ventanaTexto } from '../../lib/mantenimientos.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Campo, Dialogo, entrada } from '../admin/ui.jsx';
import SelectorEnlaces from './SelectorEnlaces.jsx';

/** Programar (o editar) un mantenimiento. En curso solo se cambian título, descripción, ticket, fin y si hay corte. */
export default function FormMantenimiento({ mantenimiento = null, onClose, onGuardado }) {
  const enCurso = mantenimiento?.estado === 'En curso';
  const [f, setF] = useState(() => (mantenimiento ? formularioDesde(mantenimiento) : formularioInicial()));
  const [intento, setIntento] = useState(false); // tras el primer intento de guardar, los errores se recalculan en vivo y desaparecen al corregirlos
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const alarmas = useTopology((s) => s.alarmas);
  const enlaces = useTopology((s) => s.enlaces);
  const activos = useTopology((s) => s.mantenimientos);

  // tipificaciones de mantenimiento activas (más la actual, aunque se haya desactivado después)
  const tipos = useMemo(() => alarmas.filter((a) => a.estado_sugerido === 'Mantenimiento' && (a.activo || a._id === f.tipificacion)), [alarmas, f.tipificacion]);
  const conflictos = useMemo(() => conflictosDe(f.enlaces, activos, { excluir: mantenimiento?._id }), [f.enlaces, activos, mantenimiento]);
  const enFalla = f.enlaces.map((i) => enlaces[i]).filter((l) => l && l.estado !== 'OK' && l.estado !== 'Mantenimiento');
  const set = (campo) => (e) => setF((x) => ({ ...x, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const sinTipos = tipos.length === 0;
  const errores = useMemo(() => (intento ? validarFormulario(f) : {}), [intento, f]);

  async function guardar(ev) {
    ev.preventDefault();
    setIntento(true);
    if (Object.keys(validarFormulario(f)).length) return;
    setEnviando(true); setError(null);
    try {
      const r = mantenimiento
        ? await api.actualizarMantenimiento(mantenimiento._id, enCurso ? aPayloadEnCurso(f) : aPayload(f))
        : await api.crearMantenimiento(aPayload(f));
      await useTopology.getState().cargarMantenimientos();
      useTopology.getState().pushToast({ nivel: 'ok', texto: mantenimiento ? 'Mantenimiento actualizado' : `Mantenimiento programado: ${r.data.titulo}` });
      onGuardado?.(r.data);
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo={mantenimiento ? 'Editar mantenimiento' : 'Programar mantenimiento'} descripcion="Avisa a todo el NOC que se va a trabajar (o ya se está trabajando) en estos enlaces." onClose={onClose} ancho="max-w-2xl">
      <form onSubmit={guardar} noValidate aria-label="Mantenimiento">
        <Campo id="m-titulo" etiqueta="Título" ayuda="Qué se va a hacer, en pocas palabras. Ej.: Cambio de tarjeta de línea en LNCH.">
          <input id="m-titulo" value={f.titulo} onChange={set('titulo')} maxLength={120} className={entrada} aria-invalid={Boolean(errores.titulo)} />
          {errores.titulo && <p className="mt-1 text-xs text-red-300">{errores.titulo}</p>}
        </Campo>

        <Campo id="m-enlaces" etiqueta="Enlaces afectados" ayuda={enCurso ? 'Con el mantenimiento en curso no se cambian los enlaces.' : 'Al iniciar el mantenimiento pasarán a estado Mantenimiento; al finalizarlo, a OK.'}>
          <SelectorEnlaces seleccion={f.enlaces} onChange={(enl) => setF((x) => ({ ...x, enlaces: enl }))} deshabilitado={enCurso} />
          {errores.enlaces && <p className="mt-1 text-xs text-red-300">{errores.enlaces}</p>}
        </Campo>
        {enFalla.length > 0 && <Aviso tipo="info">Hoy tienen una falla: {enFalla.map((l) => `${l.id_enlace} (${l.estado === 'Caido' ? 'Caído' : l.estado})`).join(', ')}. Al iniciar el mantenimiento pasarán a Mantenimiento.</Aviso>}
        {conflictos.length > 0 && <Aviso tipo="info">Ya hay otro mantenimiento en estos enlaces: {conflictos.map((m) => `«${m.titulo}» (${ventanaTexto(m)}, ${nombresEnlaces(m, 2)})`).join('; ')}.</Aviso>}

        <Campo id="m-tipo" etiqueta="Tipificación" ayuda="Qué clase de trabajo es. Un Admin puede agregar más tipos en Administración → Alarmas (estado sugerido «Mantenimiento»).">
          <select id="m-tipo" value={f.tipificacion} onChange={set('tipificacion')} disabled={enCurso || sinTipos} className={entrada} aria-invalid={Boolean(errores.tipificacion)}>
            <option value="">{sinTipos ? 'No hay tipificaciones de mantenimiento' : 'Elija la tipificación…'}</option>
            {tipos.map((t) => <option key={t._id} value={t._id}>{t.codigo} · {t.nombre}</option>)}
          </select>
          {errores.tipificacion && <p className="mt-1 text-xs text-red-300">{errores.tipificacion}</p>}
        </Campo>

        <div className="grid gap-x-4 sm:grid-cols-2">
          <Campo id="m-inicio" etiqueta="Inicio" ayuda={enCurso ? 'Ya inició: no se cambia.' : undefined}>
            <input id="m-inicio" type="datetime-local" value={f.inicio} onChange={set('inicio')} disabled={enCurso} className={entrada} aria-invalid={Boolean(errores.inicio)} />
            {errores.inicio && <p className="mt-1 text-xs text-red-300">{errores.inicio}</p>}
          </Campo>
          <Campo id="m-fin" etiqueta="Fin previsto">
            <input id="m-fin" type="datetime-local" value={f.fin} onChange={set('fin')} className={entrada} aria-invalid={Boolean(errores.fin)} />
            {errores.fin && <p className="mt-1 text-xs text-red-300">{errores.fin}</p>}
          </Campo>
        </div>

        <Campo id="m-ticket" etiqueta="Ticket / cambio" ayuda="Opcional. Ej.: número del cambio o del incidente.">
          <input id="m-ticket" value={f.ticket} onChange={set('ticket')} maxLength={60} className={entrada} />
        </Campo>
        <Campo id="m-desc" etiqueta="Descripción" ayuda="Opcional. Quién trabaja, qué se espera, qué afecta.">
          <textarea id="m-desc" value={f.descripcion} onChange={set('descripcion')} rows={3} maxLength={2000} className={entrada} />
        </Campo>
        <label className="mb-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.con_corte} onChange={set('con_corte')} /> Se prevé corte de servicio</label>

        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>{mantenimiento ? 'Guardar cambios' : 'Programar mantenimiento'}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}
