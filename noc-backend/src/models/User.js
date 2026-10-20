import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['Operador', 'Supervisor', 'Admin'];
export const TURNOS = ['Mañana', 'Tarde', 'Noche'];

const userSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true,
      minlength: [2, 'El nombre es demasiado corto'],
      maxlength: 120,
    },
    email: {
      type: String,
      required: [true, 'El email es obligatorio'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
    },
    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria'],
      minlength: [8, 'La contraseña debe tener al menos 8 caracteres'],
      select: false,
    },
    rol: {
      type: String,
      enum: { values: ROLES, message: 'Rol inválido: {VALUE}' },
      default: 'Operador',
    },
    turno: {
      type: String,
      enum: { values: TURNOS, message: 'Turno inválido: {VALUE}' },
      required: [true, 'El turno es obligatorio'],
    },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// La validación (minlength) corre ANTES de este hook, por lo que se valida el texto plano y luego se hashea.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.compararPassword = function (plano) {
  return bcrypt.compare(plano, this.password);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
