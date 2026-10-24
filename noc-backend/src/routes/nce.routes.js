import { Router } from 'express';
import * as ctrl from '../controllers/nce.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Todos los roles ven las alarmas leídas de NCE; el estado de la conexión y las pruebas son de Supervisor o superior.
// Recargar la configuración, de Admin. Nada de esto escribe en NCE: es solo lectura.
router.get('/alarmas', ctrl.alarmas);
router.get('/estado', authorize('Supervisor', 'Admin'), ctrl.estado);
router.post('/probar', authorize('Supervisor', 'Admin'), ctrl.probar);
router.post('/sincronizar', authorize('Supervisor', 'Admin'), ctrl.sincronizar);
router.post('/recargar', authorize('Admin'), ctrl.recargar);

export default router;
