import type { Role } from '@sms/shared';
import type { ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardKelasPage } from '@/features/dashboard/DashboardKelasPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { AbsensiGuruPage } from '@/features/kehadiran/AbsensiGuruPage';
import { AbsensiSiswaPage } from '@/features/kehadiran-siswa/AbsensiSiswaPage';
import { LaporanSiswaPage } from '@/features/kehadiran-siswa/LaporanSiswaPage';
import { ProfilPage } from '@/features/auth/ProfilPage';
import { LogAktivitasPage } from '@/features/log-aktivitas/LogAktivitasPage';
import { PengaturanPage } from '@/features/pengaturan/PengaturanPage';
import { PenilaianKinerjaPage } from '@/features/penilaian/PenilaianKinerjaPage';
import { PenilaianMgmpPage } from '@/features/penilaian/PenilaianMgmpPage';
import { RekapPage } from '@/features/rekap/RekapPage';
import { BantuanPage } from '@/features/umum/BantuanPage';
import { HalamanTidakDitemukan } from '@/features/umum/HalamanKosong';
import { TentangPage } from '@/features/umum/TentangPage';
import { PerluMasuk, PerluPeran } from './guards';
import { AppLayout } from './layout/AppLayout';
import { NAV_ITEMS } from './nav';

/** Peran yang boleh membuka sebuah path: satu sumber dengan menu sidebar. */
function peranUntuk(path: string): readonly Role[] {
  return NAV_ITEMS.find((item) => item.path === path)?.roles ?? [];
}

function terlindung(path: string, halaman: ReactNode): ReactNode {
  return <PerluPeran roles={peranUntuk(path)}>{halaman}</PerluPeran>;
}

export const routes: RouteObject[] = [
  { path: '/masuk', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <PerluMasuk>
        <AppLayout />
      </PerluMasuk>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'kelas/:id',
        element: (
          <PerluPeran roles={['admin', 'manajemen_guru']}>
            <DashboardKelasPage />
          </PerluPeran>
        ),
      },
      { path: 'absensi-guru', element: terlindung('/absensi-guru', <AbsensiGuruPage />) },
      { path: 'absensi-siswa', element: terlindung('/absensi-siswa', <AbsensiSiswaPage />) },
      { path: 'rekap-kehadiran', element: terlindung('/rekap-kehadiran', <RekapPage />) },
      {
        path: 'penilaian-kinerja',
        element: terlindung('/penilaian-kinerja', <PenilaianKinerjaPage />),
      },
      { path: 'penilaian-mgmp', element: terlindung('/penilaian-mgmp', <PenilaianMgmpPage />) },
      { path: 'laporan-siswa', element: terlindung('/laporan-siswa', <LaporanSiswaPage />) },
      { path: 'log-aktivitas', element: terlindung('/log-aktivitas', <LogAktivitasPage />) },
      { path: 'pengaturan/:tab?', element: terlindung('/pengaturan', <PengaturanPage />) },
      { path: 'profil', element: <ProfilPage /> },
      { path: 'bantuan', element: <BantuanPage /> },
      { path: 'tentang', element: <TentangPage /> },
      { path: '*', element: <HalamanTidakDitemukan /> },
    ],
  },
];
