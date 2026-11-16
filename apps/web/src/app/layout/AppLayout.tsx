import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useCallback, useState } from 'react';
import { Outlet } from 'react-router';
import { PENGEMBANG, STATUS_PRODUK } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Header } from './Header';
import { SidebarContent } from './Sidebar';

const KUNCI_LIPAT = 'sms.sidebar.terlipat';

function bacaStatusLipat(): boolean {
  try {
    return window.localStorage.getItem(KUNCI_LIPAT) === '1';
  } catch {
    return false;
  }
}

export function AppLayout() {
  const [terlipat, setTerlipat] = useState(bacaStatusLipat);
  const [laciTerbuka, setLaciTerbuka] = useState(false);

  const ubahLipat = useCallback(() => {
    setTerlipat((lama) => {
      const baru = !lama;
      try {
        window.localStorage.setItem(KUNCI_LIPAT, baru ? '1' : '0');
      } catch {
        // Preferensi tidak tersimpan (mode privat); tata letak tetap berfungsi.
      }
      return baru;
    });
  }, []);

  return (
    <div className="flex min-h-dvh bg-app text-ink">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-on-primary"
      >
        Lewati ke konten
      </a>

      {/* Sidebar desktop */}
      <aside
        className={cn(
          'sticky top-0 z-40 hidden h-dvh shrink-0 border-r border-line bg-surface transition-[width] duration-200 lg:block',
          terlipat ? 'w-16' : 'w-60',
        )}
      >
        <SidebarContent collapsed={terlipat} />
        <button
          type="button"
          onClick={ubahLipat}
          aria-label={terlipat ? 'Lebarkan sidebar' : 'Lipat sidebar'}
          aria-expanded={!terlipat}
          className="absolute top-[42px] -right-3 flex size-6 items-center justify-center rounded-full border border-line bg-surface text-ink-muted shadow-sm hover:text-ink"
        >
          {terlipat ? (
            <ChevronRight className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </aside>

      {/* Laci ponsel dan tablet (<1024 px) */}
      <Dialog.Root open={laciTerbuka} onOpenChange={setLaciTerbuka}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-sm lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 w-60 max-w-[85vw] border-r border-line bg-surface shadow-md lg:hidden"
          >
            <Dialog.Title className="sr-only">Menu utama</Dialog.Title>
            <SidebarContent onNavigate={() => setLaciTerbuka(false)} />
            <Dialog.Close
              aria-label="Tutup menu"
              className="absolute top-1.5 right-1.5 flex size-11 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink"
            >
              <X className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onBukaMenu={() => setLaciTerbuka(true)} />
        <main id="konten" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
        <footer className="border-t border-line px-4 py-3 text-center text-xs text-ink-subtle sm:px-6">
          Dikembangkan oleh {PENGEMBANG} · {STATUS_PRODUK}
        </footer>
      </div>
    </div>
  );
}
