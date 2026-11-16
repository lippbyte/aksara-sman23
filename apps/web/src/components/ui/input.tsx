import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const dasar =
  'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors duration-200 placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-subtle disabled:text-ink-muted aria-[invalid=true]:border-danger sm:h-9';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input type={type} className={cn(dasar, className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea rows={rows} className={cn(dasar, 'h-auto py-2 sm:h-auto', className)} {...props} />
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
      className={cn('size-4 shrink-0 rounded border-line accent-primary', className)}
      {...props}
    />
  );
}
