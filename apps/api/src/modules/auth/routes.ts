import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { requireAuth } from '../../middleware/requireAuth';
import * as controller from './controller';

export const BATAS_LOGIN = 5;
export const JENDELA_LOGIN_MS = 15 * 60 * 1000;

export function buatAuthRouter(): Router {
  const router = Router();

  // Batas percobaan login: 5 kali gagal per 15 menit per IP + email.
  const batasLogin = rateLimit({
    windowMs: JENDELA_LOGIN_MS,
    limit: BATAS_LOGIN,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
      const body = req.body as { email?: unknown } | undefined;
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      return `${ipKeyGenerator(req.ip ?? '')}|${email.slice(0, 190)}`;
    },
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.',
        },
      });
    },
  });

  router.post('/login', batasLogin, controller.login);
  router.post('/logout', requireAuth, controller.logout);
  router.get('/me', requireAuth, controller.me);
  router.put('/password', requireAuth, controller.ubahPassword);
  return router;
}
