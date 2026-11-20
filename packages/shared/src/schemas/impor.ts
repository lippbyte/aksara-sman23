import { z } from 'zod';

export const JENIS_IMPOR = ['guru', 'siswa', 'jadwal'] as const;
export type JenisImpor = (typeof JENIS_IMPOR)[number];

export const BATAS_UKURAN_CSV_BYTE = 2 * 1024 * 1024;
export const BATAS_BARIS_CSV = 5000;

export const jenisImporParamSchema = z.object({
  jenis: z.enum(JENIS_IMPOR, { error: 'Jenis impor harus guru, siswa, atau jadwal.' }),
});

export const pratinjauImporSchema = z.object({
  csv: z
    .string({ error: 'Isi CSV wajib dikirim.' })
    .min(1, 'Berkas CSV kosong.')
    .max(BATAS_UKURAN_CSV_BYTE, 'Ukuran berkas CSV maksimal 2 MB.'),
});
export type PratinjauImporInput = z.infer<typeof pratinjauImporSchema>;

export const simpanImporSchema = pratinjauImporSchema.extend({
  izinkan_buat_referensi: z.boolean().default(false),
});
export type SimpanImporInput = z.infer<typeof simpanImporSchema>;

export const hapusDataPilotSchema = z.object({
  konfirmasi_nama_sekolah: z
    .string({ error: 'Ketik nama sekolah untuk konfirmasi.' })
    .trim()
    .min(1, 'Ketik nama sekolah untuk konfirmasi.')
    .max(150),
});
export type HapusDataPilotInput = z.infer<typeof hapusDataPilotSchema>;

export interface GalatBarisImpor {
  baris: number;
  pesan: string;
}

export interface HasilPratinjauImpor {
  jenis: JenisImpor;
  ringkasan: {
    total: number;
    baru: number;
    diperbarui: number;
    ditolak: number;
  };
  referensi_baru: {
    kelas: string[];
    mgmp: string[];
  };
  galat: GalatBarisImpor[];
  total_galat: number;
  contoh: Record<string, string | number | null>[];
  dapat_disimpan: boolean;
}

export interface HasilSimpanImpor {
  jenis: JenisImpor;
  baru: number;
  diperbarui: number;
  kelas_dibuat: number;
  mgmp_dibuat: number;
}

export interface HasilHapusPilot {
  dihapus: {
    penilaian_mgmp_siswa: number;
    penilaian_mgmp: number;
    penilaian_kinerja: number;
    rekap: number;
    kehadiran_siswa: number;
    kehadiran: number;
    jadwal: number;
    siswa: number;
    guru: number;
  };
}
