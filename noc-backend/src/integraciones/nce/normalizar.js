import { aISO, leerRuta } from './util.js';

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());

/**
 * Convierte UNA alarma cruda de NCE en la forma interna de la app, según los nombres de campo del perfil.
 * `codigo` es el nombre de la alarma en mayúsculas y con guiones bajos (R_LOS, SPAN_LOSS_EXCEED_EOL…), para casarlo con la tipificación.
 */
export function normalizarAlarma(cruda, perfil) {
  const c = perfil.campos;
  const id = leerRuta(cruda, c.id);
  const nombre = texto(leerRuta(cruda, c.nombre));
  if (id === undefined || id === null || id === '' || !nombre) return { descartada: 'Falta el identificador o el nombre de la alarma' };

  const sev = texto(leerRuta(cruda, c.severidad));
  const clave = Object.keys(perfil.severidad).find((k) => k.toLowerCase() === sev.toLowerCase());
  const regla = clave ? perfil.severidad[clave] : null;
  if (regla === 'Ignorar') return { descartada: `Severidad «${sev}» ignorada por el perfil` };

  return {
    alarma: {
      id: String(id),
      codigo: nombre.toUpperCase().replace(/[\s-]+/g, '_'),
      nombre,
      severidad_nce: sev,
      estado_sugerido: regla, // null si el perfil no conoce esa severidad
      equipo: texto(leerRuta(cruda, c.equipo)),
      ubicacion: c.ubicacion ? texto(leerRuta(cruda, c.ubicacion)) : '',
      inicio: c.inicio ? aISO(leerRuta(cruda, c.inicio), perfil.formato_fecha) : null,
      texto: c.texto ? texto(leerRuta(cruda, c.texto)) : '',
    },
  };
}

/** Interpreta la lista completa: devuelve { alarmas, descartadas: [{ indice, motivo }] }. Un mismo id repetido se cuenta una sola vez. */
export function interpretarLista(crudas, perfil) {
  const alarmas = [];
  const descartadas = [];
  const vistos = new Set();
  crudas.forEach((cruda, indice) => {
    const r = normalizarAlarma(cruda, perfil);
    if (r.descartada) { descartadas.push({ indice, motivo: r.descartada }); return; }
    if (vistos.has(r.alarma.id)) { descartadas.push({ indice, motivo: `Alarma repetida (id ${r.alarma.id})` }); return; }
    vistos.add(r.alarma.id);
    alarmas.push(r.alarma);
  });
  return { alarmas, descartadas };
}
