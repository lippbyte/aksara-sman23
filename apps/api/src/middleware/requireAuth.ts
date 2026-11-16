import type { PenggunaSesi, Role } from '@sms/shared';
import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors';
import { keNumber } from '../lib/konversi';
import { prisma } from '../lib/prisma';
import { NAMA_COOKIE_SESI, OPSI_HAPUS_COOKIE } from '../lib/session';

/**
 * Memastikan ada sesi yang sah. Pengguna dibaca ulang dari basis data pada setiap
 * permintaan, sehingga akun yang dinonaktifkan atau diubah perannya langsung berlaku.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) throw unauthorized();

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      kelas_id: true,
      is_active: true,
      kelas: { select: { nama_kelas: true } },
    },
  });

  if (!u || !u.is_active) {
    await new Promise<void>((selesai) => req.session.destroy(() => selesai()));
    res.clearCookie(NAMA_COOKIE_SESI, OPSI_HAPUS_COOKIE);
    throw unauthorized('Sesi berakhir. Silakan masuk kembali.');
  }

  const user: PenggunaSesi = {
    id: keNumber(u.id),
    name: u.name,
    email: u.email,
    role: u.role,
    kelas_id: keNumber(u.kelas_id),
    nama_kelas: u.kelas?.nama_kelas ?? null,
  };
  req.user = user;
  next();
};

/** Hanya peran yang disebut yang boleh lewat. Dipasang setelah requireAuth. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role))
      throw forbidden('Peran Anda tidak memiliki akses ke fitur ini.');
    next();
  };
}

/**
 * Pembatasan kelas: `sekretaris_kelas` dikunci ke `users.kelas_id`; peran lain tidak dibatasi.
 * Service wajib memakai `req.kelasScope` di SEMUA query, termasuk ubah dan hapus berdasarkan ID.
 */
export const scopeKelas: RequestHandler = (req, _res, next) => {
  if (!req.user) throw unauthorized();
  if (req.user.role === 'sekretaris_kelas') {
    if (req.user.kelas_id === null) {
      throw forbidden('Akun sekretaris belum terikat ke kelas. Hubungi admin.');
    }
    req.kelasScope = req.user.kelas_id;
  } else {
    req.kelasScope = null;
  }
  next();
};
