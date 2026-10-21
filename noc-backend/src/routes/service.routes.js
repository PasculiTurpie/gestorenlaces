import { Router } from 'express';
import * as ctrl from '../controllers/service.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { subirTabla } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { createServiceSchema, importServicesBodySchema, listServicesQuerySchema, updateServiceSchema } from '../validators/service.validators.js';

const router = Router();
router.use(authenticate);

// Todos los roles consultan qué servicios pasan por cada enlace; cargarlos y editarlos es de Supervisor o superior.
const gestiona = authorize('Supervisor', 'Admin');

router.get('/', validate(listServicesQuerySchema, 'query'), ctrl.listar);
router.get('/resumen', ctrl.resumen); // antes de /:id
router.post('/import', gestiona, subirTabla, validate(importServicesBodySchema), ctrl.importar); // Excel (.xlsx) o texto (.txt, .csv)
router.get('/:id', ctrl.detalle);
router.post('/', gestiona, validate(createServiceSchema), ctrl.crear);
router.patch('/:id', gestiona, validate(updateServiceSchema), ctrl.actualizar);
router.delete('/:id', gestiona, ctrl.eliminar);

export default router;
