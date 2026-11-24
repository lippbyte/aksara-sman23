import { useEffect } from 'react';
import { useBlocker } from 'react-router';
import { ConfirmDialog } from './ui/dialog';

interface PenjagaPerubahanProps {
  /** `true` selama ada isian yang belum disimpan. */
  aktif: boolean;
  judul?: string;
  /** Jelaskan apa yang akan hilang. */
  pesan: string;
}

/**
 * Melindungi isian yang belum disimpan dari navigasi: pindah halaman, mengubah filter di URL
 * (tanggal, kelas, jam), dan menutup/memuat ulang tab. Navigasi di dalam aplikasi ditahan lalu
 * dikonfirmasi; aksi aman ("Tetap di sini") di kiri dan mendapat fokus awal.
 */
export function PenjagaPerubahan({
  aktif,
  judul = 'Tinggalkan perubahan yang belum disimpan?',
  pesan,
}: PenjagaPerubahanProps) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      aktif &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  // Perubahan sudah tersimpan saat dialog terbuka: lanjutkan navigasi yang tertahan.
  useEffect(() => {
    if (blocker.state === 'blocked' && !aktif) blocker.proceed();
  }, [blocker, aktif]);

  useEffect(() => {
    if (!aktif) return;
    const peringatan = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', peringatan);
    return () => window.removeEventListener('beforeunload', peringatan);
  }, [aktif]);

  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(buka) => {
        if (!buka && blocker.state === 'blocked') blocker.reset();
      }}
      judul={judul}
      pesan={pesan}
      labelBatal="Tetap di sini"
      labelSetuju="Buang perubahan"
      berbahaya
      onSetuju={() => {
        if (blocker.state === 'blocked') blocker.proceed();
      }}
    />
  );
}
