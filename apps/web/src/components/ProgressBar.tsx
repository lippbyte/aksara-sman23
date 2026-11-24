import { AMBANG_PERSENTASE } from '@sms/shared';
import { persen } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { NadaStatus } from './StatusBadge';

/**
 * Warna mengikuti ambang (DESIGN §6): ≥90 hijau, ≥75 biru info, ≥60 kuning peringatan,
 * <60 merah. Sengaja tidak memakai violet Mendampingi agar tidak terbaca sebagai status.
 */
export function nadaPersentase(nilai: number): NadaStatus {
  if (nilai >= AMBANG_PERSENTASE.tinggi) return 'hadir';
  if (nilai >= AMBANG_PERSENTASE.baik) return 'info';
  if (nilai >= AMBANG_PERSENTASE.cukup) return 'peringatan';
  return 'tidak-hadir';
}

const ISI: Record<NadaStatus, string> = {
  hadir: 'bg-hadir-chart',
  mendampingi: 'bg-mendampingi-chart',
  'tidak-hadir': 'bg-tidak-hadir-chart',
  izin: 'bg-izin-chart',
  sakit: 'bg-sakit-chart',
  info: 'bg-accent',
  peringatan: 'bg-peringatan-garis',
  netral: 'bg-icon-muted',
};
const TEKS: Record<NadaStatus, string> = {
  hadir: 'text-hadir',
  mendampingi: 'text-mendampingi',
  'tidak-hadir': 'text-tidak-hadir',
  izin: 'text-izin',
  sakit: 'text-sakit',
  info: 'text-info',
  peringatan: 'text-peringatan',
  netral: 'text-ink-muted',
};

interface ProgressBarProps {
  /** 0–100. */
  nilai: number;
  label: string;
  className?: string;
  /**
   * Nada tetap, untuk kemajuan pekerjaan (mis. guru yang sudah dinilai) yang bukan "tingkat":
   * 10 % di awal periode bukan hal buruk, jadi tidak boleh tampil merah. Bawaan: menurut ambang.
   */
  nada?: NadaStatus;
  /** Batang mengisi lebar wadah (bawaan dibatasi 7rem untuk kolom tabel). */
  penuh?: boolean;
}

/** Batang persentase + angka (warna tidak pernah berdiri sendiri). */
export function ProgressBar({ nilai, label, className, nada: nadaTetap, penuh }: ProgressBarProps) {
  const terbatas = Math.min(100, Math.max(0, Number.isFinite(nilai) ? nilai : 0));
  const nada = nadaTetap ?? nadaPersentase(terbatas);
  return (
    <div className={cn('flex items-center justify-end gap-2', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={terbatas}
        aria-valuetext={persen(terbatas)}
        className={cn(
          'h-2 w-full min-w-12 overflow-hidden rounded-full bg-subtle',
          !penuh && 'max-w-28',
        )}
      >
        <div
          className={cn('progress-isi h-full w-full rounded-full', ISI[nada])}
          style={{ transform: `scaleX(${terbatas / 100})` }}
        />
      </div>
      <span className={cn('w-16 text-right text-sm font-semibold tabular-nums', TEKS[nada])}>
        {persen(terbatas)}
      </span>
    </div>
  );
}
