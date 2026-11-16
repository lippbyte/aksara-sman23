import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { conflict } from '../lib/errors';
import { errorHandler } from './errorHandler';

function resTiruan() {
  const res = {
    headersSent: false,
    statusKode: 0,
    isi: undefined as unknown,
    status(kode: number) {
      this.statusKode = kode;
      return this;
    },
    json(isi: unknown) {
      this.isi = isi;
      return this;
    },
  };
  return res;
}

function jalankan(err: unknown) {
  const res = resTiruan();
  errorHandler(err, {} as Request, res as unknown as Response, vi.fn() as NextFunction);
  return res;
}

describe('errorHandler', () => {
  it('galat tak terduga → 500 tanpa pesan asli maupun stack trace', () => {
    const err = new Error('rahasia: koneksi db://pengguna:sandi@host gagal');
    const res = jalankan(err);
    expect(res.statusKode).toBe(500);
    expect(res.isi).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' },
    });
    expect(JSON.stringify(res.isi)).not.toContain('rahasia');
    expect(JSON.stringify(res.isi)).not.toContain('stack');
  });

  it('AppError mempertahankan kode HTTP dan details', () => {
    const res = jalankan(conflict('Bentrok.', { a: 1 }));
    expect(res.statusKode).toBe(409);
    expect(res.isi).toEqual({
      error: { code: 'CONFLICT', message: 'Bentrok.', details: { a: 1 } },
    });
  });

  it('ZodError → 400 dengan daftar isian', () => {
    const hasil = z.object({ n: z.number() }).safeParse({ n: 'x' });
    const res = jalankan(hasil.error);
    expect(res.statusKode).toBe(400);
    expect((res.isi as { error: { details: { path: string }[] } }).error.details[0]?.path).toBe(
      'n',
    );
  });

  it('galat unik Prisma (P2002) → 409 tanpa nama tabel/kolom', () => {
    const res = jalankan({ code: 'P2002', meta: { target: 'users_email_key' } });
    expect(res.statusKode).toBe(409);
    expect(JSON.stringify(res.isi)).not.toContain('users_email_key');
  });

  it('body terlalu besar → 413', () => {
    expect(jalankan({ type: 'entity.too.large', status: 413 }).statusKode).toBe(413);
  });
});
