import type { Health } from '@sms/shared';
import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const body: Health = { status: 'ok', waktu: new Date().toISOString() };
  res.json(body);
});
