import { cn } from '@/lib/utils';

/**
 * Nada visual. Status data (hadir…sakit) dipakai hanya untuk statusnya sendiri; `info` dan
 * `peringatan` untuk tingkat/umpan balik. Violet `mendampingi` khusus status Mendampingi.
 */
export type NadaStatus =
  'hadir' | 'mendampingi' | 'tidak-hadir' | 'izin' | 'sakit' | 'info' | 'peringatan' | 'netral';

const KELAS_NADA: Record<NadaStatus, { lencana: string; titik: string }> = {
  hadir: { lencana: 'bg-hadir-soft text-hadir', titik: 'bg-hadir-chart' },
  mendampingi: { lencana: 'bg-mendampingi-soft text-mendampingi', titik: 'bg-mendampingi-chart' },
  'tidak-hadir': { lencana: 'bg-tidak-hadir-soft text-tidak-hadir', titik: 'bg-tidak-hadir-chart' },
  izin: { lencana: 'bg-izin-soft text-izin', titik: 'bg-izin-chart' },
  sakit: { lencana: 'bg-sakit-soft text-sakit', titik: 'bg-sakit-chart' },
  info: { lencana: 'bg-info-soft text-info', titik: 'bg-accent' },
  peringatan: { lencana: 'bg-peringatan-soft text-peringatan', titik: 'bg-peringatan-garis' },
  netral: { lencana: 'bg-netral-soft text-netral', titik: 'bg-icon-muted' },
};

/** Warna semantik per nilai status (DESIGN §2); konsisten di semua halaman. */
const NADA: Record<string, NadaStatus> = {
  // Kehadiran guru
  Hadir: 'hadir',
  Mendampingi: 'mendampingi',
  'Tidak Hadir': 'tidak-hadir',
  // Kehadiran siswa
  hadir: 'hadir',
  izin: 'izin',
  sakit: 'sakit',
  alpa: 'tidak-hadir',
  // Tugas
  Ada: 'netral',
  'Tidak Ada': 'tidak-hadir',
  // Status data master dan akun
  aktif: 'hadir',
  tidak_aktif: 'netral',
  // Predikat kinerja dan MGMP (tingkat, bukan status kehadiran)
  'Sangat Baik': 'hadir',
  Baik: 'info',
  Cukup: 'peringatan',
  Kurang: 'tidak-hadir',
  'Sangat Aktif': 'hadir',
  Aktif: 'info',
  'Cukup Aktif': 'peringatan',
  'Kurang Aktif': 'tidak-hadir',
};

const LABEL: Record<string, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  alpa: 'Alpa',
  aktif: 'Aktif',
  tidak_aktif: 'Tidak aktif',
};

export function nadaStatus(status: string): NadaStatus {
  return NADA[status] ?? 'netral';
}

interface StatusBadgeProps {
  status: string;
  /** Teks yang ditampilkan bila berbeda dari nilai status. */
  label?: string;
  nada?: NadaStatus;
  className?: string;
}

/** Lencana status: titik warna + teks (warna tidak pernah berdiri sendiri). */
export function StatusBadge({ status, label, nada, className }: StatusBadgeProps) {
  const k = KELAS_NADA[nada ?? nadaStatus(status)];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-2xs font-semibold whitespace-nowrap ring-1 ring-current/15 ring-inset',
        k.lencana,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', k.titik)} aria-hidden="true" />
      {label ?? LABEL[status] ?? status}
    </span>
  );
}
