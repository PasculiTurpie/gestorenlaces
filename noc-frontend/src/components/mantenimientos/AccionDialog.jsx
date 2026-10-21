import { useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { nombresEnlaces } from '../../lib/mantenimientos.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Campo, Dialogo, entrada } from '../admin/ui.jsx';

const TEXTOS = {
  iniciar: { titulo: 'Iniciar mantenimiento', boton: 'Iniciar mantenimiento', variante: 'primario' },
  finalizar: { titulo: 'Finalizar mantenimiento', boton: 'Finalizar mantenimiento', variante: 'primario' },
  cancelar: { titulo: 'Cancelar mantenimiento', boton: 'Cancelar mantenimiento', variante: 'peligro' },
};

/** Confirma una acción sobre un mantenimiento y aplica sus efectos en los enlaces (iniciar → Mantenimiento, finalizar → OK). */
export default function AccionDialog({ accion, mantenimiento: m, onClose, onHecho }) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const enlaces = useTopology((s) => s.enlaces);
  const t = TEXTOS[accion];
  const afectados = (m.enlaces ?? []).map((e) => enlaces[e._id ?? e]).filter(Boolean);
  const conFalla = afectados.filter((l) => l.estado === 'Caido' || l.estado === 'Degradado');

  async function confirmar(ev) {
    ev.preventDefault();
    if (accion === 'cancelar' && texto.trim().length < 3) { setError('Indique el motivo de la cancelación'); return; }
    setEnviando(true); setError(null);
    try {
      const r = accion === 'iniciar' ? await api.iniciarMantenimiento(m._id, texto.trim() ? { observacion: texto.trim() } : {})
        : accion === 'finalizar' ? await api.finalizarMantenimiento(m._id, texto.trim() ? { observacion: texto.trim() } : {})
          : await api.cancelarMantenimiento(m._id, { motivo: texto.trim() });
      await useTopology.getState().cargarMantenimientos();
      onHecho(accion, r);
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo={t.titulo} descripcion={`«${m.titulo}» · ${nombresEnlaces(m, 4)}`} onClose={onClose}>
      <form onSubmit={confirmar} noValidate aria-label={t.titulo}>
        {accion === 'iniciar' && (
          <>
            <p className="mb-3 text-sm">Los <b className="font-medium">{m.enlaces.length}</b> enlace(s) pasarán a estado <b className="font-medium">Mantenimiento</b> con la tipificación <span className="font-mono text-xs">{m.tipificacion?.codigo}</span>{m.ticket ? <> y el ticket <span className="font-mono text-xs">{m.ticket}</span></> : null}. Todo el NOC lo verá en el mapa.</p>
            {conFalla.length > 0 && <Aviso tipo="info">Estos enlaces hoy tienen una falla y dejarán de figurar como falla: {conFalla.map((l) => `${l.id_enlace} (${l.estado === 'Caido' ? 'Caído' : l.estado})`).join(', ')}.</Aviso>}
          </>
        )}
        {accion === 'finalizar' && <p className="mb-3 text-sm">Los enlaces que sigan en <b className="font-medium">Mantenimiento</b> volverán a <b className="font-medium">OK</b>. Si alguno cambió a otro estado mientras tanto (por ejemplo, una falla), se respeta y se te avisa.</p>}
        {accion === 'cancelar' && <p className="mb-3 text-sm">El mantenimiento no se realizará. Los enlaces no se modifican. Todos verán que se canceló.</p>}

        <Campo id="a-texto" etiqueta={accion === 'cancelar' ? 'Motivo (obligatorio)' : 'Observación (opcional)'}>
          <textarea id="a-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} maxLength={500} className={entrada} />
        </Campo>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Volver</Boton>
          <Boton type="submit" variante={t.variante} cargando={enviando}>{t.boton}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}
