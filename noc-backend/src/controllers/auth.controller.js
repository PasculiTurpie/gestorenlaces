import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  // Mensaje genérico: no revelar si el email existe
  if (!user || !user.activo || !(await user.compararPassword(password))) {
    throw new AppError(401, 'Credenciales inválidas');
  }
  const token = jwt.sign({ sub: user.id, rol: user.rol }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
  res.json({ ok: true, data: { token, user: user.toJSON() } });
});

export const me = (req, res) => res.json({ ok: true, data: req.user.toJSON() });
