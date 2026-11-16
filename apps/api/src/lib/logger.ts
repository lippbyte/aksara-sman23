import pino from 'pino';
import { env, isTest } from '../env';

export const logger = pino({
  level: env.LOG_LEVEL ?? (isTest ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug'),
  // Jangan pernah mencatat kata sandi, cookie, atau isi sesi.
  redact: {
    paths: [
      'req.headers.cookie',
      'req.headers.authorization',
      'res.headers["set-cookie"]',
      '*.password',
      '*.password_baru',
      '*.password_lama',
    ],
    remove: true,
  },
});
