import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api';
import { AuthProvider } from '@/lib/auth';

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
      <AuthProvider>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </AuthProvider>
      <Toaster position="top-right" mobileOffset={16} richColors={false} />
    </QueryClientProvider>
  );
}
