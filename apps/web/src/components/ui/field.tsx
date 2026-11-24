import { WarningCircleIcon } from '@phosphor-icons/react';
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Atribut yang dipasang `Field` ke kontrolnya. */
export interface AtributIsian {
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
}

/** Untuk kontrol kustom (mis. grup pilihan): diberi juga id label untuk `aria-labelledby`. */
export interface AtributGrup extends AtributIsian {
  'aria-labelledby': string;
}

interface FieldProps {
  label: string;
  /** Teks bantuan di bawah input. */
  bantuan?: string;
  galat?: string;
  wajib?: boolean;
  className?: string;
  /**
   * Satu elemen input bawaan (`id` dan atribut aria dipasang otomatis), atau fungsi untuk
   * kontrol kustom seperti `SegmentedStatus` di dalam `Controller`.
   */
  children: ReactElement<Partial<AtributIsian>> | ((atribut: AtributGrup) => ReactNode);
}

/** Label di atas input, bantuan di bawah, galat dengan ikon (DESIGN §6 Form). */
export function Field({ label, bantuan, galat, wajib, className, children }: FieldProps) {
  const id = useId();
  const idLabel = `${id}-label`;
  const idBantuan = `${id}-bantuan`;
  const idGalat = `${id}-galat`;
  const deskripsi = [galat ? idGalat : null, bantuan ? idBantuan : null].filter(Boolean).join(' ');
  const atribut: AtributIsian = {
    id,
    'aria-invalid': galat ? true : undefined,
    'aria-describedby': deskripsi || undefined,
    // Tanda * hanya visual; status wajib diumumkan ke pembaca layar lewat aria-required.
    'aria-required': wajib || undefined,
  };
  const kustom = typeof children === 'function';

  const isiLabel = (
    <>
      {label}
      {wajib && (
        <span className="text-tidak-hadir" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </>
  );

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {kustom ? (
        // Grup kontrol tidak bisa dihubungkan lewat `for`; dinamai lewat aria-labelledby.
        <span id={idLabel} className="text-sm font-medium text-ink">
          {isiLabel}
        </span>
      ) : (
        <label id={idLabel} htmlFor={id} className="text-sm font-medium text-ink">
          {isiLabel}
        </label>
      )}
      {kustom
        ? children({ ...atribut, 'aria-labelledby': idLabel })
        : isValidElement(children) && cloneElement(children, atribut)}
      {bantuan && (
        <p id={idBantuan} className="text-xs text-ink-subtle">
          {bantuan}
        </p>
      )}
      {galat && (
        <p id={idGalat} role="alert" className="flex items-start gap-1 text-xs text-tidak-hadir">
          <WarningCircleIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {galat}
        </p>
      )}
    </div>
  );
}
