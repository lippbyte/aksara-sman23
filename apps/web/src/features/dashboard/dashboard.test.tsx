import type { DashboardPenilai, DashboardRingkasan } from '@sms/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pasangApiTiruan, tampilkanApp } from '@/test/bantuan';

afterEach(() => vi.unstubAllGlobals());

const RINGKASAN: DashboardRingkasan = {
  tanggal: '2026-11-13',
  kpi: { guru_aktif: 12, siswa_aktif: 180, rombel: 6, catatan_hari_ini: 24 },
  hari_ini: {
    per_status: {
      Hadir: { catatan: 20, jp: 40 },
      Mendampingi: { catatan: 2, jp: 4 },
      'Tidak Hadir': { catatan: 2, jp: 4 },
    },
    jp_terjadwal: 48,
    jp_tercatat: 48,
    persentase_terisi: 100,
    per_kelas: [{ kelas_id: 7, nama_kelas: 'X-1', Hadir: 6, Mendampingi: 0, 'Tidak Hadir': 2 }],
  },
  tren: [
    {
      minggu_ke: 3,
      tahun: 2026,
      tanggal_mulai: '2026-11-02',
      tanggal_selesai: '2026-11-06',
      persentase: 88.5,
      jumlah_guru: 12,
    },
    {
      minggu_ke: 4,
      tahun: 2026,
      tanggal_mulai: '2026-11-09',
      tanggal_selesai: '2026-11-13',
      persentase: null,
      jumlah_guru: 0,
    },
  ],
  jam_kosong: {
    pekan: {
      minggu_ke: 4,
      tahun: 2026,
      tanggal_mulai: '2026-11-09',
      tanggal_selesai: '2026-11-13',
    },
    data: [{ kelas_id: 7, nama_kelas: 'X-1', jp_kosong: 6 }],
  },
  guru_terendah: {
    pekan: {
      minggu_ke: 3,
      tahun: 2026,
      tanggal_mulai: '2026-11-02',
      tanggal_selesai: '2026-11-06',
    },
    data: [
      {
        guru_id: 4,
        nama_guru: 'Guru Contoh 04',
        mata_pelajaran: 'Kimia',
        persentase: 55,
        jam_hadir: 11,
        jam_wajib: 20,
      },
    ],
  },
  log_terbaru: [
    {
      id: 1,
      user_id: 1,
      nama_pengguna: 'Admin Contoh',
      module: 'Auth',
      aktivitas: 'LOGIN',
      entity_type: 'users',
      entity_id: '1',
      description: 'Admin Contoh masuk.',
      ip_address: '127.0.0.1',
      created_at: '2026-11-13T01:00:00.000Z',
    },
  ],
};

describe('Dashboard Utama (admin, manajemen)', () => {
  it('admin: KPI, tabel alternatif grafik, guru terendah, dan log terbaru', async () => {
    pasangApiTiruan('admin', (url) =>
      url.includes('/dashboard/ringkasan') ? { body: { data: RINGKASAN } } : undefined,
    );
    tampilkanApp('/');
    expect(await screen.findByText('180')).toBeInTheDocument();
    expect(screen.getByText('Catatan hari ini')).toBeInTheDocument();

    // Setiap grafik punya judul, periode, dan tabel alternatif.
    expect(screen.getByText('Kehadiran guru hari ini')).toBeInTheDocument();
    expect(screen.getAllByText(/Jumat, 13 Nov 2026 · JP per kelas/).length).toBeGreaterThan(0);
    const tabelTren = screen.getByRole('table', { name: /Tren kehadiran guru per pekan/ });
    expect(within(tabelTren).getByText('88,50%')).toBeInTheDocument();
    expect(within(tabelTren).getByText('Belum ada rekap')).toBeInTheDocument();
    expect(screen.getAllByText('Lihat tabel').length).toBeGreaterThanOrEqual(3);

    // Jam kosong: tabel alternatif menautkan ke dashboard kelas.
    const tabelKosong = screen.getByRole('table', { name: /Kelas dengan jam kosong terbanyak/ });
    expect(within(tabelKosong).getByRole('link', { name: 'X-1' })).toHaveAttribute(
      'href',
      '/kelas/7',
    );

    expect(
      screen.getByRole('progressbar', { name: 'Kehadiran Guru Contoh 04' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Log aktivitas terbaru')).toBeInTheDocument();
    expect(screen.getByText('Admin Contoh masuk.')).toBeInTheDocument();
  });

  it('manajemen: tanpa log aktivitas', async () => {
    pasangApiTiruan('manajemen_guru', (url) =>
      url.includes('/dashboard/ringkasan')
        ? { body: { data: { ...RINGKASAN, log_terbaru: null } } }
        : undefined,
    );
    tampilkanApp('/');
    expect(await screen.findByText('Guru dengan persentase terendah')).toBeInTheDocument();
    expect(screen.queryByText('Log aktivitas terbaru')).not.toBeInTheDocument();
  });

  it('galat memuat menampilkan pesan dan tombol coba lagi', async () => {
    pasangApiTiruan('admin', (url) =>
      url.includes('/dashboard/ringkasan')
        ? {
            status: 500,
            body: { error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' } },
          }
        : undefined,
    );
    tampilkanApp('/');
    expect(
      await screen.findByText('Terjadi kesalahan pada server.', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
  });
});

describe('Dashboard penilai', () => {
  const PENILAI: DashboardPenilai = {
    periode: { bulan: 11, tahun: 2026 },
    jendela: { buka: '2026-11-28', tutup: '2026-11-30', terbuka: false, hari: 3 },
    jumlah_guru_aktif: 12,
    sudah_dinilai: 11,
    belum_dinilai: [
      { guru_id: 5, kode_guru: 'G05', nama_guru: 'Guru Contoh 05', mata_pelajaran: 'Biologi' },
    ],
  };

  it('jendela, tenggat, jumlah, dan daftar guru belum dinilai', async () => {
    pasangApiTiruan('guru_penilai', (url) =>
      url.includes('/dashboard/penilai') ? { body: { data: PENILAI } } : undefined,
    );
    tampilkanApp('/');
    expect(await screen.findByText('Guru Contoh 05')).toBeInTheDocument();
    expect(screen.getByText('Tertutup')).toBeInTheDocument();
    expect(screen.getByText('Tenggat Senin, 30 Nov 2026')).toBeInTheDocument();
    expect(screen.getByText('11/12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka penilaian' })).toHaveAttribute(
      'href',
      '/penilaian-kinerja?bulan=11&tahun=2026',
    );
  });
});
