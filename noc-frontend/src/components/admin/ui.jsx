import { Loader2, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { cn } from '../../lib/format.js';

export const entrada =
  'w-full rounded-md border border-noc-line bg-noc-bg px-3 py-2 text-sm placeholder:text-noc-muted/60 disabled:cursor-not-allowed disabled:opacity-50';

// Para filtros en línea: mismo estilo pero ancho según el contenido (w-full y w-auto juntas se pisan entre sí)
export const entradaAuto = entrada.replace('w-full', 'w-auto');

export function Campo({ id, etiqueta, ayuda, children, className }) {
  return (
    <div className={cn('mb-3', className)}>
      <label htmlFor={id} className="mb-1 block text-sm">{etiqueta}</label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-noc-muted">{ayuda}</p>}
    </div>
  );
}

const VARIANTES = {
  primario: 'bg-noc-focus text-noc-bg hover:brightness-110',
  secundario: 'border border-noc-line text-noc-text hover:bg-noc-raised',
  peligro: 'border border-estado-down/50 text-red-300 hover:bg-estado-down/10',
};

export function Boton({ variante = 'secundario', cargando = false, className, children, ...props }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || cargando}
      className={cn('inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40', VARIANTES[variante], className)}
    >
      {cargando && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

export function Aviso({ tipo = 'error', children }) {
  const estilo = tipo === 'error' ? 'border-estado-down/40 bg-estado-down/10 text-red-300' : 'border-noc-line bg-noc-raised text-noc-muted';
  return <p role={tipo === 'error' ? 'alert' : 'status'} className={cn('mb-3 rounded-md border px-3 py-2 text-sm', estilo)}>{children}</p>;
}

export function Insignia({ color = '#8296ab', children, className }) {
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium', className)} style={{ color, background: `${color}26`, border: `1px solid ${color}66` }}>
      {children}
    </span>
  );
}

export function Cabecera({ titulo, descripcion, acciones }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold">{titulo}</h1>
        {descripcion && <p className="mt-0.5 max-w-prose text-sm text-noc-muted">{descripcion}</p>}
      </div>
      <div className="flex items-center gap-2">{acciones}</div>
    </div>
  );
}

export function Tabla({ columnas, children, vacio }) {
  const hayFilas = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="overflow-auto rounded-lg border border-noc-line">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead className="sticky top-0 bg-noc-panel text-left text-xs text-noc-muted">
          <tr>{columnas.map((c) => <th key={c} scope="col" className="border-b border-noc-line px-3 py-2 font-medium">{c}</th>)}</tr>
        </thead>
        <tbody className="[&>tr:not(:last-child)>td]:border-b [&>tr>td]:border-noc-line/60">{children}</tbody>
      </table>
      {!hayFilas && <p className="px-3 py-8 text-center text-sm text-noc-muted">{vacio}</p>}
    </div>
  );
}
export const Celda = ({ className, ...props }) => <td className={cn('px-3 py-2 align-middle', className)} {...props} />;

/** Modal accesible: Esc y clic fuera cierran; el foco entra al diálogo al abrirse. */
export function Dialogo({ titulo, descripcion, onClose, children, ancho = 'max-w-lg' }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        className={cn('entra flex max-h-[92vh] w-full flex-col overflow-hidden rounded-lg border border-noc-line-strong bg-noc-panel shadow-2xl outline-none', ancho)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-noc-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">{titulo}</h2>
            {descripcion && <p className="mt-0.5 text-sm text-noc-muted">{descripcion}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-noc-muted hover:bg-noc-raised hover:text-noc-text"><X size={16} /></button>
        </div>
        <div className="overflow-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
