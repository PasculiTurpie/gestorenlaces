import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Tipo de línea: indica a quién pertenece el enlace (red propia u otra telco: WOM, Tigo, Claro, Entel…).
 * Lo administra un Admin; los enlaces lo referencian por ObjectId.
 */
const linkTypeSchema = new Schema(
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
    // Color con el que se distingue el tipo en el mapa (marcador del enlace). Evitar los colores de estado.
    color: {
      type: String,
      default: '#8296ab',
      lowercase: true,
      match: [/^#[0-9a-fA-F]{6}$/, 'Color inválido (use el formato #RRGGBB)'],
    },
    descripcion: { type: String, trim: true, maxlength: 300, default: '' },
    // La red propia. Solo la crea el seed; no se puede eliminar ni desactivar.
    propio: { type: Boolean, default: false },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Nombre único sin distinguir mayúsculas ni tildes
linkTypeSchema.index({ nombre: 1 }, { unique: true, collation: { locale: 'es', strength: 1 }, name: 'nombre_unico' });

export const LinkType = mongoose.model('LinkType', linkTypeSchema);
