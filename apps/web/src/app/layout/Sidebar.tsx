import { SignOutIcon } from '@phosphor-icons/react';
import { NavLink } from 'react-router';
import { toast } from 'sonner';
import { LogoSekolah } from '@/components/GambarSekolah';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth, useKeluar } from '@/lib/auth';
import { APP_BRAND, APP_NAME } from '@/lib/config';
import { cn } from '@/lib/utils';
import { menuBergrupUntuk, type NavItem } from '../nav';

interface SidebarContentProps {
  collapsed?: boolean;
  /** Dipanggil setelah memilih menu (menutup laci di ponsel). */
  onNavigate?: () => void;
}

export function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  const { user, sekolah } = useAuth();
  const grup = user ? menuBergrupUntuk(user.role) : [];

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-3 border-b border-line px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <LogoSekolah url={sekolah?.logo_url} namaSekolah={sekolah?.nama_sekolah} ukuran={36} />
        {!collapsed && (
          <div className="min-w-0">
            <p
              title={APP_NAME}
              translate="no"
              className="truncate text-sm leading-tight font-bold tracking-tight text-ink"
            >
              {APP_BRAND}
            </p>
            <p className="mt-0.5 truncate text-xs text-ink-subtle">
              {sekolah?.nama_sekolah || 'Sistem Sekolah'}
            </p>
          </div>
        )}
      </div>

      <nav aria-label="Menu utama" className="gulir-stabil flex-1 overflow-y-auto px-3 py-2">
        {grup.map((g, i) => (
          <div
            key={g.grup}
            className={cn('py-2', i > 0 && collapsed && 'border-t border-line-soft')}
          >
            {!collapsed && (
              <p
                id={`grup-menu-${g.grup}`}
                className="mb-1 px-3 text-xs font-semibold text-ink-subtle"
              >
                {g.label}
              </p>
            )}
            <ul
              aria-labelledby={collapsed ? undefined : `grup-menu-${g.grup}`}
              aria-label={collapsed ? g.label : undefined}
              className="flex flex-col gap-0.5"
            >
              {g.item.map((item) => (
                <li key={item.path}>
                  <TautanMenu item={item} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        <KeluarButton collapsed={collapsed} />
      </div>
    </div>
  );
}

function TautanMenu({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'tombol-tekan relative flex h-10 items-center gap-3 rounded-kontrol px-3 text-sm transition-colors duration-150',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-accent-soft font-semibold text-accent ring-1 ring-accent/15 ring-inset'
            : 'font-medium text-ink-muted hover:bg-subtle hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {/* Ikon aktif ber-weight `fill`: penanda bentuk, bukan hanya warna (AGENTS §13). */}
          <item.icon
            weight={isActive ? 'fill' : 'regular'}
            className="size-5 shrink-0"
            aria-hidden="true"
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function KeluarButton({ collapsed }: { collapsed: boolean }) {
  const keluar = useKeluar();
  const tombol = (
    <button
      type="button"
      disabled={keluar.isPending}
      onClick={() =>
        keluar.mutate(undefined, { onSuccess: () => toast.success('Anda sudah keluar.') })
      }
      aria-label={collapsed ? 'Keluar' : undefined}
      className={cn(
        'tombol-tekan flex h-10 w-full items-center gap-3 rounded-kontrol bg-subtle/80 px-3 text-sm font-medium text-ink-muted hover:bg-tidak-hadir-soft hover:text-tidak-hadir disabled:opacity-60',
        collapsed && 'justify-center px-0',
      )}
    >
      <SignOutIcon className="size-5 shrink-0" aria-hidden="true" />
      {!collapsed && <span>Keluar</span>}
    </button>
  );
  if (!collapsed) return tombol;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{tombol}</TooltipTrigger>
      <TooltipContent side="right">Keluar</TooltipContent>
    </Tooltip>
  );
}
