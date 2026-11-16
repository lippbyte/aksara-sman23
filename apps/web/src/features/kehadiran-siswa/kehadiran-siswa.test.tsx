import type { LaporanSiswaBaris, SesiAbsenSiswa } from '@sms/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pasangApiTiruan, tampilkanApp } from '@/test/bantuan';

afterEach(() => vi.unstubAllGlobals());

const SESI: SesiAbsenSiswa = {
  kelas: { id: 7, nama_kelas: 'X-1' },
  tanggal: '2026-11-16',
  jam_ke: 1,
  sudah_diisi: false,
  siswa: [1, 2, 3].map((n) => ({
    siswa_id: n,
    nis: `990100${n}`,
    nama_siswa: `Siswa Contoh X-1 0${n}`,
    jenis_kelamin: n % 2 ? 'L' : 'P',
    id: null,
    status: 'hadir',
    keterangan: null,
  })),
};

function penjawab(sesi: SesiAbsenSiswa = SESI) {
  return (url: string, init?: RequestInit) => {
    if (url.includes('/kehadiran-siswa/sesi') && init?.method === 'PUT') {
      return {
        body: { data: { disimpan: 3, hitungan: { hadir: 2, izin: 0, sakit: 1, alpa: 0 } } },
      };
    }
    if (url.includes('/kehadiran-siswa/sesi')) return { body: { data: sesi } };
    if (url.includes('/referensi/kelas')) return { body: { data: [{ id: 7, nama_kelas: 'X-1' }] } };
    return undefined;
  };
}

describe('Absensi Siswa', () => {
  it('sekretaris: semua siswa default Hadir, ubah status, isi keterangan, lalu simpan', async () => {
    const fetchTiruan = pasangApiTiruan('sekretaris_kelas', penjawab());
    tampilkanApp('/absensi-siswa?tanggal=2026-11-16');

    expect(await screen.findByText('Kelas X-1 · Jam ke-1')).toBeInTheDocument();
    // Sekretaris tidak memilih kelas.
    expect(screen.queryByLabelText('Kelas')).not.toBeInTheDocument();
    expect(screen.getByText(/Semua siswa ditandai Hadir/)).toBeInTheDocument();
    expect(screen.getByText('Hadir: 3')).toBeInTheDocument();

    const grup = screen.getByRole('radiogroup', { name: 'Status Siswa Contoh X-1 02' });
    fireEvent.click(within(grup).getByRole('radio', { name: 'Sakit' }));
    expect(screen.getByText('Sakit: 1')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Keterangan Siswa Contoh X-1 02'), {
      target: { value: 'Demam (contoh)' },
    });
    expect(screen.getByText('1 perubahan belum disimpan.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Simpan absensi' }));
    await waitFor(() =>
      expect(fetchTiruan.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true),
    );
    const [, init] = fetchTiruan.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    expect(JSON.parse(String(init?.body))).toEqual({
      kelas_id: 7,
      tanggal: '2026-11-16',
      jam_ke: 1,
      items: [
        { siswa_id: 1, status: 'hadir', keterangan: null },
        { siswa_id: 2, status: 'sakit', keterangan: 'Demam (contoh)' },
        { siswa_id: 3, status: 'hadir', keterangan: null },
      ],
    });
  });

  it('"Tandai semua hadir" mengembalikan semua status', async () => {
    pasangApiTiruan('sekretaris_kelas', penjawab());
    tampilkanApp('/absensi-siswa');
    const grup = await screen.findByRole('radiogroup', { name: 'Status Siswa Contoh X-1 01' });
    fireEvent.click(within(grup).getByRole('radio', { name: 'Alpa' }));
    expect(screen.getByText('Alpa: 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tandai semua hadir' }));
    expect(screen.getByText('Hadir: 3')).toBeInTheDocument();
  });

  it('manajemen_guru hanya melihat: status terkunci dan tidak ada tombol simpan', async () => {
    pasangApiTiruan('manajemen_guru', penjawab({ ...SESI, sudah_diisi: true }));
    tampilkanApp('/absensi-siswa?kelas_id=7&tanggal=2026-11-16');
    const grup = await screen.findByRole('radiogroup', { name: 'Status Siswa Contoh X-1 01' });
    expect(within(grup).getByRole('radio', { name: 'Izin' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Simpan absensi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tandai semua hadir' })).not.toBeInTheDocument();
  });

  it('admin tanpa kelas terpilih diminta memilih kelas; guru_penilai tidak punya akses', async () => {
    pasangApiTiruan('admin', penjawab());
    const { unmount } = tampilkanApp('/absensi-siswa');
    expect(
      await screen.findByText('Pilih kelas untuk menampilkan daftar siswa.'),
    ).toBeInTheDocument();
    unmount();

    pasangApiTiruan('guru_penilai', penjawab());
    tampilkanApp('/absensi-siswa');
    expect(
      await screen.findByText('Peran Anda tidak memiliki akses ke halaman ini.'),
    ).toBeInTheDocument();
  });
});

describe('Laporan Rekap Siswa', () => {
  const BARIS: LaporanSiswaBaris = {
    siswa_id: 1,
    nis: '9901001',
    nama_siswa: 'Siswa Contoh X-1 01',
    nama_kelas: 'X-1',
    hadir: 18,
    izin: 1,
    sakit: 0,
    alpa: 1,
    total: 20,
  };

  it('menampilkan ringkasan per siswa dan tautan ekspor mengikuti filter', async () => {
    pasangApiTiruan('manajemen_guru', (url) =>
      url.includes('/laporan/siswa')
        ? { body: { data: [BARIS], meta: { page: 1, pageSize: 20, total: 1 } } }
        : undefined,
    );
    tampilkanApp('/laporan-siswa?kelas_id=7&tanggal_dari=2026-11-01&tanggal_sampai=2026-11-13');
    const tabel = await screen.findByRole('table', { name: 'Laporan rekap kehadiran siswa' });
    expect(within(tabel).getByText('Siswa Contoh X-1 01')).toBeInTheDocument();
    expect(within(tabel).getByText('18')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ekspor CSV' })).toHaveAttribute(
      'href',
      '/api/v1/laporan/siswa/export?kelas_id=7&tanggal_dari=2026-11-01&tanggal_sampai=2026-11-13',
    );
  });

  it('rentang tanggal terbalik: pesan galat dan ekspor dinonaktifkan', async () => {
    pasangApiTiruan('admin');
    tampilkanApp('/laporan-siswa?tanggal_dari=2026-11-13&tanggal_sampai=2026-11-01');
    expect(
      await screen.findByText('Tanggal akhir tidak boleh sebelum tanggal awal.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ekspor CSV' })).toBeDisabled();
  });

  it('sekretaris tidak punya akses ke laporan', async () => {
    pasangApiTiruan('sekretaris_kelas');
    tampilkanApp('/laporan-siswa');
    expect(
      await screen.findByText('Peran Anda tidak memiliki akses ke halaman ini.'),
    ).toBeInTheDocument();
  });
});
