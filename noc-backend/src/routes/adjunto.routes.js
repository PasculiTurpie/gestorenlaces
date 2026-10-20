import { Router } from 'express';
import * as ctrl from '../controllers/adjunto.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/:id/archivo', ctrl.descargar); // todos los roles: el operador consulta el procedimiento
router.delete('/:id', authorize('Admin'), ctrl.eliminar);

export default router;
