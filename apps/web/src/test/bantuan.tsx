import type { PenggunaSesi, Role, SesiSaya } from '@sms/shared';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { buatQueryClient, Providers } from '@/app/providers';
import { routes } from '@/app/routes';

export function penggunaUji(role: Role): PenggunaSesi {
  const sekretaris = role === 'sekretaris_kelas';
  return {
    id: 1,
    name: `Pengguna ${role} Contoh`,
    email: `${role}@contoh.test`,
    role,
    kelas_id: sekretaris ? 7 : null,
    nama_kelas: sekretaris ? 'X-1' : null,
  };
}

type Penjawab = (
  url: string,
  init?: RequestInit,
) => { status?: number; body?: unknown } | undefined;

function jawab(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Mengganti `fetch` dengan API tiruan: /auth/me mengikuti `role` (null = belum masuk),
 * rute lain dijawab `penjawab` atau daftar kosong.
 */
export function pasangApiTiruan(role: Role | null, penjawab?: Penjawab) {
  const tiruan = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const khusus = penjawab?.(url, init);
    if (khusus) return jawab(khusus.status ?? 200, khusus.body ?? {});

    if (url.endsWith('/auth/me')) {
      if (!role) {
        return jawab(401, { error: { code: 'UNAUTHORIZED', message: 'Silakan masuk.' } });
      }
      const sesi: SesiSaya = {
        user: penggunaUji(role),
        sekolah: {
          nama_sekolah: 'SMA Contoh Fiktif',
          logo_url: null,
          dashboard_background_url: null,
          tahun_ajaran: '2026/2027',
        },
      };
      return jawab(200, { data: sesi });
    }
    return jawab(200, { data: [], meta: { page: 1, pageSize: 20, total: 0 } });
  });
  vi.stubGlobal('fetch', tiruan);
  return tiruan;
}

export function tampilkanApp(path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const hasil = render(
    <Providers client={buatQueryClient()}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...hasil, router };
}
