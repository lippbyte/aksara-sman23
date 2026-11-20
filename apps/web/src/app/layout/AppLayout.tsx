import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { PENGEMBANG, STATUS_PRODUK } from '@/lib/config';
import { cn } from '@/lib/utils';
import { BottomNav } from './BottomNav';
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
  const { pathname } = useLocation();

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

      {/* Sidebar desktop (>=1024 px) */}
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

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main
          id="konten"
          className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 lg:py-6"
        >
          <div key={pathname} className="halaman-masuk">
            <Outlet />
          </div>
        </main>
        <footer className="border-t border-line px-4 py-3 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] text-center text-xs text-ink-subtle sm:px-6 lg:pb-3">
          Dikembangkan oleh {PENGEMBANG} · {STATUS_PRODUK}
        </footer>
      </div>

      {/* Bar navigasi bawah mobile (<1024 px) */}
      <BottomNav />
    </div>
  );
}
