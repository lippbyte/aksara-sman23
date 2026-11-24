import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { useState, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/*
 * Batas `line-kontrol` >= 3:1 terhadap putih agar isian terlihat sebagai kontrol (WCAG 1.4.11).
 * Tinggi 44 px di layar sentuh, 36 px untuk tetikus.
 */
const dasar =
  'isian-kontrol h-11 w-full rounded-kontrol border border-line-kontrol bg-surface px-3 text-sm text-ink transition-colors duration-150 placeholder:text-ink-subtle hover:border-accent disabled:cursor-not-allowed disabled:border-line disabled:bg-subtle disabled:text-ink-muted aria-[invalid=true]:border-danger pointer-fine:h-9';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input type={type} className={cn(dasar, className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={rows}
      className={cn(dasar, 'h-auto py-2 pointer-fine:h-auto', className)}
      {...props}
    />
  );
}

/** Select bawaan peramban: ringan dan nyaman di ponsel. */
export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(dasar, 'pr-8', className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cn('size-4 shrink-0 rounded border-line-kontrol accent-primary', className)}
      {...props}
    />
  );
}

/** Input kata sandi dengan tombol tampil/sembunyikan yang meneruskan id & aria langsung ke input. */
export function InputSandi({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [tampil, setTampil] = useState(false);
  return (
    <div className="relative">
      <input
        type={tampil ? 'text' : 'password'}
        className={cn(dasar, 'pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setTampil((v) => !v)}
        aria-pressed={tampil}
        aria-label={tampil ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-kontrol text-ink-subtle transition-colors hover:text-ink pointer-fine:w-9"
      >
        {tampil ? (
          <EyeSlashIcon className="size-4.5" aria-hidden="true" />
        ) : (
          <EyeIcon className="size-4.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
