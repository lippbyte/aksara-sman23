import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pasangApiTiruan, tampilkanApp } from '@/test/bantuan';
import { judulHalaman, menuUntuk, NAV_ITEMS } from '../nav';

afterEach(() => vi.unstubAllGlobals());

async function menuTampil(): Promise<(string | null)[]> {
  const nav = await screen.findByRole('navigation', { name: 'Menu utama' });
  return within(nav)
    .getAllByRole('link')
    .map((a) => a.textContent);
}

describe('AppLayout', () => {
  it('admin melihat semua menu sesuai urutan DESIGN §5', async () => {
    pasangApiTiruan('admin');
    tampilkanApp();
    expect(await menuTampil()).toEqual(NAV_ITEMS.map((i) => i.label));
  });

  it('menampilkan nama sekolah dari pengaturan, footer pengembang, dan status produk', async () => {
    pasangApiTiruan('admin');
    tampilkanApp();
    expect(await screen.findByText('SMA Contoh Fiktif')).toBeInTheDocument();
    expect(screen.getByText('Dikembangkan oleh EDILAKSO · In Development')).toBeInTheDocument();
  });

  it('judul header mengikuti rute dan menu aktif ditandai', async () => {
    pasangApiTiruan('admin');
    tampilkanApp('/absensi-guru');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Absensi Guru');
    expect(screen.getByRole('link', { name: 'Absensi Guru' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('melipat sidebar dan menyimpan pilihan di localStorage', async () => {
    pasangApiTiruan('admin');
    tampilkanApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Lipat sidebar' }));
    expect(window.localStorage.getItem('sms.sidebar.terlipat')).toBe('1');
    // Saat terlipat label tetap tersedia untuk pembaca layar.
    expect(screen.getByRole('link', { name: 'Pengaturan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lebarkan sidebar' })).toBeInTheDocument();
  });

  it('rute tak dikenal menampilkan pesan tidak ditemukan', async () => {
    pasangApiTiruan('admin');
    tampilkanApp('/tidak-ada');
    expect(await screen.findByText('Halaman yang Anda tuju tidak ditemukan.')).toBeInTheDocument();
  });
});

describe('menu dan halaman mengikuti peran', () => {
  it('sekretaris_kelas hanya melihat menu yang menjadi haknya', async () => {
    pasangApiTiruan('sekretaris_kelas');
    tampilkanApp();
    expect(await menuTampil()).toEqual([
      'Dashboard Utama',
      'Absensi Guru',
      'Absensi Siswa',
      'Penilaian MGMP',
    ]);
  });

  it('guru_penilai tidak melihat Absensi Siswa, Rekap, Laporan, Log, dan Pengaturan', async () => {
    pasangApiTiruan('guru_penilai');
    tampilkanApp();
    expect(await menuTampil()).toEqual([
      'Dashboard Utama',
      'Absensi Guru',
      'Penilaian Kinerja',
      'Penilaian MGMP',
    ]);
  });

  it('hanya admin yang mendapat menu Log Aktivitas dan Pengaturan', () => {
    const label = (role: Parameters<typeof menuUntuk>[0]) => menuUntuk(role).map((m) => m.label);
    expect(label('manajemen_guru')).not.toContain('Pengaturan');
    expect(label('manajemen_guru')).not.toContain('Log Aktivitas');
    expect(label('manajemen_guru')).toContain('Rekap Kehadiran Guru');
    expect(label('admin')).toContain('Pengaturan');
  });

  it('membuka halaman di luar haknya lewat URL menampilkan pesan tanpa akses', async () => {
    const fetchTiruan = pasangApiTiruan('sekretaris_kelas');
    tampilkanApp('/pengaturan/guru');
    expect(
      await screen.findByText('Peran Anda tidak memiliki akses ke halaman ini.'),
    ).toBeInTheDocument();
    // Halaman tidak dirender, jadi data Pengaturan tidak pernah diminta.
    expect(fetchTiruan.mock.calls.some(([url]) => String(url).includes('/settings/'))).toBe(false);
  });
});

describe('halaman masuk', () => {
  it('pengguna yang belum masuk diarahkan ke halaman masuk', async () => {
    pasangApiTiruan(null);
    const { router } = tampilkanApp('/rekap-kehadiran');
    expect(await screen.findByText('Masuk untuk melanjutkan.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/masuk');
  });

  it('validasi klien memakai skema yang sama dengan server', async () => {
    const fetchTiruan = pasangApiTiruan(null);
    tampilkanApp('/masuk');
    fireEvent.click(await screen.findByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText('Format email tidak valid.')).toBeInTheDocument();
    expect(screen.getByText('Kata sandi wajib diisi.')).toBeInTheDocument();
    expect(fetchTiruan.mock.calls.some(([url]) => String(url).endsWith('/auth/login'))).toBe(false);
  });

  it('kredensial salah menampilkan pesan dari server', async () => {
    pasangApiTiruan(null, (url) =>
      url.endsWith('/auth/login')
        ? {
            status: 401,
            body: {
              error: { code: 'INVALID_CREDENTIALS', message: 'Email atau kata sandi salah.' },
            },
          }
        : undefined,
    );
    tampilkanApp('/masuk');
    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'admin@contoh.test' },
    });
    fireEvent.change(screen.getByLabelText('Kata sandi'), { target: { value: 'salah-sekali' } });
    fireEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Email atau kata sandi salah.'),
    );
  });
});

describe('judulHalaman', () => {
  it('memetakan path ke label menu', () => {
    expect(judulHalaman('/')).toBe('Dashboard Utama');
    expect(judulHalaman('/pengaturan/guru')).toBe('Pengaturan');
    expect(judulHalaman('/tentang')).toBe('Tentang');
  });
});
