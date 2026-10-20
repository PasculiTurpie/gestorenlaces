import { Router } from 'express';
import * as ctrl from '../controllers/linkType.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createLinkTypeSchema, updateLinkTypeSchema } from '../validators/linkType.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listar); // todos los roles: el mapa necesita colores y nombres
router.post('/', authorize('Admin'), validate(createLinkTypeSchema), ctrl.crear);
router.put('/:id', authorize('Admin'), validate(updateLinkTypeSchema), ctrl.actualizar);
router.delete('/:id', authorize('Admin'), ctrl.eliminar);

export default router;
