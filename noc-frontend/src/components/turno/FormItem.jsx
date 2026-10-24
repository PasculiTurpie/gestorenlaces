import { useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { TITULOS_SUGERIDOS, aPayloadItem, cambiosItem, formularioItem, validarItem } from '../../lib/items.js';
import { useAuth } from '../../store/authStore.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Campo, Dialogo, entrada } from '../admin/ui.jsx';

/** Ingresar (o editar) un ítem de atención: cualquier cosa que haya que atender además de los enlaces. */
export default function FormItem({ item = null, onClose }) {
  const nombre = useAuth((s) => s.user?.nombre);
  const [f, setF] = useState(() => formularioItem(item));
  const [intento, setIntento] = useState(false); // tras el primer intento, los errores se recalculan en vivo
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const errores = useMemo(() => (intento ? validarItem(f) : {}), [intento, f]);
  const set = (c) => (e) => setF((x) => ({ ...x, [c]: e.target.value }));

  async function guardar(ev) {
    ev.preventDefault();
    setIntento(true);
    if (Object.keys(validarItem(f)).length) return;
    setEnviando(true); setError(null);
    try {
      if (item) {
        const cambios = cambiosItem(item, f);
        if (Object.keys(cambios).length) await api.actualizarItem(item._id, cambios);
      } else await api.crearItem(aPayloadItem(f));
      await useTopology.getState().cargarItems();
      useTopology.getState().pushToast({ nivel: 'ok', texto: item ? 'Ítem actualizado' : `Ítem «${f.titulo.trim()}» ingresado` });
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo={item ? 'Editar ítem' : 'Agregar ítem a atender'} descripcion="Corte de cable, de energía o cualquier otra falla de la red. Lo ven todos los operadores." onClose={onClose} ancho="max-w-xl">
      <form onSubmit={guardar} noValidate aria-label="Ítem de atención">
        <Campo id="i-titulo" etiqueta="Qué hay que atender" ayuda="Elija una sugerencia o escriba lo que corresponda.">
          <input id="i-titulo" list="i-titulos" value={f.titulo} onChange={set('titulo')} maxLength={120} className={entrada} aria-invalid={Boolean(errores.titulo)} autoComplete="off" />
          <datalist id="i-titulos">{TITULOS_SUGERIDOS.map((t) => <option key={t} value={t} />)}</datalist>
          {errores.titulo && <p className="mt-1 text-xs text-red-300">{errores.titulo}</p>}
        </Campo>
        <Campo id="i-ticket" etiqueta="Número de ticket" ayuda="Obligatorio. Si todavía no tiene número, escriba «Pendiente» y edítelo cuando lo tenga.">
          <input id="i-ticket" value={f.ticket} onChange={set('ticket')} maxLength={60} className={entrada} aria-invalid={Boolean(errores.ticket)} autoComplete="off" />
          {errores.ticket && <p className="mt-1 text-xs text-red-300">{errores.ticket}</p>}
        </Campo>
        <Campo id="i-desc" etiqueta="Descripción" ayuda="Dónde, desde cuándo, qué afecta y qué se ha hecho.">
          <textarea id="i-desc" value={f.descripcion} onChange={set('descripcion')} rows={4} maxLength={2000} className={entrada} aria-invalid={Boolean(errores.descripcion)} />
          {errores.descripcion && <p className="mt-1 text-xs text-red-300">{errores.descripcion}</p>}
        </Campo>
        {!item && <p className="mb-4 text-xs text-noc-muted">Quedará registrado a nombre de <b className="font-medium text-noc-text">{nombre}</b>, con la fecha y el turno.</p>}
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>{item ? 'Guardar cambios' : 'Agregar ítem'}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}
