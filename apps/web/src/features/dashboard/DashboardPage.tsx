import { TriangleAlert } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { useAuth, usePengguna } from '@/lib/auth';
import { DashboardKelasPage } from './DashboardKelasPage';
import { DashboardPenilaiPage } from './DashboardPenilaiPage';
import { DashboardRingkasanPage } from './DashboardRingkasanPage';

function urlVarian(baseUrl: string, lebar: 640 | 1280 | 1920, fmt: 'webp' | 'jpeg'): string {
  const sep = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${sep}w=${lebar}&fmt=${fmt}`;
}

/** Lapisan gambar dekoratif bagian atas dashboard yang memudar ke --bg-app (DESIGN §11.3). */
function LatarDashboard({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    <div
      aria-hidden="true"
      className="latar-dashboard-pudar pointer-events-none absolute -inset-x-4 -top-5 z-0 h-[280px] overflow-hidden sm:-inset-x-6 lg:-top-6"
    >
      <picture>
        <source
          type="image/webp"
          srcSet={`${urlVarian(url, 640, 'webp')} 640w, ${urlVarian(url, 1280, 'webp')} 1280w, ${urlVarian(url, 1920, 'webp')} 1920w`}
          sizes="100vw"
        />
        <img
          src={urlVarian(url, 1280, 'jpeg')}
          srcSet={`${urlVarian(url, 640, 'jpeg')} 640w, ${urlVarian(url, 1280, 'jpeg')} 1280w, ${urlVarian(url, 1920, 'jpeg')} 1920w`}
          sizes="100vw"
          alt=""
          decoding="async"
          fetchPriority="low"
          className="h-full w-full scale-105 object-cover opacity-[0.08] grayscale blur-[2px]"
        />
      </picture>
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
            icon={TriangleAlert}
            pesan="Akun Anda belum terikat ke kelas. Hubungi admin."
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
