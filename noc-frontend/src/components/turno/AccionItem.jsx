import { useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Campo, Dialogo, entrada } from '../admin/ui.jsx';

const TEXTOS = {
  seguimiento: { titulo: 'Agregar seguimiento', etiqueta: 'Qué se hizo o qué se supo', boton: 'Agregar seguimiento', min: 1, mensaje: 'Escriba el seguimiento' },
  resolver: { titulo: 'Resolver ítem', etiqueta: 'Cómo se resolvió', boton: 'Marcar como resuelto', min: 3, mensaje: 'Indique cómo se resolvió (mín. 3 caracteres)' },
};

/** Agregar seguimiento o resolver un ítem de atención (cualquier operador del turno puede hacerlo). */
export default function AccionItem({ accion, item, onClose }) {
  const [texto, setTexto] = useState('');
  const [intento, setIntento] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const t = TEXTOS[accion];
  const invalido = texto.trim().length < t.min;

  async function enviar(ev) {
    ev.preventDefault();
    setIntento(true);
    if (invalido) return;
    setEnviando(true); setError(null);
    try {
      if (accion === 'seguimiento') await api.seguimientoItem(item._id, texto.trim()); else await api.resolverItem(item._id, texto.trim());
      await useTopology.getState().cargarItems();
      useTopology.getState().pushToast({ nivel: 'ok', texto: accion === 'resolver' ? `Ítem «${item.titulo}» resuelto` : 'Seguimiento agregado' });
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo={t.titulo} descripcion={`«${item.titulo}» · ticket ${item.ticket}`} onClose={onClose}>
      <form onSubmit={enviar} noValidate aria-label={t.titulo}>
        <Campo id="a-item-texto" etiqueta={t.etiqueta}>
          <textarea id="a-item-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={1000} className={entrada} aria-invalid={intento && invalido} />
          {intento && invalido && <p className="mt-1 text-xs text-red-300">{t.mensaje}</p>}
        </Campo>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2"><Boton onClick={onClose}>Cancelar</Boton><Boton type="submit" variante="primario" cargando={enviando}>{t.boton}</Boton></div>
      </form>
    </Dialogo>
  );
}
