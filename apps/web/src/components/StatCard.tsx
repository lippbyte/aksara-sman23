import type { Icon as Ikon } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { NadaStatus } from './StatusBadge';

interface StatCardProps {
  label: string;
  /** Angka sudah diformat (id-ID). */
  nilai: string;
  keterangan?: string;
  icon: Ikon;
  nada?: NadaStatus;
  className?: string;
}

const IKON: Record<NadaStatus, string> = {
  hadir: 'bg-hadir-soft text-hadir',
  mendampingi: 'bg-mendampingi-soft text-mendampingi',
  'tidak-hadir': 'bg-tidak-hadir-soft text-tidak-hadir',
  izin: 'bg-izin-soft text-izin',
  sakit: 'bg-sakit-soft text-sakit',
  info: 'bg-info-soft text-info',
  peringatan: 'bg-peringatan-soft text-peringatan',
  netral: 'bg-accent-soft text-accent',
};

/** Kartu KPI (REDESIGN-DIRECTION §04 + DESIGN §6): label ringkas, angka tabular, ikon semantik. */
export function StatCard({
  label,
  nilai,
  keterangan,
  icon: Icon,
  nada = 'netral',
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'kartu-kontainer flex h-full items-start justify-between gap-3 rounded-kartu border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-ink tabular-nums">{nilai}</p>
        {keterangan && <p className="mt-0.5 text-xs text-ink-muted">{keterangan}</p>}
      </div>
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-kontrol',
          IKON[nada],
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
    </div>
  );
}
