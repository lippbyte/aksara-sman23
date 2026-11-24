import {
  JAM_KE_MAX,
  JAM_KE_MIN,
  type Halaman,
  type HasilSimpanSiswa,
  type LaporanSiswaBaris,
  type Respons,
  type RiwayatSesiSiswa,
  type SesiAbsenSiswa,
  type SimpanKehadiranSiswaInput,
} from '@sms/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, qs } from '@/lib/api';

type Param = Record<string, string | number | null | undefined>;

export function useSesiSiswa(
  params: { kelas_id: number | null; tanggal: string; jam_ke: number },
  aktif: boolean,
) {
  return useQuery({
    queryKey: ['kehadiran-siswa', 'sesi', params],
    queryFn: async () =>
      (await api.get<Respons<SesiAbsenSiswa>>(`/kehadiran-siswa/sesi${qs(params)}`)).data,
    enabled: aktif,
  });
}

export function useRiwayatSiswa(params: Param, aktif: boolean) {
  return useQuery({
    queryKey: ['kehadiran-siswa', 'riwayat', params],
    queryFn: () => api.get<Halaman<RiwayatSesiSiswa>>(`/kehadiran-siswa/riwayat${qs(params)}`),
    placeholderData: keepPreviousData,
    enabled: aktif,
  });
}

/**
 * Jam yang absensi siswanya sudah tersimpan untuk satu kelas pada satu tanggal, dari endpoint
 * riwayat yang sudah ada (tanpa perubahan API). Tanpa `keepPreviousData` agar tanda "tersimpan"
 * tanggal sebelumnya tidak sempat tampil di tanggal baru.
 */
export function useJamTersimpan(kelasId: number | null, tanggal: string, aktif = true) {
  const params = {
    kelas_id: kelasId,
    tanggal_dari: tanggal,
    tanggal_sampai: tanggal,
    page: 1,
    pageSize: JAM_KE_MAX - JAM_KE_MIN + 1,
  };
  const q = useQuery({
    queryKey: ['kehadiran-siswa', 'riwayat', params],
    queryFn: () => api.get<Halaman<RiwayatSesiSiswa>>(`/kehadiran-siswa/riwayat${qs(params)}`),
    enabled: aktif && kelasId !== null && tanggal !== '',
  });
  const jam = useMemo(() => q.data?.data.map((r) => r.jam_ke) ?? [], [q.data]);
  return { ...q, jam };
}

function useSegarkan() {
  const queryClient = useQueryClient();
  return () => {
    for (const kunci of ['kehadiran-siswa', 'laporan', 'dashboard']) {
      void queryClient.invalidateQueries({ queryKey: [kunci] });
    }
  };
}

export function useSimpanSesiSiswa() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (data: SimpanKehadiranSiswaInput) =>
      api.put<Respons<HasilSimpanSiswa>>('/kehadiran-siswa/sesi', data),
    onSuccess: segarkan,
  });
}

export function useHapusSesiSiswa() {
  const segarkan = useSegarkan();
  return useMutation({
    mutationFn: (p: { kelas_id: number; tanggal: string; jam_ke: number }) =>
      api.delete<Respons<{ dihapus: number }>>(`/kehadiran-siswa/sesi${qs(p)}`),
    onSuccess: segarkan,
  });
}

export function useLaporanSiswa(params: Param) {
  return useQuery({
    queryKey: ['laporan', 'siswa', params],
    queryFn: () => api.get<Halaman<LaporanSiswaBaris>>(`/laporan/siswa${qs(params)}`),
    placeholderData: keepPreviousData,
  });
}

/** URL unduhan CSV (GET, cookie sesi ikut terkirim karena satu asal). */
export function urlEksporLaporanSiswa(params: Param): string {
  return `/api/v1/laporan/siswa/export${qs(params)}`;
}
