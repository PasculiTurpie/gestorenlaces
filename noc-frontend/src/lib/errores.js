/** Mensaje legible de un ApiError: el mensaje general + el detalle por campo si lo hay. */
export function describirError(err) {
  if (!err) return 'Error desconocido';
  const detalles = Array.isArray(err.details) ? err.details.map((d) => (d.campo ? `${d.campo}: ${d.mensaje}` : d.mensaje)) : [];
  const base = detalles.length ? `${err.message} — ${detalles.join('; ')}` : err.message;
  return err.ref ? `${base} (ref. ${err.ref})` : base; // la referencia permite localizar el error en la consola del backend
}
