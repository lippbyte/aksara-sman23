import { loginSchema, ubahPasswordSchema, type Respons, type SesiSaya } from '@sms/shared';
import type { Request } from 'express';
import { konteksAudit } from '../../lib/audit';
import { NAMA_COOKIE_SESI, OPSI_HAPUS_COOKIE } from '../../lib/session';
import { validate, validatePublik } from '../../middleware/validate';
import * as service from './service';

function regenerasiSesi(req: Request): Promise<void> {
  return new Promise((selesai, gagal) => {
    req.session.regenerate((err) => (err ? gagal(err as Error) : selesai()));
  });
}

function simpanSesi(req: Request): Promise<void> {
  return new Promise((selesai, gagal) => {
    req.session.save((err) => (err ? gagal(err as Error) : selesai()));
  });
}

function hapusSesi(req: Request): Promise<void> {
  return new Promise((selesai, gagal) => {
    req.session.destroy((err) => (err ? gagal(err as Error) : selesai()));
  });
}

export const login = validatePublik({ body: loginSchema }, async ({ req, body }) => {
  const user = await service.login(body, konteksAudit(req));
  // ID sesi baru setiap login (mencegah session fixation).
  await regenerasiSesi(req);
  req.session.userId = user.id;
  await simpanSesi(req);
  const hasil: Respons<SesiSaya> = { data: { user, sekolah: await service.sekolahRingkas() } };
  return hasil;
});

export const logout = validate({}, async ({ req, res, user, audit }) => {
  await service.catatLogout(user, audit);
  await hapusSesi(req);
  res.clearCookie(NAMA_COOKIE_SESI, OPSI_HAPUS_COOKIE);
});

export const me = validate({}, async ({ user }) => {
  const hasil: Respons<SesiSaya> = { data: { user, sekolah: await service.sekolahRingkas() } };
  return hasil;
});

export const ubahPassword = validate(
  { body: ubahPasswordSchema },
  async ({ user, body, audit }) => {
    await service.ubahPasswordSendiri(user, body, audit);
  },
);
