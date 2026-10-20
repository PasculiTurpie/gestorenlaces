import { Router } from 'express';
import * as adjuntos from '../controllers/adjunto.controller.js';
import * as ctrl from '../controllers/alarmType.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { subirArchivo } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { createAlarmTypeSchema, updateAlarmTypeSchema } from '../validators/alarmType.validators.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.listar); // todos los roles: es la guía que consulta el operador
router.post('/', authorize('Admin'), validate(createAlarmTypeSchema), ctrl.crear);
router.put('/:id', authorize('Admin'), validate(updateAlarmTypeSchema), ctrl.actualizar);
router.post('/:id/adjuntos', authorize('Admin'), subirArchivo, adjuntos.subir); // procedimientos .docx/.pdf/.xlsx
router.delete('/:id', authorize('Admin'), ctrl.eliminar);

export default router;
