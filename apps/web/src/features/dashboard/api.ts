import type { DashboardPenilai, DashboardRingkasan, Respons } from '@sms/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/** Dashboard dimuat ulang tiap 2 menit (sejalan dengan cache server). */
const SEGARKAN_MS = 120_000;

export function useDashboardRingkasan() {
  return useQuery({
    queryKey: ['dashboard', 'ringkasan'],
    queryFn: async () => (await api.get<Respons<DashboardRingkasan>>('/dashboard/ringkasan')).data,
    refetchInterval: SEGARKAN_MS,
  });
}

export function useDashboardPenilai() {
  return useQuery({
    queryKey: ['dashboard', 'penilai'],
    queryFn: async () => (await api.get<Respons<DashboardPenilai>>('/dashboard/penilai')).data,
    refetchInterval: SEGARKAN_MS,
  });
}
