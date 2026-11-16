import type { Role } from '@sms/shared';
import { ShieldX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';

/** Hanya untuk pengguna yang sudah masuk; selain itu diarahkan ke halaman masuk. */
export function PerluMasuk({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const lokasi = useLocation();

  if (status === 'memuat') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-app p-6" role="status">
        <span className="sr-only">Memeriksa sesi…</span>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>
    );
  }
  if (status === 'tamu') {
    const dari = lokasi.pathname === '/' ? undefined : lokasi.pathname + lokasi.search;
    return <Navigate to="/masuk" replace state={dari ? { dari } : undefined} />;
  }
  return <>{children}</>;
}

/**
 * Cermin matriks akses di UI: halaman hanya dirender untuk peran yang berhak.
 * Pengaman sebenarnya tetap di server.
 */
export function PerluPeran({ roles, children }: { roles: readonly Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <EmptyState
        icon={ShieldX}
        pesan="Peran Anda tidak memiliki akses ke halaman ini."
        aksi={
          <Button asChild variant="secondary">
            <Link to="/">Kembali ke Dashboard</Link>
          </Button>
        }
      />
    );
  }
  return <>{children}</>;
}
