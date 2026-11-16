import type { DashboardKelas, Kehadiran } from '@sms/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SegmentedStatus } from '@/components/SegmentedStatus';
import { pasangApiTiruan, tampilkanApp } from '@/test/bantuan';

afterEach(() => vi.unstubAllGlobals());

const CATATAN: Kehadiran = {
  id: 11,
  tanggal: '2026-11-13',
  guru_id: 3,
  kode_guru: 'G03',
  nama_guru: 'Guru Contoh 03',
  mata_pelajaran: 'Fisika',
  kelas_id: 7,
  nama_kelas: 'X-1',
  jam_ke: 3,
  lama_jam: 2,
  status_kehadiran: 'Tidak Hadir',
  status_tugas: 'Ada',
  keterangan: 'Tugas dititipkan (contoh)',
  created_by: 1,
  nama_pembuat: 'Admin Contoh',
  created_at: '2026-11-13T02:00:00.000Z',
};

const REFERENSI = {
  kelas: [{ id: 7, nama_kelas: 'X-1' }],
  guru: [{ id: 3, kode_guru: 'G03', nama_guru: 'Guru Contoh 03', mata_pelajaran: 'Fisika' }],
};

function penjawab(
  tambahan?: (url: string, init?: RequestInit) => { status?: number; body?: unknown } | undefined,
) {
  return (url: string, init?: RequestInit) => {
    const khusus = tambahan?.(url, init);
    if (khusus) return khusus;
    if (url.includes('/referensi/kelas')) return { body: { data: REFERENSI.kelas } };
    if (url.includes('/referensi/guru')) return { body: { data: REFERENSI.guru } };
    if (url.includes('/kehadiran/jadwal')) {
      return {
        body: {
          data: [
            {
              guru_id: 3,
              kode_guru: 'G03',
              nama_guru: 'Guru Contoh 03',
              mata_pelajaran: 'Fisika',
              jam_ke: 5,
              total_jam_mengajar: 2,
              sudah_dicatat: false,
            },
          ],
        },
      };
    }
    if (url.includes('/kehadiran') && (!init?.method || init.method === 'GET')) {
      return { body: { data: [CATATAN], meta: { page: 1, pageSize: 20, total: 1 } } };
    }
    return undefined;
  };
}

describe('SegmentedStatus', () => {
  function Contoh() {
    const [nilai, setNilai] = useState<string | null>('Hadir');
    return (
      <SegmentedStatus
        label="Status kehadiran"
        nilai={nilai}
        onUbah={setNilai}
        opsi={[
          { nilai: 'Hadir', label: 'Hadir' },
          { nilai: 'Mendampingi', label: 'Mendampingi' },
          { nilai: 'Tidak Hadir', label: 'Tidak Hadir' },
        ]}
      />
    );
  }

  it('berperan sebagai radio group dan menampilkan teks status (bukan hanya warna)', () => {
    render(<Contoh />);
    const grup = screen.getByRole('radiogroup', { name: 'Status kehadiran' });
    const radio = within(grup).getAllByRole('radio');
    expect(radio.map((r) => r.textContent)).toEqual(['Hadir', 'Mendampingi', 'Tidak Hadir']);
    expect(radio[0]).toHaveAttribute('aria-checked', 'true');
    // Hanya pilihan aktif yang masuk urutan Tab.
    expect(radio.map((r) => r.tabIndex)).toEqual([0, -1, -1]);
  });

  it('klik dan tombol panah mengubah pilihan', () => {
    render(<Contoh />);
    const grup = screen.getByRole('radiogroup');
    fireEvent.click(screen.getByRole('radio', { name: 'Tidak Hadir' }));
    expect(screen.getByRole('radio', { name: 'Tidak Hadir' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Panah kanan dari pilihan terakhir kembali ke pilihan pertama.
    fireEvent.keyDown(grup, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'Hadir' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(grup, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'Tidak Hadir' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

describe('halaman Absensi Guru', () => {
  it('menampilkan catatan dengan lencana status dan rentang jam', async () => {
    pasangApiTiruan('admin', penjawab());
    tampilkanApp('/absensi-guru');
    const tabel = await screen.findByRole('table', { name: 'Daftar kehadiran guru' });
    expect(within(tabel).getByText('Guru Contoh 03')).toBeInTheDocument();
    expect(within(tabel).getByText('3–4')).toBeInTheDocument();
    expect(within(tabel).getByText('13/11/2026')).toBeInTheDocument();
    expect(within(tabel).getByText('Tidak Hadir')).toBeInTheDocument();
  });

  it('guru_penilai tidak mendapat tombol hapus; admin mendapatkannya', async () => {
    pasangApiTiruan('guru_penilai', penjawab());
    const { unmount } = tampilkanApp('/absensi-guru');
    await screen.findByRole('table', { name: 'Daftar kehadiran guru' });
    expect(screen.queryAllByRole('button', { name: /^Hapus catatan/ })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /^Ubah catatan/ }).length).toBeGreaterThan(0);
    unmount();

    pasangApiTiruan('admin', penjawab());
    tampilkanApp('/absensi-guru');
    await screen.findByRole('table', { name: 'Daftar kehadiran guru' });
    expect(screen.getAllByRole('button', { name: /^Hapus catatan/ }).length).toBeGreaterThan(0);
  });

  it('filter tersimpan di URL dan ikut dikirim ke API', async () => {
    const fetchTiruan = pasangApiTiruan('admin', penjawab());
    const { router } = tampilkanApp('/absensi-guru?status=Tidak%20Hadir&tanggal=2026-11-13');
    await screen.findByRole('table', { name: 'Daftar kehadiran guru' });
    const url = fetchTiruan.mock.calls
      .map(([u]) => String(u))
      .find((u) => u.includes('/kehadiran?'));
    expect(url).toContain('status=Tidak+Hadir');
    expect(url).toContain('tanggal=2026-11-13');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('form: sekretaris tidak memilih kelas; chip jadwal mengisi guru, jam ke, dan lama', async () => {
    const fetchTiruan = pasangApiTiruan(
      'sekretaris_kelas',
      penjawab((url, init) =>
        url.endsWith('/kehadiran') && init?.method === 'POST'
          ? { status: 201, body: { data: CATATAN } }
          : undefined,
      ),
    );
    tampilkanApp('/absensi-guru');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Catat kehadiran' }))[0]!);

    const dialog = await screen.findByRole('dialog', { name: 'Catat kehadiran guru' });
    expect(within(dialog).queryByLabelText(/^Kelas/)).not.toBeInTheDocument();
    expect(within(dialog).getByText('X-1')).toBeInTheDocument();

    fireEvent.click(await within(dialog).findByRole('button', { name: /Jam 5–6/ }));
    expect(within(dialog).getByLabelText(/^Jam ke-/)).toHaveValue('5');
    expect(within(dialog).getByRole('radio', { name: '2 JP' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    fireEvent.click(within(dialog).getByRole('radio', { name: 'Mendampingi' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Catat kehadiran' }));

    await waitFor(() =>
      expect(
        fetchTiruan.mock.calls.some(
          ([u, i]) => String(u).endsWith('/kehadiran') && i?.method === 'POST',
        ),
      ).toBe(true),
    );
    const panggilan = fetchTiruan.mock.calls.find(
      ([u, i]) => String(u).endsWith('/kehadiran') && i?.method === 'POST',
    );
    expect(JSON.parse(String(panggilan?.[1]?.body))).toMatchObject({
      guru_id: 3,
      jam_ke: 5,
      lama_jam: 2,
      status_kehadiran: 'Mendampingi',
      status_tugas: 'Ada',
    });
  });

  it('form: tanpa guru menampilkan pesan validasi; bentrok jam dari server ditampilkan', async () => {
    pasangApiTiruan(
      'admin',
      penjawab((url, init) =>
        url.endsWith('/kehadiran') && init?.method === 'POST'
          ? {
              status: 409,
              body: {
                error: {
                  code: 'CONFLICT',
                  message: 'Jam bentrok: guru ini sudah dicatat pada jam ke-1–2 di kelas X-2.',
                },
              },
            }
          : undefined,
      ),
    );
    tampilkanApp('/absensi-guru');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Catat kehadiran' }))[0]!);
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Catat kehadiran' }));
    expect(await within(dialog).findByText('Guru wajib dipilih.')).toBeInTheDocument();
    expect(within(dialog).getByText('Kelas wajib dipilih.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/^Kelas/), { target: { value: '7' } });
    await within(dialog).findByRole('option', { name: /Guru Contoh 03/ });
    fireEvent.change(within(dialog).getByLabelText(/^Guru/), { target: { value: '3' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Catat kehadiran' }));
    expect(await within(dialog).findByText(/Jam bentrok/)).toBeInTheDocument();
  });
});

describe('Dashboard Kelas', () => {
  const DASHBOARD: DashboardKelas = {
    kelas: { id: 7, nama_kelas: 'X-1' },
    tanggal: '2026-11-13',
    hitungan: { Hadir: 2, Mendampingi: 1, 'Tidak Hadir': 1 },
    jam: { Hadir: 4, Mendampingi: 2, 'Tidak Hadir': 2 },
    jurnal: [CATATAN],
    jadwal: [
      {
        guru_id: 3,
        kode_guru: 'G03',
        nama_guru: 'Guru Contoh 03',
        mata_pelajaran: 'Fisika',
        jam_ke: 7,
        total_jam_mengajar: 2,
        sudah_dicatat: false,
      },
    ],
  };

  it('sekretaris: Dashboard Utama menampilkan dashboard kelasnya dengan tombol besar', async () => {
    const fetchTiruan = pasangApiTiruan(
      'sekretaris_kelas',
      penjawab((url) =>
        url.includes('/dashboard/kelas/7') ? { body: { data: DASHBOARD } } : undefined,
      ),
    );
    tampilkanApp('/');
    expect(await screen.findByText('Kelas X-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Catat kehadiran guru' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Absen siswa' })).toBeInTheDocument();
    expect(screen.getByText('Jadwal yang belum dicatat')).toBeInTheDocument();
    expect(screen.getByText('4 JP')).toBeInTheDocument();
    // Sekretaris hanya meminta dashboard kelasnya sendiri.
    const urlDashboard = fetchTiruan.mock.calls
      .map(([u]) => String(u))
      .filter((u) => u.includes('/dashboard/kelas/'));
    expect(urlDashboard.every((u) => u.includes('/dashboard/kelas/7'))).toBe(true);
  });
});
