import type {
  DashboardKelas,
  Halaman,
  JadwalHari,
  Kehadiran,
  KehadiranInput,
  Respons,
} from '@sms/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '@/lib/api';

type Param = Record<string, string | number | undefined>;

export function useDaftarKehadiran(params: Param) {
  return useQuery({
    queryKey: ['kehadiran', 'daftar', params],
    queryFn: () => api.get<Halaman<Kehadiran>>(`/kehadiran${qs(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** Mengambil jadwal kelas pada tanggal tertentu (dipakai pemilih jadwal & riwayat). */
export async function ambilJadwalHari(
  kelasId: number | null,
  tanggal: string,
): Promise<JadwalHari[]> {
  return (
    await api.get<Respons<JadwalHari[]>>(`/kehadiran/jadwal${qs({ kelas_id: kelasId, tanggal })}`)
  ).data;
}

/** Jadwal kelas pada tanggal itu; untuk sekretaris `kelasId` boleh kosong (dari akunnya). */
export function useJadwalHari(kelasId: number | null, tanggal: string, aktif: boolean) {
  return useQuery({
    queryKey: ['kehadiran', 'jadwal', kelasId, tanggal],
    queryFn: () => ambilJadwalHari(kelasId, tanggal),
    enabled: aktif && tanggal !== '',
  });
}

export function useDashboardKelas(kelasId: number, params: Param) {
  return useQuery({
    queryKey: ['dashboard', 'kelas', kelasId, params],
    queryFn: async () =>
      (await api.get<Respons<DashboardKelas>>(`/dashboard/kelas/${kelasId}${qs(params)}`)).data,
    placeholderData: keepPreviousData,
  });
}

/** Perubahan kehadiran memengaruhi daftar, jadwal, dashboard, dan rekap. */
function useSegarkan() {
  const queryClient = useQueryClient();
  return () => {
    for (const kunci of ['kehadiran', 'dashboard', 'rekap']) {
      void queryClient.invalidateQueries({ queryKey: [kunci] });
    }
  };
}

export function useSimpanKehadiran(id: number | null) {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (data: KehadiranInput) =>
      id === null
        ? api.post<Respons<Kehadiran>>('/kehadiran', data)
        : api.put<Respons<Kehadiran>>(`/kehadiran/${id}`, data),
    onSuccess: segarkan,
  });
}

export function useHapusKehadiran() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/kehadiran/${id}`),
    onSuccess: segarkan,
  });
}
