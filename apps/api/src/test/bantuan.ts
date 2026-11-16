import type { Role } from '@sms/shared';
import type { Express } from 'express';
import request from 'supertest';
import { AKUN_CONTOH } from '../../prisma/seed-data';
import { env } from '../env';
import { PASSWORD_UJI } from './globalSetup';

export const ORIGIN = env.APP_ORIGIN;

export function emailPeran(role: Role): string {
  const akun = AKUN_CONTOH.find((a) => a.role === role);
  if (!akun) throw new Error(`Akun contoh untuk peran ${role} tidak ada.`);
  return akun.email;
}

/**
 * Klien uji dengan cookie sesi. Semua permintaan yang mengubah data otomatis
 * membawa Origin dan Content-Type yang benar, seperti klien web.
 */
export class Klien {
  private readonly agen: ReturnType<typeof request.agent>;

  constructor(app: Express) {
    this.agen = request.agent(app);
  }

  get(url: string) {
    return this.agen.get(url);
  }
  post(url: string, body: unknown = {}) {
    return this.agen
      .post(url)
      .set('Origin', ORIGIN)
      .send(body as object);
  }
  put(url: string, body: unknown = {}) {
    return this.agen
      .put(url)
      .set('Origin', ORIGIN)
      .send(body as object);
  }
  patch(url: string, body: unknown = {}) {
    return this.agen
      .patch(url)
      .set('Origin', ORIGIN)
      .send(body as object);
  }
  delete(url: string) {
    return this.agen.delete(url).set('Origin', ORIGIN).set('Content-Type', 'application/json');
  }

  async masuk(email: string, password: string = PASSWORD_UJI) {
    return this.post('/api/v1/auth/login', { email, password });
  }
}

/** Klien yang sudah masuk sebagai akun contoh dengan peran tertentu. */
export async function masukSebagai(app: Express, role: Role): Promise<Klien> {
  const klien = new Klien(app);
  const res = await klien.masuk(emailPeran(role));
  if (res.status !== 200) {
    throw new Error(`Gagal masuk sebagai ${role}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return klien;
}

export const SEMUA_PERAN: Role[] = ['admin', 'manajemen_guru', 'sekretaris_kelas', 'guru_penilai'];
export const BUKAN_ADMIN: Role[] = ['manajemen_guru', 'sekretaris_kelas', 'guru_penilai'];
