import { TriangleAlert } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { usePengguna } from '@/lib/auth';
import { DashboardKelasPage } from './DashboardKelasPage';
import { DashboardPenilaiPage } from './DashboardPenilaiPage';
import { DashboardRingkasanPage } from './DashboardRingkasanPage';

/** Dashboard Utama: isinya mengikuti peran (PROJECT-CONTEXT §4, DESIGN §7). */
export function DashboardPage() {
  const user = usePengguna();

  switch (user.role) {
    case 'sekretaris_kelas':
      return user.kelas_id === null ? (
        <EmptyState icon={TriangleAlert} pesan="Akun Anda belum terikat ke kelas. Hubungi admin." />
      ) : (
        <DashboardKelasPage kelasId={user.kelas_id} />
      );
    case 'guru_penilai':
      return <DashboardPenilaiPage />;
    case 'admin':
    case 'manajemen_guru':
      return <DashboardRingkasanPage />;
  }
}
