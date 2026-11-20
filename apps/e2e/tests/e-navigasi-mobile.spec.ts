import { expect, test } from '@playwright/test';
import { masuk } from './bantuan';
import { AKUN } from './konstanta';

const SLOT_PER_PERAN = [
  {
    email: AKUN.sekretaris,
    label: 'sekretaris_kelas',
    tautan: ['Beranda', 'Absensi Guru', 'Absensi Siswa', 'MGMP'],
    slotLima: 'Akun',
  },
  {
    email: AKUN.penilai,
    label: 'guru_penilai',
    tautan: ['Beranda', 'Absensi Guru', 'Penilaian', 'MGMP'],
    slotLima: 'Akun',
  },
  {
    email: AKUN.manajemen,
    label: 'manajemen_guru',
    tautan: ['Beranda', 'Rekap', 'Penilaian', 'Laporan'],
    slotLima: 'Lainnya',
  },
  {
    email: AKUN.admin,
    label: 'admin',
    tautan: ['Beranda', 'Absensi Guru', 'Rekap', 'Penilaian'],
    slotLima: 'Lainnya',
  },
] as const;

test.describe('navigasi mobile & responsif Fase 12', () => {
  for (const p of SLOT_PER_PERAN) {
    test(`bar bawah menampilkan slot yang benar untuk ${p.label}`, async ({ page }, info) => {
      await masuk(page, p.email);
      const barBawah = page.getByRole('navigation', { name: 'Navigasi utama' });

      if (info.project.name === 'ponsel-360') {
        await expect(barBawah).toBeVisible();
        await expect(page.getByRole('button', { name: 'Buka menu' })).toHaveCount(0);
        const tautan = await barBawah.getByRole('link').allTextContents();
        expect(tautan).toEqual([...p.tautan]);
        const pemicu = barBawah.getByRole('button', { name: p.slotLima });
        await expect(pemicu).toBeVisible();

        // Buka lembar "Lainnya"/"Akun" → tutup dengan Escape → fokus kembali ke pemicu.
        await pemicu.click();
        const lembar = page.getByRole('dialog');
        await expect(lembar).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(lembar).toBeHidden();
        await expect(pemicu).toBeFocused();
      } else {
        await expect(barBawah).toBeHidden();
        await expect(page.getByRole('navigation', { name: 'Menu utama' })).toBeVisible();
      }
    });
  }

  test('tidak ada gulir horizontal dan loncat halaman pagination bekerja', async ({
    page,
  }, info) => {
    await masuk(page, AKUN.admin);

    const rute = [
      '/',
      '/absensi-guru',
      '/absensi-siswa',
      '/rekap-kehadiran',
      '/penilaian-kinerja',
      '/penilaian-mgmp',
      '/laporan-siswa',
      '/pengaturan',
    ];
    for (const r of rute) {
      await page.goto(r);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const luapan = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(luapan, `Gulir horizontal pada ${r} (${info.project.name})`).toBeLessThanOrEqual(1);
    }

    // Uji loncat halaman pada halaman Laporan Siswa (180 siswa = 9 halaman).
    await page.goto('/laporan-siswa');
    const inputLoncat = page.getByLabel('Loncat ke halaman');
    await expect(inputLoncat).toBeVisible();
    await inputLoncat.fill('3');
    await inputLoncat.press('Enter');
    await expect(page).toHaveURL(/page=3/);
  });

  test('mode reduced-motion tidak menjalankan animasi spasial', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await masuk(page, AKUN.admin);
    const durasi = await page.evaluate(() => {
      const el = document.querySelector('.halaman-masuk');
      return el ? getComputedStyle(el).animationName : '';
    });
    expect(durasi).toBe('halaman-masuk-fade');
  });
});
