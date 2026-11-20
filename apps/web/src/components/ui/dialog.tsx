import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  judul: string;
  deskripsi?: string;
  children: ReactNode;
  className?: string;
  /** Di ponsel (<640 px) membuka layar penuh (mis. form Pengaturan, DESIGN §11.5). */
  layarPenuhMobile?: boolean;
}

/** Dialog modal; di ponsel menempel di bawah layar agar mudah dijangkau. */
export function Dialog({
  open,
  onOpenChange,
  judul,
  deskripsi,
  children,
  className,
  layarPenuhMobile = false,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="overlay-animasi fixed inset-0 z-50 bg-overlay backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-describedby={deskripsi ? undefined : undefined}
          className={cn(
            'dialog-animasi lembar-bawah-animasi fixed z-50 flex w-full flex-col border border-line bg-surface shadow-md sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[90dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl',
            layarPenuhMobile
              ? 'inset-0 max-h-dvh rounded-none border-0 sm:border'
              : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)] sm:pb-0',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-sm font-semibold text-ink">
                {judul}
              </DialogPrimitive.Title>
              {deskripsi ? (
                <DialogPrimitive.Description className="mt-0.5 text-xs text-ink-muted">
                  {deskripsi}
                </DialogPrimitive.Description>
              ) : (
                <DialogPrimitive.Description className="sr-only">
                  {judul}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Tutup"
              className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Baris tombol di bawah form dialog. */
export function DialogAksi({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  judul: string;
  /** Sebutkan apa yang terkena (DESIGN §6). */
  pesan: ReactNode;
  labelSetuju: string;
  berbahaya?: boolean;
  memproses?: boolean;
  onSetuju: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  judul,
  pesan,
  labelSetuju,
  berbahaya = false,
  memproses = false,
  onSetuju,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} judul={judul}>
      <div className="text-sm text-ink-muted">{pesan}</div>
      <DialogAksi>
        <Button variant="secondary" size="touch" onClick={() => onOpenChange(false)}>
          Batal
        </Button>
        <Button
          variant={berbahaya ? 'danger' : 'primary'}
          size="touch"
          loading={memproses}
          onClick={onSetuju}
        >
          {labelSetuju}
        </Button>
      </DialogAksi>
    </Dialog>
  );
}
