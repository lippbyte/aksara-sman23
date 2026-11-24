import { ROLE_LABEL } from '@sms/shared';
import {
  DotsThreeIcon,
  InfoIcon,
  QuestionIcon,
  SignOutIcon,
  UserIcon,
  XIcon,
} from '@phosphor-icons/react';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { toast } from 'sonner';
import { useAuth, useKeluar } from '@/lib/auth';
import { cn, inisialNama } from '@/lib/utils';
import { barBawahUntuk, HALAMAN_PENGGUNA } from '../nav';

/** Mendeteksi papan ketik virtual terbuka di ponsel agar bar bawah tidak menutupi isian (DESIGN §11.2). */
function usePapanKetikTerbuka(): boolean {
  const [terbuka, setTerbuka] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const html = document.documentElement;
    // Atribut di <html> mengubah --tinggi-bar-bawah menjadi 0 (index.css), sehingga bar simpan
    // lekat turun ke tepi layar saat bar bawah disembunyikan.
    const atur = (nilai: boolean) => {
      setTerbuka(nilai);
      if (nilai) html.setAttribute('data-papan-ketik', '');
      else html.removeAttribute('data-papan-ketik');
    };

    const periksa = () => {
      const aktif = document.activeElement;
      const fokusIsian =
        aktif instanceof HTMLInputElement ||
        aktif instanceof HTMLTextAreaElement ||
        aktif instanceof HTMLSelectElement;
      const menyusut = window.innerHeight - vv.height > 150;
      atur(fokusIsian && menyusut);
    };

    const tutup = () => atur(false);

    vv.addEventListener('resize', periksa);
    window.addEventListener('focusin', periksa);
    window.addEventListener('focusout', tutup);
    return () => {
      vv.removeEventListener('resize', periksa);
      window.removeEventListener('focusin', periksa);
      window.removeEventListener('focusout', tutup);
      html.removeAttribute('data-papan-ketik');
    };
  }, []);

  return terbuka;
}

/** Rubber-band apple-design: makin jauh melewati batas, makin kecil gerakannya. */
function karetBatas(lewat: number, dimensi: number, konstanta = 0.55): number {
  return (lewat * dimensi * konstanta) / (dimensi + konstanta * Math.abs(lewat));
}

/** Bar navigasi bawah mobile (<1024 px) beserta lembar "Lainnya" / "Akun" (DESIGN §11.2). */
export function BottomNav() {
  const { user } = useAuth();
  const keluar = useKeluar();
  const { pathname } = useLocation();
  const [lembarBuka, setLembarBuka] = useState(false);
  const papanKetikTerbuka = usePapanKetikTerbuka();
  const pemicuRef = useRef<HTMLButtonElement>(null);
  const awalPointerY = useRef<number | null>(null);
  const pointerIdAktif = useRef<number | null>(null);
  const [geserY, setGeserY] = useState(0);
  const [sedangGeser, setSedangGeser] = useState(false);
  /** Beberapa posisi terakhir untuk menghitung kecepatan saat jari dilepas. */
  const jejak = useRef<{ y: number; t: number }[]>([]);

  if (!user) return null;

  const { utama, lainnya, labelSlotLima } = barBawahUntuk(user.role);
  const jalurLembar = [...lainnya.map((i) => i.path), ...HALAMAN_PENGGUNA.map((h) => h.path)];
  const slotLimaAktif = jalurLembar.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const mulaiGeser = (e: React.PointerEvent<HTMLDivElement>) => {
    awalPointerY.current = e.clientY;
    pointerIdAktif.current = e.pointerId;
    jejak.current = [{ y: e.clientY, t: e.timeStamp }];
    setSedangGeser(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const gerakGeser = (e: React.PointerEvent<HTMLDivElement>) => {
    if (awalPointerY.current === null || pointerIdAktif.current !== e.pointerId) return;
    const selisih = e.clientY - awalPointerY.current;
    jejak.current = [...jejak.current.slice(-4), { y: e.clientY, t: e.timeStamp }];
    // Ke bawah mengikuti jari 1:1; ke atas melawan makin kuat (rubber-band 0.55, AGENTS §13).
    setGeserY(selisih > 0 ? selisih : -karetBatas(-selisih, 320));
  };
  const akhirGeser = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdAktif.current !== e.pointerId) return;
    // Tutup bila ditarik cukup jauh, atau dikibas ke bawah (kecepatan lepas > 0,5 px/ms).
    const awal = jejak.current[0];
    const akhir = jejak.current.at(-1);
    const kecepatan =
      awal && akhir && akhir.t > awal.t ? (akhir.y - awal.y) / (akhir.t - awal.t) : 0;
    if (geserY > 72 || (geserY > 12 && kecepatan > 0.5)) setLembarBuka(false);
    awalPointerY.current = null;
    pointerIdAktif.current = null;
    jejak.current = [];
    setSedangGeser(false);
    setGeserY(0);
  };

  return (
    <Dialog.Root
      open={lembarBuka}
      onOpenChange={(buka) => {
        setLembarBuka(buka);
        if (!buka) setGeserY(0);
      }}
    >
      <nav
        aria-label="Navigasi utama"
        className={cn(
          'bar-kaca fixed inset-x-0 bottom-0 z-40 border-t border-line transition-transform duration-200 lg:hidden',
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
                    'group flex min-h-12 min-w-12 flex-1 flex-col items-center justify-start gap-0.5 px-0.5 pt-1 text-2xs font-medium transition-colors duration-150',
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
                      <item.icon
                        weight={isActive ? 'fill' : 'regular'}
                        className="size-5.5 shrink-0"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="max-w-full line-clamp-2 text-center leading-none">
                      {item.labelPendek}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}

          <li className="flex min-w-0">
            <Dialog.Trigger asChild>
              <button
                ref={pemicuRef}
                type="button"
                aria-expanded={lembarBuka}
                aria-haspopup="dialog"
                className={cn(
                  'flex min-h-12 min-w-12 flex-1 flex-col items-center justify-start gap-0.5 px-0.5 pt-1 text-2xs font-medium transition-colors duration-150',
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
                    <UserIcon
                      weight={slotLimaAktif || lembarBuka ? 'fill' : 'regular'}
                      className="size-5.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <DotsThreeIcon
                      weight={slotLimaAktif || lembarBuka ? 'fill' : 'regular'}
                      className="size-5.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="max-w-full line-clamp-2 text-center leading-none">
                  {labelSlotLima}
                </span>
              </button>
            </Dialog.Trigger>
          </li>
        </ul>
      </nav>

      <Dialog.Portal>
        <Dialog.Overlay className="overlay-animasi fixed inset-0 z-50 bg-overlay backdrop-blur-sm lg:hidden" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            pemicuRef.current?.focus();
          }}
          style={{
            transform: geserY !== 0 ? `translateY(${geserY}px)` : undefined,
            transition: sedangGeser ? 'none' : undefined,
          }}
          className="dialog-animasi lembar-bawah-animasi fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-lembar border-t border-line bg-surface pb-[env(safe-area-inset-bottom,0px)] shadow-[var(--shadow-popover)] lg:hidden"
        >
          {/* Pegangan geser ke bawah untuk menutup lembar (Pointer Events + setPointerCapture 1:1) */}
          <div
            onPointerDown={mulaiGeser}
            onPointerMove={gerakGeser}
            onPointerUp={akhirGeser}
            onPointerCancel={akhirGeser}
            className="flex touch-none flex-col items-center pt-3 pb-1.5"
          >
            <span className="h-1 w-10 rounded-full bg-line" aria-hidden="true" />
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-2.5">
            {/* Satu-satunya tempat akun di mobile: identitas pengguna tampil jelas di kepala lembar. */}
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent"
              >
                {inisialNama(user.name)}
              </span>
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold text-ink">
                  {labelSlotLima === 'Lainnya' ? 'Menu lainnya' : 'Akun & informasi'}
                </Dialog.Title>
                <p className="text-xs text-ink-muted">
                  {user.name} · {ROLE_LABEL[user.role]}
                  {user.nama_kelas ? ` · ${user.nama_kelas}` : ''}
                </p>
              </div>
            </div>
            <Dialog.Close
              aria-label="Tutup menu"
              className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-kontrol text-ink-muted hover:bg-subtle hover:text-ink"
            >
              <XIcon className="size-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto overscroll-contain px-3 py-3">
            {lainnya.length > 0 && (
              <div className="mb-3">
                <p className="mb-1.5 px-2 text-xs font-semibold text-ink-subtle">Menu lain</p>
                <ul className="flex flex-col gap-1">
                  {lainnya.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        onClick={() => setLembarBuka(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex min-h-11 items-center gap-3 rounded-kontrol px-3 text-sm font-medium transition-colors duration-150',
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
              <p className="mb-1.5 px-2 text-xs font-semibold text-ink-subtle">Akun</p>
              <ul className="flex flex-col gap-1">
                <li>
                  <Link
                    to="/profil"
                    onClick={() => setLembarBuka(false)}
                    className="flex min-h-11 items-center gap-3 rounded-kontrol px-3 text-sm font-medium text-ink-muted hover:bg-app hover:text-ink"
                  >
                    <UserIcon className="size-5 shrink-0" aria-hidden="true" />
                    Profil
                  </Link>
                </li>
                <li>
                  <Link
                    to="/bantuan"
                    onClick={() => setLembarBuka(false)}
                    className="flex min-h-11 items-center gap-3 rounded-kontrol px-3 text-sm font-medium text-ink-muted hover:bg-app hover:text-ink"
                  >
                    <QuestionIcon className="size-5 shrink-0" aria-hidden="true" />
                    Bantuan
                  </Link>
                </li>
                <li>
                  <Link
                    to="/tentang"
                    onClick={() => setLembarBuka(false)}
                    className="flex min-h-11 items-center gap-3 rounded-kontrol px-3 text-sm font-medium text-ink-muted hover:bg-app hover:text-ink"
                  >
                    <InfoIcon className="size-5 shrink-0" aria-hidden="true" />
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
                className="tombol-tekan flex min-h-11 w-full items-center gap-3 rounded-kontrol bg-app px-3 text-sm font-medium text-ink-muted hover:bg-tidak-hadir-soft hover:text-tidak-hadir disabled:opacity-60"
              >
                <SignOutIcon className="size-5 shrink-0" aria-hidden="true" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
