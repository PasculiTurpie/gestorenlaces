import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { guardarBlob, fmtTamano } from '../../lib/archivos.js';
import { describirError } from '../../lib/errores.js';
import { cn } from '../../lib/format.js';
import { CAMPOS, ETIQUETA_ACCION, frasesResumen, mapeoAPayload, mapeoInicial, plantillaTexto, validarArchivoTabla, validarMapeo } from '../../lib/servicios.js';
import { useTopology } from '../../store/topologyStore.js';
import { Aviso, Boton, Dialogo, entrada } from '../admin/ui.jsx';

const PASOS = [['archivo', '1. Archivo'], ['columnas', '2. Columnas'], ['vista', '3. Vista previa'], ['resultado', '4. Resultado']];

function Pasos({ actual }) {
  const i = PASOS.findIndex(([c]) => c === actual);
  return (
    <ol aria-label="Pasos" className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {PASOS.map(([c, e], k) => <li key={c} aria-current={c === actual ? 'step' : undefined} className={cn(k === i ? 'font-semibold text-noc-text' : k < i ? 'text-noc-focus' : 'text-noc-muted')}>{e}</li>)}
    </ol>
  );
}

const nombreColumna = (c) => c.nombre || `(columna ${c.indice + 1})`;

function ListaProblemas({ titulo, lista, total, tono }) {
  if (!lista.length) return null;
  return (
    <section className="mb-4" aria-label={titulo}>
      <h3 className={cn('mb-1 text-sm font-semibold', tono === 'warn' && 'text-orange-300')}>{titulo} <span className="font-normal text-noc-muted">{total}</span></h3>
      <div className="max-h-44 overflow-auto rounded-md border border-noc-line">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-noc-raised text-noc-muted"><tr><th className="px-2 py-1 font-medium">Fila</th><th className="px-2 py-1 font-medium">Dato</th><th className="px-2 py-1 font-medium">Qué pasa</th></tr></thead>
          <tbody className="divide-y divide-noc-line">
            {lista.map((p, i) => <tr key={i}><td className="px-2 py-1 tabular-nums">{p.fila}</td><td className="px-2 py-1 font-mono">{p.texto || '—'}</td><td className="px-2 py-1">{p.motivo}</td></tr>)}
          </tbody>
        </table>
      </div>
      {total > lista.length && <p className="mt-1 text-xs text-noc-muted">Se muestran las primeras {lista.length}.</p>}
    </section>
  );
}

/** Importar los servicios de cada enlace desde Excel (.xlsx) o texto: archivo → columnas → vista previa → resultado. */
export default function ImportarServicios({ onClose }) {
  const enlaces = useTopology((s) => s.enlaces);
  const [paso, setPaso] = useState('archivo');
  const [archivo, setArchivo] = useState(null);
  const [cols, setCols] = useState(null);
  const [mapeo, setMapeo] = useState(null);
  const [errores, setErrores] = useState({});
  const [modo, setModo] = useState('agregar');
  const [filaEnc, setFilaEnc] = useState('');
  const [previa, setPrevia] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const opcionesColumna = useMemo(() => cols?.columnas ?? [], [cols]);

  async function ejecutar(fn) {
    setTrabajando(true); setError(null);
    try { await fn(); } catch (err) { setError(describirError(err)); }
    setTrabajando(false);
  }

  const leerColumnas = (file, extra = {}) => ejecutar(async () => {
    const r = await api.importarServicios(file, extra);
    setCols(r); setFilaEnc(String(r.fila_encabezado)); setMapeo(mapeoInicial(r.sugerido)); setErrores({}); setPaso('columnas');
  });

  function elegir(file) {
    if (!file) return;
    const err = validarArchivoTabla(file);
    if (err) { setError(err); return; }
    setArchivo(file);
    leerColumnas(file);
  }

  const argumentos = (extra = {}) => ({ mapeo: mapeoAPayload(mapeo), modo, hoja: cols.hoja ?? undefined, filaEncabezado: Number(filaEnc) || undefined, ...extra });

  function verPrevia() {
    const errs = validarMapeo(mapeo);
    setErrores(errs);
    if (Object.keys(errs).length) return;
    ejecutar(async () => { setPrevia(await api.importarServicios(archivo, argumentos())); setPaso('vista'); });
  }

  const importar = () => ejecutar(async () => {
    const r = await api.importarServicios(archivo, argumentos({ confirmar: true }));
    setResultado(r);
    await useTopology.getState().cargarServicios();
    useTopology.getState().pushToast({ nivel: 'ok', texto: `Servicios importados: ${r.aplicado.creados} nuevos, ${r.aplicado.actualizados} actualizados` });
    setPaso('resultado');
  });

  const cambiarColumna = (campo) => (e) => setMapeo((m) => ({ ...m, [campo]: e.target.value }));
  // función (no componente): así no se recrea en cada cambio y el selector conserva el foco
  const selectorColumna = ({ campo, etiqueta, requerido, ayuda }) => (
    <div key={campo} className="mb-2.5 grid items-start gap-x-3 sm:grid-cols-[11rem,1fr]">
      <label htmlFor={`col-${campo}`} className="pt-1.5 text-sm">{etiqueta}{requerido && <span className="text-red-300"> *</span>}</label>
      <div>
        <select id={`col-${campo}`} value={mapeo[campo]} onChange={cambiarColumna(campo)} className={entrada} aria-invalid={Boolean(errores[campo])}>
          <option value="">{requerido ? 'Elija la columna…' : '(no importar)'}</option>
          {opcionesColumna.map((c) => <option key={c.indice} value={c.indice}>{nombreColumna(c)}{c.muestra[0] ? ` — ej.: ${c.muestra[0].slice(0, 30)}` : ''}</option>)}
        </select>
        {errores[campo] ? <p className="mt-1 text-xs text-red-300">{errores[campo]}</p> : ayuda && <p className="mt-1 text-xs text-noc-muted">{ayuda}</p>}
      </div>
    </div>
  );

  return (
    <Dialogo titulo="Importar servicios" descripcion="Desde un archivo Excel (.xlsx) o de texto (.txt, .csv) con los servicios y los enlaces por los que pasan." onClose={onClose} ancho="max-w-3xl">
      <Pasos actual={paso} />
      {error && <Aviso>{error}</Aviso>}

      {paso === 'archivo' && (
        <>
          <label
            htmlFor="imp-archivo"
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastrando(false); elegir(e.dataTransfer.files[0]); }}
            className={cn('flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-8 text-center text-sm focus-within:outline focus-within:outline-2 focus-within:outline-noc-focus', arrastrando ? 'border-noc-focus bg-noc-focus/10' : 'border-noc-line-strong hover:bg-noc-raised/50')}
          >
            {trabajando ? <span>Leyendo el archivo…</span> : <><Upload size={20} className="text-noc-muted" /><span>Arrastre el archivo aquí o <span className="text-noc-focus underline">selecciónelo desde su equipo</span></span><span className="text-xs text-noc-muted">Excel (.xlsx) o texto (.txt, .csv) · hasta 5 MB</span></>}
            <input id="imp-archivo" type="file" accept=".xlsx,.txt,.csv" className="sr-only" disabled={trabajando} onChange={(e) => { elegir(e.target.files[0]); e.target.value = ''; }} />
          </label>
          <div className="mt-4 rounded-md border border-noc-line bg-noc-bg/40 p-3 text-sm">
            <p className="mb-1 font-medium">Cómo debe venir el archivo</p>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-noc-muted">
              <li>Una fila de encabezados (Servicio, Cliente, Tipo, Capacidad, Enlace…) y una fila por servicio y enlace. Si un servicio pasa por varios enlaces, repítalo en varias filas o separe los enlaces con coma.</li>
              <li>El <b className="font-medium text-noc-text">enlace</b> puede ser su código (<span className="font-mono">ENL-VLDV-LANC-01</span>), los nodos que une (<span className="font-mono">VLDV-LANC</span>, <span className="font-mono">VLDV → LANC</span>) o un recorrido (<span className="font-mono">VLDV → LANC → PNGP</span>). También sirven dos columnas: origen y destino.</li>
              <li>Puede volver a subir el mismo archivo sin duplicar nada: los servicios se reconocen por su nombre.</li>
            </ul>
            <Boton className="mt-2.5" onClick={() => guardarBlob(new Blob([plantillaTexto(Object.values(enlaces))], { type: 'text/plain;charset=utf-8' }), 'plantilla-servicios.txt')}><Download size={14} /> Descargar plantilla de ejemplo</Boton>
          </div>
        </>
      )}

      {paso === 'columnas' && cols && (
        <>
          <p className="mb-3 flex items-center gap-2 text-sm"><FileSpreadsheet size={15} className="text-noc-muted" /> <span className="font-medium">{archivo.name}</span> <span className="text-xs text-noc-muted">{fmtTamano(archivo.size)} · {cols.filas_datos} fila(s) de datos{cols.delimitador ? ` · separador ${cols.delimitador === '\t' ? 'tabulador' : `«${cols.delimitador}»`}` : ''}</span></p>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            {cols.hojas.length > 1 && (
              <label className="text-sm">Hoja<select value={cols.hoja} onChange={(e) => leerColumnas(archivo, { hoja: e.target.value })} className={cn(entrada, 'mt-1 block')} disabled={trabajando}>{cols.hojas.map((h) => <option key={h.nombre} value={h.nombre}>{h.nombre} ({h.filas} filas)</option>)}</select></label>
            )}
            <label className="text-sm">Fila de los encabezados<input type="number" min={1} value={filaEnc} onChange={(e) => setFilaEnc(e.target.value)} className={cn(entrada, 'mt-1 block w-28')} /></label>
            <Boton onClick={() => leerColumnas(archivo, { hoja: cols.hoja ?? undefined, filaEncabezado: Number(filaEnc) || undefined })} disabled={trabajando || !filaEnc}>Releer con esa fila</Boton>
          </div>

          <div className="mb-4 max-h-40 overflow-auto rounded-md border border-noc-line" aria-label="Así se ve el archivo">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-noc-raised"><tr>{cols.columnas.map((c) => <th key={c.indice} className="whitespace-nowrap px-2 py-1 font-medium">{nombreColumna(c)}</th>)}</tr></thead>
              <tbody className="divide-y divide-noc-line">{cols.muestra_filas.map((f, i) => <tr key={i}>{cols.columnas.map((c) => <td key={c.indice} className="max-w-[14rem] truncate px-2 py-1">{f[c.indice]}</td>)}</tr>)}</tbody>
            </table>
          </div>

          <h3 className="mb-2 text-sm font-semibold">¿Qué columna es cada dato?</h3>
          {CAMPOS.slice(0, 1).map((c) => selectorColumna({ campo: c.clave, etiqueta: c.etiqueta, requerido: c.requerido, ayuda: c.ayuda }))}
          <fieldset className="mb-2.5 grid items-start gap-x-3 sm:grid-cols-[11rem,1fr]">
            <legend className="sr-only">Cómo viene el enlace</legend>
            <span className="pt-1 text-sm">Enlace <span className="text-red-300">*</span></span>
            <div>
              <div className="mb-1.5 flex flex-wrap gap-x-4 text-sm">
                <label className="flex items-center gap-1.5"><input type="radio" name="enlaceModo" checked={mapeo.enlaceModo === 'enlace'} onChange={() => setMapeo((m) => ({ ...m, enlaceModo: 'enlace' }))} /> Una columna con el enlace o el recorrido</label>
                <label className="flex items-center gap-1.5"><input type="radio" name="enlaceModo" checked={mapeo.enlaceModo === 'nodos'} onChange={() => setMapeo((m) => ({ ...m, enlaceModo: 'nodos' }))} /> Columnas de origen y destino</label>
              </div>
              {mapeo.enlaceModo === 'enlace' ? (
                <div><select id="col-enlace" aria-label="Columna del enlace" value={mapeo.enlace} onChange={cambiarColumna('enlace')} className={entrada} aria-invalid={Boolean(errores.enlace)}><option value="">Elija la columna…</option>{opcionesColumna.map((c) => <option key={c.indice} value={c.indice}>{nombreColumna(c)}{c.muestra[0] ? ` — ej.: ${c.muestra[0].slice(0, 30)}` : ''}</option>)}</select>{errores.enlace && <p className="mt-1 text-xs text-red-300">{errores.enlace}</p>}</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {['origen', 'destino'].map((c) => <div key={c}><select id={`col-${c}`} aria-label={`Columna del ${c}`} value={mapeo[c]} onChange={cambiarColumna(c)} className={entrada} aria-invalid={Boolean(errores[c])}><option value="">{c === 'origen' ? 'Columna del origen…' : 'Columna del destino…'}</option>{opcionesColumna.map((x) => <option key={x.indice} value={x.indice}>{nombreColumna(x)}</option>)}</select>{errores[c] && <p className="mt-1 text-xs text-red-300">{errores[c]}</p>}</div>)}
                </div>
              )}
            </div>
          </fieldset>
          {CAMPOS.slice(1).map((c) => selectorColumna({ campo: c.clave, etiqueta: c.etiqueta, ayuda: c.ayuda }))}

          <fieldset className="mt-4 rounded-md border border-noc-line p-3">
            <legend className="px-1 text-sm font-semibold">Si el servicio ya existe</legend>
            <label className="mb-1.5 flex items-start gap-2 text-sm"><input type="radio" name="modo" className="mt-1" checked={modo === 'agregar'} onChange={() => setModo('agregar')} /><span><b className="font-medium">Agregar</b> los enlaces del archivo a los que ya tiene. No quita nada.</span></label>
            <label className="flex items-start gap-2 text-sm"><input type="radio" name="modo" className="mt-1" checked={modo === 'reemplazar'} onChange={() => setModo('reemplazar')} /><span><b className="font-medium">Reemplazar</b> su recorrido por el del archivo. Solo para los servicios que el archivo trae con enlaces válidos.</span></label>
          </fieldset>
          <div className="mt-4 flex justify-between gap-2">
            <Boton onClick={() => { setPaso('archivo'); setCols(null); setArchivo(null); }}>Elegir otro archivo</Boton>
            <Boton variante="primario" cargando={trabajando} onClick={verPrevia}>Ver vista previa</Boton>
          </div>
        </>
      )}

      {paso === 'vista' && previa && (
        <>
          <p className="mb-2 text-sm text-noc-muted">Todavía no se guardó nada. Revise lo que pasaría:</p>
          <ul className="mb-4 list-disc space-y-0.5 pl-5 text-sm">{frasesResumen(previa.resumen, modo).map((x) => <li key={x}>{x}</li>)}</ul>
          <ListaProblemas titulo="Filas que se omiten" lista={previa.problemas} total={previa.problemas_total} tono="warn" />
          <ListaProblemas titulo="Avisos" lista={previa.advertencias} total={previa.advertencias_total} />
          {previa.ejemplo.length > 0 && (
            <section aria-label="Ejemplo" className="mb-4">
              <h3 className="mb-1 text-sm font-semibold">Así quedarían {previa.ejemplo.length < previa.resumen.servicios ? `los primeros ${previa.ejemplo.length}` : 'los servicios'}</h3>
              <div className="max-h-48 overflow-auto rounded-md border border-noc-line">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-noc-raised text-noc-muted"><tr><th className="px-2 py-1 font-medium">Servicio</th><th className="px-2 py-1 font-medium">Acción</th><th className="px-2 py-1 font-medium">Enlaces</th></tr></thead>
                  <tbody className="divide-y divide-noc-line">
                    {previa.ejemplo.map((s) => (
                      <tr key={s.nombre}><td className="px-2 py-1 font-medium">{s.nombre}</td><td className="whitespace-nowrap px-2 py-1">{ETIQUETA_ACCION[s.accion]}</td>
                        <td className="px-2 py-1 font-mono">{s.enlaces.join(', ') || <span className="font-sans text-noc-muted">ninguno</span>}{s.enlaces_total > s.enlaces.length && ` +${s.enlaces_total - s.enlaces.length}`}{s.quitados > 0 && <span className="ml-1 font-sans text-orange-300">(−{s.quitados})</span>}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <div className="flex justify-between gap-2">
            <Boton onClick={() => setPaso('columnas')}>Volver a las columnas</Boton>
            <Boton variante="primario" cargando={trabajando} disabled={previa.resumen.servicios === 0 || (previa.resumen.nuevos + previa.resumen.actualizados === 0)} onClick={importar}>
              {previa.resumen.nuevos + previa.resumen.actualizados === 0 ? 'Nada que importar' : `Importar ${previa.resumen.nuevos + previa.resumen.actualizados} servicio(s)`}
            </Boton>
          </div>
        </>
      )}

      {paso === 'resultado' && resultado && (
        <>
          <Aviso tipo="info">Importación lista: {resultado.aplicado.creados} servicio(s) nuevo(s) y {resultado.aplicado.actualizados} actualizado(s).</Aviso>
          {resultado.aplicado.errores.length > 0 && <Aviso>{resultado.aplicado.errores.length} servicio(s) no se pudieron guardar: {resultado.aplicado.errores.map((e) => `${e.servicio} (${e.motivo})`).join('; ')}</Aviso>}
          <ListaProblemas titulo="Filas que se omitieron" lista={resultado.problemas} total={resultado.problemas_total} tono="warn" />
          {resultado.problemas_total > 0 && <p className="mb-3 text-xs text-noc-muted">Corrija esas filas en el archivo y vuelva a subirlo: lo que ya se importó no se duplica.</p>}
          <div className="flex justify-end"><Boton variante="primario" onClick={onClose}>Cerrar</Boton></div>
        </>
      )}
    </Dialogo>
  );
}
