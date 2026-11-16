import type { PenggunaSesi } from '@sms/shared';
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { konteksAudit, type KonteksAudit } from '../lib/audit';
import { unauthorized } from '../lib/errors';

type Skema = z.ZodType | undefined;
type Keluaran<S extends Skema> = S extends z.ZodType ? z.output<S> : undefined;

interface SkemaPermintaan<SB extends Skema, SQ extends Skema, SP extends Skema> {
  body?: SB;
  query?: SQ;
  params?: SP;
}

export interface KonteksPublik<B, Q, P> {
  req: Request;
  res: Response;
  body: B;
  query: Q;
  params: P;
}

export interface Konteks<B, Q, P> extends KonteksPublik<B, Q, P> {
  /** Pengguna yang sedang masuk (dijamin ada). */
  user: PenggunaSesi;
  /** ID kelas untuk sekretaris_kelas; null bila tidak dibatasi atau scopeKelas tidak dipasang. */
  kelasScope: number | null;
  audit: KonteksAudit;
}

function urai<SB extends Skema, SQ extends Skema, SP extends Skema>(
  skema: SkemaPermintaan<SB, SQ, SP>,
  req: Request,
) {
  // ZodError ditangkap errorHandler → 400 VALIDATION_ERROR.
  return {
    body: (skema.body ? skema.body.parse(req.body ?? {}) : undefined) as Keluaran<SB>,
    query: (skema.query ? skema.query.parse(req.query) : undefined) as Keluaran<SQ>,
    params: (skema.params ? skema.params.parse(req.params) : undefined) as Keluaran<SP>,
  };
}

function kirim(res: Response, hasil: unknown) {
  if (res.headersSent) return;
  if (hasil === undefined) res.status(204).end();
  else res.json(hasil);
}

/**
 * Pembungkus controller: memvalidasi body, query, dan params dengan skema zod dari
 * `@sms/shared`, lalu mengirim nilai kembalian sebagai JSON (204 bila undefined).
 * Untuk rute yang sudah melewati requireAuth.
 */
export function validate<
  SB extends Skema = undefined,
  SQ extends Skema = undefined,
  SP extends Skema = undefined,
>(
  skema: SkemaPermintaan<SB, SQ, SP>,
  handler: (k: Konteks<Keluaran<SB>, Keluaran<SQ>, Keluaran<SP>>) => unknown,
): RequestHandler {
  return async (req, res) => {
    if (!req.user) throw unauthorized();
    const masukan = urai(skema, req);
    const hasil = await handler({
      req,
      res,
      ...masukan,
      user: req.user,
      kelasScope: req.kelasScope ?? null,
      audit: konteksAudit(req),
    });
    kirim(res, hasil);
  };
}

/** Sama seperti `validate`, untuk rute tanpa sesi (mis. login). */
export function validatePublik<
  SB extends Skema = undefined,
  SQ extends Skema = undefined,
  SP extends Skema = undefined,
>(
  skema: SkemaPermintaan<SB, SQ, SP>,
  handler: (k: KonteksPublik<Keluaran<SB>, Keluaran<SQ>, Keluaran<SP>>) => unknown,
): RequestHandler {
  return async (req, res) => {
    const masukan = urai(skema, req);
    kirim(res, await handler({ req, res, ...masukan }));
  };
}
