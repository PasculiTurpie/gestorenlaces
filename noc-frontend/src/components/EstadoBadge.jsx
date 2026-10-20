import { ESTADO_META } from '../lib/estados.js';
import { cn } from '../lib/format.js';

export default function EstadoBadge({ estado, className }) {
  const m = ESTADO_META[estado] ?? ESTADO_META.OK;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium', className)}
      style={{ color: m.color, background: `${m.color}1f`, border: `1px solid ${m.color}55` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}
