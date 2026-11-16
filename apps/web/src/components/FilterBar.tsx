import { RotateCcw } from 'lucide-react';
import { useCallback, useId, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

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

  const adaFilter = kunci.some((k) => nilai[k] !== '');
  return { nilai, atur, page, aturPage, reset, adaFilter };
}

interface FilterBarProps {
  children: ReactNode;
  onReset?: () => void;
  adaFilter?: boolean;
  className?: string;
}

export function FilterBar({ children, onReset, adaFilter = true, className }: FilterBarProps) {
  return (
    <div
      role="search"
      aria-label="Filter"
      className={cn(
        'mb-3 flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-end',
        className,
      )}
    >
      {children}
      {onReset && (
        <Button variant="ghost" size="touch" onClick={onReset} disabled={!adaFilter}>
          <RotateCcw aria-hidden="true" />
          Reset
        </Button>
      )}
    </div>
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
      <label
        htmlFor={id}
        className="text-2xs font-semibold tracking-wider text-ink-subtle uppercase"
      >
        {label}
      </label>
      {children(id)}
    </div>
  );
}
