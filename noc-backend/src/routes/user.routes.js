import { Router } from 'express';
import * as ctrl from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createUserSchema, resetPasswordSchema, updateUserSchema } from '../validators/user.validators.js';

const router = Router();
router.use(authenticate, authorize('Admin'));

router.get('/', ctrl.listar);
router.post('/', validate(createUserSchema), ctrl.crear);
router.patch('/:id', validate(updateUserSchema), ctrl.actualizar);
router.patch('/:id/password', validate(resetPasswordSchema), ctrl.restablecerPassword);
// Sin DELETE: se desactiva (activo=false) para conservar la trazabilidad de timelines, actas e incidencias.

export default router;
