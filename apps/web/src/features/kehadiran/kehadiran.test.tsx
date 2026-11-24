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

  it('kartu ponsel: dikelompokkan per tanggal, guru + status lebih dulu, detail hanya bila berisi', async () => {
    const HADIR_BIASA: Kehadiran = {
      ...CATATAN,
      id: 12,
      tanggal: '2026-11-12',
      nama_guru: 'Guru Contoh 04',
      jam_ke: 1,
      lama_jam: 1,
      status_kehadiran: 'Hadir',
      status_tugas: 'Ada',
      keterangan: null,
    };
    pasangApiTiruan(
      'admin',
      penjawab((url, init) =>
        url.includes('/kehadiran?') && (!init?.method || init.method === 'GET')
          ? { body: { data: [CATATAN, HADIR_BIASA], meta: { page: 1, pageSize: 20, total: 2 } } }
          : undefined,
      ),
    );
    tampilkanApp('/absensi-guru');
    const daftar = await screen.findAllByRole('list', { name: 'Daftar kehadiran guru' });
    expect(daftar).toHaveLength(2);
    // Judul kelompok tanggal menggantikan baris "Tanggal" di setiap kartu.
    expect(screen.getByRole('heading', { name: 'Jumat, 13 Nov 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kamis, 12 Nov 2026' })).toBeInTheDocument();

    const tidakHadir = screen.getByRole('article', { name: 'Guru Contoh 03' });
    expect(within(tidakHadir).getByText('Fisika · Kelas X-1 · 2 JP')).toBeInTheDocument();
    expect(within(tidakHadir).getByText('3–4')).toBeInTheDocument();
    expect(within(tidakHadir).getByText('Tidak Hadir')).toBeInTheDocument();
    // Tugas relevan bila tidak hadir; keterangan tampil karena berisi.
    expect(within(tidakHadir).getByText('Tugas: Ada')).toBeInTheDocument();
    expect(within(tidakHadir).getByText('Tugas dititipkan (contoh)')).toBeInTheDocument();
    expect(
      within(tidakHadir).getByRole('button', {
        name: 'Ubah catatan Guru Contoh 03, 13/11/2026, jam ke-3–4',
      }),
    ).toBeInTheDocument();

    // Hadir dengan tugas bawaan dan tanpa keterangan: tidak ada baris kosong "Tugas"/"—".
    const hadir = screen.getByRole('article', { name: 'Guru Contoh 04' });
    expect(within(hadir).queryByText(/^Tugas/)).not.toBeInTheDocument();
    expect(within(hadir).queryByText('—')).not.toBeInTheDocument();
  });

  it('kartu ponsel sekretaris tidak mengulang nama kelasnya sendiri', async () => {
    pasangApiTiruan('sekretaris_kelas', penjawab());
    tampilkanApp('/absensi-guru');
    const kartu = await screen.findByRole('article', { name: 'Guru Contoh 03' });
    expect(within(kartu).getByText('Fisika · 2 JP')).toBeInTheDocument();
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

  it('form: isian Tugas muncul bila guru tidak Hadir dan tetap tampil bila nilainya diubah', async () => {
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

    // Hadir (bawaan) + tugas "Ada" (bawaan): isian disembunyikan.
    expect(within(dialog).queryByRole('radiogroup', { name: /^Tugas/ })).not.toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('radio', { name: 'Tidak Hadir' }));
    const tugas = within(dialog).getByRole('radiogroup', { name: /^Tugas/ });
    fireEvent.click(within(tugas).getByRole('radio', { name: 'Tidak ada tugas' }));

    // Kembali ke Hadir: nilai bukan bawaan, jadi isian tetap terlihat (tidak ada nilai tersembunyi).
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Hadir' }));
    expect(within(dialog).getByRole('radiogroup', { name: /^Tugas/ })).toBeInTheDocument();

    fireEvent.click(await within(dialog).findByRole('button', { name: /Jam 5–6/ }));
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
      status_kehadiran: 'Hadir',
      status_tugas: 'Tidak Ada',
    });
  });

  it('menutup dialog mengembalikan fokus ke tombol yang membukanya (QA Fase 6)', async () => {
    pasangApiTiruan('sekretaris_kelas', penjawab());
    tampilkanApp('/absensi-guru');
    const pemicu = (await screen.findAllByRole('button', { name: 'Catat kehadiran' }))[0]!;
    pemicu.focus();
    fireEvent.click(pemicu);
    const dialog = await screen.findByRole('dialog', { name: 'Catat kehadiran guru' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(pemicu));
  });

  it('form: grup pilihan dinamai labelnya dan wajib; menutup form berisi meminta konfirmasi', async () => {
    pasangApiTiruan('sekretaris_kelas', penjawab());
    tampilkanApp('/absensi-guru');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Catat kehadiran' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Catat kehadiran guru' });

    // Label Field menamai radiogroup lewat aria-labelledby dan status wajib diumumkan (M1).
    const grupStatus = within(dialog).getByRole('radiogroup', { name: 'Status kehadiran' });
    expect(grupStatus).toHaveAttribute('aria-required', 'true');

    // Form masih bersih: Esc langsung menutup.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Form berisi: Esc dan Batal meminta konfirmasi lebih dulu (M3).
    fireEvent.click(screen.getAllByRole('button', { name: 'Catat kehadiran' })[0]!);
    const dialogLagi = await screen.findByRole('dialog', { name: 'Catat kehadiran guru' });
    fireEvent.click(within(dialogLagi).getByRole('radio', { name: 'Tidak Hadir' }));
    fireEvent.keyDown(dialogLagi, { key: 'Escape' });
    const tanya = await screen.findByRole('dialog', { name: 'Buang perubahan?' });
    fireEvent.click(within(tanya).getByRole('button', { name: 'Lanjut mengisi' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Buang perubahan?' })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('dialog', { name: 'Catat kehadiran guru' })).toBeInTheDocument();

    fireEvent.click(within(dialogLagi).getByRole('button', { name: 'Batal' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'Buang perubahan?' })).getByRole('button', {
        name: 'Buang perubahan',
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
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

  it('sekretaris: jadwal hari ini paling atas sebagai daftar periksa dengan aksi per jam', async () => {
    const fetchTiruan = pasangApiTiruan(
      'sekretaris_kelas',
      penjawab((url) =>
        url.includes('/dashboard/kelas/7') ? { body: { data: DASHBOARD } } : undefined,
      ),
    );
    tampilkanApp('/');
    expect(await screen.findByRole('heading', { name: 'Kelas X-1' })).toBeInTheDocument();

    // Slot terjadwal jam 7–8 belum dicatat → "Catat"; catatan jam 3–4 tanpa slot → "Ubah".
    const daftar = screen
      .getAllByRole('list')
      .find((ul) => /^Jadwal/.test(ul.getAttribute('aria-label') ?? ''));
    expect(daftar).toBeDefined();
    const item = within(daftar!).getAllByRole('listitem');
    expect(item).toHaveLength(2);
    expect(within(item[0]!).getByText('3–4')).toBeInTheDocument();
    expect(within(item[0]!).getByText('Fisika · di luar jadwal')).toBeInTheDocument();
    expect(within(item[0]!).getByText('Tidak Hadir')).toBeInTheDocument();
    expect(within(item[1]!).getByText('Belum dicatat')).toBeInTheDocument();
    expect(screen.getByText('0/1 tercatat')).toBeInTheDocument();

    // Ringkasan tetap ada (PROJECT-CONTEXT §7), sebagai satu kartu kecil.
    const ringkasan = screen.getByRole('region', { name: 'Kehadiran guru' });
    expect(within(ringkasan).getByText('4 JP')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Isi absensi siswa/ })).toHaveAttribute(
      'href',
      expect.stringContaining('/absensi-siswa?kelas_id=7'),
    );

    // "Catat" membuka form dengan guru dan jam slot itu.
    fireEvent.click(
      within(item[1]!).getByRole('button', { name: 'Catat kehadiran Guru Contoh 03, jam ke-7–8' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Catat kehadiran guru' });
    await waitFor(() => expect(within(dialog).getByLabelText(/^Guru/)).toHaveValue('3'));
    expect(within(dialog).getByLabelText(/^Jam ke-/)).toHaveValue('7');

    // Sekretaris hanya meminta dashboard kelasnya sendiri.
    const urlDashboard = fetchTiruan.mock.calls
      .map(([u]) => String(u))
      .filter((u) => u.includes('/dashboard/kelas/'));
    expect(urlDashboard.every((u) => u.includes('/dashboard/kelas/7'))).toBe(true);
  });

  it('"Ubah" pada jam yang tercatat membuka form ubah catatan itu', async () => {
    pasangApiTiruan(
      'sekretaris_kelas',
      penjawab((url) =>
        url.includes('/dashboard/kelas/7') ? { body: { data: DASHBOARD } } : undefined,
      ),
    );
    tampilkanApp('/');
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ubah catatan Guru Contoh 03, jam ke-3–4' }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Ubah catatan kehadiran' }),
    ).toBeInTheDocument();
  });

  it('filter jurnal dari URL disaring di layar; daftar jadwal tetap lengkap', async () => {
    const fetchTiruan = pasangApiTiruan(
      'admin',
      penjawab((url) =>
        url.includes('/dashboard/kelas/7') ? { body: { data: DASHBOARD } } : undefined,
      ),
    );
    tampilkanApp('/kelas/7?status=Hadir');
    expect(await screen.findByRole('heading', { name: 'Kelas X-1' })).toBeInTheDocument();
    // Jurnal terbuka karena filter aktif, dan catatan "Tidak Hadir" tersaring.
    expect(
      await screen.findByText('Tidak ada catatan yang cocok dengan filter.'),
    ).toBeInTheDocument();
    // Daftar jadwal tetap menampilkan catatan itu.
    expect(screen.getByText('Fisika · di luar jadwal')).toBeInTheDocument();
    // Filter tidak dikirim ke API (endpoint sama, data lengkap untuk daftar jadwal).
    const urlDashboard = fetchTiruan.mock.calls
      .map(([u]) => String(u))
      .filter((u) => u.includes('/dashboard/kelas/'));
    expect(urlDashboard.some((u) => u.includes('status='))).toBe(false);
    const konteks = screen.getByRole('region', { name: 'Kelas X-1' });
    expect(within(konteks).getByRole('link', { name: 'Dashboard Utama' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
