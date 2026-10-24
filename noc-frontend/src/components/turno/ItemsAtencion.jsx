import { MessageSquarePlus, Pencil, Plus, RotateCcw, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNow } from '../../hooks/useNow.js';
import { api } from '../../lib/api.js';
import { describirError } from '../../lib/errores.js';
import { cn, fechaHora, hace } from '../../lib/format.js';
import { etiquetaTurnoIngreso, ultimoSeguimiento } from '../../lib/items.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton } from '../admin/ui.jsx';
import AccionItem from './AccionItem.jsx';
import FormItem from './FormItem.jsx';

function Tarjeta({ item, resuelto, ahora, onAccion, onEditar, onReabrir, trabajando }) {
  const [hilo, setHilo] = useState(false);
  const turno = etiquetaTurnoIngreso(item);
  const ultima = ultimoSeguimiento(item);
  const notas = item.seguimiento?.length ?? 0;
  return (
    <li aria-label={`Ítem ${item.titulo}`} className={cn('border-l-4 border-t border-t-noc-line px-4 py-3 first:border-t-0', resuelto ? 'border-l-estado-ok/60' : 'border-l-estado-deg')}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">{item.titulo}</h3>
        <span className="rounded border border-noc-line bg-noc-raised px-1.5 py-0.5 font-mono text-xs" title="Número de ticket">{item.ticket}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm">{item.descripcion}</p>
      <p className="mt-1.5 text-xs text-noc-muted">
        Ingresado por <b className="font-medium text-noc-text">{item.creado_por_nombre}</b> · {hace(item.createdAt, ahora)} ({fechaHora(item.createdAt)}){turno && ` · ${turno}`}
      </p>

      {notas > 0 && (
        <div className="mt-2 rounded-md bg-noc-raised/60 px-3 py-2 text-xs">
          {hilo ? (
            <ul className="space-y-1.5" aria-label="Seguimiento">
              {item.seguimiento.map((n) => <li key={n._id}><span className="font-medium">{n.nombre}</span> <span className="text-noc-muted">· {hace(n.fecha, ahora)}</span><br />{n.texto}</li>)}
            </ul>
          ) : (
            <p><span className="text-noc-muted">Último seguimiento ({ultima.nombre}, {hace(ultima.fecha, ahora)}):</span> {ultima.texto}</p>
          )}
          {notas > 1 && <button type="button" onClick={() => setHilo((h) => !h)} className="mt-1 text-noc-focus hover:underline">{hilo ? 'Ocultar el hilo' : `Ver las ${notas} notas`}</button>}
        </div>
      )}

      {resuelto && (
        <p className="mt-2 text-xs text-green-300">Resuelto por <b className="font-medium">{item.resuelto_por_nombre}</b> · {hace(item.resuelto_en, ahora)} ({fechaHora(item.resuelto_en)}) — {item.resolucion}</p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {resuelto ? (
          <Boton onClick={() => onReabrir(item)} cargando={trabajando === item._id} aria-label={`Reabrir ${item.titulo}`}><RotateCcw size={13} /> Reabrir</Boton>
        ) : (
          <>
            <Boton onClick={() => onAccion('seguimiento', item)} aria-label={`Agregar seguimiento a ${item.titulo}`}><MessageSquarePlus size={13} /> Seguimiento</Boton>
            <Boton variante="primario" onClick={() => onAccion('resolver', item)} aria-label={`Resolver ${item.titulo}`}><CheckCircle2 size={13} /> Resolver</Boton>
            <Boton onClick={() => onEditar(item)} aria-label={`Editar ${item.titulo}`}><Pencil size={13} /> Editar</Boton>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * Ítems de atención del turno: lo que hay que atender ADEMÁS de los enlaces (corte de cable secundario, corte de energía…).
 * Son de todo el NOC, no de un operador: los ven y atienden todos los que estén de turno y pasan al siguiente hasta que alguien los resuelva.
 */
export default function ItemsAtencion({ className }) {
  const abiertos = useTopology((s) => s.items);
  const ahora = useNow();
  const [vista, setVista] = useState('abiertos');
  const [res, setRes] = useState({ cargando: false, lista: [], error: null });
  const [form, setForm] = useState(null); // {} = nuevo · { item } = editar
  const [accion, setAccion] = useState(null);
  const [trabajando, setTrabajando] = useState(null);
  const [error, setError] = useState(null);

  // los resueltos se piden al abrir su pestaña y se refrescan cuando cambia algo (un ítem se resuelve o se reabre)
  useEffect(() => {
    if (vista !== 'resueltos') return undefined;
    let vigente = true;
    setRes((r) => ({ ...r, cargando: true, error: null }));
    api.items({ estado: 'Resuelto', limit: 50 })
      .then((r) => vigente && setRes({ cargando: false, lista: r.data, error: null }))
      .catch((e) => vigente && setRes({ cargando: false, lista: [], error: describirError(e) }));
    return () => { vigente = false; };
  }, [vista, abiertos]);

  async function reabrir(item) {
    setTrabajando(item._id); setError(null);
    try { await api.reabrirItem(item._id); await useTopology.getState().cargarItems(); } catch (err) { setError(describirError(err)); }
    setTrabajando(null);
  }

  const lista = vista === 'abiertos' ? abiertos : res.lista;
  return (
    <section aria-label="Ítems de atención" className={cn('rounded-lg border border-noc-line bg-noc-panel', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-noc-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Ítems de atención <span className="ml-1 font-normal text-noc-muted">{abiertos.length} abierto(s)</span></h2>
          <p className="mt-0.5 max-w-xl text-xs text-noc-muted">Cortes de cable o de energía y cualquier otra falla de la red que haya que atender además de los enlaces. Los ven todos los operadores y pasan de un turno al siguiente hasta que alguien los resuelva.</p>
        </div>
        <Boton variante="primario" onClick={() => setForm({})}><Plus size={14} /> Agregar ítem</Boton>
      </div>

      <div role="tablist" aria-label="Ítems" className="flex gap-1 border-b border-noc-line px-3">
        {[['abiertos', `Abiertos (${abiertos.length})`], ['resueltos', 'Resueltos']].map(([c, e]) => (
          <button key={c} type="button" role="tab" aria-selected={vista === c} onClick={() => setVista(c)}
            className={cn('-mb-px border-b-2 px-3 py-2 text-sm', vista === c ? 'border-noc-focus text-noc-text' : 'border-transparent text-noc-muted hover:text-noc-text')}>{e}</button>
        ))}
      </div>

      {error && <div className="px-4 pt-3"><Aviso>{error}</Aviso></div>}
      {res.error && vista === 'resueltos' && <div className="px-4 pt-3"><Aviso>{res.error}</Aviso></div>}
      {lista.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-noc-muted">
          {vista === 'abiertos' ? 'No hay ítems abiertos. Use «Agregar ítem» para registrar un corte de cable, un corte de energía o cualquier otra falla.' : res.cargando ? 'Cargando…' : 'Todavía no hay ítems resueltos.'}
        </p>
      ) : (
        <ul>
          {lista.map((i) => <Tarjeta key={i._id} item={i} resuelto={vista === 'resueltos'} ahora={ahora} trabajando={trabajando} onAccion={(tipo, it) => setAccion({ tipo, item: it })} onEditar={(it) => setForm({ item: it })} onReabrir={reabrir} />)}
        </ul>
      )}

      {form && <FormItem item={form.item ?? null} onClose={() => setForm(null)} />}
      {accion && <AccionItem accion={accion.tipo} item={accion.item} onClose={() => setAccion(null)} />}
    </section>
  );
}
