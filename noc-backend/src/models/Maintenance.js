import mongoose from 'mongoose';

const { Schema } = mongoose;

export const ESTADOS_MANTENIMIENTO = ['Programado', 'En curso', 'Finalizado', 'Cancelado'];
export const ESTADOS_ACTIVOS = ['Programado', 'En curso'];

const historialSchema = new Schema(
  {
    fecha: { type: Date, default: Date.now },
    usuario: { type: Schema.Types.ObjectId, ref: 'User' },
    accion: { type: String, maxlength: 200, required: true },
    observacion: { type: String, maxlength: 500, default: '' },
  },
  { _id: false },
);

/**
 * Trabajo (programado o en curso) sobre uno o varios enlaces, visible para todo el NOC.
 * Al INICIARLO los enlaces pasan a "Mantenimiento" y al FINALIZARLO vuelven a "OK", siempre por el mismo camino
 * auditado que usan los operadores (timeline del enlace e incidencias coherentes).
 */
const maintenanceSchema = new Schema(
  {
    titulo: { type: String, required: [true, 'El título es obligatorio'], trim: true, minlength: [3, 'Título demasiado corto'], maxlength: 120 },
    descripcion: { type: String, trim: true, maxlength: 2000, default: '' },
    enlaces: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Link' }],
      validate: [
        { validator: (v) => v.length >= 1, message: 'Seleccione al menos un enlace' },
        { validator: (v) => v.length <= 50, message: 'Máximo 50 enlaces por mantenimiento' },
        { validator: (v) => new Set(v.map(String)).size === v.length, message: 'Hay enlaces repetidos' },
      ],
    },
    tipificacion: { type: Schema.Types.ObjectId, ref: 'AlarmType', required: [true, 'Elija la tipificación del mantenimiento'] },
    ticket: { type: String, trim: true, maxlength: 60, default: '' },
    inicio: { type: Date, required: [true, 'Indique el inicio'] },
    fin: { type: Date, required: [true, 'Indique el fin'] },
    con_corte: { type: Boolean, default: false }, // se prevé afectar el servicio
    estado: { type: String, enum: { values: ESTADOS_MANTENIMIENTO, message: 'Estado inválido: {VALUE}' }, default: 'Programado' },
    inicio_real: { type: Date },
    fin_real: { type: Date },
    motivo_cancelacion: { type: String, maxlength: 500 },
    creado_por: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    historial: { type: [historialSchema], default: [] },
  },
  { timestamps: true },
);

maintenanceSchema.pre('validate', function () {
  if (this.inicio && this.fin && this.fin <= this.inicio) this.invalidate('fin', 'El fin debe ser posterior al inicio');
});

maintenanceSchema.index({ estado: 1, inicio: 1 });
maintenanceSchema.index({ enlaces: 1, estado: 1 });

export const Maintenance = mongoose.model('Maintenance', maintenanceSchema);
