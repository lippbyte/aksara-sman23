import { ArrowCounterClockwiseIcon, SlidersHorizontalIcon } from '@phosphor-icons/react';
import { useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Dialog, DialogAksi } from './ui/dialog';

/**
 * Nilai filter disimpan di URL query (DESIGN §6 FilterBar), sehingga bisa dibagikan,
 * di-bookmark, dan tetap ada setelah muat ulang. Mengubah filter mengembalikan ke halaman 1.
 */
export function useFilterUrl<K extends string>(kunci: readonly K[]) {
  const [params, setParams] = useSearchParams();

  const nilai = useMemo(() => {
    const hasil = {} as Record<K, string>;
    for (const k of kunci) hasil[k] = params.get(k) ?? '';
    return hasil;
    // `kunci` adalah daftar tetap per halaman.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const page = Math.max(1, Number(params.get('page')) || 1);

  const atur = useCallback(
    (k: K, v: string) => {
      setParams(
        (lama) => {
          const baru = new URLSearchParams(lama);
          if (v) baru.set(k, v);
          else baru.delete(k);
          baru.delete('page');
          return baru;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const aturPage = useCallback(
    (p: number) => {
      setParams((lama) => {
        const baru = new URLSearchParams(lama);
        if (p > 1) baru.set('page', String(p));
        else baru.delete('page');
        return baru;
      });
    },
    [setParams],
  );

  const reset = useCallback(() => {
    setParams(
      (lama) => {
        const baru = new URLSearchParams(lama);
        for (const k of kunci) baru.delete(k);
        baru.delete('page');
        return baru;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setParams]);

  const jumlahAktif = kunci.filter((k) => nilai[k] !== '').length;
  const adaFilter = jumlahAktif > 0;
  return { nilai, atur, page, aturPage, reset, adaFilter, jumlahAktif };
}

interface FilterBarProps {
  children: ReactNode;
  onReset?: () => void;
  adaFilter?: boolean;
  /** Jumlah filter aktif untuk lencana tombol Filter di mobile. */
  jumlahAktif?: number;
  /** Tombol aksi sejajar kanan di dalam baris filter (mis. Ekspor CSV, Tambah, Sinkron). */
  aksi?: ReactNode;
  /** Di mobile (<768 px), pindahkan isian filter ke lembar bawah (DESIGN §11.5). */
  lembarMobile?: boolean;
  className?: string;
}

export function FilterBar({
  children,
  onReset,
  adaFilter = true,
  jumlahAktif,
  aksi,
  lembarMobile = false,
  className,
}: FilterBarProps) {
  const [lembarBuka, setLembarBuka] = useState(false);

  const isiKontrol = (
    <>
      {children}
      {onReset && (
        <Button variant="ghost" size="touch" onClick={onReset} disabled={!adaFilter}>
          <ArrowCounterClockwiseIcon aria-hidden="true" />
          Reset
        </Button>
      )}
    </>
  );

  if (!lembarMobile) {
    return (
      <div
        role="search"
        aria-label="Filter"
        className={cn(
          'mb-3 flex flex-col gap-3 rounded-kartu border border-line bg-surface p-3.5 shadow-[var(--shadow-card)] sm:flex-row sm:flex-wrap sm:items-end',
          className,
        )}
      >
        {isiKontrol}
        {aksi && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{aksi}</div>}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          'mb-3 flex flex-wrap items-start gap-3 rounded-kartu border border-line bg-surface p-3.5 shadow-[var(--shadow-card)] md:items-end',
          className,
        )}
      >
        {/* Mobile (<768 px): tombol buka lembar bawah filter */}
        <div className="flex items-center md:hidden">
          <Button
            variant="secondary"
            size="touch"
            onClick={() => setLembarBuka(true)}
            aria-expanded={lembarBuka}
          >
            <SlidersHorizontalIcon aria-hidden="true" />
            Filter
            {typeof jumlahAktif === 'number' && jumlahAktif > 0 && (
              <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-2xs font-semibold text-accent tabular-nums">
                {jumlahAktif}
              </span>
            )}
          </Button>
        </div>

        {/* Desktop & tablet (>=768 px): baris filter sebaris */}
        <div role="search" aria-label="Filter" className="hidden flex-wrap items-end gap-3 md:flex">
          {isiKontrol}
        </div>

        {/* Aksi dirender satu kali, sejajar kanan. Di ponsel mengisi sisa baris di samping
            tombol Filter dan baru membungkus bila tidak muat (bukan satu tombol per baris). */}
        {aksi && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2 md:ml-auto md:flex-none">
            {aksi}
          </div>
        )}
      </div>

      {/* Lembar bawah filter hanya dirender saat terbuka agar label tidak ganda di DOM */}
      {lembarBuka && (
        <Dialog
          open
          onOpenChange={setLembarBuka}
          judul="Filter data"
          deskripsi="Pilihan langsung diterapkan pada daftar."
        >
          <div className="flex flex-col gap-3">{children}</div>
          <DialogAksi>
            {onReset && (
              <Button
                variant="secondary"
                disabled={!adaFilter}
                onClick={() => {
                  onReset();
                  setLembarBuka(false);
                }}
              >
                <ArrowCounterClockwiseIcon aria-hidden="true" />
                Reset
              </Button>
            )}
            {/* Filter sudah berlaku saat dipilih; tombol ini hanya kembali ke daftar. */}
            <Button onClick={() => setLembarBuka(false)}>Lihat hasil</Button>
          </DialogAksi>
        </Dialog>
      )}
    </>
  );
}

interface FilterItemProps {
  label: string;
  className?: string;
  children: (id: string) => ReactNode;
}

export function FilterItem({ label, className, children }: FilterItemProps) {
  const id = useId();
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 sm:w-44', className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink-muted">
        {label}
      </label>
      {children(id)}
    </div>
  );
}
