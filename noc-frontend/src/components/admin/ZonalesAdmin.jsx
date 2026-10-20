import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api.js';
import { COLORES_TIPO, claveDesdeNombre } from '../../lib/catalogos.js';
import { describirError } from '../../lib/errores.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Campo, Cabecera, Celda, Dialogo, Insignia, Tabla, entrada } from './ui.jsx';

// Tras cambiar una zonal se relee todo: su nombre y color viajan dentro de los tramos de cada enlace.
const refrescar = () => useTopology.getState().cargar({ silencioso: true });
const COLORES = ['#14b8a6', '#8b5cf6', '#ec4899', '#eab308', '#06b6d4', '#a855f7', '#f43f5e', '#84cc16'];

function FormZonal({ zonal, onClose }) {
  const nueva = !zonal;
  const [f, setF] = useState({ nombre: zonal?.nombre ?? '', clave: zonal?.clave ?? '', color: zonal?.color ?? COLORES[0], descripcion: zonal?.descripcion ?? '', activo: zonal?.activo ?? true });
  const [claveManual, setClaveManual] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiarNombre = (e) => { const nombre = e.target.value; setF((x) => ({ ...x, nombre, ...(nueva && !claveManual && { clave: claveDesdeNombre(nombre) }) })); };

  async function guardar(e) {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      if (nueva) await api.crearZonal({ clave: f.clave, nombre: f.nombre.trim(), color: f.color, descripcion: f.descripcion.trim(), activo: f.activo });
      else await api.actualizarZonal(zonal._id, { nombre: f.nombre.trim(), color: f.color, descripcion: f.descripcion.trim(), activo: f.activo });
      await refrescar();
      useTopology.getState().pushToast({ nivel: 'ok', texto: nueva ? `Zonal ${f.nombre} creada` : `Zonal ${f.nombre} actualizada` });
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo={nueva ? 'Nueva zonal' : `Editar zonal ${zonal.nombre}`} descripcion="Zona operativa a la que pertenece un tramo de fibra." onClose={onClose}>
      <form onSubmit={guardar}>
        <Campo id="z-nombre" etiqueta="Nombre"><input id="z-nombre" required minLength={2} maxLength={60} value={f.nombre} onChange={cambiarNombre} className={entrada} placeholder="Ej. Zonal Los Ríos" autoFocus /></Campo>
        <Campo id="z-clave" etiqueta="Clave" ayuda={nueva ? 'Identificador estable; no se puede cambiar después.' : 'La clave no se puede cambiar.'}>
          <input id="z-clave" required maxLength={24} value={f.clave} onChange={(e) => { setClaveManual(true); setF((x) => ({ ...x, clave: e.target.value.toUpperCase() })); }} disabled={!nueva} className={`${entrada} font-mono`} />
        </Campo>
        <Campo id="z-color" etiqueta="Color" ayuda="Distingue la zonal en la barra de tramos de cada enlace.">
          <div className="flex flex-wrap items-center gap-2">
            <input id="z-color" type="color" value={f.color} onChange={(e) => setF((x) => ({ ...x, color: e.target.value }))} className="h-9 w-12 cursor-pointer rounded border border-noc-line bg-noc-bg p-0.5" />
            {COLORES.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={f.color === c} onClick={() => setF((x) => ({ ...x, color: c }))} className="h-6 w-6 rounded border-2" style={{ background: c, borderColor: f.color === c ? '#d9e3ee' : 'transparent' }} />
            ))}
          </div>
        </Campo>
        <Campo id="z-desc" etiqueta="Descripción"><input id="z-desc" maxLength={300} value={f.descripcion} onChange={(e) => setF((x) => ({ ...x, descripcion: e.target.value }))} className={entrada} /></Campo>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} />
          Activa <span className="text-xs text-noc-muted">(una zonal desactivada no se puede asignar a tramos nuevos)</span>
        </label>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>{nueva ? 'Crear zonal' : 'Guardar cambios'}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

function ConfirmarBorrado({ zonal, onClose }) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function borrar() {
    setEnviando(true); setError(null);
    try { await api.eliminarZonal(zonal._id); await refrescar(); useTopology.getState().pushToast({ nivel: 'ok', texto: `Zonal ${zonal.nombre} eliminada` }); onClose(); }
    catch (err) { setError(describirError(err)); setEnviando(false); }
  }
  return (
    <Dialogo titulo={`Eliminar zonal ${zonal.nombre}`} onClose={onClose} ancho="max-w-md">
      <p className="mb-3 text-sm">Solo se puede eliminar una zonal sin tramos asignados. Si está en uso, desactívela en su lugar.</p>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex justify-end gap-2">
        <Boton onClick={onClose}>Cancelar</Boton>
        <Boton variante="peligro" cargando={enviando} onClick={borrar}>Eliminar zonal</Boton>
      </div>
    </Dialogo>
  );
}

export default function ZonalesAdmin() {
  const zonales = useTopology((s) => s.zonales);
  const [dialogo, setDialogo] = useState(null);

  return (
    <>
      <Cabecera
        titulo="Zonales"
        descripcion="Zonas operativas. Un enlace puede cruzar varias: en la edición de cada enlace se indica qué kilómetros pertenecen a cada una."
        acciones={<Boton variante="primario" onClick={() => setDialogo({ tipo: 'form' })}><Plus size={15} /> Nueva zonal</Boton>}
      />
      <Tabla columnas={['Zonal', 'Clave', 'Descripción', 'Enlaces', 'Estado', '']} vacio="Aún no hay zonales. Cree la primera para poder repartir los kilómetros de los enlaces.">
        {zonales.map((z) => (
          <tr key={z._id} className={z.activo ? '' : 'opacity-60'}>
            <Celda><Insignia color={z.color}>{z.nombre}</Insignia></Celda>
            <Celda className="font-mono text-xs">{z.clave}</Celda>
            <Celda className="text-noc-muted">{z.descripcion || '—'}</Celda>
            <Celda className="tabular-nums">{z.enlaces}</Celda>
            <Celda>{z.activo ? 'Activa' : 'Desactivada'}</Celda>
            <Celda className="text-right">
              <Boton className="mr-1.5" aria-label={`Editar ${z.nombre}`} onClick={() => setDialogo({ tipo: 'form', z })}><Pencil size={13} /> Editar</Boton>
              <Boton variante="peligro" aria-label={`Eliminar ${z.nombre}`} onClick={() => setDialogo({ tipo: 'borrar', z })}><Trash2 size={13} /></Boton>
            </Celda>
          </tr>
        ))}
      </Tabla>
      {dialogo?.tipo === 'form' && <FormZonal zonal={dialogo.z} onClose={() => setDialogo(null)} />}
      {dialogo?.tipo === 'borrar' && <ConfirmarBorrado zonal={dialogo.z} onClose={() => setDialogo(null)} />}
    </>
  );
}
