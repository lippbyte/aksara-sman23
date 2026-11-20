import type { LoginInput, PenggunaSesi, SekolahRingkas, UbahPasswordInput } from '@sms/shared';
import argon2 from 'argon2';
import { catatAudit, type KonteksAudit } from '../../lib/audit';
import { AppError, businessRule, notFound } from '../../lib/errors';
import { keNumber } from '../../lib/konversi';
import { prisma } from '../../lib/prisma';
import { urlLatarDashboard, urlLogo } from '../../lib/sekolah';
import { akhiriSesiPengguna } from '../../lib/session';
import * as repo from './repo';

const OPSI_ARGON = { type: argon2.argon2id } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPSI_ARGON);
}

// Hash pembanding untuk email yang tidak terdaftar, supaya lama respons tidak
// membedakan "email tidak ada" dari "kata sandi salah".
let hashPalsu: Promise<string> | undefined;
function ambilHashPalsu(): Promise<string> {
  hashPalsu ??= hashPassword('pembanding-untuk-email-tidak-terdaftar');
  return hashPalsu;
}

const galatKredensial = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Email atau kata sandi salah.');

/** Memeriksa kredensial. Sesi dibuat oleh controller setelah fungsi ini berhasil. */
export async function login(input: LoginInput, audit: KonteksAudit): Promise<PenggunaSesi> {
  const user = await repo.cariUserDenganEmail(input.email);
  const cocok = await argon2
    .verify(user?.password ?? (await ambilHashPalsu()), input.password)
    .catch(() => false);

  if (!user || !cocok || !user.is_active) {
    await catatAudit(prisma, audit, {
      module: 'Auth',
      aktivitas: 'LOGIN_GAGAL',
      entity_type: 'users',
      entity_id: user?.id ?? null,
      description: `Percobaan masuk gagal untuk ${input.email}.`,
    });
    throw galatKredensial();
  }

  const id = keNumber(user.id);
  await catatAudit(
    prisma,
    { ...audit, user_id: id },
    {
      module: 'Auth',
      aktivitas: 'LOGIN',
      entity_type: 'users',
      entity_id: id,
      description: `${user.name} masuk.`,
    },
  );

  return {
    id,
    name: user.name,
    email: user.email,
    role: user.role,
    kelas_id: keNumber(user.kelas_id),
    nama_kelas: user.kelas?.nama_kelas ?? null,
  };
}

export async function catatLogout(user: PenggunaSesi, audit: KonteksAudit): Promise<void> {
  await catatAudit(prisma, audit, {
    module: 'Auth',
    aktivitas: 'LOGOUT',
    entity_type: 'users',
    entity_id: user.id,
    description: `${user.name} keluar.`,
  });
}

export async function sekolahRingkas(): Promise<SekolahRingkas | null> {
  const s = await prisma.sekolahSettings.findFirst({ orderBy: { id: 'asc' } });
  if (!s) return null;
  return {
    nama_sekolah: s.nama_sekolah,
    logo_url: urlLogo(s.logo_path),
    dashboard_background_url: urlLatarDashboard(s.dashboard_background_path),
    tahun_ajaran: s.tahun_ajaran,
  };
}

export async function ubahPasswordSendiri(
  user: PenggunaSesi,
  input: UbahPasswordInput,
  audit: KonteksAudit,
  sesiSaatIni: string,
): Promise<void> {
  const baris = await repo.cariUserDenganId(user.id);
  if (!baris) throw notFound('Akun tidak ditemukan.');
  const cocok = await argon2.verify(baris.password, input.password_lama).catch(() => false);
  if (!cocok) throw businessRule('Kata sandi lama tidak sesuai.');

  const hash = await hashPassword(input.password_baru);
  await prisma.$transaction(async (tx) => {
    await repo.simpanPassword(tx, user.id, hash);
    const n = await akhiriSesiPengguna(tx, user.id, sesiSaatIni);
    await catatAudit(tx, audit, {
      module: 'Auth',
      aktivitas: 'UBAH_PASSWORD',
      entity_type: 'users',
      entity_id: user.id,
      description: `${user.name} mengubah kata sandinya; ${n} sesi lain diakhiri.`,
    });
  });
}
