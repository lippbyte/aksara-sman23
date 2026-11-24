import { IconContext } from '@phosphor-icons/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';

/** Bawaan ikon Phosphor (AGENTS §13): satu weight utama `regular`; ukuran tetap diatur per kelas. */
const IKON_BAWAAN = { weight: 'regular', size: 20 } as const;

export function buatQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Galat 4xx (tidak berhak, tidak ditemukan, validasi) tidak perlu diulang.
        retry: (jumlahGagal, err) =>
          !(err instanceof ApiError && err.status >= 400 && err.status < 500) && jumlahGagal < 1,
      },
    },
  });
}

export function Providers({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? buatQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <IconContext.Provider value={IKON_BAWAAN}>
        <AuthProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </AuthProvider>
        <Toaster position="top-right" mobileOffset={{ top: 56, bottom: 72 }} richColors={false} />
      </IconContext.Provider>
    </QueryClientProvider>
  );
}
