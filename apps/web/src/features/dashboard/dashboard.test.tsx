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

  it('kartu utama: JP tercatat dari JP terjadwal dan kelas yang perlu perhatian', async () => {
    pasangApiTiruan('manajemen_guru', (url) =>
      url.includes('/dashboard/ringkasan')
        ? {
            body: {
              data: {
                ...RINGKASAN,
                hari_ini: {
                  ...RINGKASAN.hari_ini,
                  jp_tercatat: 36,
                  persentase_terisi: 75,
                  per_kelas: [
                    { kelas_id: 7, nama_kelas: 'X-1', Hadir: 6, Mendampingi: 0, 'Tidak Hadir': 2 },
                    { kelas_id: 8, nama_kelas: 'X-2', Hadir: 0, Mendampingi: 0, 'Tidak Hadir': 0 },
                    { kelas_id: 9, nama_kelas: 'X-3', Hadir: 8, Mendampingi: 0, 'Tidak Hadir': 0 },
                  ],
                },
                log_terbaru: null,
              },
            },
          }
        : undefined,
    );
    tampilkanApp('/');
    const kartu = await screen.findByRole('region', { name: 'Kehadiran guru hari ini' });
    expect(within(kartu).getByText('36')).toBeInTheDocument();
    expect(within(kartu).getByText('dari 48 JP terjadwal sudah dicatat')).toBeInTheDocument();
    expect(
      within(kartu).getByRole('progressbar', { name: 'Persentase jam terisi hari ini' }),
    ).toHaveAttribute('aria-valuenow', '75');

    const perhatian = within(kartu).getByRole('list', { name: 'Kelas yang perlu perhatian' });
    const tautan = within(perhatian).getAllByRole('link');
    // Guru tidak hadir lebih dulu, lalu kelas tanpa catatan; kelas lengkap tidak muncul.
    expect(tautan.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['X-12 JP guru tidak hadir', '/kelas/7'],
      ['X-2Belum ada catatan hari ini', '/kelas/8'],
    ]);
  });

  it('hari tanpa jadwal dan tren tanpa rekap: pesan jelas, bukan angka 0 % yang menyesatkan', async () => {
    pasangApiTiruan('manajemen_guru', (url) =>
      url.includes('/dashboard/ringkasan')
        ? {
            body: {
              data: {
                ...RINGKASAN,
                hari_ini: {
                  ...RINGKASAN.hari_ini,
                  jp_terjadwal: 0,
                  jp_tercatat: 0,
                  persentase_terisi: 0,
                  per_kelas: [
                    { kelas_id: 8, nama_kelas: 'X-2', Hadir: 0, Mendampingi: 0, 'Tidak Hadir': 0 },
                  ],
                },
                tren: RINGKASAN.tren.map((t) => ({ ...t, persentase: null, jumlah_guru: 0 })),
                log_terbaru: null,
              },
            },
          }
        : undefined,
    );
    tampilkanApp('/');
    expect(await screen.findByText(/Tidak ada jam terjadwal hari ini/)).toBeInTheDocument();
    expect(
      screen.queryByRole('progressbar', { name: 'Persentase jam terisi hari ini' }),
    ).not.toBeInTheDocument();
    // Tanpa jadwal, kelas tanpa catatan bukan "perlu perhatian".
    expect(screen.getByText(/Tidak ada kelas dengan guru tidak hadir/)).toBeInTheDocument();
    expect(screen.getByText(/Belum ada rekap pekan yang selesai/)).toBeInTheDocument();
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
    // Kemajuan memakai nada tetap (bukan ambang merah/kuning) dan tautan langsung per guru.
    expect(
      screen.getByRole('progressbar', { name: 'Guru yang sudah dinilai, November 2026' }),
    ).toBeInTheDocument();
    // Jendela tertutup → pengisian terkunci untuk penilai, jadi tombolnya "Lihat".
    expect(screen.getByRole('link', { name: 'Lihat Guru Contoh 05' })).toHaveAttribute(
      'href',
      '/penilaian-kinerja?bulan=11&tahun=2026&q=G05',
    );
  });

  it('jendela terbuka: tombol per guru menjadi "Nilai"', async () => {
    pasangApiTiruan('guru_penilai', (url) =>
      url.includes('/dashboard/penilai')
        ? { body: { data: { ...PENILAI, jendela: { ...PENILAI.jendela, terbuka: true } } } }
        : undefined,
    );
    tampilkanApp('/');
    expect(await screen.findByRole('link', { name: 'Nilai Guru Contoh 05' })).toBeInTheDocument();
    expect(screen.getByText('Terbuka')).toBeInTheDocument();
  });
});
