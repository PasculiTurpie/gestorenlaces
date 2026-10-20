import { Plus, Trash2 } from 'lucide-react';
import { fmtKm, segmentosBarra } from '../../lib/tramos.js';
import { leerNumero } from '../../lib/levantamiento.js';
import { Aviso, Boton, Campo, entrada } from './ui.jsx';

const HUECO = 'repeating-linear-gradient(135deg, #223043 0 4px, #162030 4px 8px)';

/** Barra proporcional del enlace: km 0 (origen) a la izquierda; los huecos sin asignar van rayados. */
function BarraTramos({ analisis, zonales, origen, destino }) {
  const longitud = analisis.longitud;
  const segmentos = analisis.tramos ? segmentosBarra(analisis.tramos, longitud, zonales) : [];
  const total = longitud ?? Math.max(0, ...(analisis.tramos ?? []).map((t) => t.km_hasta));

  if (!segmentos.length) {
    return <p className="rounded-md border border-dashed border-noc-line px-3 py-3 text-center text-xs text-noc-muted">{analisis.errores.length ? 'Corrija los errores para ver el reparto.' : 'Agregue tramos para ver cómo se reparte el enlace entre zonales.'}</p>;
  }
  const descripcion = segmentos.map((s) => (s.tipo === 'hueco' ? `sin asignar ${s.desde} a ${s.hasta} km` : `${s.zonal?.nombre ?? 'zonal'} ${s.desde} a ${s.hasta} km`)).join('; ');

  return (
    <div>
      <div role="img" aria-label={`Reparto del enlace: ${descripcion}`} className="relative h-7 overflow-hidden rounded border border-noc-line bg-noc-bg">
        {segmentos.map((s, i) => (
          <div
            key={i}
            title={s.tipo === 'hueco' ? `Sin asignar: km ${s.desde}–${s.hasta}` : `${s.zonal?.nombre ?? 'Zonal'}: km ${s.desde}–${s.hasta}`}
            className="absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-noc-bg/60 px-1 text-[10px] font-medium text-white/95"
            style={{ left: `${s.izq}%`, width: `${s.ancho}%`, background: s.tipo === 'hueco' ? HUECO : `${s.zonal?.color ?? '#8296ab'}` }}
          >
            {s.tipo === 'tramo' && s.ancho > 14 && <span className="truncate [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">{s.zonal?.nombre}</span>}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-noc-muted">
        <span>{origen} · km 0</span>
        <span>{fmtKm(total)} · {destino}</span>
      </div>
    </div>
  );
}

export default function TramosEditor({ origen, destino, zonales, zonalesDisponibles, puedeCrearZonales, longitud, setLongitud, filas, setFilas, analisis }) {
  const cambiarFila = (i, campo) => (e) => setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, [campo]: e.target.value } : f)));
  const quitar = (i) => setFilas((fs) => fs.filter((_, j) => j !== i));
  const agregar = () =>
    setFilas((fs) => {
      const ultimo = Math.max(0, ...fs.map((f) => leerNumero(f.hasta)).filter((n) => Number.isFinite(n)));
      const largo = leerNumero(longitud);
      return [...fs, { zonal: '', desde: String(ultimo), hasta: Number.isFinite(largo) && largo > ultimo ? String(largo) : '' }];
    });

  if (zonales.length === 0) {
    return (
      <Aviso tipo="info">
        Todavía no hay zonales. {puedeCrearZonales ? 'Cree la primera en Administración → Zonales y vuelva a este enlace.' : 'Pida a un Administrador que las cree en Administración → Zonales.'}
      </Aviso>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="tr-long" etiqueta="Longitud total del enlace (km)" ayuda="Permite comprobar que el reparto cubra todo el enlace.">
          <input id="tr-long" inputMode="decimal" value={longitud} onChange={(e) => setLongitud(e.target.value)} placeholder="Ej. 100" className={`${entrada} font-mono`} />
        </Campo>
        <p className="self-center text-xs text-noc-muted">Los kilómetros se miden desde <span className="font-mono text-noc-text">{origen}</span> (km 0) hacia <span className="font-mono text-noc-text">{destino}</span>.</p>
      </div>

      <div className="mb-4"><BarraTramos analisis={analisis} zonales={zonales} origen={origen} destino={destino} /></div>

      <div className="mb-2 grid grid-cols-[1fr_5.5rem_5.5rem_4.5rem_2rem] gap-2 text-xs text-noc-muted" aria-hidden="true">
        <span>Zonal</span><span>Desde (km)</span><span>Hasta (km)</span><span>Largo</span><span />
      </div>
      <div className="space-y-2">
        {filas.map((f, i) => {
          const desde = leerNumero(f.desde), hasta = leerNumero(f.hasta);
          const largo = Number.isFinite(desde) && Number.isFinite(hasta) && hasta > desde ? hasta - desde : null;
          return (
            <div key={i} role="group" aria-label={`Tramo ${i + 1}`} className="grid grid-cols-[1fr_5.5rem_5.5rem_4.5rem_2rem] items-center gap-2">
              <select aria-label={`Zonal del tramo ${i + 1}`} value={f.zonal} onChange={cambiarFila(i, 'zonal')} className={entrada}>
                <option value="">Elija zonal…</option>
                {zonalesDisponibles.concat(zonales.filter((z) => z._id === f.zonal && !z.activo)).map((z) => <option key={z._id} value={z._id}>{z.nombre}{z.activo ? '' : ' (desactivada)'}</option>)}
              </select>
              <input aria-label={`Km inicial del tramo ${i + 1}`} inputMode="decimal" value={f.desde} onChange={cambiarFila(i, 'desde')} className={`${entrada} px-2 font-mono`} />
              <input aria-label={`Km final del tramo ${i + 1}`} inputMode="decimal" value={f.hasta} onChange={cambiarFila(i, 'hasta')} className={`${entrada} px-2 font-mono`} />
              <span className="font-mono text-xs tabular-nums text-noc-muted">{largo == null ? '—' : fmtKm(Math.round(largo * 1000) / 1000)}</span>
              <button type="button" onClick={() => quitar(i)} aria-label={`Quitar el tramo ${i + 1}`} className="rounded p-1.5 text-noc-muted hover:bg-noc-raised hover:text-red-300"><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>
      <Boton className="mt-3" onClick={agregar} disabled={filas.length >= 20}><Plus size={14} /> Agregar tramo</Boton>

      <div className="mt-3" aria-live="polite">
        {analisis.errores.map((m) => <Aviso key={m}>{m}</Aviso>)}
        {analisis.avisos.map((m) => <Aviso key={m} tipo="info">{m}</Aviso>)}
      </div>
    </div>
  );
}
