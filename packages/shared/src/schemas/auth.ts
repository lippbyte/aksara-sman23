import { z } from 'zod';
import type { Role } from '../constants';

export const PANJANG_PASSWORD_MIN = 8;
export const PANJANG_PASSWORD_MAKS = 128;

export const emailSchema = z
  .string({ error: 'Email wajib diisi.' })
  .trim()
  .toLowerCase()
  .max(190, 'Email maksimal 190 karakter.')
  .pipe(z.email('Format email tidak valid.'));

export const passwordBaruSchema = z
  .string({ error: 'Kata sandi wajib diisi.' })
  .min(PANJANG_PASSWORD_MIN, `Kata sandi minimal ${PANJANG_PASSWORD_MIN} karakter.`)
  .max(PANJANG_PASSWORD_MAKS, `Kata sandi maksimal ${PANJANG_PASSWORD_MAKS} karakter.`);

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: 'Kata sandi wajib diisi.' })
    .min(1, 'Kata sandi wajib diisi.')
    .max(PANJANG_PASSWORD_MAKS),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const ubahPasswordSchema = z
  .object({
    password_lama: z.string().min(1, 'Kata sandi lama wajib diisi.').max(PANJANG_PASSWORD_MAKS),
    password_baru: passwordBaruSchema,
  })
  .refine((v) => v.password_lama !== v.password_baru, {
    path: ['password_baru'],
    message: 'Kata sandi baru harus berbeda dari kata sandi lama.',
  });
export type UbahPasswordInput = z.infer<typeof ubahPasswordSchema>;

export const resetPasswordSchema = z.object({ password_baru: passwordBaruSchema });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Pengguna yang sedang masuk (tanpa kata sandi). */
export interface PenggunaSesi {
  id: number;
  name: string;
  email: string;
  role: Role;
  kelas_id: number | null;
  nama_kelas: string | null;
}

/** Info sekolah yang boleh dilihat semua pengguna yang sudah masuk. */
export interface SekolahRingkas {
  nama_sekolah: string;
  logo_url: string | null;
  tahun_ajaran: string;
}

export interface SesiSaya {
  user: PenggunaSesi;
  sekolah: SekolahRingkas | null;
}
