import { Router } from 'express';
import * as ctrl from '../controllers/shift.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  checklistItemSchema,
  closeShiftSchema,
  listShiftsQuerySchema,
  openShiftSchema,
  patchShiftSchema,
  previousQuerySchema,
} from '../validators/shift.validators.js';

const router = Router();
router.use(authenticate); // la propiedad (Operador: solo lo suyo) se aplica en el controlador

router.get('/', validate(listShiftsQuerySchema, 'query'), ctrl.listar);
router.post('/open', validate(openShiftSchema), ctrl.abrir);
router.get('/current', ctrl.actual); // antes de /:id
router.get('/schedule', ctrl.horarios); // horario de los turnos (antes de /:id)
router.get('/previous', validate(previousQuerySchema, 'query'), ctrl.anterior); // traspaso: último turno cerrado

router.get('/:id', ctrl.obtener);
router.get('/:id/print', ctrl.imprimible);
router.patch('/:id', validate(patchShiftSchema), ctrl.actualizarBitacora);
router.post('/:id/checklist/sync', ctrl.sincronizarChecklist);
router.patch('/:id/checklist/:enlaceId', validate(checklistItemSchema), ctrl.actualizarChecklist);
router.post('/:id/close', validate(closeShiftSchema), ctrl.cerrar);

export default router;
