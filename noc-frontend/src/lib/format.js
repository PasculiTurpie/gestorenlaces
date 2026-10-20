/** "hace 3 h 05 min" / "hace 12 min" / "hace 2 d 4 h" / "ahora" */
export function hace(fecha, ahora = Date.now()) {
  if (!fecha) return '—';
  const min = Math.max(0, Math.floor((ahora - new Date(fecha).getTime()) / 60_000));
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h ${String(min % 60).padStart(2, '0')} min`;
  return `hace ${Math.floor(h / 24)} d ${h % 24} h`;
}

export const fechaHora = (fecha) =>
  fecha ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(fecha)) : '—';

export const hora = (fecha) =>
  fecha ? new Intl.DateTimeFormat('es-CL', { timeStyle: 'medium' }).format(new Date(fecha)) : '';

export const cn = (...clases) => clases.filter(Boolean).join(' ');

/** Día de un turno ("2026-10-20") como "20-10-26". Es un día local ya calculado por el servidor: no se convierte de zona horaria. */
export const fechaDia = (ymd) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd ?? '');
  return m ? `${m[3]}-${m[2]}-${m[1].slice(2)}` : '—';
};
