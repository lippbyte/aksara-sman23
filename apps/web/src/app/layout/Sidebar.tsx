import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import logoSman23 from '@/images/logo.png';
import { useAuth, useKeluar } from '@/lib/auth';
import { APP_NAME } from '@/lib/config';
import { cn } from '@/lib/utils';
import { menuUntuk } from '../nav';

interface SidebarContentProps {
  collapsed?: boolean;
  /** Dipanggil setelah memilih menu (menutup laci di ponsel). */
  onNavigate?: () => void;
}

export function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  const { user, sekolah } = useAuth();
  const menu = user ? menuUntuk(user.role) : [];

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <img
          src={sekolah?.logo_url || logoSman23}
          alt="Logo SMAN 23"
          className="size-8 shrink-0 rounded-lg object-contain"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm leading-tight font-semibold text-ink">{APP_NAME}</p>
            {sekolah && (
              <p className="truncate text-2xs font-semibold tracking-wider text-ink-subtle uppercase">
                SMAN 23 Bandung
              </p>
            )}
          </div>
        )}
      </div>

      <nav aria-label="Menu utama" className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {menu.map((item) => {
            const link = (
              <NavLink
                to={item.path}
                end={item.path === '/'}
                onClick={onNavigate}
                aria-label={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all duration-200',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-primary text-on-primary shadow-md'
                      : 'text-ink-muted hover:bg-app hover:text-ink',
                  )
                }
              >
                <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
            return (
              <li key={item.path}>
                {collapsed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  link
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        <KeluarButton collapsed={collapsed} />
      </div>
    </div>
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
        'flex h-10 w-full items-center gap-3 rounded-lg bg-app px-3 text-sm font-medium text-ink-muted transition-all duration-200 hover:bg-tidak-hadir-soft hover:text-tidak-hadir disabled:opacity-60',
        collapsed && 'justify-center px-0',
      )}
    >
      <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
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
