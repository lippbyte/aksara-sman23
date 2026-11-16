/** Konstanta domain (PROJECT-CONTEXT §3, §5, §6). */

export const ROLES = ['admin', 'manajemen_guru', 'sekretaris_kelas', 'guru_penilai'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  manajemen_guru: 'Manajemen Guru',
  sekretaris_kelas: 'Sekretaris Kelas',
  guru_penilai: 'Guru Penilai',
};

/** Status kehadiran guru di kelas. */
export const STATUS_KEHADIRAN = ['Hadir', 'Mendampingi', 'Tidak Hadir'] as const;
export type StatusKehadiran = (typeof STATUS_KEHADIRAN)[number];

/** Status yang dihitung sebagai jam hadir pada rekap (§6.3). */
export const STATUS_DIHITUNG_HADIR: readonly StatusKehadiran[] = ['Hadir', 'Mendampingi'];

export const STATUS_TUGAS = ['Ada', 'Tidak Ada'] as const;
export type StatusTugas = (typeof STATUS_TUGAS)[number];

export const STATUS_SISWA = ['hadir', 'izin', 'sakit', 'alpa'] as const;
export type StatusSiswa = (typeof STATUS_SISWA)[number];

export const STATUS_AKTIF = ['aktif', 'tidak_aktif'] as const;
export type StatusAktif = (typeof STATUS_AKTIF)[number];

export const JENIS_KELAMIN = ['L', 'P'] as const;
export type JenisKelamin = (typeof JENIS_KELAMIN)[number];

/** Jam ke 0 = pembiasaan pagi. */
export const JAM_KE_MIN = 0;
export const JAM_KE_MAX = 12;
export const LAMA_JAM_MIN = 1;
export const LAMA_JAM_MAX = 4;

/** Hari jadwal: 1 = Senin … 6 = Sabtu. */
export const HARI_MIN = 1;
export const HARI_MAX = 6;
export const NAMA_HARI: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
};

/** Default pengaturan sekolah; nilai yang berlaku dibaca dari `sekolah_settings`. */
export const HARI_EFEKTIF_DEFAULT: readonly number[] = [1, 2, 3, 4, 5];
export const JENDELA_PENILAIAN_HARI_DEFAULT = 3;

export interface BobotKinerja {
  /** Dipakai bila skor manajemen terisi (> 0). Jumlah = 100. */
  dengan_manajemen: { kehadiran: number; administrasi: number; manajemen: number };
  /** Dipakai bila skor manajemen kosong atau 0. Jumlah = 100. */
  tanpa_manajemen: { kehadiran: number; administrasi: number };
}

export interface BobotMgmp {
  kehadiran: number;
  siswa: number;
  administrasi: number;
}

export const BOBOT_DEFAULT: { kinerja: BobotKinerja; mgmp: BobotMgmp } = {
  kinerja: {
    dengan_manajemen: { kehadiran: 50, administrasi: 30, manajemen: 20 },
    tanpa_manajemen: { kehadiran: 50, administrasi: 50 },
  },
  mgmp: { kehadiran: 40, siswa: 30, administrasi: 30 },
};

export const PREDIKAT_KINERJA_LABEL = ['Sangat Baik', 'Baik', 'Cukup', 'Kurang'] as const;
export type PredikatKinerja = (typeof PREDIKAT_KINERJA_LABEL)[number];

export const PREDIKAT_MGMP_LABEL = [
  'Sangat Aktif',
  'Aktif',
  'Cukup Aktif',
  'Kurang Aktif',
] as const;
export type PredikatMgmp = (typeof PREDIKAT_MGMP_LABEL)[number];

/** Ambang bawah (inklusif), diurutkan dari tertinggi. Di bawah ambang terakhir → label terakhir. */
export const PREDIKAT: {
  kinerja: readonly { min: number; label: PredikatKinerja }[];
  mgmp: readonly { min: number; label: PredikatMgmp }[];
} = {
  kinerja: [
    { min: 91, label: 'Sangat Baik' },
    { min: 76, label: 'Baik' },
    { min: 61, label: 'Cukup' },
    { min: 0, label: 'Kurang' },
  ],
  mgmp: [
    { min: 90, label: 'Sangat Aktif' },
    { min: 75, label: 'Aktif' },
    { min: 60, label: 'Cukup Aktif' },
    { min: 0, label: 'Kurang Aktif' },
  ],
};

/** Ambang warna ProgressBar persentase kehadiran (DESIGN §6). */
export const AMBANG_PERSENTASE = { tinggi: 90, baik: 75, cukup: 60 } as const;

export const AUDIT_MODULES = [
  'Auth',
  'Piket',
  'Siswa',
  'Rekap',
  'Penilaian',
  'Laporan',
  'Settings',
] as const;
export type AuditModule = (typeof AUDIT_MODULES)[number];

export const PAGE_SIZE_DEFAULT = 20;
