import type { Role } from '@sms/shared';
import {
  Award,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Peran yang melihat menu ini. Hanya cermin matriks akses; pengaman ada di server. */
  roles: readonly Role[];
}

const SEMUA: readonly Role[] = ['admin', 'manajemen_guru', 'sekretaris_kelas', 'guru_penilai'];
const PIMPINAN: readonly Role[] = ['admin', 'manajemen_guru'];

/** Urutan menu mengikuti DESIGN §5; akses mengikuti PROJECT-CONTEXT §4. */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard Utama', icon: LayoutDashboard, roles: SEMUA },
  { path: '/absensi-guru', label: 'Absensi Guru', icon: ClipboardCheck, roles: SEMUA },
  {
    path: '/absensi-siswa',
    label: 'Absensi Siswa',
    icon: Users,
    roles: ['admin', 'manajemen_guru', 'sekretaris_kelas'],
  },
  { path: '/rekap-kehadiran', label: 'Rekap Kehadiran Guru', icon: CalendarCheck, roles: PIMPINAN },
  {
    path: '/penilaian-kinerja',
    label: 'Penilaian Kinerja',
    icon: Award,
    roles: ['admin', 'manajemen_guru', 'guru_penilai'],
  },
  { path: '/penilaian-mgmp', label: 'Penilaian MGMP', icon: UsersRound, roles: SEMUA },
  { path: '/laporan-siswa', label: 'Laporan Rekap Siswa', icon: FileText, roles: PIMPINAN },
  { path: '/log-aktivitas', label: 'Log Aktivitas', icon: History, roles: ['admin'] },
  { path: '/pengaturan', label: 'Pengaturan', icon: Settings, roles: ['admin'] },
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
