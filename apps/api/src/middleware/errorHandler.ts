import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rute tidak ditemukan.' } });
};

interface HttpLikeError {
  status?: number;
  statusCode?: number;
  type?: string;
  code?: string;
}

/** Galat Prisma yang umum → kode HTTP yang tepat (tanpa membocorkan detail basis data). */
const GALAT_PRISMA: Record<string, { status: number; code: string; message: string }> = {
  P2002: { status: 409, code: 'CONFLICT', message: 'Data dengan nilai yang sama sudah ada.' },
  P2003: {
    status: 409,
    code: 'CONFLICT',
    message: 'Data masih dipakai oleh data lain, atau data terkait tidak ditemukan.',
  },
  P2025: { status: 404, code: 'NOT_FOUND', message: 'Data tidak ditemukan.' },
};

/** Semua galat keluar sebagai `{ error: { code, message, details? } }`, tanpa stack trace. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Data yang dikirim tidak valid.',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  const httpErr = err as HttpLikeError;

  const prismaErr = typeof httpErr.code === 'string' ? GALAT_PRISMA[httpErr.code] : undefined;
  if (prismaErr) {
    res
      .status(prismaErr.status)
      .json({ error: { code: prismaErr.code, message: prismaErr.message } });
    return;
  }

  // Galat dari body-parser (JSON rusak, body terlalu besar).
  const status = httpErr.status ?? httpErr.statusCode;
  if (httpErr.type === 'entity.too.large') {
    res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Ukuran data terlalu besar.' } });
    return;
  }
  if (httpErr.type === 'entity.parse.failed' || status === 400) {
    res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: 'Format JSON tidak valid.' } });
    return;
  }

  logger.error({ err }, 'Galat tidak tertangani');
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' },
  });
};
