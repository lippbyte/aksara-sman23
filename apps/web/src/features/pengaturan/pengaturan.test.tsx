import type { Akun, Guru, Jadwal } from '@sms/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pasangApiTiruan, tampilkanApp } from '@/test/bantuan';

afterEach(() => vi.unstubAllGlobals());

// Data fiktif.
const GURU: Guru[] = [
  {
    id: 1,
    kode_guru: 'G01',
    nip: null,
    nama_guru: 'Guru Contoh 01',
    mata_pelajaran: 'Matematika',
    jabatan: 'Wali kelas',
    mgmp_id: 2,
    nama_mgmp: 'Matematika',
    status: 'aktif',
  },
  {
    id: 2,
    kode_guru: 'G02',
    nip: null,
    nama_guru: 'Guru Contoh 02',
    mata_pelajaran: 'Fisika',
    jabatan: null,
    mgmp_id: null,
    nama_mgmp: null,
    status: 'tidak_aktif',
  },
];

const JADWAL: Jadwal[] = [
  {
    id: 5,
    guru_id: 1,
    kelas_id: 7,
    hari: 1,
    jam_ke: 1,
    total_jam_mengajar: 2,
    nama_guru: 'Guru Contoh 01',
    kode_guru: 'G01',
    mata_pelajaran: 'Matematika',
    nama_kelas: 'X-1',
  },
  {
    id: 6,
    guru_id: 1,
    kelas_id: 7,
    hari: 2,
    jam_ke: 3,
    total_jam_mengajar: 1,
    nama_guru: 'Guru Contoh 01',
    kode_guru: 'G01',
    mata_pelajaran: 'Matematika',
    nama_kelas: 'X-1',
  },
];

const AKUN: Akun = {
  id: 9,
  name: 'Sekretaris Contoh',
  email: 'sekretaris@contoh.test',
  role: 'sekretaris_kelas',
  kelas_id: 7,
  nama_kelas: 'X-1',
  is_active: true,
};

const halaman = <T,>(data: T[]) => ({ data, meta: { page: 1, pageSize: 20, total: data.length } });

function penjawab(url: string, init?: RequestInit) {
  if (init?.method === 'POST') return { status: 201, body: { data: {} } };
  if (url.includes('/settings/guru')) return { body: halaman(GURU) };
  if (url.includes('/settings/jadwal')) return { body: halaman(JADWAL) };
  if (url.includes('/settings/users')) return { body: halaman([AKUN]) };
  if (url.includes('/referensi/kelas')) return { body: { data: [{ id: 7, nama_kelas: 'X-1' }] } };
  if (url.includes('/referensi/guru')) {
    return {
      body: {
        data: [
          { id: 1, kode_guru: 'G01', nama_guru: 'Guru Contoh 01', mata_pelajaran: 'Matematika' },
        ],
      },
    };
  }
  return undefined;
}

function bodyPost(fetchTiruan: ReturnType<typeof pasangApiTiruan>, potongan: string) {
  const panggilan = fetchTiruan.mock.calls.find(
    ([u, i]) => String(u).includes(potongan) && i?.method === 'POST',
  );
  return JSON.parse(String(panggilan?.[1]?.body)) as Record<string, unknown>;
}

describe('Pengaturan: daftar data', () => {
  it('jumlah data di atas daftar; kartu ponsel ringkas, lencana hanya untuk yang tidak aktif', async () => {
    pasangApiTiruan('admin', penjawab);
    tampilkanApp('/pengaturan/guru');
    expect(await screen.findByText('2 guru')).toBeInTheDocument();

    const aktif = screen.getByRole('article', { name: 'Guru Contoh 01' });
    expect(within(aktif).getByText('G01 · Matematika')).toBeInTheDocument();
    expect(within(aktif).getByText('MGMP Matematika · Wali kelas')).toBeInTheDocument();
    expect(within(aktif).queryByText('Aktif')).not.toBeInTheDocument();
    expect(within(aktif).getByRole('button', { name: 'Ubah Guru Contoh 01' })).toBeInTheDocument();

    const nonaktif = screen.getByRole('article', { name: 'Guru Contoh 02' });
    expect(within(nonaktif).getByText('Tidak aktif')).toBeInTheDocument();
  });

  it('jadwal di ponsel dikelompokkan per hari', async () => {
    pasangApiTiruan('admin', penjawab);
    tampilkanApp('/pengaturan/jadwal');
    expect(await screen.findByRole('heading', { name: 'Senin' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selasa' })).toBeInTheDocument();
    expect(screen.getByText('Jam ke-1–2 · 2 JP · Kelas X-1')).toBeInTheDocument();
  });
});

describe('Pengaturan: form', () => {
  it('form guru dikelompokkan; status berupa pilihan bersebelahan', async () => {
    const fetchTiruan = pasangApiTiruan('admin', penjawab);
    tampilkanApp('/pengaturan/guru');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Tambah guru' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Tambah guru' });

    for (const nama of ['Identitas', 'Mengajar', 'Status']) {
      expect(within(dialog).getByRole('group', { name: nama })).toBeInTheDocument();
    }
    const status = within(dialog).getByRole('radiogroup', { name: /^Status/ });
    expect(within(status).getByRole('radio', { name: 'Aktif' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    fireEvent.change(within(dialog).getByLabelText(/^Kode guru/), { target: { value: 'G09' } });
    fireEvent.change(within(dialog).getByLabelText(/^Nama guru/), {
      target: { value: 'Guru Contoh 09' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Mata pelajaran/), {
      target: { value: 'Kimia' },
    });
    fireEvent.click(within(status).getByRole('radio', { name: 'Tidak aktif' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambah guru' }));

    await waitFor(() =>
      expect(
        fetchTiruan.mock.calls.some(
          ([u, i]) => String(u).includes('/settings/guru') && i?.method === 'POST',
        ),
      ).toBe(true),
    );
    expect(bodyPost(fetchTiruan, '/settings/guru')).toMatchObject({
      kode_guru: 'G09',
      nama_guru: 'Guru Contoh 09',
      mata_pelajaran: 'Kimia',
      mgmp_id: null,
      status: 'tidak_aktif',
    });
  });

  it('form jadwal: jam mulai dari daftar 0–12 dan jumlah JP berupa pilihan', async () => {
    const fetchTiruan = pasangApiTiruan('admin', penjawab);
    tampilkanApp('/pengaturan/jadwal');
    fireEvent.click((await screen.findAllByRole('button', { name: 'Tambah jadwal' }))[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Tambah jadwal' });

    await within(dialog).findByRole('option', { name: /Guru Contoh 01/ });
    fireEvent.change(within(dialog).getByLabelText(/^Guru/), { target: { value: '1' } });
    fireEvent.change(within(dialog).getByLabelText(/^Kelas/), { target: { value: '7' } });
    fireEvent.change(within(dialog).getByLabelText(/^Hari/), { target: { value: '3' } });
    const jam = within(dialog).getByLabelText(/^Mulai jam ke-/);
    expect(within(jam).getByRole('option', { name: '0 (pagi)' })).toBeInTheDocument();
    fireEvent.change(jam, { target: { value: '0' } });
    fireEvent.click(within(dialog).getByRole('radio', { name: '2 JP' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tambah jadwal' }));

    await waitFor(() =>
      expect(
        fetchTiruan.mock.calls.some(
          ([u, i]) => String(u).includes('/settings/jadwal') && i?.method === 'POST',
        ),
      ).toBe(true),
    );
    expect(bodyPost(fetchTiruan, '/settings/jadwal')).toEqual({
      guru_id: 1,
      kelas_id: 7,
      hari: 3,
      jam_ke: 0,
      total_jam_mengajar: 2,
    });
  });

  it('ubah akun: kata sandi awal tidak tampil; kelas tampil untuk sekretaris', async () => {
    pasangApiTiruan('admin', penjawab);
    tampilkanApp('/pengaturan/akun');
    fireEvent.click(
      await screen
        .findAllByRole('button', { name: 'Ubah akun sekretaris@contoh.test' })
        .then((b) => b[0]!),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Ubah akun' });
    expect(within(dialog).queryByLabelText(/Kata sandi awal/)).not.toBeInTheDocument();
    const akses = within(dialog).getByRole('group', { name: 'Akses' });
    expect(within(akses).getByLabelText(/^Kelas/)).toBeInTheDocument();
  });
});
