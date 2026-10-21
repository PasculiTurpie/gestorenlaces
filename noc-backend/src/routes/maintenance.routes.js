import { Router } from 'express';
import * as ctrl from '../controllers/maintenance.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  accionMaintenanceSchema,
  cancelMaintenanceSchema,
  createMaintenanceSchema,
  listMaintenanceQuerySchema,
  updateMaintenanceSchema,
} from '../validators/maintenance.validators.js';

const router = Router();
router.use(authenticate);

// Todos los roles ven los mantenimientos (es información para que todo el NOC esté al tanto);
// programarlos y operarlos requiere ser Operador o superior, igual que cambiar el estado de un enlace.
const opera = authorize('Operador', 'Supervisor', 'Admin');

router.get('/', validate(listMaintenanceQuerySchema, 'query'), ctrl.listar);
router.get('/:id', ctrl.detalle);
router.post('/', opera, validate(createMaintenanceSchema), ctrl.crear);
router.patch('/:id', opera, validate(updateMaintenanceSchema), ctrl.actualizar);
router.post('/:id/start', opera, validate(accionMaintenanceSchema), ctrl.iniciar);
router.post('/:id/finish', opera, validate(accionMaintenanceSchema), ctrl.finalizar);
router.post('/:id/cancel', opera, validate(cancelMaintenanceSchema), ctrl.cancelar);

export default router;
