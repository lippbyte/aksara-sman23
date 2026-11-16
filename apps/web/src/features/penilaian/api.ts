import type {
  DaftarPenilaian,
  HasilSyncPenilaian,
  PenilaianKinerjaBaris,
  PenilaianMgmpBaris,
  Periode,
  Respons,
  SimpanPenilaianKinerjaInput,
  SimpanPenilaianMgmpInput,
  SimpanSkorSiswaMgmpInput,
  SkorSiswaKelasBaris,
  SkorSiswaMgmpQuery,
} from '@sms/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '@/lib/api';

export function useDaftarKinerja(params: Periode & { page: number; q?: string }) {
  return useQuery({
    queryKey: ['penilaian', 'kinerja', params],
    queryFn: () =>
      api.get<DaftarPenilaian<PenilaianKinerjaBaris>>(
        `/penilaian-kinerja${qs({ ...params, pageSize: 20 })}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function useDaftarMgmp(params: Periode) {
  return useQuery({
    queryKey: ['penilaian', 'mgmp', params],
    queryFn: () => api.get<DaftarPenilaian<PenilaianMgmpBaris>>(`/penilaian-mgmp${qs(params)}`),
    placeholderData: keepPreviousData,
  });
}

function useSegarkan() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['penilaian'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };
}

export function useSinkronPenilaian(jenis: 'kinerja' | 'mgmp') {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (p: Periode) =>
      api.post<Respons<HasilSyncPenilaian>>(`/penilaian-${jenis}/sync`, p),
    onSuccess: segarkan,
  });
}

export function useSimpanKinerja() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (data: SimpanPenilaianKinerjaInput) =>
      api.put<Respons<PenilaianKinerjaBaris>>('/penilaian-kinerja', data),
    onSuccess: segarkan,
  });
}

export function useSimpanMgmp() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (data: SimpanPenilaianMgmpInput) =>
      api.put<Respons<PenilaianMgmpBaris>>('/penilaian-mgmp', data),
    onSuccess: segarkan,
  });
}

/** Rincian skor siswa per kelas untuk satu MGMP (sekretaris: hanya kelasnya). */
export function useSkorSiswaKelas(params: SkorSiswaMgmpQuery) {
  return useQuery({
    queryKey: ['penilaian', 'mgmp-siswa', params],
    queryFn: async () =>
      (await api.get<Respons<SkorSiswaKelasBaris[]>>(`/penilaian-mgmp/skor-siswa${qs(params)}`))
        .data,
  });
}

export function useSimpanSkorSiswa() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (data: SimpanSkorSiswaMgmpInput) =>
      api.put<Respons<PenilaianMgmpBaris>>('/penilaian-mgmp/skor-siswa', data),
    onSuccess: segarkan,
  });
}

export function urlEkspor(jenis: 'kinerja' | 'mgmp', p: Periode): string {
  return `/api/v1/penilaian-${jenis}/export${qs(p)}`;
}
