import { z } from 'zod';
import {
  AUDIT_MODULES,
  HARI_MAX,
  HARI_MIN,
  JAM_KE_MAX,
  JAM_KE_MIN,
  JENIS_KELAMIN,
  LAMA_JAM_MAX,
  LAMA_JAM_MIN,
  ROLES,
  STATUS_AKTIF,
  type JenisKelamin,
  type Role,
  type StatusAktif,
} from '../constants';
import { apakahBobotValid } from '../domain/skor';
import { hariDalamPekan } from '../domain/tanggal';
import { emailSchema, passwordBaruSchema } from './auth';
import { paginationQuerySchema } from './common';
import {
  idOpsionalQuery,
  idSchema,
  tanggalOpsionalQuery,
  tanggalSchema,
  teksOpsional,
  teksOpsionalQuery,
  teksWajib,
} from './dasar';

// ───────────── Sekolah ─────────────

const bobotSchema = z
  .number({ error: 'Bobot wajib berupa angka.' })
  .min(0, 'Bobot minimal 0.')
  .max(100, 'Bobot maksimal 100.');

export const sekolahSchema = z
  .object({
    nama_sekolah: teksWajib('Nama sekolah', 150),
    tahun_ajaran: teksWajib('Tahun ajaran', 20),
    tanggal_awal_pekan: tanggalSchema.refine(
      (t) => hariDalamPekan(t) === 1,
      'Tanggal awal pekan harus hari Senin.',
    ),
    hari_efektif: z
      .array(z.number().int().min(HARI_MIN).max(HARI_MAX))
      .min(1, 'Pilih minimal satu hari efektif.')
      .transform((h) => [...new Set(h)].sort((a, b) => a - b)),
    bobot_kinerja_kehadiran: bobotSchema,
    bobot_kinerja_administrasi: bobotSchema,
    bobot_kinerja_manajemen: bobotSchema,
    bobot_kinerja_kehadiran_tanpa_manajemen: bobotSchema,
    bobot_kinerja_administrasi_tanpa_manajemen: bobotSchema,
    bobot_mgmp_kehadiran: bobotSchema,
    bobot_mgmp_siswa: bobotSchema,
    bobot_mgmp_administrasi: bobotSchema,
    jendela_penilaian_hari: z
      .number({ error: 'Jendela penilaian wajib berupa angka.' })
      .int('Jendela penilaian harus bilangan bulat.')
      .min(1, 'Minimal 1 hari.')
      .max(28, 'Maksimal 28 hari.'),
  })
  .superRefine((v, ctx) => {
    const pesan = 'Jumlah bobot harus 100.';
    if (
      !apakahBobotValid([
        v.bobot_kinerja_kehadiran,
        v.bobot_kinerja_administrasi,
        v.bobot_kinerja_manajemen,
      ])
    ) {
      ctx.addIssue({ code: 'custom', path: ['bobot_kinerja_manajemen'], message: pesan });
    }
    if (
      !apakahBobotValid([
        v.bobot_kinerja_kehadiran_tanpa_manajemen,
        v.bobot_kinerja_administrasi_tanpa_manajemen,
      ])
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['bobot_kinerja_administrasi_tanpa_manajemen'],
        message: pesan,
      });
    }
    if (
      !apakahBobotValid([v.bobot_mgmp_kehadiran, v.bobot_mgmp_siswa, v.bobot_mgmp_administrasi])
    ) {
      ctx.addIssue({ code: 'custom', path: ['bobot_mgmp_administrasi'], message: pesan });
    }
  });
export type SekolahInput = z.infer<typeof sekolahSchema>;

export interface Sekolah extends SekolahInput {
  id: number;
  logo_url: string | null;
  login_background_url: string | null;
  dashboard_background_url: string | null;
}

/** Logo sebagai data URL (PNG, JPEG, atau WebP). */
export const logoSchema = z.object({
  data_url: z
    .string()
    .regex(
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
      'Logo harus PNG, JPEG, atau WebP.',
    )
    .max(400_000, 'Ukuran logo maksimal sekitar 280 KB.'),
});
export type LogoInput = z.infer<typeof logoSchema>;

export const JENIS_LATAR = ['masuk', 'dashboard'] as const;
export type JenisLatar = (typeof JENIS_LATAR)[number];

export const UKURAN_LATAR = [640, 1280, 1920] as const;
export type UkuranLatar = (typeof UKURAN_LATAR)[number];

export const FORMAT_LATAR = ['webp', 'jpeg'] as const;
export type FormatLatar = (typeof FORMAT_LATAR)[number];

export const jenisLatarParamSchema = z.object({
  jenis: z.enum(JENIS_LATAR, { error: 'Jenis latar harus "masuk" atau "dashboard".' }),
});

/** Gambar latar sekolah sebagai data URL (PNG, JPEG, atau WebP; maks ±5 MB biner). */
export const latarGambarSchema = z.object({
  data_url: z
    .string()
    .regex(
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/,
      'Gambar latar harus PNG, JPEG, atau WebP.',
    )
    .max(7_000_000, 'Ukuran gambar latar maksimal 5 MB.'),
});
export type LatarGambarInput = z.infer<typeof latarGambarSchema>;

export const latarQuerySchema = z.object({
  w: z.preprocess(
    (v) => (v === '' || v === undefined ? 1280 : Number(v)),
    z.union([z.literal(640), z.literal(1280), z.literal(1920)]).default(1280),
  ),
  fmt: z.preprocess(
    (v) => (v === '' || v === undefined ? 'webp' : v),
    z.enum(FORMAT_LATAR).default('webp'),
  ),
});
export type LatarQuery = z.infer<typeof latarQuerySchema>;

// ───────────── Kelas ─────────────

export const kelasSchema = z.object({ nama_kelas: teksWajib('Nama kelas', 50) });
export type KelasInput = z.infer<typeof kelasSchema>;
export interface Kelas {
  id: number;
  nama_kelas: string;
  jumlah_siswa?: number;
}

// ───────────── MGMP ─────────────

export const mgmpSchema = z.object({
  nama_mapel: teksWajib('Nama mapel', 100),
  deskripsi: teksOpsional(1000),
});
export type MgmpInput = z.infer<typeof mgmpSchema>;
export type MgmpFormValues = z.input<typeof mgmpSchema>;
export interface Mgmp {
  id: number;
  nama_mapel: string;
  deskripsi: string | null;
  jumlah_guru?: number;
}

// ───────────── Guru ─────────────

export const guruSchema = z.object({
  kode_guru: teksWajib('Kode guru', 20),
  nip: teksOpsional(30),
  nama_guru: teksWajib('Nama guru', 150),
  mata_pelajaran: teksWajib('Mata pelajaran', 100),
  jabatan: teksOpsional(100),
  mgmp_id: idSchema.nullish().transform((v) => v ?? null),
  status: z.enum(STATUS_AKTIF),
});
export type GuruInput = z.infer<typeof guruSchema>;
export type GuruFormValues = z.input<typeof guruSchema>;
export interface Guru {
  id: number;
  kode_guru: string;
  nip: string | null;
  nama_guru: string;
  mata_pelajaran: string;
  jabatan: string | null;
  mgmp_id: number | null;
  nama_mgmp: string | null;
  status: StatusAktif;
}

// ───────────── Siswa ─────────────

export const siswaSchema = z.object({
  nis: teksWajib('NIS', 30),
  nama_siswa: teksWajib('Nama siswa', 150),
  jenis_kelamin: z.enum(JENIS_KELAMIN, { error: 'Pilih jenis kelamin.' }),
  kelas_id: idSchema,
  wali_kelas: teksOpsional(150),
  status: z.enum(STATUS_AKTIF),
});
export type SiswaInput = z.infer<typeof siswaSchema>;
export type SiswaFormValues = z.input<typeof siswaSchema>;
export interface Siswa {
  id: number;
  nis: string;
  nama_siswa: string;
  jenis_kelamin: JenisKelamin;
  kelas_id: number;
  nama_kelas: string;
  wali_kelas: string | null;
  status: StatusAktif;
}

// ───────────── Jadwal mengajar ─────────────

export const jadwalSchema = z.object({
  guru_id: idSchema,
  kelas_id: idSchema,
  hari: z.number().int().min(HARI_MIN, 'Hari tidak valid.').max(HARI_MAX, 'Hari tidak valid.'),
  jam_ke: z
    .number()
    .int()
    .min(JAM_KE_MIN, `Jam ke minimal ${JAM_KE_MIN}.`)
    .max(JAM_KE_MAX, `Jam ke maksimal ${JAM_KE_MAX}.`),
  total_jam_mengajar: z
    .number()
    .int()
    .min(LAMA_JAM_MIN, `Minimal ${LAMA_JAM_MIN} JP.`)
    .max(LAMA_JAM_MAX, `Maksimal ${LAMA_JAM_MAX} JP.`),
});
export type JadwalInput = z.infer<typeof jadwalSchema>;
export interface Jadwal extends JadwalInput {
  id: number;
  nama_guru: string;
  kode_guru: string;
  mata_pelajaran: string;
  nama_kelas: string;
}

// ───────────── Akun ─────────────

const akunDasar = {
  name: teksWajib('Nama', 150),
  email: emailSchema,
  role: z.enum(ROLES, { error: 'Pilih peran.' }),
  kelas_id: idSchema.nullish().transform((v) => v ?? null),
  is_active: z.boolean(),
};

function periksaKelasSekretaris(
  v: { role: Role; kelas_id: number | null },
  ctx: z.RefinementCtx,
): void {
  if (v.role === 'sekretaris_kelas' && v.kelas_id === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['kelas_id'],
      message: 'Sekretaris kelas wajib terikat ke satu kelas.',
    });
  }
}

export const akunBuatSchema = z
  .object({ ...akunDasar, password: passwordBaruSchema })
  .superRefine(periksaKelasSekretaris);
export type AkunBuatInput = z.infer<typeof akunBuatSchema>;
export type AkunBuatFormValues = z.input<typeof akunBuatSchema>;

export const akunUbahSchema = z.object(akunDasar).superRefine(periksaKelasSekretaris);
export type AkunUbahInput = z.infer<typeof akunUbahSchema>;
export type AkunUbahFormValues = z.input<typeof akunUbahSchema>;

export interface Akun {
  id: number;
  name: string;
  email: string;
  role: Role;
  kelas_id: number | null;
  nama_kelas: string | null;
  is_active: boolean;
}

// ───────────── Query daftar ─────────────

export const daftarQuerySchema = paginationQuerySchema.extend({ q: teksOpsionalQuery });
export type DaftarQuery = z.infer<typeof daftarQuerySchema>;

const statusOpsionalQuery = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.enum(STATUS_AKTIF).optional(),
);

export const guruQuerySchema = daftarQuerySchema.extend({
  mgmp_id: idOpsionalQuery,
  status: statusOpsionalQuery,
});
export type GuruQuery = z.infer<typeof guruQuerySchema>;

export const siswaQuerySchema = daftarQuerySchema.extend({
  kelas_id: idOpsionalQuery,
  status: statusOpsionalQuery,
});
export type SiswaQuery = z.infer<typeof siswaQuerySchema>;

export const jadwalQuerySchema = paginationQuerySchema.extend({
  guru_id: idOpsionalQuery,
  kelas_id: idOpsionalQuery,
  hari: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.coerce.number().int().min(HARI_MIN).max(HARI_MAX).optional(),
  ),
});
export type JadwalQuery = z.infer<typeof jadwalQuerySchema>;

export const akunQuerySchema = daftarQuerySchema.extend({
  role: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.enum(ROLES).optional()),
});
export type AkunQuery = z.infer<typeof akunQuerySchema>;

// ───────────── Log aktivitas ─────────────

export const auditQuerySchema = paginationQuerySchema.extend({
  module: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.enum(AUDIT_MODULES).optional(),
  ),
  user_id: idOpsionalQuery,
  tanggal_dari: tanggalOpsionalQuery,
  tanggal_sampai: tanggalOpsionalQuery,
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditLog {
  id: number;
  user_id: number | null;
  nama_pengguna: string | null;
  module: string;
  aktivitas: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string;
  ip_address: string | null;
  created_at: string;
}

// ───────────── Referensi (pilihan dropdown) ─────────────

export interface RefKelas {
  id: number;
  nama_kelas: string;
}
export interface RefGuru {
  id: number;
  kode_guru: string;
  nama_guru: string;
  mata_pelajaran: string;
}
export interface RefMgmp {
  id: number;
  nama_mapel: string;
}
export interface RefPengguna {
  id: number;
  name: string;
}
