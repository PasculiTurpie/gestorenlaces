import mongoose from 'mongoose';
import { claveServicio } from '../utils/servicios.js';

const { Schema } = mongoose;

/**
 * Servicio que se transporta por la red (una señal de TV, un circuito de datos...). Lleva los enlaces por los que pasa,
 * para saber qué servicios se ven afectados cuando un enlace falla o entra en mantenimiento.
 */
const serviceSchema = new Schema(
  {
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, minlength: [2, 'Nombre demasiado corto'], maxlength: 120 },
    // nombre sin tildes ni mayúsculas: identifica al servicio al importar (volver a subir el archivo no duplica)
    clave: { type: String, required: true, unique: true },
    codigo: { type: String, trim: true, maxlength: 60, default: '' },
    cliente: { type: String, trim: true, maxlength: 120, default: '' },
    tipo: { type: String, trim: true, maxlength: 60, default: '' },
    capacidad: { type: String, trim: true, maxlength: 40, default: '' },
    observacion: { type: String, trim: true, maxlength: 500, default: '' },
    enlaces: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Link' }],
      default: [],
      validate: [
        { validator: (v) => v.length <= 200, message: 'Un servicio admite hasta 200 enlaces' },
        { validator: (v) => new Set(v.map(String)).size === v.length, message: 'Hay enlaces repetidos' },
      ],
    },
    actualizado_por: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

serviceSchema.pre('validate', function () {
  if (this.nombre) this.clave = claveServicio(this.nombre);
});
serviceSchema.index({ enlaces: 1 }); // «¿qué servicios pasan por este enlace?»

export const Service = mongoose.model('Service', serviceSchema);
