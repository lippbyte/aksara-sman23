import { Construction, SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';

/** Pengganti sementara sampai modulnya dibangun di fase berikutnya. */
export function HalamanKosong() {
  return <EmptyState icon={Construction} pesan="Halaman ini belum tersedia." />;
}

export function HalamanTidakDitemukan() {
  return (
    <EmptyState
      icon={SearchX}
      pesan="Halaman yang Anda tuju tidak ditemukan."
      aksi={
        <Button asChild variant="secondary">
          <Link to="/">Kembali ke Dashboard</Link>
        </Button>
      }
    />
  );
}
