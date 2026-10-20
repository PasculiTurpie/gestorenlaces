import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validators/link.validators.js';

// Freno a fuerza bruta: solo cuentan los intentos FALLIDOS (10 por IP cada 15 min)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: { message: 'Demasiados intentos fallidos. Espera 15 minutos.' } },
});

const router = Router();
router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/me', authenticate, me);
export default router;
