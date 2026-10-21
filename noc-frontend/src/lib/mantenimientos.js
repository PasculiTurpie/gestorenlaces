// Mantenimientos programados / en curso: lógica pura (sin React).

export const ESTADOS_ACTIVOS = ['Programado', 'En curso'];

const ms = (f) => new Date(f).getTime();

/**
 * Situación de un mantenimiento respecto de AHORA. Programado: aún no empieza ("programado"), ya debió empezar y nadie lo
 * inició ("por_iniciar") o su ventana terminó sin iniciarse ("vencido"). En curso: dentro de su ventana o pasada de ella ("excedido").
 */
export function situacion(m, ahora = Date.now()) {
  if (m.estado === 'Programado') {
    if (ahora > ms(m.fin)) return { clave: 'vencido', etiqueta: 'Venció sin iniciarse', nivel: 'warn' };
    if (ahora >= ms(m.inicio)) return { clave: 'por_iniciar', etiqueta: 'Debió iniciar', nivel: 'warn' };
    return { clave: 'programado', etiqueta: 'Programado', nivel: 'info' };
  }
  if (m.estado === 'En curso') {
    return ahora > ms(m.fin) ? { clave: 'excedido', etiqueta: 'En curso · excede la ventana', nivel: 'warn' } : { clave: 'en_curso', etiqueta: 'En curso', nivel: 'curso' };
  }
  return { clave: m.estado.toLowerCase(), etiqueta: m.estado, nivel: 'muted' };
}

export const esActivo = (m) => ESTADOS_ACTIVOS.includes(m.estado);

const dd = (n) => String(n).padStart(2, '0');
const fecha = (f, tz) => { const d = new Date(f); return `${dd(d.getDate())}-${dd(d.getMonth() + 1)}-${String(d.getFullYear()).slice(2)}`; };
const hora = (f) => { const d = new Date(f); return `${dd(d.getHours())}:${dd(d.getMinutes())}`; };

/** "21-10-26 05:00 → 07:00" (mismo día) o "21-10-26 23:00 → 22-10-26 01:30". */
export function ventanaTexto(m) {
  return fecha(m.inicio) === fecha(m.fin) ? `${fecha(m.inicio)} ${hora(m.inicio)} → ${hora(m.fin)}` : `${fecha(m.inicio)} ${hora(m.inicio)} → ${fecha(m.fin)} ${hora(m.fin)}`;
}

/** Códigos de los enlaces: "ENL-A, ENL-B +2". Con enlaces aún sin poblar usa su id. */
export function nombresEnlaces(m, max = 3) {
  const ids = (m.enlaces ?? []).map((e) => e.id_enlace ?? String(e));
  return ids.length <= max ? ids.join(', ') : `${ids.slice(0, max).join(', ')} +${ids.length - max}`;
}

/**
 * Mantenimientos activos por enlace: { enlaceId: [m, ...] }, el que está en curso primero y luego por inicio.
 * Es lo que permite mostrar, en cada enlace, que se está trabajando o se va a trabajar.
 */
export function porEnlace(lista) {
  const mapa = {};
  for (const m of lista.filter(esActivo)) for (const e of m.enlaces ?? []) (mapa[e._id ?? e] ??= []).push(m);
  for (const k of Object.keys(mapa)) mapa[k].sort((a, b) => Number(b.estado === 'En curso') - Number(a.estado === 'En curso') || ms(a.inicio) - ms(b.inicio));
  return mapa;
}

/** Lo que conviene que todos vean ya: lo que está en curso, lo que debió iniciar y lo que empieza en las próximas `horas`. En ese orden. */
export function relevantes(lista, ahora = Date.now(), horas = 48) {
  const limite = ahora + horas * 3_600_000;
  const peso = (m) => ({ excedido: 0, en_curso: 1, por_iniciar: 2, vencido: 3, programado: 4 })[situacion(m, ahora).clave] ?? 9;
  return lista
    .filter(esActivo)
    .filter((m) => m.estado === 'En curso' || ms(m.inicio) <= limite)
    .sort((a, b) => peso(a) - peso(b) || ms(a.inicio) - ms(b.inicio));
}

// ----------------------------------------------------------------------------- formulario

const pad = (n) => String(n).padStart(2, '0');
/** Date/ISO → valor de <input type="datetime-local"> en hora local ("2026-10-21T05:00"). */
export const aInputLocal = (f) => { const d = new Date(f); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** Formulario nuevo: empieza en el próximo cuarto de hora y dura 2 horas. */
export function formularioInicial(ahora = Date.now()) {
  const d = new Date(Math.ceil(ahora / 900_000) * 900_000);
  return { titulo: '', descripcion: '', enlaces: [], tipificacion: '', ticket: '', inicio: aInputLocal(d), fin: aInputLocal(new Date(+d + 2 * 3_600_000)), con_corte: false };
}

export const formularioDesde = (m) => ({
  titulo: m.titulo, descripcion: m.descripcion ?? '', enlaces: (m.enlaces ?? []).map((e) => e._id ?? e), tipificacion: m.tipificacion?._id ?? m.tipificacion ?? '',
  ticket: m.ticket ?? '', inicio: aInputLocal(m.inicio), fin: aInputLocal(m.fin), con_corte: Boolean(m.con_corte),
});

/** Errores por campo ({} si es válido). Con el mantenimiento en curso el inicio ya no se valida contra "ahora". */
export function validarFormulario(f, ahora = Date.now()) {
  const e = {};
  if (f.titulo.trim().length < 3) e.titulo = 'Escriba un título (mín. 3 caracteres)';
  if (f.enlaces.length === 0) e.enlaces = 'Seleccione al menos un enlace';
  if (f.enlaces.length > 50) e.enlaces = 'Máximo 50 enlaces';
  if (!f.tipificacion) e.tipificacion = 'Elija la tipificación';
  const ini = new Date(f.inicio).getTime();
  const fin = new Date(f.fin).getTime();
  if (Number.isNaN(ini)) e.inicio = 'Indique el inicio';
  if (Number.isNaN(fin)) e.fin = 'Indique el fin';
  else if (!Number.isNaN(ini) && fin <= ini) e.fin = 'El fin debe ser posterior al inicio';
  else if (fin <= ahora) e.fin = 'El fin ya pasó';
  return e;
}

/** Cuerpo para la API (fechas en ISO). Los enlaces viajan por id. */
export const aPayload = (f) => ({
  titulo: f.titulo.trim(), descripcion: f.descripcion.trim(), enlaces: f.enlaces, tipificacion: f.tipificacion,
  ticket: f.ticket.trim(), inicio: new Date(f.inicio).toISOString(), fin: new Date(f.fin).toISOString(), con_corte: f.con_corte,
});

/** Para el editor de un mantenimiento en curso: solo viajan los campos que el servidor permite cambiar. */
export const aPayloadEnCurso = (f) => { const { titulo, descripcion, ticket, fin, con_corte } = aPayload(f); return { titulo, descripcion, ticket, fin, con_corte }; };

/** Otros mantenimientos activos que tocan alguno de estos enlaces (para avisar de solapamientos). */
export function conflictosDe(enlaceIds, lista, { excluir = null } = {}) {
  const sel = new Set(enlaceIds);
  return lista.filter((m) => esActivo(m) && m._id !== excluir && (m.enlaces ?? []).some((e) => sel.has(e._id ?? e)));
}

/** Resumen legible del resultado de iniciar/finalizar (para mostrarlo al operador). null si todo salió bien. */
export function avisoResultado(accion, resultado) {
  const fallidos = resultado?.fallidos ?? [];
  const omitidos = accion === 'finalizar' ? (resultado?.omitidos ?? []) : [];
  const partes = [];
  if (fallidos.length) partes.push(`No se pudo actualizar: ${fallidos.map((f) => `${f.enlace} (${f.motivo})`).join('; ')}. Revíselos y vuelva a intentarlo o cámbielos a mano.`);
  if (omitidos.length) partes.push(`Se respetó el estado actual de: ${omitidos.map((o) => `${o.enlace} (${o.motivo})`).join('; ')}.`);
  return partes.length ? partes.join(' ') : null;
}
