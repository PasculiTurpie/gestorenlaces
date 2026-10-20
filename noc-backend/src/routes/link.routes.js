import { Router } from 'express';
import * as ctrl from '../controllers/link.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createLinkSchema,
  deleteQuerySchema,
  levantamientoSchema,
  listQuerySchema,
  metricsQuerySchema,
  statusSchema,
  timelineEntrySchema,
  tramosSchema,
  updateLinkSchema,
} from '../validators/link.validators.js';

const router = Router();
router.use(authenticate);

// Lectura: cualquier rol autenticado
router.get('/', validate(listQuerySchema, 'query'), ctrl.listar);
router.get('/metrics', validate(metricsQuerySchema, 'query'), ctrl.metricasGlobales); // antes de /:id
router.get('/:id', ctrl.obtener);
router.get('/:id/metrics', validate(metricsQuerySchema, 'query'), ctrl.metricasEnlace);

// Operación diaria: Operador, Supervisor y Admin
router.patch('/:id/status', validate(statusSchema), ctrl.actualizarEstado);
router.post('/:id/timeline', validate(timelineEntrySchema), ctrl.agregarTimeline);

// Gestión de la topología: Supervisor / Admin
router.post('/', authorize('Supervisor', 'Admin'), validate(createLinkSchema), ctrl.crear);
router.put('/:id', authorize('Supervisor', 'Admin'), validate(updateLinkSchema), ctrl.actualizar);
router.put('/:id/filamentos/:sentido', authorize('Supervisor', 'Admin'), validate(levantamientoSchema), ctrl.guardarLevantamiento);
router.put('/:id/tramos', authorize('Supervisor', 'Admin'), validate(tramosSchema), ctrl.guardarTramos);
router.delete('/:id', authorize('Admin'), validate(deleteQuerySchema, 'query'), ctrl.eliminar);

export default router;
