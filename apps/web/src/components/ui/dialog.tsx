import { XIcon } from '@phosphor-icons/react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface KonteksDialog {
  /** Menutup dialog lewat penjaga perubahan (sama dengan Esc, ketuk latar, dan tombol X). */
  mintaTutup: () => void;
}

const KonteksDialog = createContext<KonteksDialog | null>(null);

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  judul: string;
  deskripsi?: string;
  children: ReactNode;
  className?: string;
  /** Di ponsel (<640 px) membuka layar penuh (mis. form Pengaturan, DESIGN §11.5). */
  layarPenuhMobile?: boolean;
  /**
   * Form berisi perubahan yang belum disimpan. Selama `true`, menutup dialog (Esc, ketuk latar,
   * X, atau `DialogBatal`) meminta konfirmasi lebih dulu (modern-web-guidance `dialog`).
   */
  kotor?: boolean;
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
  kotor = false,
}: DialogProps) {
  const [tanyaBuang, setTanyaBuang] = useState(false);

  // Radix hanya mengembalikan fokus ke `Dialog.Trigger`; dialog di aplikasi ini dibuka dari
  // tombol biasa, sehingga tanpa ini fokus jatuh ke <body> saat ditutup (QA Fase 6, papan ketik).
  // Efek layout berjalan sebelum Radix memindahkan fokus ke dalam dialog, jadi yang tercatat
  // adalah pemicunya.
  const pemicu = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) {
      pemicu.current = document.activeElement;
    }
  }, [open]);

  const mintaTutup = useCallback(() => {
    if (kotor) setTanyaBuang(true);
    else onOpenChange(false);
  }, [kotor, onOpenChange]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(buka) => (buka ? onOpenChange(true) : mintaTutup())}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="overlay-animasi fixed inset-0 z-50 bg-overlay backdrop-blur-sm" />
        <DialogPrimitive.Content
          // Tanpa deskripsi, nyatakan eksplisit agar Radix tidak menautkan ke elemen kosong.
          {...(deskripsi ? {} : { 'aria-describedby': undefined })}
          onCloseAutoFocus={(e) => {
            const el = pemicu.current;
            if (el?.isConnected) {
              e.preventDefault();
              el.focus({ preventScroll: true });
            }
          }}
          className={cn(
            // overflow-hidden: bar aksi lekat (sudut siku) tidak menyembul di luar sudut membulat.
            'dialog-animasi lembar-bawah-animasi fixed z-50 flex w-full flex-col overflow-hidden border border-line bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-[var(--shadow-popover)] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:max-h-[90dvh] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lembar sm:pb-0',
            layarPenuhMobile
              ? 'inset-0 max-h-dvh rounded-none border-0 sm:border'
              : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-lembar',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
            <div className="min-w-0 pt-1">
              <DialogPrimitive.Title className="text-base font-semibold text-ink">
                {judul}
              </DialogPrimitive.Title>
              {deskripsi && (
                <DialogPrimitive.Description className="mt-0.5 text-xs text-ink-muted">
                  {deskripsi}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Tutup"
              className="tombol-tekan -mr-2 flex size-11 shrink-0 items-center justify-center rounded-kontrol text-ink-muted hover:bg-subtle hover:text-ink pointer-fine:size-9"
            >
              <XIcon className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>
          <div className="gulir-stabil overflow-y-auto px-4 py-4 sm:px-5">
            <KonteksDialog.Provider value={{ mintaTutup }}>{children}</KonteksDialog.Provider>
          </div>

          {tanyaBuang && (
            <ConfirmDialog
              open
              onOpenChange={(buka) => !buka && setTanyaBuang(false)}
              judul="Buang perubahan?"
              pesan="Isian yang belum disimpan pada formulir ini akan hilang."
              labelBatal="Lanjut mengisi"
              labelSetuju="Buang perubahan"
              berbahaya
              onSetuju={() => {
                setTanyaBuang(false);
                onOpenChange(false);
              }}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/**
 * Baris tombol di bawah form dialog. Lekat di bawah area gulir agar tombol simpan selalu
 * terlihat, termasuk saat papan ketik ponsel terbuka (DESIGN §11.2).
 */
export function DialogAksi({ children }: { children: ReactNode }) {
  return (
    // `-bottom-4` menutup padding bawah wadah gulir (py-4): sticky menempel di tepi konten,
    // jadi tanpa ini isian form terlihat di celah 16 px di bawah bar aksi.
    <div className="sticky -bottom-4 z-10 -mx-4 mt-5 -mb-4 flex gap-2 border-t border-line-soft bg-surface px-4 py-3 *:flex-1 sm:-mx-5 sm:justify-end sm:px-5 sm:*:flex-none">
      {children}
    </div>
  );
}

/** Tombol Batal yang melewati penjaga perubahan dialog. */
export function DialogBatal({
  label = 'Batal',
  autoFocus,
}: {
  label?: string;
  autoFocus?: boolean;
}) {
  const konteks = useContext(KonteksDialog);
  return (
    <Button variant="secondary" autoFocus={autoFocus} onClick={() => konteks?.mintaTutup()}>
      {label}
    </Button>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  judul: string;
  /** Sebutkan apa yang terkena (DESIGN §6). */
  pesan: ReactNode;
  labelSetuju: string;
  labelBatal?: string;
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
  labelBatal = 'Batal',
  berbahaya = false,
  memproses = false,
  onSetuju,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} judul={judul}>
      <div className="text-sm text-ink-muted">{pesan}</div>
      <DialogAksi>
        {/* Aksi aman di kiri dan mendapat fokus awal untuk aksi berbahaya. */}
        <DialogBatal label={labelBatal} autoFocus={berbahaya} />
        <Button variant={berbahaya ? 'danger' : 'primary'} loading={memproses} onClick={onSetuju}>
          {labelSetuju}
        </Button>
      </DialogAksi>
    </Dialog>
  );
}
