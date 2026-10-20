import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { diagnostico } from '../services/sistema.service.js';
import { asyncHandler } from '../utils/errors.js';

const router = Router();
router.use(authenticate, authorize('Admin'));

router.get('/diagnostico', asyncHandler(async (_req, res) => res.json({ ok: true, data: await diagnostico() })));

export default router;
