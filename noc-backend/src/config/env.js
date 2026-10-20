import 'dotenv/config';
import path from 'node:path';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  mongoUri: required('MONGODB_URI'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  timelineMax: Number(process.env.TIMELINE_MAX ?? 500),
  // Zona horaria con la que se muestran las fechas en el resumen imprimible del turno
  appTimezone: process.env.APP_TIMEZONE ?? 'America/Santiago',
  // Nº de proxies de confianza (nginx, etc.) para que el rate limit vea la IP real. 0 = sin proxy.
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  // Documentos adjuntos (procedimientos .docx/.pdf/.xlsx). En contenedores, montar un volumen persistente aquí.
  uploadsDir: path.resolve(process.env.UPLOADS_DIR ?? 'uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 15),
};

if (env.nodeEnv === 'production' && env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
}
