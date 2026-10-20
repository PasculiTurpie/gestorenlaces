import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Documento adjunto a una tipificación de alarma (procedimiento en .docx, .pdf o .xlsx).
 * El archivo vive en disco (UPLOADS_DIR) con un nombre generado por el servidor; aquí solo se guardan sus metadatos.
 */
const adjuntoSchema = new Schema(
  {
    alarma: { type: Schema.Types.ObjectId, ref: 'AlarmType', required: true, index: true },
    nombre: { type: String, required: true, trim: true, maxlength: 200 }, // nombre original, saneado
    extension: { type: String, required: true, enum: ['pdf', 'docx', 'xlsx'] },
    mime: { type: String, required: true },
    tamano_bytes: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true }, // huella del contenido (trazabilidad)
    almacen: { type: String, required: true }, // nombre del archivo en disco: <id>.<ext>
    descripcion: { type: String, trim: true, maxlength: 200, default: '' },
    subido_por: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const Adjunto = mongoose.model('Adjunto', adjuntoSchema);
