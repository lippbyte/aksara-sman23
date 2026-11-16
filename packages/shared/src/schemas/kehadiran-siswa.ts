import { z } from 'zod';
import {
  JAM_KE_MAX,
  JAM_KE_MIN,
  STATUS_SISWA,
  type JenisKelamin,
  type StatusSiswa,
} from '../constants';
import { paginationQuerySchema } from './common';
import {
  idOpsionalQuery,
  idSchema,
  tanggalOpsionalQuery,
  tanggalSchema,
  teksOpsional,
} from './dasar';

const jamKeSiswa = z.coerce
  .number({ error: 'Jam ke wajib diisi.' })
  .int('Jam ke harus bilangan bulat.')
  .min(JAM_KE_MIN, `Jam ke minimal ${JAM_KE_MIN}.`)
  .max(JAM_KE_MAX, `Jam ke maksimal ${JAM_KE_MAX}.`);

/** Rentang tanggal: `tanggal_dari` tidak boleh setelah `tanggal_sampai`. */
function rentangValid(v: { tanggal_dari?: string; tanggal_sampai?: string }): boolean {
  return !v.tanggal_dari || !v.tanggal_sampai || v.tanggal_dari <= v.tanggal_sampai;
}
const pesanRentang = {
  path: ['tanggal_sampai'],
  message: 'Tanggal akhir tidak boleh sebelum tanggal awal.',
};

// ───────────── Input massal per kelas (§6.2) ─────────────

/** Daftar siswa satu sesi: kelas + tanggal + jam ke. */
export const sesiSiswaQuerySchema = z.object({
  /** Diabaikan untuk sekretaris_kelas (kelas dari akunnya). */
  kelas_id: idOpsionalQuery,
  tanggal: tanggalSchema,
  jam_ke: jamKeSiswa.default(1),
});
export type SesiSiswaQuery = z.infer<typeof sesiSiswaQuerySchema>;

export const simpanKehadiranSiswaSchema = z.object({
  /** Diabaikan untuk sekretaris_kelas; wajib untuk admin (diperiksa di server). */
  kelas_id: idSchema.nullish().transform((v) => v ?? null),
  tanggal: tanggalSchema,
  jam_ke: jamKeSiswa.default(1),
  items: z
    .array(
      z.object({
        siswa_id: idSchema,
        status: z.enum(STATUS_SISWA, { error: 'Pilih status kehadiran siswa.' }),
        keterangan: teksOpsional(255),
      }),
    )
    .min(1, 'Tidak ada siswa untuk disimpan.')
    .max(200, 'Maksimal 200 siswa per penyimpanan.')
    .refine(
      (items) => new Set(items.map((i) => i.siswa_id)).size === items.length,
      'Setiap siswa hanya boleh muncul sekali.',
    ),
});
export type SimpanKehadiranSiswaInput = z.infer<typeof simpanKehadiranSiswaSchema>;

export type HitunganSiswa = Record<StatusSiswa, number>;

export interface BarisAbsenSiswa {
  siswa_id: number;
  nis: string;
  nama_siswa: string;
  jenis_kelamin: JenisKelamin;
  /** ID catatan bila sudah pernah disimpan. */
  id: number | null;
  /** Default `hadir` bila belum ada catatan. */
  status: StatusSiswa;
  keterangan: string | null;
}

export interface SesiAbsenSiswa {
  kelas: { id: number; nama_kelas: string };
  tanggal: string;
  jam_ke: number;
  /** Sudah ada catatan tersimpan untuk sesi ini. */
  sudah_diisi: boolean;
  siswa: BarisAbsenSiswa[];
}

export interface HasilSimpanSiswa {
  disimpan: number;
  hitungan: HitunganSiswa;
}

/** Hapus seluruh catatan satu sesi. */
export const hapusSesiSiswaQuerySchema = sesiSiswaQuerySchema;

// ───────────── Riwayat per tanggal ─────────────

export const riwayatSiswaQuerySchema = paginationQuerySchema
  .extend({
    kelas_id: idOpsionalQuery,
    tanggal_dari: tanggalOpsionalQuery,
    tanggal_sampai: tanggalOpsionalQuery,
  })
  .refine(rentangValid, pesanRentang);
export type RiwayatSiswaQuery = z.infer<typeof riwayatSiswaQuerySchema>;

export interface RiwayatSesiSiswa extends HitunganSiswa {
  tanggal: string;
  jam_ke: number;
  kelas_id: number;
  nama_kelas: string;
  total: number;
}

// ───────────── Laporan rekap siswa ─────────────

export const laporanSiswaFilterSchema = z
  .object({
    kelas_id: idOpsionalQuery,
    siswa_id: idOpsionalQuery,
    tanggal_dari: tanggalOpsionalQuery,
    tanggal_sampai: tanggalOpsionalQuery,
  })
  .refine(rentangValid, pesanRentang);
export type LaporanSiswaFilter = z.infer<typeof laporanSiswaFilterSchema>;

export const laporanSiswaQuerySchema = paginationQuerySchema
  .extend({
    kelas_id: idOpsionalQuery,
    siswa_id: idOpsionalQuery,
    tanggal_dari: tanggalOpsionalQuery,
    tanggal_sampai: tanggalOpsionalQuery,
  })
  .refine(rentangValid, pesanRentang);
export type LaporanSiswaQuery = z.infer<typeof laporanSiswaQuerySchema>;

export interface LaporanSiswaBaris extends HitunganSiswa {
  siswa_id: number;
  nis: string;
  nama_siswa: string;
  nama_kelas: string;
  /** Jumlah catatan (sesi) dalam rentang. */
  total: number;
}

export interface RefSiswa {
  id: number;
  nis: string;
  nama_siswa: string;
  kelas_id: number;
}
