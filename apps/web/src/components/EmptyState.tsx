import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  /** Satu kalimat. */
  pesan: string;
  aksi?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, pesan, aksi, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-12 text-center',
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-subtle">
        <Icon className="size-5 text-icon-muted" aria-hidden="true" />
      </span>
      <p className="text-sm text-ink-muted">{pesan}</p>
      {aksi}
    </div>
  );
}
