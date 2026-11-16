import { z } from 'zod';
import {
  JAM_KE_MAX,
  JAM_KE_MIN,
  LAMA_JAM_MAX,
  LAMA_JAM_MIN,
  STATUS_KEHADIRAN,
  STATUS_TUGAS,
  type StatusKehadiran,
  type StatusTugas,
} from '../constants';
import { paginationQuerySchema } from './common';
import {
  idOpsionalQuery,
  idSchema,
  idWajib,
  tanggalOpsionalQuery,
  tanggalSchema,
  teksOpsional,
} from './dasar';

/** Catatan kehadiran guru di kelas (§6.1). */
export const kehadiranSchema = z.object({
  tanggal: tanggalSchema,
  guru_id: idWajib('Guru'),
  /**
   * Untuk sekretaris_kelas nilai ini diabaikan: kelas selalu diambil dari akunnya.
   * Untuk peran lain wajib diisi (diperiksa di server).
   */
  kelas_id: idSchema.nullish().transform((v) => v ?? null),
  jam_ke: z
    .number({ error: 'Jam ke wajib diisi.' })
    .int('Jam ke harus bilangan bulat.')
    .min(JAM_KE_MIN, `Jam ke minimal ${JAM_KE_MIN}.`)
    .max(JAM_KE_MAX, `Jam ke maksimal ${JAM_KE_MAX}.`),
  lama_jam: z
    .number({ error: 'Lama JP wajib diisi.' })
    .int('Lama JP harus bilangan bulat.')
    .min(LAMA_JAM_MIN, `Lama minimal ${LAMA_JAM_MIN} JP.`)
    .max(LAMA_JAM_MAX, `Lama maksimal ${LAMA_JAM_MAX} JP.`),
  status_kehadiran: z.enum(STATUS_KEHADIRAN, { error: 'Pilih status kehadiran.' }),
  status_tugas: z.enum(STATUS_TUGAS, { error: 'Pilih status tugas.' }),
  keterangan: teksOpsional(500),
});
export type KehadiranInput = z.infer<typeof kehadiranSchema>;

/**
 * Varian untuk peran selain sekretaris_kelas: kelas wajib dipilih.
 * Server menerapkan aturan yang sama setelah menentukan kelas dari sesi.
 */
export const kehadiranWajibKelasSchema = kehadiranSchema.refine((v) => v.kelas_id !== null, {
  path: ['kelas_id'],
  message: 'Kelas wajib dipilih.',
});
export type KehadiranFormValues = z.input<typeof kehadiranSchema>;

export interface Kehadiran {
  id: number;
  tanggal: string;
  guru_id: number;
  kode_guru: string;
  nama_guru: string;
  mata_pelajaran: string;
  kelas_id: number;
  nama_kelas: string;
  jam_ke: number;
  lama_jam: number;
  status_kehadiran: StatusKehadiran;
  status_tugas: StatusTugas;
  keterangan: string | null;
  created_by: number;
  nama_pembuat: string;
  created_at: string;
}

const statusKehadiranQuery = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.enum(STATUS_KEHADIRAN).optional(),
);

export const kehadiranQuerySchema = paginationQuerySchema.extend({
  tanggal: tanggalOpsionalQuery,
  tanggal_dari: tanggalOpsionalQuery,
  tanggal_sampai: tanggalOpsionalQuery,
  kelas_id: idOpsionalQuery,
  guru_id: idOpsionalQuery,
  status: statusKehadiranQuery,
});
export type KehadiranQuery = z.infer<typeof kehadiranQuerySchema>;

/** Jadwal sebuah kelas pada satu tanggal, untuk mengisi form dengan cepat. */
export const jadwalHariQuerySchema = z.object({
  kelas_id: idOpsionalQuery,
  tanggal: tanggalSchema,
});
export type JadwalHariQuery = z.infer<typeof jadwalHariQuerySchema>;

export interface JadwalHari {
  guru_id: number;
  kode_guru: string;
  nama_guru: string;
  mata_pelajaran: string;
  jam_ke: number;
  total_jam_mengajar: number;
  /** Sudah ada catatan kehadiran guru ini di kelas dan jam tersebut pada tanggal itu. */
  sudah_dicatat: boolean;
}

// ───────────── Dashboard kelas ─────────────

export const dashboardKelasQuerySchema = z.object({
  tanggal: tanggalOpsionalQuery,
  guru_id: idOpsionalQuery,
  status: statusKehadiranQuery,
});
export type DashboardKelasQuery = z.infer<typeof dashboardKelasQuerySchema>;

export interface DashboardKelas {
  kelas: { id: number; nama_kelas: string };
  tanggal: string;
  /** Hitungan catatan per status pada tanggal itu (tanpa filter guru/status). */
  hitungan: Record<StatusKehadiran, number>;
  /** Jumlah JP per status. */
  jam: Record<StatusKehadiran, number>;
  /** Jurnal mengajar: catatan kehadiran pada tanggal itu, urut jam ke. */
  jurnal: Kehadiran[];
  /** Jadwal kelas pada hari itu, untuk melihat jam yang belum dicatat. */
  jadwal: JadwalHari[];
}
