import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { nadaStatus, type NadaStatus } from './StatusBadge';

export interface OpsiSegmen<T extends string | number> {
  nilai: T;
  label: string;
  nada?: NadaStatus;
}

interface SegmentedStatusProps<T extends string | number> {
  /** Nama kelompok untuk pembaca layar (dipakai bila tidak ada `aria-labelledby`). */
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
  'aria-labelledby'?: string;
  'aria-required'?: boolean;
}

/*
 * Pilihan terpilih memakai isi pekat + teks putih + tanda centang: bedanya terang-gelap dan
 * bentuk, bukan hanya rona warna (WCAG 1.4.1). Yang tidak terpilih berbingkai >= 3:1 (WCAG 1.4.11).
 */
const TERPILIH: Record<NadaStatus, string> = {
  hadir: 'border-hadir bg-hadir text-on-primary',
  mendampingi: 'border-mendampingi bg-mendampingi text-on-primary',
  'tidak-hadir': 'border-tidak-hadir bg-tidak-hadir text-on-primary',
  izin: 'border-izin bg-izin text-on-primary',
  sakit: 'border-sakit bg-sakit text-on-primary',
  info: 'border-info bg-info text-on-primary',
  peringatan: 'border-peringatan bg-peringatan text-on-primary',
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
      aria-label={aria['aria-labelledby'] ? undefined : label}
      aria-labelledby={aria['aria-labelledby']}
      aria-describedby={aria['aria-describedby']}
      aria-invalid={aria['aria-invalid']}
      aria-required={aria['aria-required']}
      onKeyDown={tekan}
      // Kontainer kueri: ukuran teks dan centang mengikuti lebar grup ini sendiri, bukan lebar
      // layar, karena grup yang sama dipakai di baris daftar sempit maupun dialog lebar.
      // Tanpa dukungan container query: teks ringkas tanpa centang (isi pekat tetap penanda).
      className={cn('@container flex gap-1.5', className)}
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
              'tombol-tekan flex min-w-0 flex-1 items-center justify-center gap-1 rounded-kontrol border px-1.5 disabled:cursor-not-allowed disabled:opacity-60',
              ringkas
                ? 'h-11 text-xs pointer-fine:h-9'
                : // Tiga pilihan atau lebih (mis. "Mendampingi") mengecil di grup sempit agar tidak terpotong.
                  cn('h-11 text-sm', opsi.length >= 3 && '@max-[22rem]:text-xs'),
              terpilih
                ? cn('font-semibold', TERPILIH[o.nada ?? nadaStatus(String(o.nilai))])
                : 'border-line-kontrol bg-surface font-medium text-ink-muted hover:border-accent hover:text-ink',
            )}
          >
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
