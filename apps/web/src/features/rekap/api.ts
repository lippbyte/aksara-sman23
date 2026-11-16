import type {
  Halaman,
  HasilSyncRekap,
  PekanRekap,
  PekanTersedia,
  PratinjauSyncRekap,
  Rekap,
  Respons,
  SyncRekapForm,
  UbahRekapInput,
} from '@sms/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '@/lib/api';

type Param = Record<string, string | number | null | undefined>;

export function usePekanRekap() {
  return useQuery({
    queryKey: ['rekap', 'pekan'],
    queryFn: async () => (await api.get<Respons<PekanTersedia[]>>('/rekap-kehadiran/pekan')).data,
  });
}

export function useMapelRekap() {
  return useQuery({
    queryKey: ['rekap', 'mapel'],
    queryFn: async () => (await api.get<Respons<string[]>>('/rekap-kehadiran/mapel')).data,
    staleTime: 5 * 60_000,
  });
}

export function useDaftarRekap(params: Param, aktif: boolean) {
  return useQuery({
    queryKey: ['rekap', 'daftar', params],
    queryFn: () => api.get<Halaman<Rekap>>(`/rekap-kehadiran${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled: aktif,
  });
}

function useSegarkan() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['rekap'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

/** Jumlah baris terkoreksi manual pada pekan itu; dipakai dialog konfirmasi sinkron. */
export function usePratinjauSinkron(pekan: PekanRekap | null) {
  return useQuery({
    queryKey: ['rekap', 'pratinjau', pekan],
    queryFn: async () =>
      (
        await api.get<Respons<PratinjauSyncRekap>>(
          `/rekap-kehadiran/sync/pratinjau${qs({ minggu_ke: pekan?.minggu_ke, tahun: pekan?.tahun })}`,
        )
      ).data,
    enabled: pekan !== null,
    staleTime: 0,
  });
}

export function useSinkronRekap() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (data: SyncRekapForm) =>
      api.post<Respons<HasilSyncRekap>>('/rekap-kehadiran/sync', data),
    onSuccess: segarkan,
  });
}

export function useUbahRekap() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UbahRekapInput }) =>
      api.put<Respons<Rekap>>(`/rekap-kehadiran/${id}`, data),
    onSuccess: segarkan,
  });
}

export function useHapusRekap() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rekap-kehadiran/${id}`),
    onSuccess: segarkan,
  });
}

export function urlEksporRekap(params: Param): string {
  return `/api/v1/rekap-kehadiran/export${qs(params)}`;
}
