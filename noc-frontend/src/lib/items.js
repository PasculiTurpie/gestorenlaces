// Ítems de atención del turno: lógica pura (sin React).

/** Sugerencias para el título (el campo es libre: «cualquier otro ítem»). */
export const TITULOS_SUGERIDOS = [
  'Corte de cable secundario', 'Corte de energía', 'Falla de equipo', 'Falla de climatización', 'Intervención de terceros / obra civil', 'Falla de enlace de acceso', 'Otro',
];

/** Errores por campo ({} si es válido). El ticket es obligatorio. */
export function validarItem(f) {
  const e = {};
  if (f.titulo.trim().length < 3) e.titulo = 'Escriba qué hay que atender (mín. 3 caracteres)';
  if (!f.ticket.trim()) e.ticket = 'El número de ticket es obligatorio';
  if (f.descripcion.trim().length < 3) e.descripcion = 'Describa el ítem (mín. 3 caracteres)';
  return e;
}

export const aPayloadItem = (f) => ({ titulo: f.titulo.trim(), ticket: f.ticket.trim(), descripcion: f.descripcion.trim() });
export const formularioItem = (item = null) => ({ titulo: item?.titulo ?? '', ticket: item?.ticket ?? '', descripcion: item?.descripcion ?? '' });

/** Solo cuenta lo que cambió, para no enviar ni anotar nada si no hay cambios. */
export function cambiosItem(item, f) {
  const nuevo = aPayloadItem(f);
  return Object.fromEntries(Object.entries(nuevo).filter(([k, v]) => v !== item[k]));
}

/** "turno noche del 20-10-26" (con la fecha del turno ya calculada por el servidor). */
export function etiquetaTurnoIngreso(item) {
  const t = item.turno_ingreso;
  if (!t?.tipo_turno) return null;
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.fecha_turno ?? '');
  return `turno ${t.tipo_turno.toLowerCase()}${f ? ` del ${f[3]}-${f[2]}-${f[1].slice(2)}` : ''}`;
}

/** Última nota de seguimiento (para mostrarla sin desplegar todo el hilo). */
export const ultimoSeguimiento = (item) => item.seguimiento?.at(-1) ?? null;
