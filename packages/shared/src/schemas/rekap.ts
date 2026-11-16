import { z } from 'zod';
import type { RentangPekan } from '../domain/pekan';
import { paginationQuerySchema } from './common';
import { idOpsionalQuery, tanggalOpsionalQuery, teksOpsionalQuery } from './dasar';

const mingguKeSchema = z.coerce
  .number({ error: 'Pekan wajib dipilih.' })
  .int('Pekan tidak valid.')
  .min(1, 'Pekan minimal 1.')
  .max(1000, 'Pekan tidak valid.');

const tahunSchema = z.coerce
  .number({ error: 'Tahun wajib diisi.' })
  .int('Tahun tidak valid.')
  .min(2000, 'Tahun tidak valid.')
  .max(2100, 'Tahun tidak valid.');

const opsional = <T extends z.ZodType>(s: T) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), s.optional());

const filterRekap = {
  minggu_ke: opsional(mingguKeSchema),
  tahun: opsional(tahunSchema),
  guru_id: idOpsionalQuery,
  /** Mata pelajaran guru (sama persis). */
  mapel: teksOpsionalQuery,
  /** Guru yang punya jadwal mengajar di kelas ini. */
  kelas_id: idOpsionalQuery,
  /** Pekan yang beririsan dengan rentang ini. */
  tanggal_dari: tanggalOpsionalQuery,
  tanggal_sampai: tanggalOpsionalQuery,
};

function periksaFilter(
  v: { minggu_ke?: number; tahun?: number; tanggal_dari?: string; tanggal_sampai?: string },
  ctx: z.RefinementCtx,
): void {
  if ((v.minggu_ke === undefined) !== (v.tahun === undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: ['minggu_ke'],
      message: 'Pekan dan tahun harus diisi bersamaan.',
    });
  }
  if (v.tanggal_dari && v.tanggal_sampai && v.tanggal_dari > v.tanggal_sampai) {
    ctx.addIssue({
      code: 'custom',
      path: ['tanggal_sampai'],
      message: 'Tanggal akhir tidak boleh sebelum tanggal awal.',
    });
  }
}

export const rekapQuerySchema = paginationQuerySchema
  .extend(filterRekap)
  .superRefine(periksaFilter);
export type RekapQuery = z.infer<typeof rekapQuerySchema>;

export const rekapFilterSchema = z.object(filterRekap).superRefine(periksaFilter);
export type RekapFilter = z.infer<typeof rekapFilterSchema>;

/** Sinkron massal satu pekan untuk semua guru aktif (§6.3). */
export const syncRekapSchema = z.object({ minggu_ke: mingguKeSchema, tahun: tahunSchema });
export type SyncRekapInput = z.infer<typeof syncRekapSchema>;

const jamSchema = (label: string) =>
  z
    .number({ error: `${label} wajib diisi.` })
    .int(`${label} harus bilangan bulat.`)
    .min(0, `${label} minimal 0.`)
    .max(200, `${label} maksimal 200.`);

/**
 * Koreksi manual jam wajib dan jam hadir. Persentase selalu dihitung ulang dengan
 * fungsi domain, tidak diisi langsung.
 */
export const ubahRekapSchema = z.object({
  total_jam_wajib: jamSchema('Jam wajib'),
  total_jam_hadir: jamSchema('Jam hadir'),
});
export type UbahRekapInput = z.infer<typeof ubahRekapSchema>;

export interface Rekap {
  id: number;
  guru_id: number;
  kode_guru: string;
  nama_guru: string;
  mata_pelajaran: string;
  tahun: number;
  minggu_ke: number;
  tanggal_mulai: string;
  tanggal_selesai: string;
  total_jam_wajib: number;
  total_jam_hadir: number;
  persentase_kehadiran: number;
  updated_at: string;
}

export interface PekanTersedia extends RentangPekan {
  /** Jumlah baris rekap yang sudah ada untuk pekan ini. */
  jumlah_rekap: number;
  /** Pekan yang memuat hari ini. */
  berjalan: boolean;
}

export interface HasilSyncRekap {
  pekan: RentangPekan;
  disinkronkan: number;
}
