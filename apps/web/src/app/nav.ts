import type { Role } from '@sms/shared';
import {
  CalendarCheckIcon,
  ChalkboardTeacherIcon,
  ClockCounterClockwiseIcon,
  FileTextIcon,
  GearSixIcon,
  MedalIcon,
  SquaresFourIcon,
  StudentIcon,
  UsersThreeIcon,
  type Icon as Ikon,
} from '@phosphor-icons/react';

/** Kelompok menu sidebar (REDESIGN-DIRECTION §9.1): pekerjaan harian, pantauan, administrasi. */
export type GrupNav = 'harian' | 'pantauan' | 'administrasi';

export const LABEL_GRUP: Record<GrupNav, string> = {
  harian: 'Harian',
  pantauan: 'Rekap & Penilaian',
  administrasi: 'Administrasi',
};

export interface NavItem {
  path: string;
  label: string;
  /** Label ringkas untuk bar navigasi bawah mobile (DESIGN §11.2). */
  labelPendek: string;
  icon: Ikon;
  grup: GrupNav;
  /** Peran yang melihat menu ini. Hanya cermin matriks akses; pengaman ada di server. */
  roles: readonly Role[];
}

const SEMUA: readonly Role[] = ['admin', 'manajemen_guru', 'sekretaris_kelas', 'guru_penilai'];
const PIMPINAN: readonly Role[] = ['admin', 'manajemen_guru'];

/** Urutan menu mengikuti DESIGN §5; akses mengikuti PROJECT-CONTEXT §4. */
export const NAV_ITEMS: NavItem[] = [
  {
    path: '/',
    label: 'Dashboard Utama',
    labelPendek: 'Beranda',
    icon: SquaresFourIcon,
    grup: 'harian',
    roles: SEMUA,
  },
  {
    path: '/absensi-guru',
    label: 'Absensi Guru',
    labelPendek: 'Absensi Guru',
    icon: ChalkboardTeacherIcon,
    grup: 'harian',
    roles: SEMUA,
  },
  {
    path: '/absensi-siswa',
    label: 'Absensi Siswa',
    labelPendek: 'Absensi Siswa',
    icon: StudentIcon,
    grup: 'harian',
    roles: ['admin', 'manajemen_guru', 'sekretaris_kelas'],
  },
  {
    path: '/rekap-kehadiran',
    label: 'Rekap Kehadiran Guru',
    labelPendek: 'Rekap',
    icon: CalendarCheckIcon,
    grup: 'pantauan',
    roles: PIMPINAN,
  },
  {
    path: '/penilaian-kinerja',
    label: 'Penilaian Kinerja',
    labelPendek: 'Penilaian',
    icon: MedalIcon,
    grup: 'pantauan',
    roles: ['admin', 'manajemen_guru', 'guru_penilai'],
  },
  {
    path: '/penilaian-mgmp',
    label: 'Penilaian MGMP',
    labelPendek: 'MGMP',
    icon: UsersThreeIcon,
    grup: 'pantauan',
    roles: SEMUA,
  },
  {
    path: '/laporan-siswa',
    label: 'Laporan Rekap Siswa',
    labelPendek: 'Laporan',
    icon: FileTextIcon,
    grup: 'pantauan',
    roles: PIMPINAN,
  },
  {
    path: '/log-aktivitas',
    label: 'Log Aktivitas',
    labelPendek: 'Log',
    icon: ClockCounterClockwiseIcon,
    grup: 'administrasi',
    roles: ['admin'],
  },
  {
    path: '/pengaturan',
    label: 'Pengaturan',
    labelPendek: 'Pengaturan',
    icon: GearSixIcon,
    grup: 'administrasi',
    roles: ['admin'],
  },
];

/** Halaman di menu pengguna (bukan di sidebar). */
export const HALAMAN_PENGGUNA: { path: string; label: string }[] = [
  { path: '/profil', label: 'Profil' },
  { path: '/bantuan', label: 'Bantuan' },
  { path: '/tentang', label: 'Tentang' },
];

export function menuUntuk(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Menu sidebar dikelompokkan; kelompok tanpa menu untuk peran itu tidak ditampilkan. */
export function menuBergrupUntuk(role: Role): { grup: GrupNav; label: string; item: NavItem[] }[] {
  const menu = menuUntuk(role);
  return (Object.keys(LABEL_GRUP) as GrupNav[])
    .map((grup) => ({ grup, label: LABEL_GRUP[grup], item: menu.filter((m) => m.grup === grup) }))
    .filter((g) => g.item.length > 0);
}

/** Konfigurasi slot 1–4 bar bawah per peran (DESIGN §11.2). */
const SLOT_UTAMA_PER_PERAN: Record<Role, readonly string[]> = {
  sekretaris_kelas: ['/', '/absensi-guru', '/absensi-siswa', '/penilaian-mgmp'],
  guru_penilai: ['/', '/absensi-guru', '/penilaian-kinerja', '/penilaian-mgmp'],
  manajemen_guru: ['/', '/rekap-kehadiran', '/penilaian-kinerja', '/laporan-siswa'],
  admin: ['/', '/absensi-guru', '/rekap-kehadiran', '/penilaian-kinerja'],
};

export interface KonfigurasiBarBawah {
  utama: NavItem[];
  lainnya: NavItem[];
  labelSlotLima: 'Akun' | 'Lainnya';
}

export function barBawahUntuk(role: Role): KonfigurasiBarBawah {
  const semua = menuUntuk(role);
  const peta = new Map(semua.map((m) => [m.path, m]));
  const jalurUtama = SLOT_UTAMA_PER_PERAN[role];
  const utama = jalurUtama.map((p) => peta.get(p)).filter((m): m is NavItem => m !== undefined);
  const setUtama = new Set(utama.map((m) => m.path));
  const lainnya = semua.filter((m) => !setUtama.has(m.path));
  return {
    utama,
    lainnya,
    labelSlotLima: lainnya.length > 0 ? 'Lainnya' : 'Akun',
  };
}

export function judulHalaman(pathname: string): string {
  if (pathname.startsWith('/kelas/')) return 'Dashboard Kelas';
  const semua = [...NAV_ITEMS, ...HALAMAN_PENGGUNA];
  const cocok = semua
    .filter((item) =>
      item.path === '/'
        ? pathname === '/'
        : pathname === item.path || pathname.startsWith(`${item.path}/`),
    )
    .sort((a, b) => b.path.length - a.path.length)[0];
  return cocok?.label ?? 'Halaman tidak ditemukan';
}
