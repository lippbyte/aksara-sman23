import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cn('rounded-xl border border-line bg-surface', className)} {...props} />
  );
}

interface CardHeaderProps {
  judul: string;
  keterangan?: string;
  aksi?: ReactNode;
  className?: string;
}

export function CardHeader({ judul, keterangan, aksi, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-4 py-3 sm:px-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{judul}</h2>
        {keterangan && <p className="mt-0.5 text-xs text-ink-subtle">{keterangan}</p>}
      </div>
      {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-4 sm:p-5', className)} {...props} />;
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-subtle', className)}
      {...props}
    />
  );
}
