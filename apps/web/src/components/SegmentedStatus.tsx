import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { nadaStatus, type NadaStatus } from './StatusBadge';

export interface OpsiSegmen<T extends string | number> {
  nilai: T;
  label: string;
  nada?: NadaStatus;
}

interface SegmentedStatusProps<T extends string | number> {
  /** Nama kelompok untuk pembaca layar. */
  label: string;
  opsi: readonly OpsiSegmen<T>[];
  nilai: T | null;
  onUbah: (nilai: T) => void;
  disabled?: boolean;
  /** Tampilan ringkas untuk baris daftar (mis. absensi siswa). */
  ringkas?: boolean;
  className?: string;
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

const TERPILIH: Record<NadaStatus, string> = {
  hadir: 'border-hadir bg-hadir-soft text-hadir',
  mendampingi: 'border-mendampingi bg-mendampingi-soft text-mendampingi',
  'tidak-hadir': 'border-tidak-hadir bg-tidak-hadir-soft text-tidak-hadir',
  izin: 'border-izin bg-izin-soft text-izin',
  sakit: 'border-sakit bg-sakit-soft text-sakit',
  netral: 'border-primary bg-primary text-on-primary',
};

/**
 * Pilihan status dengan tombol bersebelahan (DESIGN §6): lebih cepat dari dropdown di ponsel.
 * Berperilaku seperti radio group: panah kiri/kanan berpindah pilihan.
 */
export function SegmentedStatus<T extends string | number>({
  label,
  opsi,
  nilai,
  onUbah,
  disabled = false,
  ringkas = false,
  className,
  id,
  ...aria
}: SegmentedStatusProps<T>) {
  const wadah = useRef<HTMLDivElement>(null);
  const indeksAktif = opsi.findIndex((o) => o.nilai === nilai);

  function tekan(e: KeyboardEvent<HTMLDivElement>) {
    const arah =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (arah === 0 || opsi.length === 0) return;
    e.preventDefault();
    const dari = indeksAktif === -1 ? 0 : indeksAktif;
    const tujuan = (dari + arah + opsi.length) % opsi.length;
    const pilihan = opsi[tujuan];
    if (!pilihan) return;
    onUbah(pilihan.nilai);
    wadah.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[tujuan]?.focus();
  }

  return (
    <div
      ref={wadah}
      id={id}
      role="radiogroup"
      aria-label={label}
      aria-describedby={aria['aria-describedby']}
      aria-invalid={aria['aria-invalid']}
      onKeyDown={tekan}
      className={cn('flex gap-1.5', className)}
    >
      {opsi.map((o, i) => {
        const terpilih = o.nilai === nilai;
        return (
          <button
            key={String(o.nilai)}
            type="button"
            role="radio"
            aria-checked={terpilih}
            disabled={disabled}
            // Hanya satu tombol yang masuk urutan Tab, seperti radio group bawaan.
            tabIndex={terpilih || (indeksAktif === -1 && i === 0) ? 0 : -1}
            onClick={() => onUbah(o.nilai)}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-center rounded-lg border font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60',
              ringkas ? 'h-11 px-1.5 text-xs sm:h-9' : 'h-11 px-2 text-sm',
              terpilih
                ? TERPILIH[o.nada ?? nadaStatus(String(o.nilai))]
                : 'border-line bg-surface text-ink-muted hover:bg-app hover:text-ink',
            )}
          >
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
