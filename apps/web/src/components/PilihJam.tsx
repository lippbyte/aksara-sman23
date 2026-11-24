import { CheckCircleIcon } from '@phosphor-icons/react';
import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface InfoJamTampil {
  mapel?: string;
  tersimpan?: boolean;
}

interface PilihJamProps {
  /** Nama grup untuk pembaca layar bila tidak ada `aria-labelledby`. */
  label: string;
  opsi: readonly number[];
  nilai: number;
  onUbah: (jam: number) => void;
  info?: ReadonlyMap<number, InfoJamTampil>;
  disabled?: boolean;
  className?: string;
  'aria-labelledby'?: string;
}

/**
 * Pemilih jam pelajaran: deret chip yang bisa digulir ke samping, berperilaku seperti radio
 * group (panah kiri/kanan, Home/End). Tiap chip menampilkan mapel terjadwal (petunjuk) dan
 * tanda bila absensi jam itu sudah tersimpan. Tepi memudar saat masih ada chip di luar layar
 * (`.gulir-samping`, modern-web-guidance scrollability-affordance-hints).
 */
export function PilihJam({
  label,
  opsi,
  nilai,
  onUbah,
  info,
  disabled = false,
  className,
  ...aria
}: PilihJamProps) {
  const wadah = useRef<HTMLDivElement>(null);
  const indeksAktif = opsi.indexOf(nilai);

  // Chip terpilih selalu terlihat. Gulir wadahnya sendiri secara horizontal, bukan
  // `scrollIntoView`, agar halaman tidak ikut melompat secara vertikal.
  useLayoutEffect(() => {
    const el = wadah.current;
    const chip = el?.querySelectorAll<HTMLElement>('[role="radio"]')[indeksAktif];
    if (!el || !chip) return;
    // Wadah `relative` → offsetLeft chip diukur dari tepi kiri isi wadah.
    const target = chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2;
    const halus = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof el.scrollTo === 'function') {
      el.scrollTo({ left: Math.max(0, target), behavior: halus ? 'smooth' : 'auto' });
    }
  }, [indeksAktif]);

  function tekan(e: KeyboardEvent<HTMLDivElement>) {
    let tujuan: number | null = null;
    const dari = indeksAktif === -1 ? 0 : indeksAktif;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') tujuan = (dari + 1) % opsi.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      tujuan = (dari - 1 + opsi.length) % opsi.length;
    else if (e.key === 'Home') tujuan = 0;
    else if (e.key === 'End') tujuan = opsi.length - 1;
    if (tujuan === null || opsi.length === 0) return;
    e.preventDefault();
    const pilihan = opsi[tujuan];
    if (pilihan === undefined) return;
    onUbah(pilihan);
    wadah.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[tujuan]?.focus();
  }

  return (
    <div
      ref={wadah}
      role="radiogroup"
      aria-label={aria['aria-labelledby'] ? undefined : label}
      aria-labelledby={aria['aria-labelledby']}
      onKeyDown={tekan}
      // p-1 (+ -m-1 agar sejajar): ruang 4 px untuk cincin fokus (outline 2 px + offset 2 px),
      // yang kalau tidak akan terpotong oleh wadah gulir.
      className={cn('gulir-samping relative -m-1 flex gap-1.5 p-1', className)}
    >
      {opsi.map((jam, i) => {
        const terpilih = jam === nilai;
        const { mapel, tersimpan } = info?.get(jam) ?? {};
        return (
          <button
            key={jam}
            type="button"
            role="radio"
            aria-checked={terpilih}
            aria-label={`Jam ke-${jam}${mapel ? `, ${mapel}` : ''}${tersimpan ? ', sudah tersimpan' : ''}`}
            title={mapel}
            disabled={disabled}
            tabIndex={terpilih || (indeksAktif === -1 && i === 0) ? 0 : -1}
            onClick={() => onUbah(jam)}
            className={cn(
              'tombol-tekan flex h-12 w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-kontrol border px-1 disabled:cursor-not-allowed disabled:opacity-60 pointer-fine:h-11',
              terpilih
                ? 'border-primary bg-primary text-on-primary'
                : 'border-line-kontrol bg-surface text-ink hover:border-accent',
            )}
          >
            <span
              aria-hidden="true"
              className="flex items-center gap-1 text-sm font-semibold tabular-nums"
            >
              {jam}
              {tersimpan && (
                <CheckCircleIcon
                  weight="fill"
                  className={cn('size-3.5', terpilih ? 'text-on-primary' : 'text-hadir')}
                />
              )}
            </span>
            <span
              aria-hidden="true"
              className={cn(
                'w-full truncate text-center text-2xs',
                terpilih ? 'text-on-primary' : 'text-ink-muted',
              )}
            >
              {mapel ?? '–'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
