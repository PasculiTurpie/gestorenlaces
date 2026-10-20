import mongoose from 'mongoose';

// ESTACION = sitio/estación (icono rectangular en el NMS). Ampliar según el catálogo real.
export const TIPOS_NODO = ['ESTACION', 'OLA', 'IBTP', 'NE'];

const nodeSchema = new mongoose.Schema(
  {
    id_nodo: {
      type: String,
      required: [true, 'id_nodo es obligatorio'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_-]{2,32}$/, 'id_nodo debe tener 2-32 caracteres (A-Z, 0-9, _ o -)'],
    },
    nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, maxlength: 120 },
    tipo: {
      type: String,
      required: [true, 'El tipo es obligatorio'],
      uppercase: true,
      trim: true,
      enum: { values: TIPOS_NODO, message: 'Tipo de nodo inválido: {VALUE}' },
    },
    // Coordenadas del canvas de React Flow (se persisten al arrastrar el nodo)
    posicion: {
      x: { type: Number, default: 0, min: -1e6, max: 1e6 },
      y: { type: Number, default: 0, min: -1e6, max: 1e6 },
    },
  },
  { timestamps: true },
);

nodeSchema.index({ tipo: 1 });

export const NodeDoc = mongoose.model('Node', nodeSchema);
