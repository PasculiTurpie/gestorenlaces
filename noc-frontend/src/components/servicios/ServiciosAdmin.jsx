import { Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Cabecera, Celda, Dialogo, Tabla, entrada } from '../admin/ui.jsx';
import FormServicio from './FormServicio.jsx';
import ImportarServicios from './ImportarServicios.jsx';

const LIMITE = 100;

/** Servicios que pasan por cada enlace: listado, alta/edición manual e importación desde Excel o texto. */
export default function ServiciosAdmin() {
  const total = useTopology((s) => s.serviciosPorEnlace); // cambia cuando alguien carga o edita servicios
  const [q, setQ] = useState('');
  const [busca, setBusca] = useState('');
  const [est, setEst] = useState({ cargando: true, lista: [], total: 0, error: null });
  const [pagina, setPagina] = useState(1);
  const [form, setForm] = useState(null);
  const [importando, setImportando] = useState(false);
  const [borrar, setBorrar] = useState(null);
  const [errorBorrar, setErrorBorrar] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setBusca(q.trim()); setPagina(1); }, 300); return () => clearTimeout(t); }, [q]);

  const cargar = useCallback(async () => {
    setEst((e) => ({ ...e, cargando: true, error: null }));
    try {
      const r = await api.servicios({ q: busca, page: pagina, limit: LIMITE });
      setEst((e) => ({ cargando: false, lista: pagina === 1 ? r.data : [...e.lista, ...r.data], total: r.meta.total, error: null }));
    } catch (err) { setEst((e) => ({ ...e, cargando: false, error: describirError(err) })); }
  }, [busca, pagina]);
  useEffect(() => { cargar(); }, [cargar, total]);

  async function eliminar() {
    setErrorBorrar(null);
    try {
      await api.eliminarServicio(borrar._id);
      await useTopology.getState().cargarServicios();
      useTopology.getState().pushToast({ nivel: 'ok', texto: `Servicio «${borrar.nombre}» eliminado` });
      setBorrar(null);
    } catch (err) { setErrorBorrar(describirError(err)); }
  }

  return (
    <>
      <Cabecera
        titulo="Servicios"
        descripcion="Qué servicios pasan por cada enlace, para saber a quiénes afecta una falla o un mantenimiento. Todos los ven al consultar un enlace."
        acciones={<div className="flex gap-2"><Boton onClick={() => setImportando(true)}><Upload size={14} /> Importar Excel / texto</Boton><Boton variante="primario" onClick={() => setForm({})}><Plus size={14} /> Nuevo servicio</Boton></div>}
      />
      <div className="relative mb-3 max-w-sm">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-2.5 text-noc-muted" aria-hidden="true" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por servicio, cliente, tipo o código…" aria-label="Buscar servicios" className={`${entrada} pl-8`} />
      </div>
      {est.error && <Aviso>{est.error}</Aviso>}
      <Tabla columnas={['Servicio', 'Cliente', 'Tipo', 'Capacidad', 'Enlaces', '']} vacio={!est.cargando && est.lista.length === 0 ? (busca ? 'Ningún servicio coincide con la búsqueda.' : 'Todavía no hay servicios. Importe un archivo Excel o de texto, o cree uno a mano.') : null}>
        {est.lista.map((s) => (
          <tr key={s._id} className="border-t border-noc-line">
            <Celda><div className="font-medium">{s.nombre}</div>{s.codigo && <div className="font-mono text-xs text-noc-muted">{s.codigo}</div>}</Celda>
            <Celda>{s.cliente || <span className="text-noc-muted">—</span>}</Celda>
            <Celda>{s.tipo || <span className="text-noc-muted">—</span>}</Celda>
            <Celda className="tabular-nums">{s.capacidad || <span className="text-noc-muted">—</span>}</Celda>
            <Celda><span className="tabular-nums">{s.enlaces.length || <span className="text-estado-deg">0</span>}</span>{s.enlaces.length > 0 && <span className="ml-2 font-mono text-xs text-noc-muted">{s.enlaces.slice(0, 2).map((e) => e.id_enlace).join(', ')}{s.enlaces.length > 2 ? ` +${s.enlaces.length - 2}` : ''}</span>}</Celda>
            <Celda className="text-right whitespace-nowrap">
              <Boton onClick={() => setForm({ s })} aria-label={`Editar ${s.nombre}`}><Pencil size={13} /> Editar</Boton>{' '}
              <Boton variante="peligro" onClick={() => { setErrorBorrar(null); setBorrar(s); }} aria-label={`Eliminar ${s.nombre}`}><Trash2 size={13} /></Boton>
            </Celda>
          </tr>
        ))}
      </Tabla>
      <div className="mt-3 flex items-center justify-between text-xs text-noc-muted">
        <span>{est.cargando ? 'Cargando…' : `${est.lista.length} de ${est.total} servicio(s)`}</span>
        {est.lista.length < est.total && !est.cargando && <Boton onClick={() => setPagina((p) => p + 1)}>Ver más</Boton>}
      </div>

      {form && <FormServicio servicio={form.s ?? null} onClose={() => setForm(null)} />}
      {importando && <ImportarServicios onClose={() => setImportando(false)} />}
      {borrar && (
        <Dialogo titulo="Eliminar servicio" descripcion={`«${borrar.nombre}»`} onClose={() => setBorrar(null)}>
          <p className="mb-3 text-sm">Se elimina el servicio y su relación con {borrar.enlaces.length} enlace(s). Los enlaces no se modifican.</p>
          {errorBorrar && <Aviso>{errorBorrar}</Aviso>}
          <div className="flex justify-end gap-2"><Boton onClick={() => setBorrar(null)}>Cancelar</Boton><Boton variante="peligro" onClick={eliminar}>Eliminar servicio</Boton></div>
        </Dialogo>
      )}
    </>
  );
}
