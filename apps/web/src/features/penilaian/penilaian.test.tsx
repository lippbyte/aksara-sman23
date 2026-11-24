import type {
  DaftarPenilaian,
  PenilaianKinerjaBaris,
  PenilaianMgmpBaris,
  SkorSiswaKelasBaris,
} from '@sms/shared';
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

function daftar<T>(
  data: T[],
  jendela = JENDELA_BUKA,
  pekan_belum_disinkron: DaftarPenilaian<T>['pekan_belum_disinkron'] = [],
  pekan_rekap_sebagian: DaftarPenilaian<T>['pekan_rekap_sebagian'] = [],
): DaftarPenilaian<T> {
  return {
    data,
    meta: { page: 1, pageSize: 20, total: data.length },
    jendela,
    pekan_belum_disinkron,
    pekan_rekap_sebagian,
  };
}

const SEBAGIAN: DaftarPenilaian<unknown>['pekan_rekap_sebagian'] = [
  {
    minggu_ke: 4,
    tahun: 2026,
    tanggal_mulai: '2026-11-09',
    tanggal_selesai: '2026-11-13',
    terekap: 10,
    jumlah_guru: 12,
  },
];

const BELUM: DaftarPenilaian<unknown>['pekan_belum_disinkron'] = [
  { minggu_ke: 5, tahun: 2026, tanggal_mulai: '2026-11-16', tanggal_selesai: '2026-11-20' },
  { minggu_ke: 6, tahun: 2026, tanggal_mulai: '2026-11-23', tanggal_selesai: '2026-11-27' },
];

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

  it('kartu ponsel: skor ringkas satu baris, predikat, dan tombol Nilai', async () => {
    pasangApiTiruan('guru_penilai', (url) =>
      url.includes('/penilaian-kinerja?') ? { body: daftar(KINERJA) } : undefined,
    );
    tampilkanApp('/penilaian-kinerja?bulan=11&tahun=2026');
    const kartu = await screen.findByRole('article', { name: 'Guru Contoh 01' });
    expect(within(kartu).getByText('Matematika')).toBeInTheDocument();
    expect(
      within(kartu).getByText(
        'Skor akhir 89,63 · Kehadiran 91,25 · Administrasi 88,00 · Manajemen —',
      ),
    ).toBeInTheDocument();
    expect(within(kartu).getByText('Baik')).toBeInTheDocument();
    expect(within(kartu).getByRole('button', { name: 'Nilai Guru Contoh 01' })).toBeEnabled();
    const belum = screen.getByRole('article', { name: 'Guru Contoh 02' });
    expect(within(belum).getByText('Belum dinilai')).toBeInTheDocument();
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
      await screen.findByText('Halaman ini tidak tersedia untuk peran Anda'),
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
      skor_kehadiran: 88,
      skor_siswa: 85,
      kelas_terisi: 2,
      jumlah_kelas: 6,
      skor_kelas_saya: null,
      skor_administrasi: null,
      skor_akhir: null,
      predikat: null,
      catatan: null,
      sudah_dinilai: false,
      nama_penilai: null,
      updated_at: '2026-11-28T03:00:00.000Z',
    },
  ];
  const MGMP_SEKRETARIS: PenilaianMgmpBaris[] = [
    { ...MGMP[0]!, skor_kehadiran: null, skor_siswa: null, skor_kelas_saya: 80 },
  ];
  const RINCIAN: SkorSiswaKelasBaris[] = [
    {
      kelas_id: 1,
      nama_kelas: 'X-1',
      skor: 80,
      nama_pengisi: 'Sekretaris X-1 Contoh',
      updated_at: null,
      berjadwal: true,
    },
    {
      kelas_id: 2,
      nama_kelas: 'X-2',
      skor: 90,
      nama_pengisi: 'Guru Penilai Contoh',
      updated_at: null,
      berjadwal: true,
    },
    {
      kelas_id: 3,
      nama_kelas: 'XI-1',
      skor: null,
      nama_pengisi: null,
      updated_at: null,
      berjadwal: true,
    },
  ];

  it('sekretaris: skor kelasnya dan "n dari m kelas"; mengisi lewat rute skor siswa tanpa kelas', async () => {
    const fetchTiruan = pasangApiTiruan('sekretaris_kelas', (url, init) => {
      if (url.endsWith('/penilaian-mgmp/skor-siswa') && init?.method === 'PUT')
        return { body: { data: MGMP_SEKRETARIS[0] } };
      return url.includes('/penilaian-mgmp?') ? { body: daftar(MGMP_SEKRETARIS) } : undefined;
    });
    tampilkanApp('/penilaian-mgmp?bulan=11&tahun=2026');
    const tabel = await screen.findByRole('table', { name: 'Penilaian MGMP November 2026' });
    const judul = within(tabel)
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(judul).toEqual(['MGMP', 'Skor siswa X-1', 'Sudah mengisi', 'Aksi']);
    expect(within(tabel).getAllByText('2 dari 6 kelas')[0]).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sinkronkan/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ekspor CSV' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Isi skor siswa MGMP Matematika' })[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/Kelas/)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Skor administrasi/)).not.toBeInTheDocument();
    const isian = within(dialog).getByLabelText(/^Skor siswa kelas Anda/);
    expect(isian).toHaveValue(80);
    fireEvent.change(isian, { target: { value: '85.5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));

    await waitFor(() =>
      expect(fetchTiruan.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true),
    );
    const [url, init] = fetchTiruan.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    expect(String(url)).toContain('/penilaian-mgmp/skor-siswa');
    expect(JSON.parse(String(init?.body))).toEqual({
      mgmp_id: 1,
      bulan: 11,
      tahun: 2026,
      skor: 85.5,
    });
  });

  it('manajemen: semua kolom, rata-rata skor siswa dengan "n dari m kelas", sinkron, dan ekspor', async () => {
    pasangApiTiruan('manajemen_guru', (url) =>
      url.includes('/penilaian-mgmp?') ? { body: daftar(MGMP) } : undefined,
    );
    tampilkanApp('/penilaian-mgmp?bulan=11&tahun=2026');
    const tabel = await screen.findByRole('table');
    expect(within(tabel).getAllByRole('columnheader')).toHaveLength(8);
    expect(within(tabel).getAllByText('85,00')[0]).toBeInTheDocument();
    expect(within(tabel).getAllByText('2 dari 6 kelas')[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sinkronkan skor otomatis' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ekspor CSV' })).toHaveAttribute(
      'href',
      '/api/v1/penilaian-mgmp/export?bulan=11&tahun=2026',
    );
  });

  it('form nilai penilai tidak lagi berisi skor siswa', async () => {
    const fetchTiruan = pasangApiTiruan('guru_penilai', (url, init) => {
      if (url.endsWith('/penilaian-mgmp') && init?.method === 'PUT')
        return { body: { data: MGMP[0] } };
      return url.includes('/penilaian-mgmp?') ? { body: daftar(MGMP) } : undefined;
    });
    tampilkanApp('/penilaian-mgmp?bulan=11&tahun=2026');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Nilai MGMP Matematika' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/Skor siswa/)).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Skor administrasi'), {
      target: { value: '90' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
    await waitFor(() =>
      expect(fetchTiruan.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true),
    );
    const [, init] = fetchTiruan.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    expect(JSON.parse(String(init?.body))).toEqual({
      mgmp_id: 1,
      bulan: 11,
      tahun: 2026,
      skor_administrasi: 90,
      catatan: null,
    });
  });

  it('penilai: rincian per kelas dan mengisi skor untuk kelas yang dipilih (kelas wajib)', async () => {
    const fetchTiruan = pasangApiTiruan('guru_penilai', (url, init) => {
      if (url.endsWith('/penilaian-mgmp/skor-siswa') && init?.method === 'PUT')
        return { body: { data: MGMP[0] } };
      if (url.includes('/penilaian-mgmp/skor-siswa?')) return { body: { data: RINCIAN } };
      return url.includes('/penilaian-mgmp?') ? { body: daftar(MGMP) } : undefined;
    });
    tampilkanApp('/penilaian-mgmp?bulan=11&tahun=2026');
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Skor siswa per kelas MGMP Matematika' }))[0]!,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Skor siswa MGMP Matematika' });
    const rincian = await within(dialog).findByRole('table', { name: 'Skor siswa per kelas' });
    expect(within(rincian).getByText('Sekretaris X-1 Contoh')).toBeInTheDocument();
    expect(within(rincian).getByText('Belum mengisi')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^Skor siswa kelas ini/), {
      target: { value: '75' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
    expect(await within(dialog).findByText('Kelas wajib dipilih.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^Kelas/), { target: { value: '3' } });
    fireEvent.change(within(dialog).getByLabelText(/^Skor siswa kelas ini/), {
      target: { value: '75' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Simpan' }));
    await waitFor(() =>
      expect(fetchTiruan.mock.calls.some(([, i]) => i?.method === 'PUT')).toBe(true),
    );
    const [, init] = fetchTiruan.mock.calls.find(([, i]) => i?.method === 'PUT')!;
    expect(JSON.parse(String(init?.body))).toEqual({
      mgmp_id: 1,
      bulan: 11,
      tahun: 2026,
      kelas_id: 3,
      skor: 75,
    });
  });

  it('MGMP tanpa jadwal: "Tidak ada kelas berjadwal"; isian kelas tak berjadwal ditandai dan tidak bisa dipilih', async () => {
    const tanpa = { ...MGMP[0]!, mgmp_id: 2, nama_mapel: 'Seni', kelas_terisi: 0, jumlah_kelas: 0 };
    pasangApiTiruan('admin', (url) => {
      if (url.includes('/penilaian-mgmp/skor-siswa?'))
        return {
          body: {
            data: [
              ...RINCIAN,
              {
                kelas_id: 9,
                nama_kelas: 'XII-3',
                skor: 10,
                nama_pengisi: 'Admin Contoh',
                updated_at: null,
                berjadwal: false,
              },
            ],
          },
        };
      return url.includes('/penilaian-mgmp?') ? { body: daftar([...MGMP, tanpa]) } : undefined;
    });
    tampilkanApp('/penilaian-mgmp?bulan=11&tahun=2026');
    const tabel = await screen.findByRole('table');
    expect(within(tabel).getAllByText('Tidak ada kelas berjadwal')[0]).toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Skor siswa per kelas MGMP Matematika' })[0]!,
    );
    const dialog = await screen.findByRole('dialog');
    expect(
      await within(dialog).findByText('Tanpa jadwal MGMP ini, tidak dihitung'),
    ).toBeInTheDocument();
    const pilihan = within(within(dialog).getByLabelText(/^Kelas/))
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(pilihan).toEqual(['Pilih kelas', 'X-1', 'X-2', 'XI-1']);
  });

  it('peringatan pekan belum disinkron tampil untuk penilai, tidak untuk sekretaris', async () => {
    pasangApiTiruan('guru_penilai', (url) =>
      url.includes('/penilaian-mgmp?') ? { body: daftar(MGMP, JENDELA_BUKA, BELUM) } : undefined,
    );
    tampilkanApp('/penilaian-mgmp?bulan=11&tahun=2026');
    const status = await screen.findByText('2 pekan bulan ini belum disinkron');
    expect(status.closest('[role=status]')).toHaveTextContent(
      'Pekan 5 (16–20 Nov), Pekan 6 (23–27 Nov)',
    );
    expect(status.closest('[role=status]')).toHaveTextContent('tidak dihitung sebagai 0');
    expect(
      screen.queryByRole('link', { name: 'Buka Rekap Kehadiran Guru' }),
    ).not.toBeInTheDocument();
  });

  it('sekretaris: tanpa peringatan pekan; daftar kosong menjelaskan alasannya', async () => {
    pasangApiTiruan('sekretaris_kelas', (url) =>
      url.includes('/penilaian-mgmp?') ? { body: daftar([], JENDELA_BUKA, BELUM) } : undefined,
    );
    tampilkanApp('/penilaian-mgmp?bulan=11&tahun=2026');
    expect(
      await screen.findByText('Belum ada MGMP yang gurunya mengajar di kelas X-1.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/belum disinkron/)).not.toBeInTheDocument();
  });
});

describe('Peringatan pekan di Penilaian Kinerja', () => {
  it('manajemen melihat peringatan dengan tautan ke rekap', async () => {
    pasangApiTiruan('manajemen_guru', (url) =>
      url.includes('/penilaian-kinerja?')
        ? { body: daftar(KINERJA, JENDELA_BUKA, BELUM) }
        : undefined,
    );
    tampilkanApp('/penilaian-kinerja?bulan=11&tahun=2026');
    expect(await screen.findByText('2 pekan bulan ini belum disinkron')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Buka Rekap Kehadiran Guru' })).toHaveAttribute(
      'href',
      '/rekap-kehadiran',
    );
  });
});

describe('Peringatan pekan gabungan', () => {
  it('belum disinkron + sebagian → satu kotak, satu judul, dua rincian', async () => {
    pasangApiTiruan('manajemen_guru', (url) =>
      url.includes('/penilaian-kinerja?')
        ? { body: daftar(KINERJA, JENDELA_BUKA, BELUM, SEBAGIAN) }
        : undefined,
    );
    tampilkanApp('/penilaian-kinerja?bulan=11&tahun=2026');
    const judul = await screen.findByText('3 pekan bulan ini belum disinkron lengkap');
    const kotak = judul.closest('[role=status]');
    expect(
      screen.getAllByRole('status').filter((el) => el.textContent?.includes('pekan bulan ini')),
    ).toHaveLength(1);
    expect(kotak).toHaveTextContent('Belum disinkron: Pekan 5 (16–20 Nov), Pekan 6 (23–27 Nov).');
    expect(kotak).toHaveTextContent('Baru sebagian: Pekan 4 (9–13 Nov), 10 dari 12 guru.');
  });

  it('hanya sebagian → judul "baru disinkron sebagian"', async () => {
    pasangApiTiruan('guru_penilai', (url) =>
      url.includes('/penilaian-mgmp?')
        ? { body: daftar([], JENDELA_BUKA, [], SEBAGIAN) }
        : undefined,
    );
    tampilkanApp('/penilaian-mgmp?bulan=11&tahun=2026');
    expect(
      await screen.findByText('1 pekan bulan ini baru disinkron sebagian'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Belum disinkron:/)).not.toBeInTheDocument();
  });
});
