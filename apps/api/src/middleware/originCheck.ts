import type { RequestHandler } from 'express';
import { env } from '../env';
import { AppError } from '../lib/errors';

const METODE_AMAN = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Perlindungan CSRF (AGENTS §6): permintaan yang mengubah data wajib membawa
 * `Content-Type: application/json` DAN header `Origin` yang sama dengan APP_ORIGIN.
 * Form HTML lintas situs tidak bisa memenuhi keduanya.
 */
export const originCheck: RequestHandler = (req, _res, next) => {
  if (METODE_AMAN.has(req.method)) {
    next();
    return;
  }
  if (req.headers.origin !== env.APP_ORIGIN) {
    throw new AppError(403, 'ORIGIN_MISMATCH', 'Asal permintaan tidak diizinkan.');
  }
  const tipe = String(req.headers['content-type'] ?? '').toLowerCase();
  if (!tipe.startsWith('application/json')) {
    throw new AppError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Permintaan harus memakai Content-Type application/json.',
    );
  }
  next();
};
