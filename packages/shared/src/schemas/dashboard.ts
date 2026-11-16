import type { StatusKehadiran } from '../constants';
import type { RentangPekan } from '../domain/pekan';
import type { JendelaPenilaian } from '../domain/skor';
import type { Periode } from './penilaian';
import type { AuditLog } from './settings';

export interface KehadiranKelasHariIni extends Record<StatusKehadiran, number> {
  kelas_id: number;
  nama_kelas: string;
}

export interface TitikTren {
  minggu_ke: number;
  tahun: number;
  tanggal_mulai: string;
  tanggal_selesai: string;
  /** Rata-rata persentase guru berjadwal; null bila rekap pekan itu belum ada. */
  persentase: number | null;
  jumlah_guru: number;
}

export interface KelasJamKosong {
  kelas_id: number;
  nama_kelas: string;
  /** JP berstatus Tidak Hadir pada pekan ini. */
  jp_kosong: number;
}

export interface GuruTerendah {
  guru_id: number;
  nama_guru: string;
  mata_pelajaran: string;
  persentase: number;
  jam_hadir: number;
  jam_wajib: number;
}

/** Dashboard utama untuk admin dan manajemen_guru (DESIGN §7). */
export interface DashboardRingkasan {
  tanggal: string;
  kpi: { guru_aktif: number; siswa_aktif: number; rombel: number; catatan_hari_ini: number };
  hari_ini: {
    per_status: Record<StatusKehadiran, { catatan: number; jp: number }>;
    jp_terjadwal: number;
    jp_tercatat: number;
    persentase_terisi: number;
    /** JP per status per kelas (bar bertumpuk). */
    per_kelas: KehadiranKelasHariIni[];
  };
  /** 8 pekan terakhir, urut lama → baru. */
  tren: TitikTren[];
  jam_kosong: { pekan: RentangPekan; data: KelasJamKosong[] };
  /** Pekan terakhir yang sudah punya rekap. */
  guru_terendah: { pekan: RentangPekan | null; data: GuruTerendah[] };
  /** Hanya untuk admin; null untuk peran lain. */
  log_terbaru: AuditLog[] | null;
}

export interface GuruBelumDinilai {
  guru_id: number;
  kode_guru: string;
  nama_guru: string;
  mata_pelajaran: string;
}

/** Dashboard ringkas guru_penilai (DESIGN §7). */
export interface DashboardPenilai {
  periode: Periode;
  jendela: JendelaPenilaian & { hari: number };
  jumlah_guru_aktif: number;
  sudah_dinilai: number;
  belum_dinilai: GuruBelumDinilai[];
}
