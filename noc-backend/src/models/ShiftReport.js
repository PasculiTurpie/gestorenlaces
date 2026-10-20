import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { fechaDelTurno } from '../config/turnos.js';
import { TURNOS } from './User.js';
import { ESTADOS_ENLACE } from './Link.js';

const { Schema } = mongoose;

const checklistItemSchema = new Schema(
  {
    enlace: { type: Schema.Types.ObjectId, ref: 'Link', required: true },
    estado_recibido: { type: String, enum: ESTADOS_ENLACE, required: true },
    gestionado: { type: Boolean, default: false },
    accion_tomada: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { _id: false },
);

const shiftReportSchema = new Schema(
  {
    operador: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fecha_inicio: { type: Date, required: true, default: Date.now },
    fecha_fin: { type: Date },
    tipo_turno: { type: String, enum: { values: TURNOS, message: 'Turno inválido: {VALUE}' }, required: true },
    // Día al que pertenece el turno ("AAAA-MM-DD", hora local). El turno noche que empieza el 19 a las 23:00 es el turno del 20.
    fecha_turno: { type: String, match: [/^\d{4}-\d{2}-\d{2}$/, 'Fecha de turno inválida'] },
    checklist_enlaces: { type: [checklistItemSchema], default: [] },
    bitacora_general: { type: String, trim: true, maxlength: 10_000, default: '' },
    cerrado: { type: Boolean, default: false },
  },
  { timestamps: true },
);

shiftReportSchema.pre('validate', function () {
  // La fecha del turno se fija al abrirlo, según su horario (ver config/turnos.js)
  if (this.isNew && !this.fecha_turno) this.fecha_turno = fechaDelTurno(this.tipo_turno, this.fecha_inicio, env.appTimezone);

  // Un enlace solo puede aparecer una vez en el checklist
  const vistos = new Set();
  this.checklist_enlaces.forEach((item, i) => {
    const id = String(item.enlace);
    if (vistos.has(id)) this.invalidate(`checklist_enlaces.${i}.enlace`, 'Enlace duplicado en el checklist');
    vistos.add(id);
  });

  if (this.fecha_fin && this.fecha_fin < this.fecha_inicio) {
    this.invalidate('fecha_fin', 'La fecha de fin no puede ser anterior al inicio');
  }

  // Reglas de cierre: no se puede cerrar con incidentes recibidos sin gestionar
  if (this.cerrado) {
    this.fecha_fin ??= new Date();
    this.checklist_enlaces.forEach((item, i) => {
      if (item.estado_recibido !== 'OK' && !item.gestionado) {
        this.invalidate(`checklist_enlaces.${i}.gestionado`, 'Debe gestionarse antes de cerrar el turno');
      }
      if (item.gestionado && !item.accion_tomada?.trim()) {
        this.invalidate(`checklist_enlaces.${i}.accion_tomada`, 'Indique la acción tomada');
      }
    });
  }
});

// Un acta cerrada es inmutable (valor de auditoría).
shiftReportSchema.pre('save', function () {
  if (this.isNew || this.modifiedPaths().length === 0) return;
  if (this.cerrado && !this.isModified('cerrado')) {
    throw new Error('Un acta de turno cerrada no puede modificarse');
  }
});

shiftReportSchema.index({ operador: 1, fecha_inicio: -1 });
shiftReportSchema.index({ cerrado: 1, fecha_inicio: -1 });
shiftReportSchema.index({ fecha_turno: -1 }); // historial por fecha de turno
shiftReportSchema.index({ cerrado: 1, fecha_fin: -1 }); // último turno cerrado (traspaso)
// Un operador solo puede tener un turno abierto a la vez.
shiftReportSchema.index(
  { operador: 1 },
  { unique: true, partialFilterExpression: { cerrado: false }, name: 'un_turno_abierto_por_operador' },
);

// Detección automática de enlaces != OK al abrir turno.
shiftReportSchema.statics.checklistInicial = async function () {
  const Link = mongoose.model('Link');
  const pendientes = await Link.find({ estado: { $ne: 'OK' } }).select('_id estado id_enlace').lean();
  // Lo más grave primero: es lo que el operador debe atender antes
  const peso = { Caido: 3, Degradado: 2, Mantenimiento: 1 };
  pendientes.sort((a, b) => (peso[b.estado] ?? 0) - (peso[a.estado] ?? 0) || a.id_enlace.localeCompare(b.id_enlace));
  return pendientes.map((l) => ({ enlace: l._id, estado_recibido: l.estado, gestionado: false, accion_tomada: '' }));
};

// Las actas anteriores a este campo se rellenan al arrancar el servidor; mientras tanto se calcula al serializar
shiftReportSchema.set('toJSON', {
  transform(_doc, ret) {
    ret.fecha_turno ??= fechaDelTurno(ret.tipo_turno, ret.fecha_inicio, env.appTimezone);
    return ret;
  },
});

export const ShiftReport = mongoose.model('ShiftReport', shiftReportSchema);
