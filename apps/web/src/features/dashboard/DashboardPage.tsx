import { WarningIcon } from '@phosphor-icons/react';
import { EmptyState } from '@/components/EmptyState';
import { FotoLatar } from '@/components/GambarSekolah';
import { useAuth, usePengguna } from '@/lib/auth';
import { DashboardKelasPage } from './DashboardKelasPage';
import { DashboardPenilaiPage } from './DashboardPenilaiPage';
import { DashboardRingkasanPage } from './DashboardRingkasanPage';

/**
 * Lapisan foto dekoratif di bagian atas dashboard (±17.5rem, opasitas 6–10 %, abu-abu) yang
 * memudar ke --bg-app (DESIGN §11.3). Hanya bila admin mengunggahnya di Pengaturan Sekolah.
 */
function LatarDashboard({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    <div
      aria-hidden="true"
      className="latar-dashboard-pudar pointer-events-none absolute -inset-x-4 -top-5 z-0 h-70 overflow-hidden sm:-inset-x-6 lg:-top-6"
    >
      <FotoLatar url={url} className="scale-105 opacity-10 blur-xs grayscale" />
    </div>
  );
}

/** Dashboard Utama: isinya mengikuti peran (PROJECT-CONTEXT §4, DESIGN §7). */
export function DashboardPage() {
  const user = usePengguna();
  const { sekolah } = useAuth();

  let isi: React.ReactNode;
  switch (user.role) {
    case 'sekretaris_kelas':
      isi =
        user.kelas_id === null ? (
          <EmptyState
            icon={WarningIcon}
            nada="peringatan"
            judul="Akun belum terhubung ke kelas"
            pesan="Sekretaris kelas perlu terhubung ke satu kelas sebelum bisa mencatat. Minta admin mengatur kelas di Pengaturan → Akun."
          />
        ) : (
          <DashboardKelasPage kelasId={user.kelas_id} />
        );
      break;
    case 'guru_penilai':
      isi = <DashboardPenilaiPage />;
      break;
    case 'admin':
    case 'manajemen_guru':
      isi = <DashboardRingkasanPage />;
      break;
  }

  return (
    <div className="relative">
      <LatarDashboard url={sekolah?.dashboard_background_url} />
      <div className="relative z-10">{isi}</div>
    </div>
  );
}
