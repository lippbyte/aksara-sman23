import { ROLE_LABEL } from '@sms/shared';
import { ChevronDown, CircleHelp, Info, LogOut, UserRound } from 'lucide-react';
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
import { judulHalaman } from '../nav';

/** Header aplikasi: h-12 di mobile (tanpa hamburger, DESIGN §11.2), h-14 di desktop. */
export function Header() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const keluar = useKeluar();

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 sm:px-6 lg:h-14">
      <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-ink lg:text-xl">
        {judulHalaman(pathname)}
      </h1>

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Menu pengguna"
          className="flex h-11 max-w-[55vw] items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink-muted hover:bg-subtle hover:text-ink sm:h-9"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-subtle">
            <UserRound className="size-4" aria-hidden="true" />
          </span>
          <span className="hidden truncate sm:inline">{user?.name ?? 'Pengguna'}</span>
          <ChevronDown className="size-4 shrink-0 text-icon-muted" aria-hidden="true" />
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
              <UserRound aria-hidden="true" />
              Profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/bantuan">
              <CircleHelp aria-hidden="true" />
              Bantuan
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/tentang">
              <Info aria-hidden="true" />
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
            <LogOut aria-hidden="true" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
