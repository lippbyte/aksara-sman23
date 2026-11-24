import { ROLE_LABEL } from '@sms/shared';
import {
  CaretDownIcon,
  InfoIcon,
  QuestionIcon,
  SignOutIcon,
  UserIcon,
} from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, useKeluar } from '@/lib/auth';
import { APP_BRAND } from '@/lib/config';
import { inisialNama } from '@/lib/utils';
import { judulHalaman } from '../nav';

/**
 * Header aplikasi: min 56 px di mobile (tanpa hamburger, DESIGN §11.2), 64 px di desktop.
 * Menu akun hanya di desktop; di bawah 1024 px akun ada di lembar bar bawah agar tidak ganda.
 */
export function Header() {
  const { pathname } = useLocation();
  const { user, sekolah } = useAuth();
  const keluar = useKeluar();
  const ref = useRef<HTMLElement>(null);

  // Tinggi sebenarnya → --tinggi-header, dipakai judul grup lekat dan scroll-padding-top.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const akar = document.documentElement;
    const amati = new ResizeObserver(() => {
      akar.style.setProperty('--tinggi-header', `${el.offsetHeight}px`);
    });
    amati.observe(el);
    return () => {
      amati.disconnect();
      akar.style.removeProperty('--tinggi-header');
    };
  }, []);

  return (
    <header
      ref={ref}
      className="bar-kaca sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-3 border-b border-line px-4 py-2 sm:px-6 lg:min-h-16 lg:px-8"
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-lg leading-tight font-bold tracking-tight text-ink lg:text-xl">
          {judulHalaman(pathname)}
        </h1>
        {sekolah && (
          <p className="mt-0.5 hidden truncate text-xs text-ink-subtle sm:block">
            <span translate="no">{APP_BRAND}</span>
            {` · ${sekolah.nama_sekolah} (${sekolah.tahun_ajaran})`}
          </p>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Menu pengguna"
          className="tombol-tekan hidden h-10 max-w-64 items-center gap-2 rounded-kontrol px-2 text-sm font-medium text-ink-muted hover:bg-subtle hover:text-ink lg:flex"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
            {inisialNama(user?.name)}
          </span>
          <span className="hidden truncate text-left sm:inline">{user?.name ?? 'Pengguna'}</span>
          <CaretDownIcon className="size-4 shrink-0 text-icon-muted" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user && (
            <>
              <DropdownMenuLabel>
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                <p className="text-xs text-ink-subtle">
                  {ROLE_LABEL[user.role]}
                  {user.nama_kelas ? ` · ${user.nama_kelas}` : ''}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link to="/profil">
              <UserIcon aria-hidden="true" />
              Profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/bantuan">
              <QuestionIcon aria-hidden="true" />
              Bantuan
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/tentang">
              <InfoIcon aria-hidden="true" />
              Tentang
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={keluar.isPending}
            onSelect={() =>
              keluar.mutate(undefined, { onSuccess: () => toast.success('Anda sudah keluar.') })
            }
          >
            <SignOutIcon aria-hidden="true" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
