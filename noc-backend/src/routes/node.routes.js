import { Router } from 'express';
import * as ctrl from '../controllers/node.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { bulkPositionsSchema, createNodeSchema, positionSchema, updateNodeSchema } from '../validators/node.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listar);
router.put('/positions', authorize('Supervisor', 'Admin'), validate(bulkPositionsSchema), ctrl.moverPosiciones); // antes de /:id
router.get('/:id', ctrl.obtener);

// La disposición del canvas es compartida por toda la sala: solo Supervisor/Admin la modifican.
// (Para permitir a los Operadores, quitar authorize() de las dos rutas de posición.)
router.patch('/:id/position', authorize('Supervisor', 'Admin'), validate(positionSchema), ctrl.moverPosicion);

router.post('/', authorize('Supervisor', 'Admin'), validate(createNodeSchema), ctrl.crear);
router.put('/:id', authorize('Supervisor', 'Admin'), validate(updateNodeSchema), ctrl.actualizar);
router.delete('/:id', authorize('Admin'), ctrl.eliminar);

export default router;
