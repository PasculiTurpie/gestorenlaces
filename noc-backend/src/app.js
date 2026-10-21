import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import adjuntoRoutes from './routes/adjunto.routes.js';
import alarmTypeRoutes from './routes/alarmType.routes.js';
import authRoutes from './routes/auth.routes.js';
import incidentRoutes from './routes/incident.routes.js';
import linkRoutes from './routes/link.routes.js';
import serviceRoutes from './routes/service.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import linkTypeRoutes from './routes/linkType.routes.js';
import nodeRoutes from './routes/node.routes.js';
import shiftRoutes from './routes/shift.routes.js';
import sistemaRoutes from './routes/sistema.routes.js';
import userRoutes from './routes/user.routes.js';
import zonalRoutes from './routes/zonal.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  if (env.trustProxy) app.set('trust proxy', env.trustProxy);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/links', linkRoutes);
  app.use('/api/nodes', nodeRoutes);
  app.use('/api/shifts', shiftRoutes);
  app.use('/api/incidents', incidentRoutes);
  app.use('/api/link-types', linkTypeRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/zonales', zonalRoutes);
  app.use('/api/alarm-types', alarmTypeRoutes);
  app.use('/api/adjuntos', adjuntoRoutes);
  app.use('/api/sistema', sistemaRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/services', serviceRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
