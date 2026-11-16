import type { DaftarPenilaian, PenilaianKinerjaBaris, PenilaianMgmpBaris } from '@sms/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pasangApiTiruan, tampilkanApp } from '@/test/bantuan';

afterEach(() => vi.unstubAllGlobals());

const JENDELA_TUTUP = { buka: '2026-11-28', tutup: '2026-11-30', terbuka: false, hari: 3 };
const JENDELA_BUKA = { ...JENDELA_TUTUP, terbuka: true };

const KINERJA: PenilaianKinerjaBaris[] = [
  {
    guru_id: 1,
    kode_guru: 'G01',
    nama_guru: 'Guru Contoh 01',
    mata_pelajaran: 'Matematika',
    id: 5,
    skor_kehadiran: 91.25,
    skor_administrasi_avg: 88,
    skor_manajemen_avg: null,
    skor_akhir: 89.63,
    predikat: 'Baik',
    catatan: null,
    sudah_dinilai: true,
    nama_penilai: 'Guru Penilai Contoh',
    updated_at: '2026-11-28T03:00:00.000Z',
  },
  {
    guru_id: 2,
    kode_guru: 'G02',
    nama_guru: 'Guru Contoh 02',
    mata_pelajaran: 'Fisika',
    id: null,
    skor_kehadiran: 80,
    skor_administrasi_avg: null,
    skor_manajemen_avg: null,
    skor_akhir: null,
    predikat: null,
    catatan: null,
    sudah_dinilai: false,
    nama_penilai: null,
    updated_at: null,
  },
];

function daftar<T>(data: T[], jendela = JENDELA_BUKA): DaftarPenilaian<T> {
  return { data, meta: { page: 1, pageSize: 20, total: data.length }, jendela };
}

describe('Penilaian Kinerja', () => {
  it('menampilkan predikat, "Belum dinilai", info jendela, dan teks bobot sekolah', async () => {
    pasangApiTiruan('guru_penilai', (url) =>
      url.includes('/penilaian-kinerja?') ? { body: daftar(KINERJA) } : undefined,
    );
    tampilkanApp('/penilaian-kinerja?bulan=11&tahun=2026');
    const tabel = await screen.findByRole('table', {
      name: 'Penilaian kinerja guru November 2026',
    });
    expect(within(tabel).getByText('Baik')).toBeInTheDocument();
    expect(within(tabel).getByText('Belum dinilai')).toBeInTheDocument();
    expect(within(tabel).getByText('89,63')).toBeInTheDocument();
    expect(screen.getByText('Aspek dan bobot mengikuti ketentuan sekolah.')).toBeInTheDocument();
    expect(screen.getByText('Terbuka')).toBeInTheDocument();
  });

  it('jendela tertutup: guru_penilai tidak bisa menilai; admin tetap bisa dengan pemberitahuan log', async () => {
    pasangApiTiruan('guru_penilai', (url) =>
      url.includes('/penilaian-kinerja?') ? { body: daftar(KINERJA, JENDELA_TUTUP) } : undefined,
    );
    const { unmount } = tampilkanApp('/penilaian-kinerja?bulan=11&tahun=2026');
    await screen.findByRole('table');
    for (const tombol of screen.getAllByRole('button', { name: /^Nilai Guru/ })) {
      expect(tombol).toBeDisabled();
    }
    expect(screen.getByText(/hanya dapat dilakukan saat jendela terbuka/)).toBeInTheDocument();
    unmount();

    pasangApiTiruan('admin', (url) =>
      url.includes('/penilaian-kinerja?') ? { body: daftar(KINERJA, JENDELA_TUTUP) } : undefined,
    );
    tampilkanApp('/penilaian-kinerja?bulan=11&tahun=2026');
    await screen.findByRole('table');
    expect(screen.getAllByRole('button', { name: /^Nilai Guru/ })[0]).toBeEnabled();
    expect(screen.getByText(/tercatat di log aktivitas/)).toBeInTheDocument();
  });

  it('form nilai: skor manajemen kosong dikirim sebagai null; validasi skor 0–100', async () => {
    const fetchTiruan = pasangApiTiruan('guru_penilai', (url, init) => {
      if (url.endsWith('/penilaian-kinerja') && init?.method === 'PUT') {
        return { body: { data: { ...KINERJA[1], skor_akhir: 85, predikat: 'Baik' } } };
      }
      return url.includes('/penilaian-kinerja?') ? { body: daftar(KINERJA) } : undefined;
    });
    tampilkanApp('/penilaian-kinerja?bulan=11&tahun=2026');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nilai Guru Contoh 02' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Nilai Guru Contoh 02' });

    const adm = within(dialog).getByLabelText(/^Skor administrasi/);
    fireEvent.change(adm, { target: { value: '120' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan nilai' }));
    expect(await within(dialog).findByText('Skor maksimal 100.')).toBeInTheDocument();

    fireEvent.change(adm, { target: { value: '90' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan nilai' }));
    await waitFor(() =>
      expect(fetchTiruan.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true),
    );
    const [, init] = fetchTiruan.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    expect(JSON.parse(String(init?.body))).toEqual({
      guru_id: 2,
      bulan: 11,
      tahun: 2026,
      skor_administrasi_avg: 90,
      skor_manajemen_avg: null,
      catatan: null,
    });
  });

  it('sekretaris tidak punya akses ke penilaian kinerja', async () => {
    pasangApiTiruan('sekretaris_kelas');
    tampilkanApp('/penilaian-kinerja');
    expect(
      await screen.findByText('Peran Anda tidak memiliki akses ke halaman ini.'),
    ).toBeInTheDocument();
  });
});

describe('Penilaian MGMP', () => {
  const MGMP: PenilaianMgmpBaris[] = [
    {
      mgmp_id: 1,
      nama_mapel: 'Matematika',
      jumlah_guru_aktif: 4,
      id: 3,
      skor_kehadiran: null,
      skor_siswa: 80,
      skor_administrasi: null,
      skor_akhir: null,
      predikat: null,
      catatan: null,
      sudah_dinilai: true,
      nama_penilai: null,
      updated_at: '2026-11-28T03:00:00.000Z',
    },
  ];

  it('sekretaris: hanya kolom dan isian skor siswa; tanpa sinkron dan ekspor', async () => {
    const fetchTiruan = pasangApiTiruan('sekretaris_kelas', (url, init) => {
      if (url.endsWith('/penilaian-mgmp') && init?.method === 'PUT')
        return { body: { data: MGMP[0] } };
      return url.includes('/penilaian-mgmp?') ? { body: daftar(MGMP) } : undefined;
    });
    tampilkanApp('/penilaian-mgmp?bulan=11&tahun=2026');
    const tabel = await screen.findByRole('table', { name: 'Penilaian MGMP November 2026' });
    const judul = within(tabel)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(judul).toEqual(['MGMP', 'Skor siswa', 'Aksi']);
    expect(screen.queryByRole('button', { name: /Sinkronkan/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ekspor CSV' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Nilai MGMP Matematika' })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/Skor administrasi/)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Catatan/)).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Skor siswa/), { target: { value: '85.5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(fetchTiruan.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true),
    );
    const [, init] = fetchTiruan.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    expect(JSON.parse(String(init?.body))).toEqual({
      mgmp_id: 1,
      bulan: 11,
      tahun: 2026,
      skor_siswa: 85.5,
    });
  });

  it('manajemen: semua kolom, sinkron, dan ekspor tersedia', async () => {
    pasangApiTiruan('manajemen_guru', (url) =>
      url.includes('/penilaian-mgmp?') ? { body: daftar(MGMP) } : undefined,
    );
    tampilkanApp('/penilaian-mgmp?bulan=11&tahun=2026');
    const tabel = await screen.findByRole('table');
    expect(within(tabel).getAllByRole('columnheader')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Sinkronkan skor kehadiran' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ekspor CSV' })).toHaveAttribute(
      'href',
      '/api/v1/penilaian-mgmp/export?bulan=11&tahun=2026',
    );
  });
});
