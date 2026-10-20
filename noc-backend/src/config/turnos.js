/**
 * Horario de los turnos del NOC. Es la ÚNICA fuente: el frontend lo consulta en GET /api/shifts/schedule.
 * Las horas son locales (APP_TIMEZONE). El turno noche cruza la medianoche: empieza un día y termina a la mañana siguiente.
 * El orden importa: cada turno recibe del anterior de la lista (y el primero, del último).
 */
export const HORARIOS = [
  { clave: 'Mañana', inicio: '08:00', fin: '15:30' },
  { clave: 'Tarde', inicio: '15:30', fin: '23:00' },
  { clave: 'Noche', inicio: '23:00', fin: '08:00' },
];

// Quien llega puede abrir su turno unos minutos antes del cambio (mientras el anterior todavía termina).
// Configurable con TOLERANCIA_APERTURA_MIN (0–120); un valor inválido se ignora.
export const TOLERANCIA_APERTURA_MIN = (() => {
  const n = Number(process.env.TOLERANCIA_APERTURA_MIN ?? 30);
  return Number.isFinite(n) && n >= 0 && n <= 120 ? Math.floor(n) : 30;
})();

const aMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const cruzaMedianoche = (t) => aMin(t.fin) <= aMin(t.inicio);

/** Minutos desde las 00:00 en la zona horaria dada (respeta el cambio de horario de verano/invierno). */
export function minutosLocales(fecha, tz) {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(fecha);
  return Number(partes.find((p) => p.type === 'hour').value) * 60 + Number(partes.find((p) => p.type === 'minute').value);
}

/** Turno que está en curso a esa hora: 08:00 y 15:30 son de Mañana/Tarde (el límite pertenece al turno que EMPIEZA). */
export function turnoDeFecha(fecha, tz) {
  const min = minutosLocales(fecha, tz);
  return HORARIOS.find((t) => {
    const i = aMin(t.inicio);
    const f = aMin(t.fin);
    return i < f ? min >= i && min < f : min >= i || min < f;
  }).clave;
}

/** Turno que conviene proponer al abrir: el en curso, o el que empieza en los próximos `toleranciaMin` minutos. */
export function turnoSugerido(fecha, tz, toleranciaMin = TOLERANCIA_APERTURA_MIN) {
  const min = minutosLocales(fecha, tz);
  const proximo = HORARIOS.find((t) => {
    const falta = (aMin(t.inicio) - min + 1440) % 1440;
    return falta > 0 && falta <= toleranciaMin;
  });
  return proximo?.clave ?? turnoDeFecha(fecha, tz);
}

/** Fecha local "AAAA-MM-DD" de un instante en la zona horaria dada. */
export const fechaLocal = (fecha, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(fecha);

const sumarDias = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * Fecha a la que PERTENECE un turno ("AAAA-MM-DD"). Mañana y Tarde: el día en que empiezan.
 * Noche (cruza la medianoche): el día en que TERMINA. Quien entra el 19 a las 23:00 hace el turno noche del 20.
 * Como el turno se identifica por su horario y no por la hora exacta de apertura, abrirlo antes (22:40) o después
 * de la medianoche (02:00) da el mismo resultado.
 */
export function fechaDelTurno(clave, fechaInicio, tz) {
  const t = HORARIOS.find((x) => x.clave === clave);
  const dia = fechaLocal(fechaInicio, tz);
  if (!t || !cruzaMedianoche(t)) return dia;
  // desde la hora de fin (08:00) hasta las 24:00 se está en la parte "de la tarde" del turno: termina al día siguiente
  return minutosLocales(fechaInicio, tz) >= aMin(t.fin) ? sumarDias(dia, 1) : dia;
}

/** De qué turno se recibe: Mañana←Noche, Tarde←Mañana, Noche←Tarde. */
export function turnoAnterior(clave) {
  const i = HORARIOS.findIndex((t) => t.clave === clave);
  return i < 0 ? null : HORARIOS[(i + HORARIOS.length - 1) % HORARIOS.length].clave;
}

/** "Noche (23:00–08:00)" */
export function etiquetaTurno(clave) {
  const t = HORARIOS.find((x) => x.clave === clave);
  return t ? `${clave} (${t.inicio}–${t.fin})` : clave;
}

/** Lo que consulta el frontend. */
export function descripcionHorarios(tz, ahora = new Date()) {
  return {
    zona_horaria: tz,
    tolerancia_apertura_min: TOLERANCIA_APERTURA_MIN,
    turnos: HORARIOS.map((t) => ({ ...t, cruza_medianoche: cruzaMedianoche(t), anterior: turnoAnterior(t.clave) })),
    ahora: { turno: turnoDeFecha(ahora, tz), sugerido: turnoSugerido(ahora, tz) },
  };
}
