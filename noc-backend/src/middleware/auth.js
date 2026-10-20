import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError, asyncHandler } from '../utils/errors.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new AppError(401, 'Autenticación requerida');

  const payload = jwt.verify(token, env.jwtSecret); // JsonWebTokenError -> 401 en errorHandler
  const user = await User.findById(payload.sub);
  if (!user || !user.activo) throw new AppError(401, 'Usuario inexistente o desactivado');

  req.user = user;
  next();
});

// RBAC: authorize('Supervisor', 'Admin')
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) return next(new AppError(401, 'Autenticación requerida'));
    if (!roles.includes(req.user.rol)) {
      return next(new AppError(403, `Permisos insuficientes (se requiere: ${roles.join(' | ')})`));
    }
    next();
  };
