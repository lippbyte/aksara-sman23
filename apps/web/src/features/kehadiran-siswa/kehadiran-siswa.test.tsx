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
    expect(screen.getByText(/Semua siswa bawaan Hadir/)).toBeInTheDocument();
    expect(screen.getByText('Hadir 3')).toBeInTheDocument();

    const grup = screen.getByRole('radiogroup', { name: 'Status Siswa Contoh X-1 02' });
    fireEvent.click(within(grup).getByRole('radio', { name: 'Sakit' }));
    expect(screen.getByText('Sakit 1')).toBeInTheDocument();
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
    expect(screen.getByText('Alpa 1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tandai semua hadir' }));
    expect(screen.getByText('Hadir 3')).toBeInTheDocument();
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
    expect(await screen.findByText('Pilih kelas dulu')).toBeInTheDocument();
    unmount();

    pasangApiTiruan('guru_penilai', penjawab());
    tampilkanApp('/absensi-siswa');
    expect(
      await screen.findByText('Halaman ini tidak tersedia untuk peran Anda'),
    ).toBeInTheDocument();
  });

  const terpilih = (nama: string, status: string) =>
    within(screen.getByRole('radiogroup', { name: `Status ${nama}` })).getByRole('radio', {
      name: status,
    });

  it('isian yang belum disimpan tidak hilang saat data dimuat ulang; baris lain ikut server (C2)', async () => {
    let sesiServer: SesiAbsenSiswa = SESI;
    pasangApiTiruan('sekretaris_kelas', (url, init) =>
      url.includes('/kehadiran-siswa/sesi') && init?.method !== 'PUT'
        ? { body: { data: sesiServer } }
        : penjawab()(url, init),
    );
    const { client } = tampilkanApp('/absensi-siswa?tanggal=2026-11-16');

    await screen.findByText('Kelas X-1 · Jam ke-1');
    fireEvent.click(terpilih('Siswa Contoh X-1 02', 'Alpa'));
    expect(screen.getByText('1 perubahan belum disimpan.')).toBeInTheDocument();

    // Perangkat lain menyimpan siswa 03 sebagai Izin, lalu data dimuat ulang (mis. sambung ulang).
    sesiServer = {
      ...SESI,
      sudah_diisi: true,
      siswa: SESI.siswa.map((s) => (s.siswa_id === 3 ? { ...s, status: 'izin' as const } : s)),
    };
    await client.invalidateQueries({ queryKey: ['kehadiran-siswa'] });

    await waitFor(() =>
      expect(terpilih('Siswa Contoh X-1 03', 'Izin')).toHaveAttribute('aria-checked', 'true'),
    );
    expect(terpilih('Siswa Contoh X-1 02', 'Alpa')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('1 perubahan belum disimpan.')).toBeInTheDocument();
  });

  it('mengganti tanggal saat ada perubahan meminta konfirmasi lebih dulu', async () => {
    pasangApiTiruan('sekretaris_kelas', penjawab());
    const { router } = tampilkanApp('/absensi-siswa?tanggal=2026-11-16');
    await screen.findByText('Kelas X-1 · Jam ke-1');
    fireEvent.click(terpilih('Siswa Contoh X-1 01', 'Sakit'));

    fireEvent.change(screen.getByLabelText('Tanggal'), { target: { value: '2026-11-17' } });
    const tanya = await screen.findByRole('dialog', {
      name: 'Tinggalkan absensi yang belum disimpan?',
    });
    fireEvent.click(within(tanya).getByRole('button', { name: 'Tetap di sini' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(router.state.location.search).toBe('?tanggal=2026-11-16');
    expect(terpilih('Siswa Contoh X-1 01', 'Sakit')).toHaveAttribute('aria-checked', 'true');

    fireEvent.change(screen.getByLabelText('Tanggal'), { target: { value: '2026-11-17' } });
    const tanyaLagi = await screen.findByRole('dialog', {
      name: 'Tinggalkan absensi yang belum disimpan?',
    });
    fireEvent.click(within(tanyaLagi).getByRole('button', { name: 'Buang perubahan' }));
    await waitFor(() => expect(router.state.location.search).toBe('?tanggal=2026-11-17'));
  });

  it('pemilih jam menandai jam tersimpan dan mapel terjadwal; memilih jam mengubah URL', async () => {
    pasangApiTiruan('sekretaris_kelas', (url, init) => {
      if (url.includes('/kehadiran-siswa/riwayat') && url.includes('tanggal_dari=2026-11-16')) {
        return {
          body: {
            data: [
              {
                tanggal: '2026-11-16',
                jam_ke: 1,
                kelas_id: 7,
                nama_kelas: 'X-1',
                hadir: 3,
                izin: 0,
                sakit: 0,
                alpa: 0,
                total: 3,
              },
            ],
            meta: { page: 1, pageSize: 13, total: 1 },
          },
        };
      }
      if (url.includes('/kehadiran/jadwal')) {
        return {
          body: {
            data: [
              {
                guru_id: 3,
                kode_guru: 'G03',
                nama_guru: 'Guru Contoh 03',
                mata_pelajaran: 'Fisika',
                jam_ke: 1,
                total_jam_mengajar: 2,
                sudah_dicatat: true,
              },
            ],
          },
        };
      }
      return penjawab()(url, init);
    });
    const { router } = tampilkanApp('/absensi-siswa?tanggal=2026-11-16');
    const grupJam = await screen.findByRole('radiogroup', { name: 'Jam ke-' });
    expect(
      await within(grupJam).findByRole('radio', { name: 'Jam ke-1, Fisika, sudah tersimpan' }),
    ).toHaveAttribute('aria-checked', 'true');
    expect(within(grupJam).getByRole('radio', { name: 'Jam ke-2, Fisika' })).toBeInTheDocument();
    // Mapel jam ini ikut tampil di kepala sesi (hanya petunjuk, keputusan D7 opsi a).
    expect(await screen.findByText(/Senin, 16 Nov 2026 · Fisika/)).toBeInTheDocument();

    fireEvent.click(within(grupJam).getByRole('radio', { name: 'Jam ke-3' }));
    await waitFor(() => expect(router.state.location.search).toBe('?tanggal=2026-11-16&jam_ke=3'));
  });

  it('setelah tersimpan, bar simpan menawarkan lanjut ke jam berikutnya', async () => {
    let sudahDisimpan = false;
    pasangApiTiruan('sekretaris_kelas', (url, init) => {
      if (url.includes('/kehadiran-siswa/sesi') && init?.method === 'PUT') sudahDisimpan = true;
      if (url.includes('/kehadiran-siswa/sesi') && init?.method !== 'PUT') {
        return { body: { data: { ...SESI, sudah_diisi: sudahDisimpan } } };
      }
      return penjawab()(url, init);
    });
    const { router } = tampilkanApp('/absensi-siswa?tanggal=2026-11-16');
    await screen.findByText('Kelas X-1 · Jam ke-1');
    expect(screen.getByText('Belum diisi')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Simpan absensi' }));
    const lanjut = await screen.findByRole('button', { name: 'Lanjut ke jam ke-2' });
    expect(screen.getByText('Absensi jam ini tersimpan.')).toBeInTheDocument();
    expect(screen.getByText('Tersimpan')).toBeInTheDocument();

    fireEvent.click(lanjut);
    await waitFor(() => expect(router.state.location.search).toBe('?tanggal=2026-11-16&jam_ke=2'));
  });

  it('"Tandai semua hadir" bisa diurungkan', async () => {
    pasangApiTiruan('sekretaris_kelas', penjawab());
    tampilkanApp('/absensi-siswa');
    await screen.findByText('Kelas X-1 · Jam ke-1');
    fireEvent.click(terpilih('Siswa Contoh X-1 01', 'Alpa'));
    fireEvent.click(screen.getByRole('button', { name: 'Tandai semua hadir' }));
    expect(screen.getByText('Hadir 3')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Urungkan' }));
    expect(await screen.findByText('Alpa 1')).toBeInTheDocument();
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
      await screen.findByText('Halaman ini tidak tersedia untuk peran Anda'),
    ).toBeInTheDocument();
  });
});
