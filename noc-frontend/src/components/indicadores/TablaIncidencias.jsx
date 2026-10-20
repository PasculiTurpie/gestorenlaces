import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { fechaHora } from '../../lib/format.js';
import { fmtDuracion } from '../../lib/turno.js';
import { useAuth } from '../../store/authStore.js';
import { useTopology } from '../../store/topologyStore.js';
import EstadoBadge from '../EstadoBadge.jsx';
import { Aviso, Boton, Campo, Celda, Dialogo, Tabla, entrada } from '../admin/ui.jsx';

function EditarIncidencia({ incidencia, onGuardada, onClose }) {
  const [causa, setCausa] = useState(incidencia.causa_raiz ?? '');
  const [ticket, setTicket] = useState(incidencia.ticket ?? '');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    const body = {};
    if (causa.trim() !== (incidencia.causa_raiz ?? '')) body.causa_raiz = causa.trim();
    if (ticket.trim() !== (incidencia.ticket ?? '')) body.ticket = ticket.trim();
    if (!Object.keys(body).length) return onClose();
    setEnviando(true); setError(null);
    try {
      const { data } = await api.actualizarIncidencia(incidencia._id, body);
      onGuardada(data);
      useTopology.getState().pushToast({ nivel: 'ok', texto: 'Incidencia actualizada' });
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo="Causa raíz de la incidencia" descripcion={`${incidencia.enlace?.id_enlace} · ${incidencia.severidad === 'Caido' ? 'Caído' : 'Degradado'} desde ${fechaHora(incidencia.inicio)}`} onClose={onClose} ancho="max-w-md">
      <form onSubmit={guardar}>
        <Campo id="i-causa" etiqueta="Causa raíz" ayuda="Suele conocerse después del cierre (post-mortem). Se guarda en el historial de la incidencia.">
          <textarea id="i-causa" rows={3} maxLength={1000} value={causa} onChange={(e) => setCausa(e.target.value)} className={entrada} autoFocus />
        </Campo>
        <Campo id="i-ticket" etiqueta="Ticket"><input id="i-ticket" maxLength={60} value={ticket} onChange={(e) => setTicket(e.target.value)} className={`${entrada} font-mono`} /></Campo>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>Guardar</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

/** Incidencias del período. Las cerradas sin causa raíz se destacan: son trabajo pendiente del post-mortem. */
export default function TablaIncidencias({ incidencias, onActualizada }) {
  const rol = useAuth((s) => s.user?.rol);
  const puedeEditar = rol === 'Supervisor' || rol === 'Admin';
  const [editando, setEditando] = useState(null);

  return (
    <>
      <Tabla columnas={['Enlace', 'Estado', 'Alarma', 'Inicio', 'Fin', 'Duración', 'Ticket', 'Causa raíz', ...(puedeEditar ? [''] : [])]} vacio="No hubo incidencias en el período.">
        {incidencias.map((i) => (
          <tr key={i._id}>
            <Celda className="font-mono text-xs">{i.enlace?.id_enlace ?? '—'}</Celda>
            <Celda><EstadoBadge estado={i.severidad} /></Celda>
            <Celda className="text-xs">
              {i.tipificacion ? <span className="font-mono" title={i.tipificacion.nombre}>{i.tipificacion.codigo}</span> : <span className="text-noc-muted">Sin tipificar</span>}
              {i.filamentos_afectados?.length > 0 && <div className="text-noc-muted">{i.filamentos_afectados.length === 2 ? 'ida y vuelta' : `solo ${i.filamentos_afectados[0]}`}</div>}
            </Celda>
            <Celda className="tabular-nums">{fechaHora(i.inicio)}</Celda>
            <Celda className="tabular-nums">{i.abierta ? <span className="text-estado-down">En curso</span> : fechaHora(i.fin)}</Celda>
            <Celda className="tabular-nums">{i.abierta ? '—' : fmtDuracion(i.duracion_minutos)}</Celda>
            <Celda className="font-mono text-xs">{i.ticket || <span className="text-noc-muted">—</span>}</Celda>
            <Celda className="max-w-[18rem]">
              {i.causa_raiz ? i.causa_raiz : i.abierta ? <span className="text-noc-muted">—</span> : <span className="text-estado-deg">Sin causa raíz</span>}
            </Celda>
            {puedeEditar && <Celda className="text-right"><Boton aria-label={`Editar causa raíz de ${i.enlace?.id_enlace}`} onClick={() => setEditando(i)}><Pencil size={13} /></Boton></Celda>}
          </tr>
        ))}
      </Tabla>
      {editando && <EditarIncidencia incidencia={editando} onGuardada={onActualizada} onClose={() => setEditando(null)} />}
    </>
  );
}
