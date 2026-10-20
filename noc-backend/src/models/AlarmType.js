import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Tipificación de alarmas: qué es, qué significa y qué hacer. Es la guía operativa que se consulta al
 * registrar una alarma en un filamento. La administra un Admin (el contenido refleja los procedimientos
 * reales de la operación).
 */
const alarmTypeSchema = new Schema(
  {
    codigo: {
      type: String,
      required: [true, 'El código es obligatorio'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_-]{2,24}$/, 'El código debe tener 2-24 caracteres (A-Z, 0-9, _ o -)'],
    },
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, minlength: [2, 'Nombre demasiado corto'], maxlength: 80 },
    // Estado con el que normalmente se registra esta alarma (filtra las opciones al elegir el estado)
    estado_sugerido: {
      type: String,
      enum: { values: ['Caido', 'Degradado', 'Mantenimiento'], message: 'Estado inválido: {VALUE}' },
      default: 'Caido',
    },
    significado: { type: String, trim: true, maxlength: 2000, default: '' },
    // Pasos ordenados del procedimiento a seguir
    procedimiento: {
      type: [{ type: String, trim: true, minlength: [1, 'Un paso no puede estar vacío'], maxlength: [600, 'Un paso admite hasta 600 caracteres'] }],
      default: [],
      validate: { validator: (v) => v.length <= 20, message: 'Máximo 20 pasos por procedimiento' },
    },
    escalamiento: { type: String, trim: true, maxlength: 600, default: '' },
    // Tiempo objetivo (min) para actuar/escalar desde que se registra la alarma
    tiempo_respuesta_min: { type: Number, min: [1, 'Debe ser al menos 1 minuto'], max: 10080, default: null },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

alarmTypeSchema.index({ nombre: 1 }, { unique: true, collation: { locale: 'es', strength: 1 }, name: 'nombre_unico' });

export const AlarmType = mongoose.model('AlarmType', alarmTypeSchema);
