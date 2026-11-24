import { expect, test, type Page } from '@playwright/test';
import { masuk } from './bantuan';
import { PASSWORD_E2E } from './konstanta';

/** Tiap peran mendarat di Dashboard Utama dengan isi yang sesuai perannya. */
const PERAN = [
  {
    email: 'admin@contoh.test',
    label: 'Admin',
    ada: 'Log aktivitas terbaru',
    tidakAda: 'Guru yang belum dinilai',
  },
  {
    email: 'manajemen@contoh.test',
    label: 'Manajemen Guru',
    ada: 'Tren kehadiran guru per pekan',
    tidakAda: 'Log aktivitas terbaru',
  },
  {
    email: 'sekretaris.x1@contoh.test',
    label: 'Sekretaris Kelas · X-1',
    ada: 'Kelas X-1',
    tidakAda: 'Tren kehadiran guru per pekan',
  },
  {
    email: 'penilai@contoh.test',
    label: 'Guru Penilai',
    ada: 'Guru yang belum dinilai',
    tidakAda: 'Tren kehadiran guru per pekan',
  },
] as const;

/** Tombol Keluar ada di sidebar (desktop) atau lembar "Lainnya"/"Akun" di bar bawah (mobile). */
async function keluar(page: Page) {
  const tombol = page.getByRole('button', { name: 'Keluar' });
  if (!(await tombol.isVisible())) {
    const barBawah = page.getByRole('navigation', { name: 'Navigasi utama' });
    const pemicu = barBawah.getByRole('button', { name: /^(Lainnya|Akun)$/ });
    await pemicu.click();
  }
  await tombol.click();
}

test('login salah menampilkan pesan galat dan tetap di /masuk', async ({ page }) => {
  await page.goto('/masuk');
  await page.getByLabel('Email').fill('admin@contoh.test');
  await page.getByLabel('Kata sandi').fill('bukan-kata-sandinya');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email atau kata sandi salah.');
  await expect(page).toHaveURL(/\/masuk$/);

  // Email tak terdaftar → pesan yang sama (tidak membocorkan akun mana yang ada).
  await page.getByLabel('Email').fill('tidak.ada@contoh.test');
  await page.getByLabel('Kata sandi').fill(PASSWORD_E2E);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email atau kata sandi salah.');
});

for (const peran of PERAN) {
  test(`login ${peran.label} → mendarat di halaman yang sesuai; logout → /masuk dan halaman terlindung tertutup`, async ({
    page,
  }) => {
    await masuk(page, peran.email);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard Utama' })).toBeVisible();
    await expect(page.getByRole('heading', { name: peran.ada })).toBeVisible();
    await expect(page.getByRole('heading', { name: peran.tidakAda })).toHaveCount(0);

    // Identitas akun menyebut peran (dan kelas untuk sekretaris): menu pengguna di header
    // (desktop) atau kepala lembar "Lainnya"/"Akun" di bar bawah (mobile, satu-satunya menu akun).
    const menuHeader = page.getByRole('button', { name: 'Menu pengguna' });
    if (await menuHeader.isVisible()) {
      await menuHeader.click();
      await expect(page.getByRole('menu')).toContainText(peran.label);
    } else {
      await page
        .getByRole('navigation', { name: 'Navigasi utama' })
        .getByRole('button', { name: /^(Lainnya|Akun)$/ })
        .click();
      await expect(page.getByRole('dialog')).toContainText(peran.label);
    }
    await page.keyboard.press('Escape');

    await keluar(page);
    await expect(page).toHaveURL(/\/masuk$/);
    await expect(page.getByText('Masuk untuk melanjutkan.')).toBeVisible();

    // Halaman terlindung tidak bisa dibuka lagi; sesi di server juga sudah berakhir.
    await page.goto('/absensi-guru');
    await expect(page).toHaveURL(/\/masuk$/);
    expect((await page.request.get('/api/v1/auth/me')).status()).toBe(401);
  });
}

test('membuka halaman terlindung saat belum masuk → /masuk, lalu kembali ke halaman itu setelah login', async ({
  page,
}) => {
  await page.goto('/rekap-kehadiran');
  await expect(page).toHaveURL(/\/masuk$/);
  await page.getByLabel('Email').fill('manajemen@contoh.test');
  await page.getByLabel('Kata sandi').fill(PASSWORD_E2E);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/rekap-kehadiran$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Rekap Kehadiran Guru' })).toBeVisible();
});
