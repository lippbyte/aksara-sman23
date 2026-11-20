import { AMBANG_PERSENTASE } from '@sms/shared';
import { persen } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { NadaStatus } from './StatusBadge';

/** Warna mengikuti ambang (DESIGN §6): ≥90 emerald, ≥75 indigo, ≥60 amber, <60 rose. */
export function nadaPersentase(nilai: number): NadaStatus {
  if (nilai >= AMBANG_PERSENTASE.tinggi) return 'hadir';
  if (nilai >= AMBANG_PERSENTASE.baik) return 'mendampingi';
  if (nilai >= AMBANG_PERSENTASE.cukup) return 'izin';
  return 'tidak-hadir';
}

const ISI: Record<NadaStatus, string> = {
  hadir: 'bg-hadir-chart',
  mendampingi: 'bg-mendampingi-chart',
  'tidak-hadir': 'bg-tidak-hadir-chart',
  izin: 'bg-izin-chart',
  sakit: 'bg-sakit-chart',
  netral: 'bg-icon-muted',
};
const TEKS: Record<NadaStatus, string> = {
  hadir: 'text-hadir',
  mendampingi: 'text-mendampingi',
  'tidak-hadir': 'text-tidak-hadir',
  izin: 'text-izin',
  sakit: 'text-sakit',
  netral: 'text-ink-muted',
};

interface ProgressBarProps {
  /** 0–100. */
  nilai: number;
  label: string;
  className?: string;
}

/** Batang persentase + angka (warna tidak pernah berdiri sendiri). */
export function ProgressBar({ nilai, label, className }: ProgressBarProps) {
  const terbatas = Math.min(100, Math.max(0, Number.isFinite(nilai) ? nilai : 0));
  const nada = nadaPersentase(terbatas);
  return (
    <div className={cn('flex items-center justify-end gap-2', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={terbatas}
        aria-valuetext={persen(terbatas)}
        className="h-1.5 w-full max-w-28 min-w-12 overflow-hidden rounded-full bg-subtle"
      >
        <div
          className={cn('progress-isi h-full rounded-full', ISI[nada])}
          style={{ width: `${terbatas}%` }}
        />
      </div>
      <span className={cn('w-16 text-right text-sm font-semibold tabular-nums', TEKS[nada])}>
        {persen(terbatas)}
      </span>
    </div>
  );
}
