import { z } from 'zod';
import type { RentangPekan } from '../domain/pekan';
import { paginationQuerySchema } from './common';
import { idOpsionalQuery, tanggalOpsionalQuery, teksOpsionalQuery, teksWajib } from './dasar';

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

/** Satu pekan rekap. */
export const pekanRekapSchema = z.object({ minggu_ke: mingguKeSchema, tahun: tahunSchema });
export type PekanRekap = z.infer<typeof pekanRekapSchema>;

/**
 * Sinkron massal satu pekan untuk semua guru aktif (§6.3). Baris yang dikoreksi manual
 * dilewati, kecuali `timpa_koreksi` = true (hanya admin, diperiksa di server).
 */
export const syncRekapSchema = pekanRekapSchema.extend({
  timpa_koreksi: z.boolean({ error: 'Pilihan timpa koreksi tidak valid.' }).default(false),
});
export type SyncRekapInput = z.infer<typeof syncRekapSchema>;
export type SyncRekapForm = z.input<typeof syncRekapSchema>;

/** Pratinjau sebelum sinkron: jumlah baris terkoreksi yang akan dilewati atau ditimpa. */
export interface PratinjauSyncRekap {
  minggu_ke: number;
  tahun: number;
  terkoreksi: number;
}

const jamSchema = (label: string) =>
  z
    .number({ error: `${label} wajib diisi.` })
    .int(`${label} harus bilangan bulat.`)
    .min(0, `${label} minimal 0.`)
    .max(200, `${label} maksimal 200.`);

/**
 * Koreksi manual jam wajib dan jam hadir, wajib dengan alasan. Persentase selalu dihitung
 * ulang dengan fungsi domain, tidak diisi langsung.
 */
export const ubahRekapSchema = z.object({
  total_jam_wajib: jamSchema('Jam wajib'),
  total_jam_hadir: jamSchema('Jam hadir'),
  alasan_koreksi: teksWajib('Alasan koreksi', 500),
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
  /** Dikoreksi manual: sinkron melewati baris ini kecuali admin memilih menimpa. */
  dikoreksi_manual: boolean;
  alasan_koreksi: string | null;
  nama_pengoreksi: string | null;
  dikoreksi_pada: string | null;
  /**
   * Baris terkoreksi yang catatan kehadiran gurunya pada pekan itu dibuat/diubah setelah
   * dikoreksi. Hanya penanda; rekap tidak dihitung ulang otomatis.
   */
  berubah_sejak_koreksi: boolean;
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
  /** Baris yang ditulis ulang (termasuk yang ditimpa). */
  disinkronkan: number;
  /** Baris terkoreksi manual yang dibiarkan. */
  dilewati: number;
  /** Baris terkoreksi manual yang ditimpa (timpa_koreksi). */
  ditimpa: number;
}
