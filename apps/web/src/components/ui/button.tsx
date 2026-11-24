import { cva, type VariantProps } from 'class-variance-authority';
import { CircleNotchIcon } from '@phosphor-icons/react';
import { Slot } from 'radix-ui';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/utils';

/*
 * Ukuran mengikuti alat masuk, bukan lebar layar (modern-web-guidance `form-factor-adaptation`):
 * layar sentuh (pointer kasar) mendapat target 44 px, tetikus (pointer halus) tetap ringkas 36 px.
 */
const buttonVariants = cva(
  'tombol-tekan inline-flex shrink-0 items-center justify-center gap-2 rounded-kontrol text-sm font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        /** Aksi utama: satu per area. */
        primary: 'bg-primary text-on-primary shadow-xs hover:bg-primary-hover',
        /** Aksi kedua (Batal, Ekspor). */
        secondary: 'border border-line bg-surface text-ink hover:border-accent/40 hover:bg-app',
        /** Aksi tersier: tanpa bingkai (Lihat semua, ikon di baris tabel). */
        ghost: 'text-ink-muted hover:bg-subtle hover:text-ink',
        /** Aksi merusak (Hapus). */
        danger: 'bg-danger text-on-primary shadow-xs hover:bg-danger-hover',
      },
      size: {
        sm: 'h-8 px-2.5 text-xs pointer-coarse:h-11 [&_svg]:size-3.5',
        md: 'h-11 px-4 pointer-fine:h-9 pointer-fine:px-3.5',
        /** Sama dengan `md`; dipertahankan untuk pemanggil lama. */
        touch: 'h-11 px-4 pointer-fine:h-9 pointer-fine:px-3.5',
        /** Tombol ikon: wajib `aria-label`. */
        icon: 'size-11 pointer-fine:size-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <CircleNotchIcon className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
