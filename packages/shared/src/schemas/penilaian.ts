import { z } from 'zod';
import type { PredikatKinerja, PredikatMgmp } from '../constants';
import type { JendelaPenilaian } from '../domain/skor';
import { paginationQuerySchema } from './common';
import { idWajib, skorSchema, teksOpsional, teksOpsionalQuery } from './dasar';

const bulanSchema = z.coerce
  .number({ error: 'Bulan wajib dipilih.' })
  .int('Bulan tidak valid.')
  .min(1, 'Bulan tidak valid.')
  .max(12, 'Bulan tidak valid.');

const tahunSchema = z.coerce
  .number({ error: 'Tahun wajib diisi.' })
  .int('Tahun tidak valid.')
  .min(2000, 'Tahun tidak valid.')
  .max(2100, 'Tahun tidak valid.');

/** Periode penilaian: satu bulan. */
export const periodeSchema = z.object({ bulan: bulanSchema, tahun: tahunSchema });
export type Periode = z.infer<typeof periodeSchema>;

export const penilaianKinerjaQuerySchema = paginationQuerySchema.extend({
  bulan: bulanSchema,
  tahun: tahunSchema,
  q: teksOpsionalQuery,
});
export type PenilaianKinerjaQuery = z.infer<typeof penilaianKinerjaQuerySchema>;

/** Sinkron skor kehadiran otomatis untuk satu periode (§6.4, §6.5). */
export const syncPenilaianSchema = periodeSchema;
export type SyncPenilaianInput = Periode;

// ───────────── Kinerja guru bulanan (§6.4) ─────────────

export const simpanPenilaianKinerjaSchema = z.object({
  guru_id: idWajib('Guru'),
  bulan: bulanSchema,
  tahun: tahunSchema,
  skor_administrasi_avg: skorSchema,
  /** Kosong atau 0 → rumus tanpa manajemen. */
  skor_manajemen_avg: skorSchema.nullish().transform((v) => v ?? null),
  catatan: teksOpsional(1000),
});
export type SimpanPenilaianKinerjaInput = z.infer<typeof simpanPenilaianKinerjaSchema>;
export type SimpanPenilaianKinerjaForm = z.input<typeof simpanPenilaianKinerjaSchema>;

export interface PenilaianKinerjaBaris {
  guru_id: number;
  kode_guru: string;
  nama_guru: string;
  mata_pelajaran: string;
  /** Kosong bila belum ada baris penilaian untuk periode ini. */
  id: number | null;
  skor_kehadiran: number | null;
  skor_administrasi_avg: number | null;
  skor_manajemen_avg: number | null;
  skor_akhir: number | null;
  /** Dihitung dari skor_akhir; kosong bila belum dinilai. */
  predikat: PredikatKinerja | null;
  catatan: string | null;
  /** Sudah diisi penilai (bukan hanya hasil sinkron skor kehadiran). */
  sudah_dinilai: boolean;
  nama_penilai: string | null;
  updated_at: string | null;
}

// ───────────── MGMP bulanan (§6.5) ─────────────

/**
 * Semua skor opsional: isian yang tidak dikirim tidak diubah.
 * `sekretaris_kelas` hanya boleh mengirim `skor_siswa` (diperiksa di server).
 */
export const simpanPenilaianMgmpSchema = z
  .object({
    mgmp_id: idWajib('MGMP'),
    bulan: bulanSchema,
    tahun: tahunSchema,
    skor_siswa: skorSchema.optional(),
    skor_administrasi: skorSchema.optional(),
    catatan: teksOpsional(1000).optional(),
  })
  .refine(
    (v) =>
      v.skor_siswa !== undefined || v.skor_administrasi !== undefined || v.catatan !== undefined,
    { message: 'Isi minimal satu nilai.', path: ['skor_siswa'] },
  );
export type SimpanPenilaianMgmpInput = z.infer<typeof simpanPenilaianMgmpSchema>;

export interface PenilaianMgmpBaris {
  mgmp_id: number;
  nama_mapel: string;
  jumlah_guru_aktif: number;
  id: number | null;
  skor_kehadiran: number | null;
  skor_siswa: number | null;
  skor_administrasi: number | null;
  skor_akhir: number | null;
  predikat: PredikatMgmp | null;
  catatan: string | null;
  sudah_dinilai: boolean;
  nama_penilai: string | null;
  updated_at: string | null;
}

/** Respons daftar penilaian: data + info jendela pengisian untuk periode itu. */
export interface DaftarPenilaian<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
  jendela: JendelaPenilaian & { hari: number };
}

export interface HasilSyncPenilaian {
  bulan: number;
  tahun: number;
  disinkronkan: number;
}
