import { AlarmType } from '../../src/models/AlarmType.js';

/**
 * Tipificación de alarmas de la red DWDM (Huawei), tal como la define la operación: código de la alarma, su definición
 * (nombre) y su causa común (significado). NO incluye procedimientos, escalamientos ni tiempos de respuesta: son de la
 * operación y los carga un Admin desde Administración → Alarmas (pasos propios y/o documentos .docx/.pdf/.xlsx adjuntos).
 *
 * `estado_sugerido` es una PROPUESTA (con qué estado se registra normalmente cada alarma) y solo ordena las opciones al
 * registrar un estado; un Admin puede cambiarlo y nunca impide usar la alarma en otro estado.
 */
export const ALARMAS_BASE = [
  { codigo: 'BEFFEC_EXC', nombre: 'BCH / FEC Bit Error Rate Exceeds Threshold', estado_sugerido: 'Degradado',
    significado: 'La tasa de error de bits (BER) corregida antes del FEC supera el umbral crítico. Indica degradación severa en la señal óptica.' },
  { codigo: 'SPAN_LOSS_EXCEED_EOL', nombre: 'Span Loss Exceeds End of Life', estado_sugerido: 'Degradado',
    significado: 'La atenuación o pérdida en el tramo de fibra superó el límite de fin de vida útil (EOL) planificado para el enlace.' },
  { codigo: 'SPAN_LOSS_EXCEED_BOL', nombre: 'Span Loss Exceeds Beginning of Life', estado_sugerido: 'Degradado',
    significado: 'La pérdida del tramo supera la tolerancia inicial (BOL) proyectada, indicando degradación temprana de la fibra.' },
  { codigo: 'R_LOS', nombre: 'Receive Loss of Signal', estado_sugerido: 'Caido',
    significado: 'Pérdida total de la señal óptica recibida en un puerto o interfaz.' },
  { codigo: 'R_LOF', nombre: 'Receive Loss of Frame', estado_sugerido: 'Caido',
    significado: 'Pérdida de la trama en la recepción. La señal óptica llega, pero no se puede sincronizar ni delimitar el formato del frame.' },
  { codigo: 'HARD_BAD', nombre: 'Hardware Bad / Hardware Failure', estado_sugerido: 'Caido',
    significado: 'Fallo o avería física en un módulo, tarjeta o transceptor (SFP/XFP/CFP).' },
  { codigo: 'IN_PWR_HIGH', nombre: 'Input Power Too High', estado_sugerido: 'Degradado',
    significado: 'La potencia de entrada óptica en la interfaz receptora supera el umbral máximo de saturación.' },
  { codigo: 'IN_PWR_LOW', nombre: 'Input Power Too Low', estado_sugerido: 'Degradado',
    significado: 'La potencia óptica recibida está por debajo de la sensibilidad mínima aceptable de la interfaz.' },
  { codigo: 'MUT_LOS', nombre: 'Multiplexer Unit Loss of Signal', estado_sugerido: 'Caido',
    significado: 'Pérdida de señal a la entrada del multiplexor u ordenador óptico.' },
  { codigo: 'OSC_LOS', nombre: 'Optical Supervisory Channel Loss of Signal', estado_sugerido: 'Degradado',
    significado: 'Pérdida de la señal del canal de supervisión óptica (OSC), lo que impide la gestión e intercambio de información entre sitios.' },
  { codigo: 'TEMP_ALAM', nombre: 'Temperature Alarm', estado_sugerido: 'Degradado',
    significado: 'La temperatura de una tarjeta o componente de chasis excede el umbral de operación seguro.' },
  { codigo: 'OTU_LOF', nombre: 'OTU Loss of Frame', estado_sugerido: 'Caido',
    significado: 'Pérdida del encuadre en la capa de unidad de transporte óptico (OTU).' },
  { codigo: 'ODU_AIS', nombre: 'ODU Alarm Indication Signal', estado_sugerido: 'Caido',
    significado: 'Señal de indicación de alarma en la capa ODU (Optical Data Unit), generada aguas arriba debido a un fallo severo previo.' },
  { codigo: 'FAN_FAIL', nombre: 'Fan Unit Failure', estado_sugerido: 'Degradado',
    significado: 'Fallo mecánico o eléctrico en la unidad de ventilación del chasis.' },

  // Mantenimiento: informa a todo el NOC que se está trabajando (o se va a trabajar) en el enlace. Un Admin puede agregar más tipos
  // (p. ej. cambio de tarjeta, limpieza de conectores) desde Administración → Alarmas, con estado sugerido "Mantenimiento".
  { codigo: 'MANT_PROG', nombre: 'Mantenimiento programado', estado_sugerido: 'Mantenimiento',
    significado: 'Trabajo planificado y coordinado, con ventana definida, en el enlace o en un equipo asociado.' },
  { codigo: 'MANT_CORR', nombre: 'Mantenimiento correctivo', estado_sugerido: 'Mantenimiento',
    significado: 'Intervención no planificada para reparar o prevenir una falla; puede afectar el servicio.' },
];

/** Tipificaciones genéricas de la primera versión del sistema: este catálogo las reemplaza (se DESACTIVAN, no se borran). */
export const ALARMAS_GENERICAS = ['LOS', 'LOF', 'CORTE', 'ATEN', 'SD', 'ENERGIA', 'EQUIPO', 'TERCEROS', 'MANT'];

/** Códigos propios que ya usaba la operación para una alarma del catálogo: se renombran conservando todo su contenido. */
export const CODIGOS_RENOMBRADOS = { SPAN_LOSS: 'SPAN_LOSS_EXCEED_EOL' };

const duplicado = (err) => err?.code === 11000;

/**
 * Deja la tipificación de alarmas según el catálogo DWDM. Idempotente y respetuoso con lo que un Admin ya haya editado:
 *  1. renombra los códigos propios equivalentes (p. ej. SPAN_LOSS → SPAN_LOSS_EXCEED_EOL) SIN tocar su procedimiento, escalamiento ni documentos;
 *  2. crea las alarmas que falten (las que ya existen NO se modifican);
 *  3. desactiva las genéricas anteriores (salvo con `retirarGenericas: false`), conservando su historial.
 * Devuelve el detalle para mostrarlo: { creados, total, renombrados, retiradas, conflictos }.
 */
export async function cargarAlarmasBase({ modelos = { AlarmType }, alarmas = ALARMAS_BASE, retirarGenericas = true } = {}) {
  const { AlarmType: Modelo } = modelos;
  const catalogo = new Map(alarmas.map((a) => [a.codigo, a]));
  const resultado = { creados: 0, total: alarmas.length, renombrados: [], retiradas: 0, conflictos: [] };

  for (const [viejo, nuevo] of Object.entries(CODIGOS_RENOMBRADOS)) {
    const actual = await Modelo.findOne({ codigo: viejo });
    if (!actual) continue;
    if (await Modelo.findOne({ codigo: nuevo })) {
      resultado.conflictos.push(`${viejo}: no se renombró porque ya existe ${nuevo}; revise cuál conservar desde Administración → Alarmas`);
      continue;
    }
    // si el nombre era solo el código repetido (p. ej. "SPAN_LOSS_EXCEED_EOL"), se pasa al nombre del catálogo; si no, se respeta
    const sinNombreReal = [viejo, nuevo].includes(String(actual.nombre).toUpperCase());
    const cambios = { codigo: nuevo, ...(sinNombreReal && catalogo.has(nuevo) && { nombre: catalogo.get(nuevo).nombre }) };
    try {
      await Modelo.updateOne({ _id: actual._id }, { $set: cambios });
      resultado.renombrados.push({ de: viejo, a: nuevo });
    } catch (err) {
      if (!duplicado(err)) throw err;
      resultado.conflictos.push(`${viejo}: no se pudo renombrar a ${nuevo} (el nombre «${cambios.nombre}» ya está en uso)`);
    }
  }

  for (const a of alarmas) {
    try {
      const r = await Modelo.updateOne({ codigo: a.codigo }, { $setOnInsert: { ...a, activo: true } }, { upsert: true });
      resultado.creados += r.upsertedCount ?? 0;
    } catch (err) {
      if (!duplicado(err)) throw err;
      resultado.conflictos.push(`${a.codigo}: no se creó porque ya existe otra tipificación con el nombre «${a.nombre}»`);
    }
  }

  if (retirarGenericas) {
    const r = await Modelo.updateMany({ codigo: { $in: ALARMAS_GENERICAS }, activo: true }, { $set: { activo: false } });
    resultado.retiradas = r.modifiedCount ?? 0;
  }
  return resultado;
}
