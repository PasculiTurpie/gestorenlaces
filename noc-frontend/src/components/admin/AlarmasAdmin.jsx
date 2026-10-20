import { ArrowDown, ArrowUp, Download, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { ETIQUETA_TIPO, fmtTamano, guardarBlob, validarArchivoCliente } from '../../lib/archivos.js';
import { ordenarAlarmas } from '../../lib/alarmas.js';
import { claveDesdeNombre } from '../../lib/catalogos.js';
import { describirError } from '../../lib/errores.js';
import { leerNumero } from '../../lib/levantamiento.js';
import { useTopology } from '../../store/topologyStore.js';
import { IconoDocumento } from '../alarmas/Documentos.jsx';
import EstadoBadge from '../EstadoBadge.jsx';
import { Aviso, Boton, Campo, Cabecera, Celda, Dialogo, Tabla, entrada } from './ui.jsx';

// Al cambiar una tipificación se relee todo: su contenido viaja con las alarmas de cada enlace.
const refrescar = () => useTopology.getState().cargar({ silencioso: true });
const ESTADOS = [['Caido', 'Caído'], ['Degradado', 'Degradado'], ['Mantenimiento', 'Mantenimiento']];

/** Lista ordenable de pasos del procedimiento. */
function EditorPasos({ pasos, setPasos }) {
  const cambiar = (i, v) => setPasos((p) => p.map((x, j) => (j === i ? v : x)));
  const mover = (i, d) => setPasos((p) => { const n = [...p]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const quitar = (i) => setPasos((p) => p.filter((_, j) => j !== i));

  return (
    <div>
      <ol className="space-y-2">
        {pasos.map((paso, i) => (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-noc-raised font-mono text-[11px] text-noc-muted">{i + 1}</span>
            <textarea aria-label={`Paso ${i + 1}`} rows={2} maxLength={600} value={paso} onChange={(e) => cambiar(i, e.target.value)} className={`${entrada} min-h-[2.5rem] resize-y`} />
            <div className="flex shrink-0 flex-col">
              <button type="button" aria-label={`Subir el paso ${i + 1}`} disabled={i === 0} onClick={() => mover(i, -1)} className="rounded p-1 text-noc-muted hover:bg-noc-raised hover:text-noc-text disabled:opacity-30"><ArrowUp size={13} /></button>
              <button type="button" aria-label={`Bajar el paso ${i + 1}`} disabled={i === pasos.length - 1} onClick={() => mover(i, 1)} className="rounded p-1 text-noc-muted hover:bg-noc-raised hover:text-noc-text disabled:opacity-30"><ArrowDown size={13} /></button>
            </div>
            <button type="button" aria-label={`Quitar el paso ${i + 1}`} onClick={() => quitar(i)} className="mt-1.5 rounded p-1.5 text-noc-muted hover:bg-noc-raised hover:text-red-300"><Trash2 size={14} /></button>
          </li>
        ))}
      </ol>
      {pasos.length === 0 && <p className="mb-2 text-xs text-noc-muted">Aún no hay pasos. El operador verá «Aún no hay un procedimiento registrado».</p>}
      <Boton className="mt-2" onClick={() => setPasos((p) => [...p, ''])} disabled={pasos.length >= 20}><Plus size={14} /> Agregar paso</Boton>
    </div>
  );
}

const MAX_DOCUMENTOS = 10;

/** Documentos de procedimiento de la alarma: los ya guardados (descargar/eliminar) y los nuevos en cola (se suben al guardar). */
function DocumentosEditor({ existentes, pendientes, setPendientes }) {
  const [arrastrando, setArrastrando] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [trabajando, setTrabajando] = useState(null);
  const [aviso, setAviso] = useState(null);

  function agregar(lista) {
    const nuevos = [];
    // Un archivo que ya falló al subirse se puede volver a elegir: reemplaza al anterior (no cuenta como repetido)
    const base = pendientes.filter((p) => !(p.error && lista.some((f) => f.name === p.file.name && f.size === p.file.size)));
    let cupo = MAX_DOCUMENTOS - existentes.length - base.filter((p) => !p.error).length;
    for (const file of lista) {
      let error = validarArchivoCliente(file);
      if (!error && (base.some((p) => p.file.name === file.name && p.file.size === file.size) || existentes.some((e) => e.nombre === file.name && e.tamano_bytes === file.size))) error = 'Ya está en la lista';
      if (!error && cupo <= 0) error = `Máximo ${MAX_DOCUMENTOS} documentos por alarma`;
      if (!error) cupo -= 1;
      nuevos.push({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, error });
    }
    setPendientes([...base, ...nuevos]);
  }

  async function descargar(a) {
    setTrabajando(a._id); setAviso(null);
    try { guardarBlob(await api.descargarAdjunto(a._id), a.nombre); } catch (err) { setAviso(describirError(err)); }
    setTrabajando(null);
  }
  async function eliminar(a) {
    setTrabajando(a._id); setAviso(null);
    try { await api.eliminarAdjunto(a._id); await refrescar(); setConfirmar(null); } catch (err) { setAviso(describirError(err)); }
    setTrabajando(null);
  }

  return (
    <div className="mb-4">
      <p className="mb-1 text-sm">Documentos del procedimiento</p>
      <p className="mb-2 text-xs text-noc-muted">Word (.docx), PDF y Excel (.xlsx), de hasta 15 MB. El operador los ve y descarga junto con el procedimiento.</p>

      {existentes.length > 0 && (
        <ul className="mb-2 space-y-1.5" aria-label="Documentos guardados">
          {existentes.map((a) => (
            <li key={a._id} className="flex items-center gap-3 rounded-md border border-noc-line px-3 py-2">
              <IconoDocumento extension={a.extension} />
              <div className="min-w-0 flex-1"><div className="truncate text-sm">{a.nombre}</div><div className="text-xs text-noc-muted">{ETIQUETA_TIPO[a.extension]} · {fmtTamano(a.tamano_bytes)}</div></div>
              {confirmar === a._id ? (
                <span className="flex items-center gap-1.5 text-xs">¿Eliminar?
                  <Boton variante="peligro" className="px-2 py-1 text-xs" cargando={trabajando === a._id} onClick={() => eliminar(a)}>Sí, eliminar</Boton>
                  <Boton className="px-2 py-1 text-xs" onClick={() => setConfirmar(null)}>No</Boton>
                </span>
              ) : (
                <>
                  <button type="button" onClick={() => descargar(a)} aria-label={`Descargar ${a.nombre}`} className="rounded p-1.5 text-noc-muted hover:bg-noc-raised hover:text-noc-text"><Download size={14} /></button>
                  <button type="button" onClick={() => setConfirmar(a._id)} aria-label={`Eliminar ${a.nombre}`} className="rounded p-1.5 text-noc-muted hover:bg-noc-raised hover:text-red-300"><Trash2 size={14} /></button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {aviso && <Aviso>{aviso}</Aviso>}

      <label
        htmlFor="a-docs"
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); agregar([...e.dataTransfer.files]); }}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-4 text-center text-sm focus-within:outline focus-within:outline-2 focus-within:outline-noc-focus ${arrastrando ? 'border-noc-focus bg-noc-focus/10' : 'border-noc-line-strong hover:bg-noc-raised/50'}`}
      >
        <Upload size={18} className="text-noc-muted" />
        <span>Arrastre archivos aquí o <span className="text-noc-focus underline">seleccione desde su equipo</span></span>
        <input id="a-docs" type="file" multiple accept=".pdf,.docx,.xlsx" className="sr-only" onChange={(e) => { agregar([...e.target.files]); e.target.value = ''; }} />
      </label>

      {pendientes.length > 0 && (
        <ul className="mt-2 space-y-1.5" aria-label="Documentos por subir">
          {pendientes.map((p) => (
            <li key={p.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 ${p.error ? 'border-estado-down/50 bg-estado-down/5' : 'border-noc-focus/30 bg-noc-focus/5'}`}>
              <IconoDocumento extension={p.file.name.split('.').pop().toLowerCase()} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{p.file.name}</div>
                <div className={`text-xs ${p.error ? 'text-red-300' : 'text-noc-muted'}`}>{p.error ?? `${fmtTamano(p.file.size)} · se subirá al guardar`}</div>
              </div>
              <button type="button" onClick={() => setPendientes((l) => l.filter((x) => x.id !== p.id))} aria-label={`Quitar ${p.file.name}`} className="rounded p-1.5 text-noc-muted hover:bg-noc-raised hover:text-noc-text"><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FormAlarma({ alarma, onClose }) {
  const [creadaId, setCreadaId] = useState(null); // si la alarma se creó pero falló la subida de algún documento, se puede reintentar sin duplicarla
  const [pendientes, setPendientes] = useState([]);
  const idActual = alarma?._id ?? creadaId;
  const nueva = !idActual;
  const viva = useTopology((s) => s.alarmas.find((a) => a._id === idActual));
  const [f, setF] = useState({
    nombre: alarma?.nombre ?? '', codigo: alarma?.codigo ?? '', estado_sugerido: alarma?.estado_sugerido ?? 'Caido', significado: alarma?.significado ?? '',
    escalamiento: alarma?.escalamiento ?? '', tiempo: alarma?.tiempo_respuesta_min != null ? String(alarma.tiempo_respuesta_min) : '', activo: alarma?.activo ?? true,
  });
  const [pasos, setPasos] = useState(alarma?.procedimiento ?? []);
  const [codigoManual, setCodigoManual] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const cambiarNombre = (e) => { const nombre = e.target.value; setF((x) => ({ ...x, nombre, ...(nueva && !codigoManual && { codigo: claveDesdeNombre(nombre).slice(0, 12) }) })); };

  async function guardar(e) {
    e.preventDefault();
    const tiempo = leerNumero(f.tiempo);
    if (Number.isNaN(tiempo) || (tiempo != null && (!Number.isInteger(tiempo) || tiempo < 1))) return setError('El tiempo de respuesta debe ser un número entero de minutos (o dejarse vacío).');
    const body = {
      nombre: f.nombre.trim(), estado_sugerido: f.estado_sugerido, significado: f.significado.trim(),
      procedimiento: pasos.map((p) => p.trim()).filter(Boolean), // los pasos en blanco se descartan
      escalamiento: f.escalamiento.trim(), tiempo_respuesta_min: tiempo, activo: f.activo,
    };
    setEnviando(true); setError(null);
    try {
      let id = idActual;
      if (nueva) { id = (await api.crearAlarma({ codigo: f.codigo, ...body })).data._id; setCreadaId(id); }
      else await api.actualizarAlarma(id, body);

      // Documentos en cola: se suben de a uno; los que fallen se conservan para reintentar
      const fallidos = [];
      for (const p of pendientes.filter((x) => !x.error)) {
        try { await api.subirAdjunto(id, p.file); } catch (err) {
          const motivo = describirError(err);
          fallidos.push({ ...p, error: err.status >= 500 && !/Sistema/.test(motivo) ? `${motivo} — Revise Administración → Sistema.` : motivo });
        }
      }
      await refrescar();
      if (fallidos.length) {
        setPendientes([...pendientes.filter((x) => x.error), ...fallidos]);
        setError(`La alarma se guardó, pero ${fallidos.length} documento(s) no se pudieron subir. Revise el motivo en cada uno y vuelva a guardar.`);
        setEnviando(false);
        return;
      }
      const subidos = pendientes.filter((x) => !x.error).length;
      useTopology.getState().pushToast({ nivel: 'ok', texto: `${nueva ? 'Alarma' : 'Tipificación'} ${f.codigo} ${nueva ? 'creada' : 'actualizada'}${subidos ? ` · ${subidos} documento(s) subido(s)` : ''}` });
      onClose();
    } catch (err) { setError(describirError(err)); setEnviando(false); }
  }

  return (
    <Dialogo titulo={nueva ? 'Nueva tipificación de alarma' : `Editar ${alarma?.codigo ?? f.codigo}`} descripcion="Qué es la alarma, qué significa y qué debe hacer el operador." onClose={onClose} ancho="max-w-2xl">
      <form onSubmit={guardar}>
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <Campo id="a-nombre" etiqueta="Nombre"><input id="a-nombre" required minLength={2} maxLength={80} value={f.nombre} onChange={cambiarNombre} className={entrada} placeholder="Ej. Pérdida de señal (LOS)" autoFocus /></Campo>
          <Campo id="a-codigo" etiqueta="Código" ayuda={nueva ? 'No se puede cambiar después.' : 'Inmutable.'}>
            <input id="a-codigo" required maxLength={24} value={f.codigo} onChange={(e) => { setCodigoManual(true); setF((x) => ({ ...x, codigo: e.target.value.toUpperCase() })); }} disabled={!nueva} className={`${entrada} font-mono`} />
          </Campo>
        </div>
        <Campo id="a-estado" etiqueta="Se registra normalmente como" ayuda="Ordena las opciones al registrar un estado; no impide usar la alarma en otro.">
          <select id="a-estado" value={f.estado_sugerido} onChange={set('estado_sugerido')} className={entrada}>{ESTADOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Campo>
        <Campo id="a-signif" etiqueta="Qué significa" ayuda="Descripción y causas probables, en lenguaje de operación.">
          <textarea id="a-signif" rows={4} maxLength={2000} value={f.significado} onChange={set('significado')} className={entrada} />
        </Campo>
        <div className="mb-3">
          <p className="mb-1.5 text-sm">Qué hacer (procedimiento)</p>
          <EditorPasos pasos={pasos} setPasos={setPasos} />
        </div>
        <DocumentosEditor existentes={viva?.adjuntos ?? []} pendientes={pendientes} setPendientes={setPendientes} />
        <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
          <Campo id="a-esc" etiqueta="Escalamiento" ayuda="A quién avisar y cuándo."><textarea id="a-esc" rows={2} maxLength={600} value={f.escalamiento} onChange={set('escalamiento')} className={entrada} /></Campo>
          <Campo id="a-t" etiqueta="Tiempo de respuesta (min)" ayuda="Objetivo para actuar."><input id="a-t" inputMode="numeric" value={f.tiempo} onChange={set('tiempo')} className={`${entrada} font-mono`} placeholder="15" /></Campo>
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.activo} onChange={set('activo')} /> Activa <span className="text-xs text-noc-muted">(una tipificación desactivada no se ofrece al registrar alarmas nuevas)</span></label>
        {error && <Aviso>{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Boton onClick={onClose}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={enviando}>{nueva ? 'Crear tipificación' : 'Guardar cambios'}{pendientes.some((p) => !p.error) ? ` y subir ${pendientes.filter((p) => !p.error).length} documento(s)` : ''}</Boton>
        </div>
      </form>
    </Dialogo>
  );
}

function ConfirmarBorrado({ alarma, onClose }) {
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  async function borrar() {
    setEnviando(true); setError(null);
    try { await api.eliminarAlarma(alarma._id); await refrescar(); useTopology.getState().pushToast({ nivel: 'ok', texto: `Alarma ${alarma.codigo} eliminada` }); onClose(); }
    catch (err) { setError(describirError(err)); setEnviando(false); }
  }
  return (
    <Dialogo titulo={`Eliminar ${alarma.codigo}`} onClose={onClose} ancho="max-w-md">
      <p className="mb-3 text-sm">Solo se puede eliminar una tipificación que ninguna incidencia ni alarma activa use. Si ya se usó, desactívela: así se conserva el historial.</p>
      {error && <Aviso>{error}</Aviso>}
      <div className="flex justify-end gap-2">
        <Boton onClick={onClose}>Cancelar</Boton>
        <Boton variante="peligro" cargando={enviando} onClick={borrar}>Eliminar</Boton>
      </div>
    </Dialogo>
  );
}

export default function AlarmasAdmin() {
  const alarmas = useTopology((s) => s.alarmas);
  const [params, setParams] = useSearchParams();
  const [dialogo, setDialogo] = useState(null);

  // ?alarma=<id> abre el editor (lo usa el botón «Editar» de la guía)
  const editando = params.get('alarma') ? alarmas.find((a) => a._id === params.get('alarma')) : null;

  return (
    <>
      <Cabecera
        titulo="Alarmas"
        descripcion="Tipificación de alarmas: qué significa cada una y el procedimiento a seguir. Es la guía que ve el operador al registrar una alarma en un filamento."
        acciones={<Boton variante="primario" onClick={() => setDialogo({ tipo: 'form' })}><Plus size={15} /> Nueva tipificación</Boton>}
      />
      <Tabla columnas={['Alarma', 'Se registra como', 'Pasos', 'Docs', 'Respuesta', 'Uso', 'Estado', '']} vacio="Aún no hay tipificaciones. Ejecute «npm run seed:alarmas» para cargar las de partida, o cree la primera.">
        {ordenarAlarmas(alarmas).map((a) => (
          <tr key={a._id} className={a.activo ? '' : 'opacity-60'}>
            <Celda><div className="font-mono text-xs">{a.codigo}</div><div>{a.nombre}</div></Celda>
            <Celda><EstadoBadge estado={a.estado_sugerido} /></Celda>
            <Celda className="tabular-nums">{a.procedimiento.length || <span className="text-estado-deg">0</span>}</Celda>
            <Celda className="tabular-nums">{a.adjuntos?.length || <span className="text-noc-muted">—</span>}</Celda>
            <Celda className="tabular-nums">{a.tiempo_respuesta_min ? `${a.tiempo_respuesta_min} min` : '—'}</Celda>
            <Celda className="text-xs text-noc-muted">{a.alarmas_activas} activa(s) · {a.incidencias} incid.</Celda>
            <Celda>{a.activo ? 'Activa' : 'Desactivada'}</Celda>
            <Celda className="text-right">
              <Boton className="mr-1.5" aria-label={`Editar ${a.codigo}`} onClick={() => setDialogo({ tipo: 'form', a })}><Pencil size={13} /> Editar</Boton>
              <Boton variante="peligro" aria-label={`Eliminar ${a.codigo}`} onClick={() => setDialogo({ tipo: 'borrar', a })}><Trash2 size={13} /></Boton>
            </Celda>
          </tr>
        ))}
      </Tabla>
      {editando && !dialogo && <FormAlarma key={editando._id} alarma={editando} onClose={() => setParams({}, { replace: true })} />}
      {dialogo?.tipo === 'form' && <FormAlarma alarma={dialogo.a} onClose={() => setDialogo(null)} />}
      {dialogo?.tipo === 'borrar' && <ConfirmarBorrado alarma={dialogo.a} onClose={() => setDialogo(null)} />}
    </>
  );
}
