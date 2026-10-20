import { env } from '../config/env.js';
import { fechaDelTurno } from '../config/turnos.js';
import { ShiftReport } from '../models/ShiftReport.js';

/**
 * Asigna `fecha_turno` a las actas que no la tienen (anteriores a este campo). Idempotente: solo toca las que faltan.
 * Usa la misma regla que al abrir un turno (el turno noche pertenece al día en que termina).
 * Se escribe sin tocar `updatedAt`: es un dato derivado de campos que no cambian, no una modificación del acta.
 */
export async function rellenarFechaTurno({ tz = env.appTimezone, dryRun = false } = {}) {
  const faltantes = await ShiftReport.find({ $or: [{ fecha_turno: null }, { fecha_turno: '' }] }).select('tipo_turno fecha_inicio').lean();
  if (faltantes.length === 0 || dryRun) return faltantes.length;
  await ShiftReport.bulkWrite(
    faltantes.map((a) => ({ updateOne: { filter: { _id: a._id }, update: { $set: { fecha_turno: fechaDelTurno(a.tipo_turno, a.fecha_inicio, tz) } } } })),
    { ordered: false, timestamps: false },
  );
  return faltantes.length;
}
