import mongoose from 'mongoose';
import { TURNOS } from './User.js';

const { Schema } = mongoose;

export const ESTADOS_ITEM = ['Abierto', 'Resuelto'];

const seguimientoSchema = new Schema(
  {
    fecha: { type: Date, default: Date.now },
    usuario: { type: Schema.Types.ObjectId, ref: 'User' },
    nombre: { type: String, required: true, trim: true, maxlength: 120 }, // quién lo escribió, tal como se llamaba al hacerlo
    texto: { type: String, required: [true, 'Escriba el seguimiento'], trim: true, minlength: [1, 'Escriba el seguimiento'], maxlength: 1000 },
  },
  { _id: true },
);

const historialSchema = new Schema(
  { fecha: { type: Date, default: Date.now }, nombre: { type: String, maxlength: 120 }, accion: { type: String, maxlength: 200, required: true } },
  { _id: false },
);

/**
 * Ítem de atención del NOC, TRANSVERSAL a los turnos y a los operadores: cualquier cosa que haya que atender además de los enlaces
 * (corte de cable secundario, corte de energía, falla de climatización…). No pertenece al acta de un operador: lo ven y atienden todos
 * los que estén de turno, y sigue abierto de un turno al siguiente hasta que alguien lo resuelve.
 */
const itemSchema = new Schema(
  {
    titulo: { type: String, required: [true, 'El título es obligatorio'], trim: true, minlength: [3, 'Título demasiado corto'], maxlength: 120 },
    ticket: { type: String, required: [true, 'El número de ticket es obligatorio'], trim: true, minlength: [1, 'El número de ticket es obligatorio'], maxlength: 60 },
    descripcion: { type: String, required: [true, 'La descripción es obligatoria'], trim: true, minlength: [3, 'Descripción demasiado corta'], maxlength: 2000 },
    estado: { type: String, enum: { values: ESTADOS_ITEM, message: 'Estado inválido: {VALUE}' }, default: 'Abierto' },
    // quién lo ingresó: lo fija el servidor con la sesión, no el cliente; no se puede cambiar después
    creado_por: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
    creado_por_nombre: { type: String, required: true, trim: true, maxlength: 120, immutable: true },
    // en qué turno se ingresó
    turno_ingreso: { tipo_turno: { type: String, enum: TURNOS }, fecha_turno: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ } },
    seguimiento: { type: [seguimientoSchema], default: [], validate: [{ validator: (v) => v.length <= 200, message: 'Demasiadas notas de seguimiento (máx. 200)' }] },
    resuelto_por: { type: Schema.Types.ObjectId, ref: 'User' },
    resuelto_por_nombre: { type: String, maxlength: 120 },
    resuelto_en: { type: Date },
    resolucion: { type: String, trim: true, maxlength: 1000 },
    historial: { type: [historialSchema], default: [] },
  },
  { timestamps: true },
);

itemSchema.index({ estado: 1, createdAt: -1 });

export const ShiftItem = mongoose.model('ShiftItem', itemSchema);
