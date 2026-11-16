import type { PekanTersedia, Rekap } from '@sms/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nadaPersentase, ProgressBar } from '@/components/ProgressBar';
import { pasangApiTiruan, tampilkanApp } from '@/test/bantuan';

afterEach(() => {
  vi.unstubAllGlobals();
  terkoreksi = 0;
});

describe('ProgressBar', () => {
  it.each([
    [100, 'hadir'],
    [90, 'hadir'],
    [89.99, 'mendampingi'],
    [75, 'mendampingi'],
    [74.99, 'izin'],
    [60, 'izin'],
    [59.99, 'tidak-hadir'],
    [0, 'tidak-hadir'],
  ])('%s%% → warna %s', (nilai, nada) => {
    expect(nadaPersentase(nilai)).toBe(nada);
  });

  it('menampilkan angka format id-ID dan atribut progressbar', () => {
    render(<ProgressBar nilai={87.5} label="Kehadiran Guru Contoh" />);
    const bar = screen.getByRole('progressbar', { name: 'Kehadiran Guru Contoh' });
    expect(bar).toHaveAttribute('aria-valuenow', '87.5');
    expect(screen.getByText('87,50%')).toBeInTheDocument();
  });
});

const PEKAN: PekanTersedia[] = [
  {
    minggu_ke: 5,
    tahun: 2026,
    tanggal_mulai: '2026-11-16',
    tanggal_selesai: '2026-11-20',
    jumlah_rekap: 0,
    berjalan: true,
  },
  {
    minggu_ke: 4,
    tahun: 2026,
    tanggal_mulai: '2026-11-09',
    tanggal_selesai: '2026-11-13',
    jumlah_rekap: 12,
    berjalan: false,
  },
];
const REKAP: Rekap = {
  id: 9,
  guru_id: 3,
  kode_guru: 'G03',
  nama_guru: 'Guru Contoh 03',
  mata_pelajaran: 'Fisika',
  tahun: 2026,
  minggu_ke: 4,
  tanggal_mulai: '2026-11-09',
  tanggal_selesai: '2026-11-13',
  total_jam_wajib: 8,
  total_jam_hadir: 7,
  persentase_kehadiran: 87.5,
  dikoreksi_manual: false,
  alasan_koreksi: null,
  nama_pengoreksi: null,
  dikoreksi_pada: null,
  updated_at: '2026-11-13T10:00:00.000Z',
};
const REKAP_KOREKSI: Rekap = {
  ...REKAP,
  id: 10,
  guru_id: 4,
  kode_guru: 'G04',
  nama_guru: 'Guru Contoh 04',
  dikoreksi_manual: true,
  alasan_koreksi: 'Mengajar pengganti (contoh)',
  nama_pengoreksi: 'Admin Contoh',
  dikoreksi_pada: '2026-11-14T03:00:00.000Z',
};
let terkoreksi = 0;

function penjawab(url: string, init?: RequestInit) {
  if (url.includes('/rekap-kehadiran/pekan')) return { body: { data: PEKAN } };
  if (url.includes('/rekap-kehadiran/mapel')) return { body: { data: ['Fisika'] } };
  if (url.includes('/rekap-kehadiran/sync/pratinjau')) {
    return { body: { data: { minggu_ke: 4, tahun: 2026, terkoreksi } } };
  }
  if (url.includes('/rekap-kehadiran/sync')) {
    return { body: { data: { pekan: PEKAN[1], disinkronkan: 12, dilewati: 0, ditimpa: 0 } } };
  }
  if (url.includes('/rekap-kehadiran') && (!init?.method || init.method === 'GET')) {
    const pekan5 = url.includes('minggu_ke=5');
    return {
      body: {
        data: pekan5 ? [] : [REKAP, REKAP_KOREKSI],
        meta: { page: 1, pageSize: 20, total: pekan5 ? 0 : 2 },
      },
    };
  }
  return undefined;
}

describe('halaman Rekap Kehadiran Guru', () => {
  it('default pekan berjalan; pekan yang belum disinkron menawarkan sinkron', async () => {
    const fetchTiruan = pasangApiTiruan('manajemen_guru', penjawab);
    tampilkanApp('/rekap-kehadiran');
    expect(
      await screen.findByText('Rekap pekan ini belum dihitung. Sinkronkan untuk menghitungnya.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Pekan')).toHaveValue('2026-5');
    expect(
      screen.getByRole('option', { name: /Pekan 5 \(16–20 Nov\) · berjalan · belum disinkron/ }),
    ).toBeInTheDocument();
    const url = fetchTiruan.mock.calls
      .map(([u]) => String(u))
      .find((u) => u.includes('/rekap-kehadiran?'));
    expect(url).toContain('minggu_ke=5');
    expect(url).toContain('tahun=2026');
  });

  it('memilih pekan menampilkan tabel dengan ProgressBar; sinkron lewat dialog konfirmasi', async () => {
    const fetchTiruan = pasangApiTiruan('admin', penjawab);
    tampilkanApp('/rekap-kehadiran?pekan=2026-4');
    const tabel = await screen.findByRole('table', { name: 'Rekap kehadiran guru per pekan' });
    expect(within(tabel).getByText('Guru Contoh 03')).toBeInTheDocument();
    expect(
      within(tabel).getByRole('progressbar', { name: 'Kehadiran Guru Contoh 03' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ekspor CSV' })).toHaveAttribute(
      'href',
      '/api/v1/rekap-kehadiran/export?minggu_ke=4&tahun=2026',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sinkronkan rekap' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sinkronkan rekap?' });
    expect(within(dialog).getByText('Pekan 4 (9–13 Nov)')).toBeInTheDocument();
    expect(
      await within(dialog).findByText('Tidak ada baris yang dikoreksi manual pada pekan ini.'),
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sinkronkan' }));
    await waitFor(() => {
      const kirim = fetchTiruan.mock.calls.find(([u]) =>
        String(u).endsWith('/rekap-kehadiran/sync'),
      );
      expect(JSON.parse(String(kirim?.[1]?.body))).toEqual({
        minggu_ke: 4,
        tahun: 2026,
        timpa_koreksi: false,
      });
    });
  });

  it('baris terkoreksi ditandai beserta alasannya', async () => {
    pasangApiTiruan('manajemen_guru', penjawab);
    tampilkanApp('/rekap-kehadiran?pekan=2026-4');
    const tabel = await screen.findByRole('table', { name: 'Rekap kehadiran guru per pekan' });
    expect(within(tabel).getByText('Dikoreksi manual')).toBeInTheDocument();
    expect(
      within(tabel).getByText('Alasan: Mengajar pengganti (contoh) (Admin Contoh)'),
    ).toBeInTheDocument();
  });

  it('dialog sinkron menyebut jumlah baris terkoreksi; manajemen tidak bisa menimpa', async () => {
    terkoreksi = 3;
    pasangApiTiruan('manajemen_guru', penjawab);
    tampilkanApp('/rekap-kehadiran?pekan=2026-4');
    await screen.findByRole('table', { name: 'Rekap kehadiran guru per pekan' });
    fireEvent.click(screen.getByRole('button', { name: 'Sinkronkan rekap' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sinkronkan rekap?' });
    expect(await within(dialog).findByText('3 baris')).toBeInTheDocument();
    expect(within(dialog).getByText('akan dilewati')).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('admin dapat memilih menimpa: tombol menyebut jumlah baris dan mengirim timpa_koreksi', async () => {
    terkoreksi = 2;
    const fetchTiruan = pasangApiTiruan('admin', penjawab);
    tampilkanApp('/rekap-kehadiran?pekan=2026-4');
    await screen.findByRole('table', { name: 'Rekap kehadiran guru per pekan' });
    fireEvent.click(screen.getByRole('button', { name: 'Sinkronkan rekap' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sinkronkan rekap?' });
    fireEvent.click(
      await within(dialog).findByRole('checkbox', {
        name: 'Timpa 2 baris koreksi manual dengan hasil sinkron',
      }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sinkronkan dan timpa 2 baris' }));
    await waitFor(() => {
      const kirim = fetchTiruan.mock.calls.find(([u]) =>
        String(u).endsWith('/rekap-kehadiran/sync'),
      );
      expect(JSON.parse(String(kirim?.[1]?.body))).toEqual({
        minggu_ke: 4,
        tahun: 2026,
        timpa_koreksi: true,
      });
    });
  });

  it('koreksi manual menampilkan pratinjau persentase dari fungsi domain', async () => {
    pasangApiTiruan('admin', penjawab);
    tampilkanApp('/rekap-kehadiran?pekan=2026-4');
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Koreksi rekap Guru Contoh 03' }))[0]!,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Koreksi rekap' });
    expect(within(dialog).getByText('87,50%')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Jam hadir (JP)'), { target: { value: '10' } });
    expect(await within(dialog).findByText('100,00%')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Jam wajib (JP)'), { target: { value: '0' } });
    expect(await within(dialog).findByText('0,00%')).toBeInTheDocument();
  });

  it('koreksi manual wajib alasan', async () => {
    const fetchTiruan = pasangApiTiruan('admin', penjawab);
    tampilkanApp('/rekap-kehadiran?pekan=2026-4');
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Koreksi rekap Guru Contoh 03' }))[0]!,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Koreksi rekap' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan koreksi' }));
    expect(await within(dialog).findByText('Alasan koreksi wajib diisi.')).toBeInTheDocument();
    expect(
      fetchTiruan.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      ),
    ).toBe(false);

    fireEvent.change(within(dialog).getByLabelText(/Alasan koreksi/), {
      target: { value: 'Jadwal berubah (contoh)' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan koreksi' }));
    await waitFor(() => {
      const kirim = fetchTiruan.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === 'PUT',
      );
      expect(JSON.parse(String(kirim?.[1]?.body))).toEqual({
        total_jam_wajib: 8,
        total_jam_hadir: 7,
        alasan_koreksi: 'Jadwal berubah (contoh)',
      });
    });
  });

  it('sekretaris dan guru_penilai tidak punya akses', async () => {
    pasangApiTiruan('guru_penilai', penjawab);
    tampilkanApp('/rekap-kehadiran');
    expect(
      await screen.findByText('Peran Anda tidak memiliki akses ke halaman ini.'),
    ).toBeInTheDocument();
  });
});
