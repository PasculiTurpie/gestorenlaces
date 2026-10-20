import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Zonal: zona operativa responsable de un tramo de fibra. Un enlace puede cruzar varias zonales;
 * cada tramo (km desde / km hasta) del enlace se asigna a una. Lo administra un Admin.
 */
const zonalSchema = new Schema(
  {
    clave: {
      type: String,
      required: [true, 'La clave es obligatoria'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_-]{2,24}$/, 'La clave debe tener 2-24 caracteres (A-Z, 0-9, _ o -)'],
    },
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, minlength: [2, 'Nombre demasiado corto'], maxlength: 60 },
    color: { type: String, default: '#8296ab', lowercase: true, match: [/^#[0-9a-fA-F]{6}$/, 'Color inválido (use el formato #RRGGBB)'] },
    descripcion: { type: String, trim: true, maxlength: 300, default: '' },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

zonalSchema.index({ nombre: 1 }, { unique: true, collation: { locale: 'es', strength: 1 }, name: 'nombre_unico' });

export const Zonal = mongoose.model('Zonal', zonalSchema);
