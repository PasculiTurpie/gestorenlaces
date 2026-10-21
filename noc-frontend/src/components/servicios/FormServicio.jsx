import { useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Campo, Dialogo, entrada } from '../admin/ui.jsx';
import SelectorEnlaces from '../mantenimientos/SelectorEnlaces.jsx';

/** Alta o edición manual de un servicio y de los enlaces por los que pasa. */
export default function FormServicio({ servicio = null, onClose, onGuardado }) {
  const [f, setF] = useState(() => ({ nombre: servicio?.nombre ?? '', codigo: servicio?.codigo ?? '', cliente: servicio?.cliente ?? '', tipo: servicio?.tipo ?? '', capacidad: servicio?.capacidad ?? '', observacion: servicio?.observacion ?? '', enlaces: (servicio?.enlaces ?? []).map((e) => e._id ?? e) }));
  const [error, setError] = useState(null);
  const [intento, setIntento] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const set = (c) => (e) => setF((x) => ({ ...x, [c]: e.target.value }));
  const errorNombre = intento && f.nombre.trim().length < 2 ? 'Escriba el nombre del servicio' : null;

  async function guardar(ev) {
    ev.preventDefault();
    setIntento(true);
    if (f.nombre.trim().length < 2) return;
    setEnviando(true); setError(null);
    const cuerpo = { nombre: f.nombre.trim(), codigo: f.codigo.trim(), cliente: f.cliente.trim(), tipo: f.tipo.trim(), capacidad: f.capacidad.trim(), observacion: f.observacion.trim(), enlaces: f.enlaces };
    try {
      const r = servicio ? await api.actualizarServicio(servicio._id, cuerpo) : await api.crearServicio(cuerpo);
      await useTopology.getState().cargarServicios();
      useTopology.getState().pushToast({ nivel: 'ok', texto: servicio ? `Servicio «${r.data.nombre}» actualizado` : `Servicio «${r.data.nombre}» creado` });
      onGuardado?.(r.data);
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo={servicio ? 'Editar servicio' : 'Nuevo servicio'} descripcion="Qué servicio es y por qué enlaces pasa." onClose={onClose} ancho="max-w-2xl">
      <form onSubmit={guardar} noValidate aria-label="Servicio">
        <Campo id="s-nombre" etiqueta="Servicio" ayuda="Nombre con que se conoce. No puede repetirse (no distingue mayúsculas ni tildes).">
          <input id="s-nombre" value={f.nombre} onChange={set('nombre')} maxLength={120} className={entrada} aria-invalid={Boolean(errorNombre)} />
          {errorNombre && <p className="mt-1 text-xs text-red-300">{errorNombre}</p>}
        </Campo>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Campo id="s-cliente" etiqueta="Cliente"><input id="s-cliente" value={f.cliente} onChange={set('cliente')} maxLength={120} className={entrada} /></Campo>
          <Campo id="s-tipo" etiqueta="Tipo de servicio"><input id="s-tipo" value={f.tipo} onChange={set('tipo')} maxLength={60} placeholder="TV, datos, voz…" className={entrada} /></Campo>
          <Campo id="s-cap" etiqueta="Capacidad"><input id="s-cap" value={f.capacidad} onChange={set('capacidad')} maxLength={40} placeholder="10G, STM-64…" className={entrada} /></Campo>
          <Campo id="s-codigo" etiqueta="Código"><input id="s-codigo" value={f.codigo} onChange={set('codigo')} maxLength={60} className={entrada} /></Campo>
        </div>
        <Campo id="s-enlaces" etiqueta="Enlaces por los que pasa" ayuda="Busque por código de enlace o por los nodos que une.">
          <SelectorEnlaces id="s-enlaces" seleccion={f.enlaces} onChange={(enl) => setF((x) => ({ ...x, enlaces: enl }))} />
        </Campo>
        <Campo id="s-obs" etiqueta="Observación"><textarea id="s-obs" value={f.observacion} onChange={set('observacion')} rows={2} maxLength={500} className={entrada} /></Campo>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>{servicio ? 'Guardar cambios' : 'Crear servicio'}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}
