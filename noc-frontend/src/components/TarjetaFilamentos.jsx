import { ArrowLeft, ArrowRight } from 'lucide-react';
import { ESTADO_META } from '../lib/estados.js';
import { ETIQUETA_SENTIDO, fmtDb, fmtDbm } from '../lib/levantamiento.js';

export const TARJETA = { w: 236, h: 66 }; // tamaño aproximado, para colocarla sin tapar la línea

function Fila({ filamento }) {
  const { sentido, levantamiento: l } = filamento;
  const Flecha = sentido === 'ida' ? ArrowRight : ArrowLeft;
  return (
    <div
      className="flex items-center gap-1.5 font-mono text-[10px] leading-4"
      title={l.completo ? `Atenuación medida: ${fmtDb(l.atenuacion)} dB` : 'Falta registrar el levantamiento de potencias'}
    >
      <Flecha size={11} className="shrink-0 text-noc-muted" />
      <span className="w-9 shrink-0 text-noc-muted">{ETIQUETA_SENTIDO[sentido]}</span>
      {l.tx == null && l.rx == null ? (
        <span className="text-noc-muted">sin levantamiento</span>
      ) : (
        <span className="whitespace-nowrap tabular-nums">
          Tx {fmtDbm(l.tx)} <span className="text-noc-muted">·</span> Rx {fmtDbm(l.rx)}
        </span>
      )}
    </div>
  );
}

/** Estado propio de un filamento alarmado y su tipificación (solo se muestra si no está en OK). */
function FilaAlarma({ filamento: f }) {
  if (f.estado === 'OK') return null;
  const m = ESTADO_META[f.estado];
  return (
    <div className="-mt-0.5 mb-0.5 pl-[3.1rem] font-mono text-[10px] leading-4" style={{ color: m.color }}>
      ● {m.label}{f.alarma?.tipificacion?.codigo ? ` · ${f.alarma.tipificacion.codigo}` : ''}
    </div>
  );
}

/** Tarjeta con los dos filamentos de un enlace desplegado: sentido y potencias del levantamiento. */
export default function TarjetaFilamentos({ x, y, idEnlace, tipo, filamentos, onAbrir }) {
  const ajeno = tipo && !tipo.propio;
  return (
    <div
      role="group"
      aria-label={`Filamentos de ${idEnlace}`}
      className="nodrag nopan rounded-md border bg-noc-panel/95 px-2 py-1.5 shadow-xl"
      style={{
        position: 'absolute',
        width: TARJETA.w,
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        pointerEvents: 'all',
        borderColor: ajeno ? tipo.color : '#33465c',
      }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <button type="button" onClick={onAbrir} title="Abrir el enlace" className="truncate font-mono text-[10px] text-noc-text hover:underline">
          {idEnlace}
        </button>
        {ajeno && (
          <span className="shrink-0 rounded px-1 text-[10px] leading-4" style={{ color: tipo.color, background: `${tipo.color}26`, border: `1px solid ${tipo.color}66` }}>
            {tipo.nombre}
          </span>
        )}
      </div>
      {filamentos.map((f) => (
        <div key={f.sentido}>
          <Fila filamento={f} />
          <FilaAlarma filamento={f} />
        </div>
      ))}
    </div>
  );
}
