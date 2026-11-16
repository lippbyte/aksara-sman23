import type { RefGuru, RefKelas, RefMgmp, RefSiswa, Respons } from '@sms/shared';
import { useQuery } from '@tanstack/react-query';
import { api, qs } from './api';

const LIMA_MENIT = 5 * 60_000;

/** Pilihan dropdown. Kunci query diawali 'referensi' agar mudah dibatalkan saat data master berubah. */
export function useRefKelas() {
  return useQuery({
    queryKey: ['referensi', 'kelas'],
    queryFn: async () => (await api.get<Respons<RefKelas[]>>('/referensi/kelas')).data,
    staleTime: LIMA_MENIT,
  });
}

export function useRefGuru() {
  return useQuery({
    queryKey: ['referensi', 'guru'],
    queryFn: async () => (await api.get<Respons<RefGuru[]>>('/referensi/guru')).data,
    staleTime: LIMA_MENIT,
  });
}

export function useRefMgmp() {
  return useQuery({
    queryKey: ['referensi', 'mgmp'],
    queryFn: async () => (await api.get<Respons<RefMgmp[]>>('/referensi/mgmp')).data,
    staleTime: LIMA_MENIT,
  });
}

/** Daftar siswa (data anak) untuk filter laporan; hanya diminta bila kelas dipilih. */
export function useRefSiswa(kelasId: number | null) {
  return useQuery({
    queryKey: ['referensi', 'siswa', kelasId],
    queryFn: async () =>
      (await api.get<Respons<RefSiswa[]>>(`/referensi/siswa${qs({ kelas_id: kelasId })}`)).data,
    staleTime: LIMA_MENIT,
    enabled: kelasId !== null,
  });
}
