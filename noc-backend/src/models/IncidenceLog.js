import mongoose from 'mongoose';

const { Schema } = mongoose;

// Solo estos estados generan registro de incidencia (Mantenimiento es ventana planificada).
export const SEVERIDADES = ['Caido', 'Degradado'];

const incidenceSchema = new Schema(
  {
    enlace: { type: Schema.Types.ObjectId, ref: 'Link', required: true },
    severidad: { type: String, enum: { values: SEVERIDADES, message: 'Severidad inválida: {VALUE}' }, required: true },
    inicio: { type: Date, required: true, default: Date.now },
    fin: { type: Date },
    // Se mantiene en el hook de validación. Existe porque los índices parciales de MongoDB
    // no soportan { fin: { $exists: false } }, pero sí igualdad sobre un booleano.
    abierta: { type: Boolean, default: true },
    duracion_minutos: { type: Number, min: 0 },
    // Qué alarma la originó (tipificación) y qué filamento(s) del enlace están en ese estado
    tipificacion: { type: Schema.Types.ObjectId, ref: 'AlarmType', default: null },
    filamentos_afectados: { type: [{ type: String, enum: ['ida', 'vuelta'] }], default: [] },
    causa_raiz: { type: String, trim: true, maxlength: 1000, default: '' },
    ticket: { type: String, trim: true, maxlength: 60, default: '' },
  },
  { timestamps: true },
);

// Hook de cálculo: abierta/duración derivadas de inicio y fin.
incidenceSchema.pre('validate', function () {
  this.abierta = !this.fin;
  if (this.fin) {
    if (this.fin < this.inicio) {
      this.invalidate('fin', 'La fecha de fin no puede ser anterior al inicio');
      return;
    }
    this.duracion_minutos = Math.round(((this.fin - this.inicio) / 60_000) * 100) / 100;
  } else {
    this.duracion_minutos = undefined;
  }
});

incidenceSchema.index({ enlace: 1, inicio: -1 });
incidenceSchema.index({ inicio: 1, fin: 1 });
// Invariante: como máximo UNA incidencia abierta por enlace (protege frente a condiciones de carrera).
incidenceSchema.index(
  { enlace: 1 },
  { unique: true, partialFilterExpression: { abierta: true }, name: 'una_incidencia_abierta_por_enlace' },
);

export const IncidenceLog = mongoose.model('IncidenceLog', incidenceSchema);
