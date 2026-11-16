import type {
  LoginInput,
  PenggunaSesi,
  Respons,
  Role,
  SekolahRingkas,
  SesiSaya,
} from '@sms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { api, ApiError, PERISTIWA_SESI_BERAKHIR } from './api';

export const KUNCI_SESI = ['auth', 'me'] as const;

interface NilaiAuth {
  /** `memuat` sampai pemeriksaan sesi pertama selesai. */
  status: 'memuat' | 'masuk' | 'tamu';
  user: PenggunaSesi | null;
  sekolah: SekolahRingkas | null;
  bolehPeran: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<NilaiAuth | null>(null);

async function ambilSesi(): Promise<SesiSaya | null> {
  try {
    return (await api.get<Respons<SesiSaya>>('/auth/me')).data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const sesi = useQuery({ queryKey: KUNCI_SESI, queryFn: ambilSesi, staleTime: 5 * 60_000 });

  // Sesi berakhir di tengah pemakaian (401 dari rute mana pun) → kembali ke halaman masuk.
  useEffect(() => {
    const tangani = () => queryClient.setQueryData(KUNCI_SESI, null);
    window.addEventListener(PERISTIWA_SESI_BERAKHIR, tangani);
    return () => window.removeEventListener(PERISTIWA_SESI_BERAKHIR, tangani);
  }, [queryClient]);

  const nilai = useMemo<NilaiAuth>(() => {
    const user = sesi.data?.user ?? null;
    return {
      status: sesi.isPending ? 'memuat' : user ? 'masuk' : 'tamu',
      user,
      sekolah: sesi.data?.sekolah ?? null,
      bolehPeran: (...roles) => user !== null && roles.includes(user.role),
    };
  }, [sesi.data, sesi.isPending]);

  return <AuthContext.Provider value={nilai}>{children}</AuthContext.Provider>;
}

export function useAuth(): NilaiAuth {
  const nilai = useContext(AuthContext);
  if (!nilai) throw new Error('useAuth harus dipakai di dalam AuthProvider.');
  return nilai;
}

/** Pengguna yang dijamin sudah masuk (dipakai di dalam rute terlindung). */
export function usePengguna(): PenggunaSesi {
  const { user } = useAuth();
  if (!user) throw new Error('Halaman ini membutuhkan pengguna yang sudah masuk.');
  return user;
}

/**
 * Ganti sesi di cache: query sesi DIPERBARUI (bukan dibuang) agar `AuthProvider` yang
 * sedang mengamatinya ikut berubah; data lain dibuang supaya data pengguna sebelumnya
 * tidak tersisa. (`queryClient.clear()` membuang query sesi yang sedang diamati, sehingga
 * provider tetap melihat status lama → login terpental kembali ke /masuk.)
 */
function gantiSesi(queryClient: ReturnType<typeof useQueryClient>, sesi: SesiSaya | null) {
  queryClient.removeQueries({
    predicate: (q) => JSON.stringify(q.queryKey) !== JSON.stringify(KUNCI_SESI),
  });
  queryClient.setQueryData(KUNCI_SESI, sesi);
}

export function useMasuk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<Respons<SesiSaya>>('/auth/login', input),
    onSuccess: (res) => gantiSesi(queryClient, res.data),
  });
}

export function useKeluar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    // Data pengguna sebelumnya tidak boleh tersisa di cache.
    onSettled: () => gantiSesi(queryClient, null),
  });
}
