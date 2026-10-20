import { Router } from 'express';
import * as ctrl from '../controllers/incident.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listIncidentsQuerySchema, patchIncidentSchema } from '../validators/incident.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', validate(listIncidentsQuerySchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.obtener);
router.patch('/:id', authorize('Supervisor', 'Admin'), validate(patchIncidentSchema), ctrl.actualizar);

export default router;
