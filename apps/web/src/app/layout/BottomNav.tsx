import { ROLE_LABEL } from '@sms/shared';
import { CircleHelp, Ellipsis, Info, LogOut, UserRound, X } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { toast } from 'sonner';
import { useAuth, useKeluar } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { barBawahUntuk, HALAMAN_PENGGUNA } from '../nav';

/** Mendeteksi papan ketik virtual terbuka di ponsel agar bar bawah tidak menutupi isian (DESIGN §11.2). */
function usePapanKetikTerbuka(): boolean {
  const [terbuka, setTerbuka] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const periksa = () => {
      const aktif = document.activeElement;
      const fokusIsian =
        aktif instanceof HTMLInputElement ||
        aktif instanceof HTMLTextAreaElement ||
        aktif instanceof HTMLSelectElement;
      const menyusut = window.innerHeight - vv.height > 150;
      setTerbuka(fokusIsian && menyusut);
    };

    const tutup = () => setTerbuka(false);

    vv.addEventListener('resize', periksa);
    window.addEventListener('focusin', periksa);
    window.addEventListener('focusout', tutup);
    return () => {
      vv.removeEventListener('resize', periksa);
      window.removeEventListener('focusin', periksa);
      window.removeEventListener('focusout', tutup);
    };
  }, []);

  return terbuka;
}

/** Bar navigasi bawah mobile (<1024 px) beserta lembar "Lainnya" / "Akun" (DESIGN §11.2). */
export function BottomNav() {
  const { user } = useAuth();
  const keluar = useKeluar();
  const { pathname } = useLocation();
  const [lembarBuka, setLembarBuka] = useState(false);
  const papanKetikTerbuka = usePapanKetikTerbuka();
  const awalSentuhY = useRef<number | null>(null);
  const [geserY, setGeserY] = useState(0);

  if (!user) return null;

  const { utama, lainnya, labelSlotLima } = barBawahUntuk(user.role);
  const jalurLembar = [...lainnya.map((i) => i.path), ...HALAMAN_PENGGUNA.map((h) => h.path)];
  const slotLimaAktif = jalurLembar.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const mulaiGeser = (y: number) => {
    awalSentuhY.current = y;
  };
  const gerakGeser = (y: number) => {
    if (awalSentuhY.current === null) return;
    const selisih = y - awalSentuhY.current;
    if (selisih > 0) setGeserY(Math.min(selisih, 160));
  };
  const akhirGeser = () => {
    if (geserY > 72) setLembarBuka(false);
    awalSentuhY.current = null;
    setGeserY(0);
  };

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-sm transition-transform duration-200 lg:hidden',
          'pb-[env(safe-area-inset-bottom,0px)]',
          papanKetikTerbuka && 'pointer-events-none translate-y-full',
        )}
      >
        <ul className="grid h-14 grid-cols-5 items-stretch">
          {utama.map((item) => (
            <li key={item.path} className="flex min-w-0">
              <NavLink
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  cn(
                    'group flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-2xs font-medium transition-colors duration-150',
                    isActive ? 'text-accent' : 'text-ink-muted hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200',
                        isActive ? 'bg-accent-soft text-accent' : 'bg-transparent',
                      )}
                    >
                      <item.icon className="size-[22px] shrink-0" aria-hidden="true" />
                    </span>
                    <span className="max-w-full truncate leading-none">{item.labelPendek}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}

          <li className="flex min-w-0">
            <button
              type="button"
              onClick={() => setLembarBuka(true)}
              aria-expanded={lembarBuka}
              aria-haspopup="dialog"
              className={cn(
                'flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-2xs font-medium transition-colors duration-150',
                slotLimaAktif || lembarBuka ? 'text-accent' : 'text-ink-muted hover:text-ink',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200',
                  slotLimaAktif || lembarBuka ? 'bg-accent-soft text-accent' : 'bg-transparent',
                )}
              >
                {labelSlotLima === 'Akun' ? (
                  <UserRound className="size-[22px] shrink-0" aria-hidden="true" />
                ) : (
                  <Ellipsis className="size-[22px] shrink-0" aria-hidden="true" />
                )}
              </span>
              <span className="max-w-full truncate leading-none">{labelSlotLima}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Dialog.Root
        open={lembarBuka}
        onOpenChange={(buka) => {
          setLembarBuka(buka);
          if (!buka) setGeserY(0);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="overlay-animasi fixed inset-0 z-50 bg-overlay backdrop-blur-sm lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            style={geserY > 0 ? { transform: `translateY(${geserY}px)` } : undefined}
            className="dialog-animasi lembar-bawah-animasi fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-md lg:hidden"
          >
            {/* Pegangan geser ke bawah untuk menutup lembar */}
            <div
              onTouchStart={(e) => mulaiGeser(e.touches[0]?.clientY ?? 0)}
              onTouchMove={(e) => gerakGeser(e.touches[0]?.clientY ?? 0)}
              onTouchEnd={akhirGeser}
              className="flex flex-col items-center pt-2.5 pb-1"
            >
              <span className="h-1 w-10 rounded-full bg-line" aria-hidden="true" />
            </div>

            <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
              <div className="min-w-0">
                <Dialog.Title className="text-sm font-semibold text-ink">
                  {labelSlotLima === 'Lainnya' ? 'Menu lainnya' : 'Akun & informasi'}
                </Dialog.Title>
                <p className="truncate text-xs text-ink-subtle">
                  {user.name} · {ROLE_LABEL[user.role]}
                  {user.nama_kelas ? ` · ${user.nama_kelas}` : ''}
                </p>
              </div>
              <Dialog.Close
                aria-label="Tutup menu lainnya"
                className="-mr-2 flex size-11 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-ink"
              >
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <div className="overflow-y-auto px-3 py-3">
              {lainnya.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 px-2 text-2xs font-semibold tracking-wider text-ink-subtle uppercase">
                    Menu lain
                  </p>
                  <ul className="flex flex-col gap-1">
                    {lainnya.map((item) => (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          onClick={() => setLembarBuka(false)}
                          className={({ isActive }) =>
                            cn(
                              'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150',
                              isActive
                                ? 'bg-accent-soft text-accent'
                                : 'text-ink-muted hover:bg-app hover:text-ink',
                            )
                          }
                        >
                          <item.icon className="size-5 shrink-0" aria-hidden="true" />
                          <span>{item.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="mb-1.5 px-2 text-2xs font-semibold tracking-wider text-ink-subtle uppercase">
                  Akun
                </p>
                <ul className="flex flex-col gap-1">
                  <li>
                    <Link
                      to="/profil"
                      onClick={() => setLembarBuka(false)}
                      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-muted hover:bg-app hover:text-ink"
                    >
                      <UserRound className="size-5 shrink-0" aria-hidden="true" />
                      Profil
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/bantuan"
                      onClick={() => setLembarBuka(false)}
                      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-muted hover:bg-app hover:text-ink"
                    >
                      <CircleHelp className="size-5 shrink-0" aria-hidden="true" />
                      Bantuan
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/tentang"
                      onClick={() => setLembarBuka(false)}
                      className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-ink-muted hover:bg-app hover:text-ink"
                    >
                      <Info className="size-5 shrink-0" aria-hidden="true" />
                      Tentang
                    </Link>
                  </li>
                </ul>
              </div>

              <div className="mt-3 border-t border-line-soft pt-3">
                <button
                  type="button"
                  disabled={keluar.isPending}
                  onClick={() => {
                    setLembarBuka(false);
                    keluar.mutate(undefined, {
                      onSuccess: () => toast.success('Anda sudah keluar.'),
                    });
                  }}
                  className="tombol-tekan flex min-h-11 w-full items-center gap-3 rounded-lg bg-app px-3 text-sm font-medium text-ink-muted hover:bg-tidak-hadir-soft hover:text-tidak-hadir disabled:opacity-60"
                >
                  <LogOut className="size-5 shrink-0" aria-hidden="true" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
