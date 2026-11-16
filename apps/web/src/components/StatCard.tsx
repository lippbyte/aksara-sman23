import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NadaStatus } from './StatusBadge';

interface StatCardProps {
  label: string;
  /** Angka sudah diformat (id-ID). */
  nilai: string;
  keterangan?: string;
  icon: LucideIcon;
  nada?: NadaStatus;
  className?: string;
}

const IKON: Record<NadaStatus, string> = {
  hadir: 'bg-hadir-soft text-hadir',
  mendampingi: 'bg-mendampingi-soft text-mendampingi',
  'tidak-hadir': 'bg-tidak-hadir-soft text-tidak-hadir',
  izin: 'bg-izin-soft text-izin',
  sakit: 'bg-sakit-soft text-sakit',
  netral: 'bg-subtle text-ink-muted',
};

/** Kartu KPI (DESIGN §6): label kecil, angka besar, keterangan konteks, ikon. */
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
        'flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-4 sm:p-5',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-2xs font-semibold tracking-wider text-ink-subtle uppercase">{label}</p>
        <p className="mt-1 text-2xl font-bold text-ink tabular-nums">{nilai}</p>
        {keterangan && <p className="mt-0.5 text-xs text-ink-muted">{keterangan}</p>}
      </div>
      <span
        className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', IKON[nada])}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
    </div>
  );
}
