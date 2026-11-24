import type { Icon as Ikon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type NadaKosong = 'netral' | 'peringatan' | 'galat';

interface EmptyStateProps {
  icon: Ikon;
  /** Apa yang terjadi, singkat (mis. "Belum ada catatan hari ini"). Opsional untuk kompatibilitas. */
  judul?: string;
  /** Penjelasan dan langkah berikutnya, satu-dua kalimat. */
  pesan: string;
  aksi?: ReactNode;
  /** `galat` diumumkan pembaca layar sebagai peringatan; lainnya sebagai status. */
  nada?: NadaKosong;
  className?: string;
}

const IKON: Record<NadaKosong, string> = {
  netral: 'bg-accent-soft text-accent',
  peringatan: 'bg-peringatan-soft text-peringatan',
  galat: 'bg-tidak-hadir-soft text-tidak-hadir',
};

/**
 * Keadaan kosong/galat yang menjelaskan apa yang terjadi dan apa yang bisa dilakukan
 * (REDESIGN-DIRECTION §10.8). Tanpa ilustrasi dekoratif.
 */
export function EmptyState({
  icon: Icon,
  judul,
  pesan,
  aksi,
  nada = 'netral',
  className,
}: EmptyStateProps) {
  return (
    <div
      role={nada === 'galat' ? 'alert' : 'status'}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-kartu border border-line bg-surface px-4 py-10 text-center shadow-[var(--shadow-card)] sm:py-12',
        className,
      )}
    >
      <span className={cn('flex size-11 items-center justify-center rounded-kontrol', IKON[nada])}>
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="flex max-w-md flex-col gap-1">
        {judul && <p className="text-base font-semibold text-ink">{judul}</p>}
        <p className="text-sm text-ink-muted">{pesan}</p>
      </div>
      {aksi && <div className="mt-1 flex flex-wrap justify-center gap-2">{aksi}</div>}
    </div>
  );
}
