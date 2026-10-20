import mongoose from 'mongoose';
import { validarTramos } from '../utils/tramos.js';

const { Schema } = mongoose;

export const ESTADOS_ENLACE = ['OK', 'Degradado', 'Caido', 'Mantenimiento'];

// Cada enlace tiene dos filamentos de fibra: uno de ida (origen -> destino) y uno de vuelta (destino -> origen).
export const SENTIDOS = ['ida', 'vuelta'];

/** Atenuación medida (dB) = potencia emitida - potencia recibida. null si falta alguno de los dos valores. */
export const calcularAtenuacion = (tx, rx) =>
  Number.isFinite(tx) && Number.isFinite(rx) ? Math.round((tx - rx) * 100) / 100 : null;

const potencia = {
  type: Number,
  min: [-60, 'La potencia no puede ser menor a -60 dBm'],
  max: [40, 'La potencia no puede ser mayor a +40 dBm'],
};

// Parámetros medidos en el levantamiento (puesta en servicio) del filamento
const levantamientoSchema = new Schema(
  {
    fecha: { type: Date },
    potencia_tx_dbm: potencia,
    potencia_rx_dbm: potencia,
    observacion: { type: String, trim: true, maxlength: 500, default: '' },
    registrado_por: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

// Tramo del enlace asignado a una zonal. Los km se miden desde el nodo origen (km 0) hacia el destino.
const tramoSchema = new Schema(
  {
    zonal: { type: Schema.Types.ObjectId, ref: 'Zonal', required: [true, 'El tramo necesita una zonal'] },
    km_desde: { type: Number, required: true, min: [0, 'El km inicial no puede ser negativo'], max: 20000 },
    km_hasta: { type: Number, required: true, min: [0, 'El km final no puede ser negativo'], max: 20000 },
  },
  { _id: false },
);

// Alarma activa de un filamento: su tipificación (qué es y qué hacer) y una nota
const alarmaFilamentoSchema = new Schema(
  {
    tipificacion: { type: Schema.Types.ObjectId, ref: 'AlarmType', default: null },
    observacion: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { _id: false },
);

const filamentoSchema = new Schema(
  {
    sentido: { type: String, enum: { values: SENTIDOS, message: 'Sentido inválido: {VALUE}' }, required: true },
    // Estado propio del filamento. SIN valor por defecto: undefined = hereda el estado del enlace (enlaces anteriores).
    estado: { type: String, enum: { values: ESTADOS_ENLACE, message: 'Estado inválido: {VALUE}' } },
    estado_desde: { type: Date },
    alarma: { type: alarmaFilamentoSchema, default: undefined },
    levantamiento: { type: levantamientoSchema, default: () => ({}) },
  },
  { _id: false },
);

const timelineSchema = new Schema(
  {
    fecha: { type: Date, default: Date.now, required: true },
    operador: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accion: { type: String, required: [true, 'La acción es obligatoria'], trim: true, maxlength: 200 },
    observacion: { type: String, trim: true, maxlength: 2000, default: '' },
    ticket: { type: String, trim: true, maxlength: 60, default: '' },
  },
  { _id: true },
);

const linkSchema = new Schema(
  {
    id_enlace: {
      type: String,
      required: [true, 'id_enlace es obligatorio'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9_-]{3,40}$/, 'id_enlace debe tener 3-40 caracteres (A-Z, 0-9, _ o -)'],
    },
    origen_nodo: { type: Schema.Types.ObjectId, ref: 'Node', required: [true, 'origen_nodo es obligatorio'] },
    destino_nodo: { type: Schema.Types.ObjectId, ref: 'Node', required: [true, 'destino_nodo es obligatorio'] },
    estado: {
      type: String,
      enum: { values: ESTADOS_ENLACE, message: 'Estado inválido: {VALUE}' },
      default: 'OK',
      required: true,
    },
    // Desde cuándo está en el estado actual (útil para "tiempo en falla" en la UI)
    estado_desde: { type: Date, default: Date.now },
    ticket_actual: { type: String, trim: true, maxlength: 60, default: '' },
    proveedor: { type: String, trim: true, maxlength: 120, default: '' },
    // A quién pertenece la línea (propia o de otra telco). null = sin clasificar.
    tipo_enlace: { type: Schema.Types.ObjectId, ref: 'LinkType', default: null },
    // Siempre exactamente dos: ida y vuelta
    filamentos: {
      type: [filamentoSchema],
      default: () => [{ sentido: 'ida' }, { sentido: 'vuelta' }],
      validate: {
        validator: (v) => v.length === 2 && new Set(v.map((f) => f.sentido)).size === 2,
        message: 'Un enlace debe tener exactamente dos filamentos: ida y vuelta',
      },
    },
    // Largo total del enlace (km) y su reparto por zonal. Los tramos pueden dejar huecos sin asignar.
    longitud_km: { type: Number, min: [0.001, 'La longitud debe ser mayor a 0'], max: 20000, default: null },
    tramos: { type: [tramoSchema], default: [], validate: { validator: (v) => v.length <= 20, message: 'Máximo 20 tramos por enlace' } },
    // Bitácora operacional embebida y acotada (ver TIMELINE_MAX). El histórico permanente es Incidence_Log.
    timeline: { type: [timelineSchema], default: [] },
  },
  { timestamps: true },
);

linkSchema.pre('validate', function () {
  const o = this.origen_nodo?._id ?? this.origen_nodo;
  const d = this.destino_nodo?._id ?? this.destino_nodo;
  if (o && d && String(o) === String(d)) {
    this.invalidate('destino_nodo', 'El origen y el destino de un enlace no pueden ser el mismo nodo');
  }
});

linkSchema.pre('validate', function () {
  const errores = validarTramos(this.tramos.map((t) => ({ km_desde: t.km_desde, km_hasta: t.km_hasta })), this.longitud_km);
  for (const mensaje of errores) this.invalidate('tramos', mensaje);
});

linkSchema.index({ estado: 1 });
linkSchema.index({ origen_nodo: 1, destino_nodo: 1 }); // no único: pueden existir fibras paralelas/redundantes
linkSchema.index({ proveedor: 1 });
linkSchema.index({ tipo_enlace: 1 });
linkSchema.index({ 'tramos.zonal': 1 });

export const Link = mongoose.model('Link', linkSchema);
