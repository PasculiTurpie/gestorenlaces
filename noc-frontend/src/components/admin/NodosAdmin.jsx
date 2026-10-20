import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { ETIQUETA_TIPO_NODO, TIPOS_NODO } from '../../lib/catalogos.js';
import { describirError } from '../../lib/errores.js';
import { leerNumero } from '../../lib/levantamiento.js';
import { contarEnlacesPorNodo } from '../../lib/selectors.js';
import { useAuth } from '../../store/authStore.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Campo, Cabecera, Celda, Dialogo, Tabla, entrada, entradaAuto } from './ui.jsx';

function FormNodo({ nodo, onClose }) {
  const nuevo = !nodo;
  const [f, setF] = useState({ id_nodo: nodo?.id_nodo ?? '', nombre: nodo?.nombre ?? '', tipo: nodo?.tipo ?? 'ESTACION', x: nodo ? String(nodo.posicion.x) : '', y: nodo ? String(nodo.posicion.y) : '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    const x = leerNumero(f.x), y = leerNumero(f.y);
    if (Number.isNaN(x) || Number.isNaN(y)) return setError('La posición X e Y deben ser números.');
    const posicion = x != null && y != null ? { x, y } : undefined;
    if ((x == null) !== (y == null)) return setError('Indique X e Y, o deje ambos vacíos.');
    setEnviando(true); setError(null);
    try {
      const T = useTopology.getState();
      if (nuevo) T.aplicarNodo((await api.crearNodo({ id_nodo: f.id_nodo.trim(), nombre: f.nombre.trim(), tipo: f.tipo, ...(posicion && { posicion }) })).data);
      else T.aplicarNodo((await api.actualizarNodo(nodo.id_nodo, { nombre: f.nombre.trim(), tipo: f.tipo, ...(posicion && { posicion }) })).data);
      T.pushToast({ nivel: 'ok', texto: nuevo ? `Nodo ${f.id_nodo.toUpperCase()} creado` : `Nodo ${nodo.id_nodo} actualizado` });
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo={nuevo ? 'Nuevo nodo' : `Editar nodo ${nodo.id_nodo}`} onClose={onClose}>
      <form onSubmit={guardar}>
        <Campo id="n-id" etiqueta="Código del nodo" ayuda={nuevo ? 'Identificador corto y único (ej. VLDV). No se puede cambiar después.' : 'El código no se puede cambiar: enlaces e historial lo referencian.'}>
          <input id="n-id" required maxLength={32} value={f.id_nodo} onChange={set('id_nodo')} disabled={!nuevo} className={`${entrada} font-mono uppercase`} autoFocus={nuevo} />
        </Campo>
        <Campo id="n-nombre" etiqueta="Nombre"><input id="n-nombre" required maxLength={120} value={f.nombre} onChange={set('nombre')} className={entrada} autoFocus={!nuevo} /></Campo>
        <Campo id="n-tipo" etiqueta="Tipo">
          <select id="n-tipo" value={f.tipo} onChange={set('tipo')} className={entrada}>{TIPOS_NODO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_NODO[t]}</option>)}</select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="n-x" etiqueta="Posición X" ayuda="Coordenadas en el mapa. También se ajustan arrastrando el nodo."><input id="n-x" inputMode="decimal" value={f.x} onChange={set('x')} className={`${entrada} font-mono`} /></Campo>
          <Campo id="n-y" etiqueta="Posición Y"><input id="n-y" inputMode="decimal" value={f.y} onChange={set('y')} className={`${entrada} font-mono`} /></Campo>
        </div>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>{nuevo ? 'Crear nodo' : 'Guardar cambios'}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

function ConfirmarBorrado({ nodo, enlaces, onClose }) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function borrar() {
    setEnviando(true); setError(null);
    try {
      await api.eliminarNodo(nodo.id_nodo);
      useTopology.getState().quitarNodo(nodo.id_nodo);
      useTopology.getState().pushToast({ nivel: 'ok', texto: `Nodo ${nodo.id_nodo} eliminado` });
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }
  return (
    <Dialogo titulo={`Eliminar nodo ${nodo.id_nodo}`} onClose={onClose} ancho="max-w-md">
      <p className="mb-3 text-sm">Esta acción no se puede deshacer.{enlaces > 0 && ` El nodo participa en ${enlaces} enlace(s); el servidor no permitirá eliminarlo hasta que los reasigne o elimine.`}</p>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex justify-end gap-2">
        <Boton onClick={onClose}>Cancelar</Boton>
        <Boton variante="peligro" cargando={enviando} onClick={borrar}>Eliminar nodo</Boton>
      </div>
    </Dialogo>
  );
}

export default function NodosAdmin() {
  const nodos = useTopology((s) => s.nodos);
  const enlaces = useTopology((s) => s.enlaces);
  const rol = useAuth((s) => s.user?.rol);
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [dialogo, setDialogo] = useState(null); // { tipo: 'form'|'borrar', nodo? }

  const porNodo = useMemo(() => contarEnlacesPorNodo(enlaces), [enlaces]);
  const filas = useMemo(() => {
    const t = q.trim().toLowerCase();
    return Object.values(nodos)
      .filter((n) => (!tipo || n.tipo === tipo) && (!t || n.id_nodo.toLowerCase().includes(t) || n.nombre.toLowerCase().includes(t)))
      .sort((a, b) => a.id_nodo.localeCompare(b.id_nodo));
  }, [nodos, q, tipo]);

  return (
    <>
      <Cabecera
        titulo="Nodos"
        descripcion={`${Object.keys(nodos).length} nodos en la red. La posición en el mapa también se cambia arrastrando el nodo.`}
        acciones={<Boton variante="primario" onClick={() => setDialogo({ tipo: 'form' })}><Plus size={15} /> Nuevo nodo</Boton>}
      />
      <div className="mb-3 flex flex-wrap gap-2">
        <input type="search" aria-label="Buscar nodo" placeholder="Buscar por código o nombre" value={q} onChange={(e) => setQ(e.target.value)} className={`${entrada} max-w-xs`} />
        <select aria-label="Filtrar por tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${entradaAuto}`}>
          <option value="">Todos los tipos</option>
          {TIPOS_NODO.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO_NODO[t]}</option>)}
        </select>
      </div>
      <Tabla columnas={['Código', 'Nombre', 'Tipo', 'Posición', 'Enlaces', '']} vacio="Ningún nodo coincide con la búsqueda.">
        {filas.map((n) => (
          <tr key={n.id_nodo}>
            <Celda className="font-mono">{n.id_nodo}</Celda>
            <Celda>{n.nombre}</Celda>
            <Celda>{ETIQUETA_TIPO_NODO[n.tipo] ?? n.tipo}</Celda>
            <Celda className="font-mono text-xs tabular-nums text-noc-muted">{n.posicion.x}, {n.posicion.y}</Celda>
            <Celda className="tabular-nums">{porNodo[n.id_nodo] ?? 0}</Celda>
            <Celda className="text-right">
              <Boton className="mr-1.5" aria-label={`Editar ${n.id_nodo}`} onClick={() => setDialogo({ tipo: 'form', nodo: n })}><Pencil size={13} /> Editar</Boton>
              {rol === 'Admin' && <Boton variante="peligro" aria-label={`Eliminar ${n.id_nodo}`} onClick={() => setDialogo({ tipo: 'borrar', nodo: n })}><Trash2 size={13} /></Boton>}
            </Celda>
          </tr>
        ))}
      </Tabla>
      {dialogo?.tipo === 'form' && <FormNodo nodo={dialogo.nodo} onClose={() => setDialogo(null)} />}
      {dialogo?.tipo === 'borrar' && <ConfirmarBorrado nodo={dialogo.nodo} enlaces={porNodo[dialogo.nodo.id_nodo] ?? 0} onClose={() => setDialogo(null)} />}
    </>
  );
}
