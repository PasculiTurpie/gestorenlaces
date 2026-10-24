import { Router } from 'express';
import * as ctrl from '../controllers/shiftItem.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createItemSchema, listItemsQuerySchema, resolverSchema, seguimientoSchema, updateItemSchema } from '../validators/shiftItem.validators.js';

const router = Router();
router.use(authenticate);

// Transversal: cualquier usuario autenticado que esté operando puede ingresar, seguir y resolver ítems (varios operadores comparten el turno).
router.get('/', validate(listItemsQuerySchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.detalle);
router.post('/', validate(createItemSchema), ctrl.crear);
router.patch('/:id', validate(updateItemSchema), ctrl.actualizar);
router.post('/:id/seguimiento', validate(seguimientoSchema), ctrl.agregarSeguimiento);
router.post('/:id/resolver', validate(resolverSchema), ctrl.resolver);
router.post('/:id/reabrir', ctrl.reabrir);

export default router;
