import { AlarmType } from '../../src/models/AlarmType.js';

/**
 * Tipificaciones de alarma de PARTIDA para una red óptica de transporte. El significado y los procedimientos son
 * genéricos (buenas prácticas habituales): deben revisarse y ajustarse a los procedimientos, contactos y tiempos
 * reales de la operación. Un Admin los edita desde Administración → Alarmas.
 */
export const ALARMAS_BASE = [
  {
    codigo: 'LOS',
    nombre: 'Pérdida de señal (LOS)',
    estado_sugerido: 'Caido',
    significado: 'El receptor no detecta luz en el puerto: no llega señal por ese filamento. Causas habituales: corte o desconexión de la fibra, conector suelto o muy sucio, falla del transmisor en el extremo remoto o equipo remoto apagado.',
    procedimiento: [
      'Confirmar la alarma en el NMS en ambos extremos del enlace y determinar si afecta a un filamento (ida o vuelta) o a ambos.',
      'Revisar si hay alarmas de energía o de equipo en los sitios de los dos extremos: pueden ser la causa real.',
      'Consultar la potencia Tx y Rx de los puertos en ambos extremos y compararla con el levantamiento del enlace.',
      'Si el Tx remoto es normal pero no llega luz, sospechar corte de fibra: solicitar medición con OTDR o inspección en terreno.',
      'Abrir ticket con el responsable del tramo (zonal o proveedor según el tipo de línea) y registrar el número en el enlace.',
      'Informar al Supervisor de turno y dejar constancia de lo actuado en la bitácora.',
    ],
    escalamiento: 'Supervisor de turno de inmediato. Si el enlace no tiene ruta de respaldo, avisar también a Ingeniería de Transporte.',
    tiempo_respuesta_min: 15,
  },
  {
    codigo: 'LOF',
    nombre: 'Pérdida de trama (LOF)',
    estado_sugerido: 'Caido',
    significado: 'Llega luz, pero el equipo no logra sincronizar la trama. Suele indicar señal muy degradada, desajuste de configuración entre extremos o falla de una tarjeta o transceptor.',
    procedimiento: [
      'Verificar en ambos extremos que la configuración (velocidad, formato, canal) coincide.',
      'Revisar la potencia Rx: si está en el límite, tratarlo como degradación por atenuación.',
      'Limpiar o reemplazar el transceptor y los conectores del puerto afectado, si hay acceso al sitio.',
      'Si persiste, escalar a Ingeniería de Transporte para revisar la tarjeta.',
    ],
    escalamiento: 'Supervisor de turno; Ingeniería de Transporte si no se resuelve en el primer análisis.',
    tiempo_respuesta_min: 30,
  },
  {
    codigo: 'CORTE',
    nombre: 'Corte de fibra confirmado',
    estado_sugerido: 'Caido',
    significado: 'Se confirmó una interrupción física de la fibra (medición con OTDR o reporte de terreno). Causas: obras civiles, vandalismo, accidentes o desastres.',
    procedimiento: [
      'Registrar la distancia aproximada al corte (OTDR) y el tramo o zonal al que pertenece.',
      'Notificar a la zonal responsable de ese tramo y abrir ticket de reparación.',
      'Coordinar la cuadrilla de reparación y registrar la hora estimada de restablecimiento.',
      'Informar al Supervisor y a las áreas con servicios afectados.',
      'Actualizar el enlace con el ticket y las novedades hasta el restablecimiento; al cerrar, registrar la causa raíz.',
    ],
    escalamiento: 'Supervisor de turno y responsable de la zonal del tramo afectado.',
    tiempo_respuesta_min: 15,
  },
  {
    codigo: 'ATEN',
    nombre: 'Alta atenuación / potencia Rx baja',
    estado_sugerido: 'Degradado',
    significado: 'La potencia recibida está por debajo de lo esperado según el levantamiento del enlace. El servicio funciona, pero con poco margen. Causas: conectores sucios, curvaturas, empalmes deteriorados o envejecimiento de la fibra.',
    procedimiento: [
      'Comparar la potencia Rx actual con la del levantamiento y estimar cuántos dB se perdieron.',
      'Revisar si el cambio fue gradual o brusco, y si coincide con alguna intervención en la ruta.',
      'Solicitar limpieza e inspección de conectores en ambos extremos.',
      'Si la pérdida supera el margen, abrir ticket para medición de la fibra con OTDR.',
      'Dejar el enlace en seguimiento: registrar mediciones en cada turno hasta que se corrija.',
    ],
    escalamiento: 'Supervisor de turno si la potencia se acerca al umbral de sensibilidad del receptor.',
    tiempo_respuesta_min: 60,
  },
  {
    codigo: 'SD',
    nombre: 'Degradación de señal / errores (BER alto)',
    estado_sugerido: 'Degradado',
    significado: 'El enlace está activo pero con una tasa de errores superior a la tolerable. Puede originarse en atenuación, conectores defectuosos, dispersión o un transceptor que falla.',
    procedimiento: [
      'Revisar los contadores de errores en ambos extremos y confirmar que persisten.',
      'Verificar potencias Tx y Rx en el filamento afectado.',
      'Si los errores aparecen en un solo sentido, revisar el transceptor y los conectores de ese filamento.',
      'Si empeora o hay pérdida de tráfico, escalar y registrar la alarma como Caída.',
    ],
    escalamiento: 'Ingeniería de Transporte si los errores persisten tras la revisión básica.',
    tiempo_respuesta_min: 60,
  },
  {
    codigo: 'ENERGIA',
    nombre: 'Falla de energía en sitio',
    estado_sugerido: 'Caido',
    significado: 'Un sitio o repetidor perdió alimentación eléctrica (corte de red, falla de rectificador o baterías agotadas), lo que apaga los equipos y cae el enlace.',
    procedimiento: [
      'Confirmar si hay otras alarmas en el mismo sitio (varios enlaces caídos a la vez sugieren falla de energía).',
      'Verificar con el responsable del sitio el estado de la red eléctrica y la autonomía de baterías.',
      'Despachar mantenimiento del sitio o grupo electrógeno si corresponde.',
      'Registrar la hora de inicio y estimar la autonomía restante para anticipar nuevas caídas.',
    ],
    escalamiento: 'Supervisor de turno y mantenimiento del sitio.',
    tiempo_respuesta_min: 15,
  },
  {
    codigo: 'EQUIPO',
    nombre: 'Falla de equipo o tarjeta',
    estado_sugerido: 'Caido',
    significado: 'Un equipo o una tarjeta de línea presenta una falla de hardware que interrumpe o degrada el enlace.',
    procedimiento: [
      'Identificar el equipo y la tarjeta afectados y qué otros enlaces dependen de ellos.',
      'Intentar el reinicio controlado del puerto o la tarjeta solo si está autorizado en el procedimiento.',
      'Abrir caso con el proveedor del equipo y coordinar el reemplazo.',
      'Registrar el número de caso y la hora estimada de reposición.',
    ],
    escalamiento: 'Ingeniería de Transporte y proveedor del equipo.',
    tiempo_respuesta_min: 30,
  },
  {
    codigo: 'TERCEROS',
    nombre: 'Intervención de terceros / obra civil',
    estado_sugerido: 'Caido',
    significado: 'Una obra o trabajo ajeno a la operación está afectando o amenaza la fibra o el sitio (excavaciones, trabajos en postes, maniobras de otro operador).',
    procedimiento: [
      'Identificar el responsable de la obra y el punto exacto.',
      'Solicitar la detención de los trabajos o la coordinación con el área de canalización.',
      'Despachar a terreno para constatar el daño y fotografiarlo.',
      'Abrir ticket de reparación y registrar los datos del tercero para el posterior reclamo.',
    ],
    escalamiento: 'Supervisor de turno y área legal/seguros si hay daño a la infraestructura.',
    tiempo_respuesta_min: 15,
  },
  {
    codigo: 'MANT',
    nombre: 'Mantenimiento programado',
    estado_sugerido: 'Mantenimiento',
    significado: 'Ventana de trabajo planificada y autorizada sobre el enlace. Puede haber interrupción o degradación del servicio durante la ventana.',
    procedimiento: [
      'Verificar que existe el ticket o cambio autorizado y que la ventana coincide con la hora actual.',
      'Registrar el número del cambio en el enlace y el horario previsto de término.',
      'Al finalizar la ventana, confirmar que el enlace volvió a OK y cerrar el estado de mantenimiento.',
      'Si la ventana se excede o hay incidencias, escalar al Supervisor.',
    ],
    escalamiento: 'Responsable del cambio y Supervisor de turno si la ventana se excede.',
    tiempo_respuesta_min: null,
  },
];

/** Upsert por código. Idempotente: nunca pisa lo que un Admin haya editado (todo va en $setOnInsert). */
export async function cargarAlarmasBase({ modelos = { AlarmType }, alarmas = ALARMAS_BASE } = {}) {
  let creados = 0;
  for (const a of alarmas) {
    const r = await modelos.AlarmType.updateOne({ codigo: a.codigo }, { $setOnInsert: { ...a, activo: true } }, { upsert: true });
    creados += r.upsertedCount ?? 0;
  }
  return { creados, total: alarmas.length };
}
