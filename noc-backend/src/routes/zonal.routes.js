import { Router } from 'express';
import * as ctrl from '../controllers/zonal.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createZonalSchema, updateZonalSchema } from '../validators/zonal.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listar); // todos los roles: el mapa y los formularios necesitan nombres y colores
router.post('/', authorize('Admin'), validate(createZonalSchema), ctrl.crear);
router.put('/:id', authorize('Admin'), validate(updateZonalSchema), ctrl.actualizar);
router.delete('/:id', authorize('Admin'), ctrl.eliminar);

export default router;
