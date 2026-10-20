import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../lib/api.js';
import { COLORES_TIPO, claveDesdeNombre } from '../../lib/catalogos.js';
import { describirError } from '../../lib/errores.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Campo, Cabecera, Celda, Dialogo, Insignia, Tabla, entrada } from './ui.jsx';

// Tras cambiar un tipo se vuelve a leer todo: el nombre y el color viajan dentro de cada enlace.
const refrescar = () => useTopology.getState().cargar({ silencioso: true });

function FormTipo({ tipo, onClose }) {
  const nuevo = !tipo;
  const [f, setF] = useState({ nombre: tipo?.nombre ?? '', clave: tipo?.clave ?? '', color: tipo?.color ?? COLORES_TIPO[0], descripcion: tipo?.descripcion ?? '', activo: tipo?.activo ?? true });
  const [claveManual, setClaveManual] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cambiarNombre = (e) => { const nombre = e.target.value; setF((x) => ({ ...x, nombre, ...(nuevo && !claveManual && { clave: claveDesdeNombre(nombre) }) })); };

  async function guardar(e) {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      if (nuevo) await api.crearTipo({ clave: f.clave, nombre: f.nombre.trim(), color: f.color, descripcion: f.descripcion.trim(), activo: f.activo });
      else await api.actualizarTipo(tipo._id, { nombre: f.nombre.trim(), color: f.color, descripcion: f.descripcion.trim(), activo: f.activo });
      await refrescar();
      useTopology.getState().pushToast({ nivel: 'ok', texto: nuevo ? `Tipo ${f.nombre} creado` : `Tipo ${f.nombre} actualizado` });
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo={nuevo ? 'Nuevo tipo de línea' : `Editar tipo ${tipo.nombre}`} descripcion="Indica a quién pertenece una línea: la red propia u otra telco." onClose={onClose}>
      <form onSubmit={guardar}>
        <Campo id="t-nombre" etiqueta="Nombre"><input id="t-nombre" required minLength={2} maxLength={60} value={f.nombre} onChange={cambiarNombre} className={entrada} placeholder="Ej. Movistar" autoFocus /></Campo>
        <Campo id="t-clave" etiqueta="Clave" ayuda={nuevo ? 'Identificador estable; no se puede cambiar después.' : 'La clave no se puede cambiar.'}>
          <input id="t-clave" required maxLength={24} value={f.clave} onChange={(e) => { setClaveManual(true); setF((x) => ({ ...x, clave: e.target.value.toUpperCase() })); }} disabled={!nuevo} className={`${entrada} font-mono`} />
        </Campo>
        <Campo id="t-color" etiqueta="Color en el mapa" ayuda="Se muestra en el «+» de cada enlace. Evite verde, naranja, rojo y azul: son los colores de estado.">
          <div className="flex flex-wrap items-center gap-2">
            <input id="t-color" type="color" value={f.color} onChange={(e) => setF((x) => ({ ...x, color: e.target.value }))} className="h-9 w-12 cursor-pointer rounded border border-noc-line bg-noc-bg p-0.5" />
            {COLORES_TIPO.map((c) => (
              <button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={f.color === c} onClick={() => setF((x) => ({ ...x, color: c }))}
                className="h-6 w-6 rounded border-2" style={{ background: c, borderColor: f.color === c ? '#d9e3ee' : 'transparent' }} />
            ))}
          </div>
        </Campo>
        <Campo id="t-desc" etiqueta="Descripción"><input id="t-desc" maxLength={300} value={f.descripcion} onChange={(e) => setF((x) => ({ ...x, descripcion: e.target.value }))} className={entrada} /></Campo>
        {!tipo?.propio && (
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.activo} onChange={(e) => setF((x) => ({ ...x, activo: e.target.checked }))} />
            Activo <span className="text-xs text-noc-muted">(un tipo desactivado no se puede asignar a enlaces nuevos)</span>
          </label>
        )}
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>{nuevo ? 'Crear tipo' : 'Guardar cambios'}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

function ConfirmarBorrado({ tipo, onClose }) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function borrar() {
    setEnviando(true); setError(null);
    try { await api.eliminarTipo(tipo._id); await refrescar(); useTopology.getState().pushToast({ nivel: 'ok', texto: `Tipo ${tipo.nombre} eliminado` }); onClose(); }
    catch (err) { setError(describirError(err)); setEnviando(false); }
  }
  return (
    <Dialogo titulo={`Eliminar tipo ${tipo.nombre}`} onClose={onClose} ancho="max-w-md">
      <p className="mb-3 text-sm">Solo se puede eliminar un tipo que ningún enlace use. Si está en uso, desactívelo en su lugar.</p>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex justify-end gap-2">
        <Boton onClick={onClose}>Cancelar</Boton>
        <Boton variante="peligro" cargando={enviando} onClick={borrar}>Eliminar tipo</Boton>
      </div>
    </Dialogo>
  );
}

export default function TiposAdmin() {
  const tipos = useTopology((s) => s.tipos);
  const [dialogo, setDialogo] = useState(null);

  return (
    <>
      <Cabecera
        titulo="Tipos de línea"
        descripcion="A quién pertenece cada enlace: la red propia u otra telco. El tipo se asigna a cada enlace desde la sección Enlaces."
        acciones={<Boton variante="primario" onClick={() => setDialogo({ tipo: 'form' })}><Plus size={15} /> Nuevo tipo</Boton>}
      />
      <Tabla columnas={['Tipo', 'Clave', 'Descripción', 'Enlaces', 'Estado', '']} vacio="No hay tipos de línea. Ejecute «npm run seed:tipos» o cree el primero.">
        {tipos.map((t) => (
          <tr key={t._id} className={t.activo ? '' : 'opacity-60'}>
            <Celda><Insignia color={t.color}>{t.nombre}</Insignia>{t.propio && <span className="ml-2 text-xs text-noc-muted">red propia</span>}</Celda>
            <Celda className="font-mono text-xs">{t.clave}</Celda>
            <Celda className="text-noc-muted">{t.descripcion || '—'}</Celda>
            <Celda className="tabular-nums">{t.enlaces}</Celda>
            <Celda>{t.activo ? 'Activo' : 'Desactivado'}</Celda>
            <Celda className="text-right">
              <Boton className="mr-1.5" aria-label={`Editar ${t.nombre}`} onClick={() => setDialogo({ tipo: 'form', t })}><Pencil size={13} /> Editar</Boton>
              {!t.propio && <Boton variante="peligro" aria-label={`Eliminar ${t.nombre}`} onClick={() => setDialogo({ tipo: 'borrar', t })}><Trash2 size={13} /></Boton>}
            </Celda>
          </tr>
        ))}
      </Tabla>
      {dialogo?.tipo === 'form' && <FormTipo tipo={dialogo.t} onClose={() => setDialogo(null)} />}
      {dialogo?.tipo === 'borrar' && <ConfirmarBorrado tipo={dialogo.t} onClose={() => setDialogo(null)} />}
    </>
  );
}
