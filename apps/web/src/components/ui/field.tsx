import { CircleAlert } from 'lucide-react';
import { cloneElement, useId, type ReactElement } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  /** Teks bantuan di bawah input. */
  bantuan?: string;
  galat?: string;
  wajib?: boolean;
  className?: string;
  /** Satu elemen input; `id` dan atribut aria dipasang otomatis. */
  children: ReactElement<{
    id?: string;
    'aria-invalid'?: boolean;
    'aria-describedby'?: string;
  }>;
}

/** Label di atas input, bantuan di bawah, galat dengan ikon (DESIGN §6 Form). */
export function Field({ label, bantuan, galat, wajib, className, children }: FieldProps) {
  const id = useId();
  const idBantuan = `${id}-bantuan`;
  const idGalat = `${id}-galat`;
  const deskripsi = [galat ? idGalat : null, bantuan ? idBantuan : null].filter(Boolean).join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {wajib && (
          <span className="text-tidak-hadir" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {cloneElement(children, {
        id,
        'aria-invalid': galat ? true : undefined,
        'aria-describedby': deskripsi || undefined,
      })}
      {bantuan && (
        <p id={idBantuan} className="text-xs text-ink-subtle">
          {bantuan}
        </p>
      )}
      {galat && (
        <p id={idGalat} role="alert" className="flex items-start gap-1 text-xs text-tidak-hadir">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {galat}
        </p>
      )}
    </div>
  );
}
