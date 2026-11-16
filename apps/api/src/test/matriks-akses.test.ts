import { ROLES, type Role } from '@sms/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, tutupSumberDaya } from '../app';
import { Klien, masukSebagai } from './bantuan';

/**
 * Matriks akses PROJECT-CONTEXT §4, diuji untuk SETIAP rute dan SETIAP peran.
 *
 * Peran yang tidak berhak → 403. Peran yang berhak → bukan 401/403.
 * Isian sengaja tidak valid (ID "x", body kosong) sehingga permintaan yang lolos otorisasi
 * berhenti di validasi (400) dan tidak mengubah data.
 */
const app = createApp();
const SEMUA = ROLES;
const ADMIN: Role[] = ['admin'];
const PIMPINAN: Role[] = ['admin', 'manajemen_guru'];

type Metode = 'get' | 'post' | 'put' | 'delete';
const RUTE: { metode: Metode; path: string; boleh: readonly Role[] }[] = [
  // Auth
  { metode: 'get', path: '/auth/me', boleh: SEMUA },
  { metode: 'put', path: '/auth/password', boleh: SEMUA },
  // Referensi
  { metode: 'get', path: '/referensi/kelas', boleh: SEMUA },
  { metode: 'get', path: '/referensi/guru', boleh: SEMUA },
  { metode: 'get', path: '/referensi/mgmp', boleh: SEMUA },
  {
    metode: 'get',
    path: '/referensi/siswa',
    boleh: ['admin', 'manajemen_guru', 'sekretaris_kelas'],
  },
  // Dashboard
  { metode: 'get', path: '/dashboard/ringkasan', boleh: PIMPINAN },
  { metode: 'get', path: '/dashboard/penilai', boleh: ['admin', 'manajemen_guru', 'guru_penilai'] },
  {
    metode: 'get',
    path: '/dashboard/kelas/x',
    boleh: ['admin', 'manajemen_guru', 'sekretaris_kelas'],
  },
  // Kehadiran guru: lihat/tambah/ubah semua peran; hapus bukan guru_penilai
  { metode: 'get', path: '/kehadiran', boleh: SEMUA },
  { metode: 'get', path: '/kehadiran/jadwal', boleh: SEMUA },
  { metode: 'get', path: '/kehadiran/x', boleh: SEMUA },
  { metode: 'post', path: '/kehadiran', boleh: SEMUA },
  { metode: 'put', path: '/kehadiran/x', boleh: SEMUA },
  {
    metode: 'delete',
    path: '/kehadiran/x',
    boleh: ['admin', 'manajemen_guru', 'sekretaris_kelas'],
  },
  // Kehadiran siswa (diperketat §8.6): lihat admin/manajemen/sekretaris; ubah admin/sekretaris
  {
    metode: 'get',
    path: '/kehadiran-siswa/sesi',
    boleh: ['admin', 'manajemen_guru', 'sekretaris_kelas'],
  },
  {
    metode: 'get',
    path: '/kehadiran-siswa/riwayat?page=0',
    boleh: ['admin', 'manajemen_guru', 'sekretaris_kelas'],
  },
  { metode: 'put', path: '/kehadiran-siswa/sesi', boleh: ['admin', 'sekretaris_kelas'] },
  { metode: 'delete', path: '/kehadiran-siswa/sesi', boleh: ['admin', 'sekretaris_kelas'] },
  { metode: 'delete', path: '/kehadiran-siswa/x', boleh: ['admin', 'sekretaris_kelas'] },
  // Rekap kehadiran guru
  { metode: 'get', path: '/rekap-kehadiran?page=0', boleh: PIMPINAN },
  { metode: 'get', path: '/rekap-kehadiran/pekan', boleh: PIMPINAN },
  { metode: 'get', path: '/rekap-kehadiran/mapel', boleh: PIMPINAN },
  { metode: 'get', path: '/rekap-kehadiran/export?minggu_ke=1', boleh: PIMPINAN },
  { metode: 'post', path: '/rekap-kehadiran/sync', boleh: PIMPINAN },
  { metode: 'put', path: '/rekap-kehadiran/x', boleh: PIMPINAN },
  { metode: 'delete', path: '/rekap-kehadiran/x', boleh: PIMPINAN },
  // Penilaian kinerja bulanan
  { metode: 'get', path: '/penilaian-kinerja', boleh: ['admin', 'manajemen_guru', 'guru_penilai'] },
  { metode: 'put', path: '/penilaian-kinerja', boleh: ['admin', 'manajemen_guru', 'guru_penilai'] },
  {
    metode: 'post',
    path: '/penilaian-kinerja/sync',
    boleh: ['admin', 'manajemen_guru', 'guru_penilai'],
  },
  {
    metode: 'get',
    path: '/penilaian-kinerja/export',
    boleh: ['admin', 'manajemen_guru', 'guru_penilai'],
  },
  // Penilaian MGMP: semua peran (sekretaris hanya skor_siswa, diuji di modulnya)
  { metode: 'get', path: '/penilaian-mgmp', boleh: SEMUA },
  { metode: 'put', path: '/penilaian-mgmp', boleh: SEMUA },
  {
    metode: 'post',
    path: '/penilaian-mgmp/sync',
    boleh: ['admin', 'manajemen_guru', 'guru_penilai'],
  },
  {
    metode: 'get',
    path: '/penilaian-mgmp/export',
    boleh: ['admin', 'manajemen_guru', 'guru_penilai'],
  },
  // Laporan rekap siswa + ekspor
  { metode: 'get', path: '/laporan/siswa?page=0', boleh: PIMPINAN },
  { metode: 'get', path: '/laporan/siswa/export?siswa_id=x', boleh: PIMPINAN },
  // Log aktivitas
  { metode: 'get', path: '/audit-logs?page=0', boleh: ADMIN },
  { metode: 'get', path: '/audit-logs/pengguna', boleh: ADMIN },
  // Pengaturan
  { metode: 'get', path: '/settings/sekolah', boleh: ADMIN },
  { metode: 'put', path: '/settings/sekolah', boleh: ADMIN },
  { metode: 'put', path: '/settings/sekolah/logo', boleh: ADMIN },
  ...['guru', 'kelas', 'siswa', 'jadwal', 'mgmp', 'users'].flatMap((s) => [
    { metode: 'get' as const, path: `/settings/${s}?page=0`, boleh: ADMIN },
    { metode: 'post' as const, path: `/settings/${s}`, boleh: ADMIN },
    { metode: 'put' as const, path: `/settings/${s}/x`, boleh: ADMIN },
    { metode: 'delete' as const, path: `/settings/${s}/x`, boleh: ADMIN },
  ]),
  { metode: 'post', path: '/settings/users/x/reset-password', boleh: ADMIN },
];

const klien = new Map<Role, Klien>();

beforeAll(async () => {
  for (const r of ROLES) klien.set(r, await masukSebagai(app, r));
});
afterAll(() => tutupSumberDaya());

function panggil(k: Klien, metode: Metode, path: string) {
  const url = `/api/v1${path}`;
  if (metode === 'get') return k.get(url);
  if (metode === 'delete') return k.delete(url);
  return k[metode](url, {});
}

describe('matriks akses (PROJECT-CONTEXT §4)', () => {
  it('tanpa sesi: semua rute → 401', async () => {
    const tamu = new Klien(app);
    for (const r of RUTE) {
      expect((await panggil(tamu, r.metode, r.path)).status, `${r.metode} ${r.path}`).toBe(401);
    }
  });

  it.each(ROLES)('%s: hanya rute yang menjadi haknya', async (role) => {
    const k = klien.get(role)!;
    for (const r of RUTE) {
      const res = await panggil(k, r.metode, r.path);
      const label = `${role} ${r.metode.toUpperCase()} ${r.path} → ${res.status}`;
      if (r.boleh.includes(role)) {
        expect([401, 403], label).not.toContain(res.status);
        expect(res.status, label).toBeLessThan(500);
      } else {
        expect(res.status, label).toBe(403);
        expect(res.body.error.code, label).toBe('FORBIDDEN');
      }
    }
  });
});
