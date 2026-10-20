import { env } from '../config/env.js';
import { Link } from '../models/Link.js';
import { IncidenceLog } from '../models/IncidenceLog.js';
import { AppError } from '../utils/errors.js';

const redondear = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

/** Diferencia (ms) entre la hora local de `tz` y UTC en el instante dado (negativa al oeste de Greenwich). */
function desfaseZona(instante, tz) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  );
  const comoUtc = Date.UTC(+partes.year, +partes.month - 1, +partes.day, +partes.hour, +partes.minute, +partes.second);
  return comoUtc - Math.floor(instante.getTime() / 1000) * 1000;
}

/** Instante UTC en que empieza el día 1 del mes (00:00 hora local de `tz`). Dos pasadas para cubrir cambios de horario. */
export function inicioDeMes(year, month, tz = 'UTC') {
  const ref = Date.UTC(year, month - 1, 1);
  const primera = ref - desfaseZona(new Date(ref), tz);
  return new Date(ref - desfaseZona(new Date(primera), tz));
}

/** Año y mes (1-12) que corren ahora en la zona horaria dada. */
export function anioMesEnZona(ahora, tz = 'UTC') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric' }).formatToParts(ahora).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month };
}

/**
 * Ventana de cálculo del mes en la zona horaria de la operación (APP_TIMEZONE): un mes de reporte empieza y
 * termina a medianoche LOCAL. Si el mes está en curso, el tiempo total es el transcurrido hasta "ahora",
 * no el mes completo (evita inflar artificialmente el uptime).
 */
export function rangoMes(year, month, ahora = new Date(), tz = env.appTimezone) {
  const desde = inicioDeMes(year, month, tz);
  const hasta = month === 12 ? inicioDeMes(year + 1, 1, tz) : inicioDeMes(year, month + 1, tz);
  const corte = ahora < hasta ? ahora : hasta;
  const totalMin = Math.max((corte - desde) / 60_000, 0);
  return { desde, hasta, corte, totalMin };
}

/** Uptime % = ((Tiempo Total - Minutos Falla) / Tiempo Total) * 100 */
export function calcularUptime(totalMin, minutosFalla) {
  if (totalMin <= 0) return 100;
  return redondear(((totalMin - minutosFalla) / totalMin) * 100);
}

/**
 * Métricas mensuales por enlace.
 *  - Minutos de falla: solape de cada incidencia con la ventana (las que cruzan de mes se recortan;
 *    las abiertas cuentan hasta "ahora"). Por defecto solo severidad 'Caido'.
 *  - MTTR: media de duracion_minutos de las incidencias CERRADAS que comenzaron en el mes.
 */
export async function metricasMensuales({ year, month, enlaceIds, incluirDegradado = false, ahora = new Date() }) {
  const { desde, hasta, corte, totalMin } = rangoMes(year, month, ahora);
  if (desde > ahora) throw new AppError(400, 'El período solicitado está en el futuro');

  const filtroEnlaces = enlaceIds ? { _id: { $in: enlaceIds } } : {};
  const enlaces = await Link.find(filtroEnlaces).select('id_enlace').sort({ id_enlace: 1 }).lean();

  const severidades = incluirDegradado ? ['Caido', 'Degradado'] : ['Caido'];
  const incidencias = await IncidenceLog.find({
    enlace: { $in: enlaces.map((e) => e._id) },
    severidad: { $in: severidades },
    inicio: { $lt: corte },
    $or: [{ abierta: true }, { fin: { $gt: desde } }],
  })
    .select('enlace inicio fin duracion_minutos')
    .lean();

  const porEnlace = new Map();
  for (const inc of incidencias) {
    const k = String(inc.enlace);
    if (!porEnlace.has(k)) porEnlace.set(k, []);
    porEnlace.get(k).push(inc);
  }

  const periodo = `${year}-${String(month).padStart(2, '0')}`;

  return enlaces.map((enlace) => {
    const lista = porEnlace.get(String(enlace._id)) ?? [];
    let minutosFalla = 0;
    const duraciones = [];

    for (const inc of lista) {
      const ini = Math.max(inc.inicio.getTime(), desde.getTime());
      const fin = Math.min((inc.fin ?? ahora).getTime(), corte.getTime());
      if (fin > ini) minutosFalla += (fin - ini) / 60_000;
      if (inc.fin && inc.inicio >= desde && inc.inicio < hasta) duraciones.push(inc.duracion_minutos);
    }

    return {
      enlace: enlace._id,
      id_enlace: enlace.id_enlace,
      periodo,
      total_minutos: redondear(totalMin, 2),
      minutos_falla: redondear(minutosFalla, 2),
      uptime_pct: calcularUptime(totalMin, minutosFalla),
      incidentes: lista.length,
      mttr_minutos: duraciones.length ? redondear(duraciones.reduce((a, b) => a + b, 0) / duraciones.length, 2) : null,
    };
  });
}
