import { expect, test, type Page } from '@playwright/test';
import { hariKerjaTerakhir, klienApi, masuk, slot } from './bantuan';
import { AKUN } from './konstanta';

/** Buka form "Catat kehadiran guru" dan isi; belum disimpan. */
async function isiForm(
  page: Page,
  isian: { tanggal: string; jam: number; indeksGuru: number; guruId?: string },
) {
  await page.getByRole('button', { name: 'Catat kehadiran' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Catat kehadiran guru' });
  await expect(dialog).toBeVisible();
  // Kelas sekretaris terkunci ke kelasnya: tampil sebagai teks, tidak bisa dipilih.
  await expect(dialog.getByText('X-1', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: 'Kelas' })).toHaveCount(0);

  await dialog.getByLabel('Tanggal').fill(isian.tanggal);
  const pilihGuru = dialog.getByLabel('Guru');
  await expect(pilihGuru.locator('option')).not.toHaveCount(1);
  const id =
    isian.guruId ?? (await pilihGuru.locator('option').nth(isian.indeksGuru).getAttribute('value'));
  if (!id) throw new Error('Guru contoh tidak tersedia.');
  const teks = (await pilihGuru.locator(`option[value="${id}"]`).textContent()) ?? '';
  await pilihGuru.selectOption(id);
  await dialog.getByLabel('Jam ke-').selectOption(String(isian.jam));
  return { dialog, id, nama: teks.replace(/\s*\(.*\)\s*$/, '') };
}

test('sekretaris mencatat kehadiran guru, jam bentrok ditolak, rekap ikut berubah', async ({
  page,
}, info) => {
  const tanggal = hariKerjaTerakhir();
  const { jamGuru, indeksGuru } = slot(info);

  // Rekap hanya bisa dibaca pimpinan; diperiksa lewat API sebagai manajemen_guru.
  const manajemen = await klienApi(AKUN.manajemen);
  const jamHadirRekap = async (guruId: string) => {
    const res = await manajemen.get(
      `/api/v1/rekap-kehadiran?guru_id=${guruId}&tanggal_dari=${tanggal}&tanggal_sampai=${tanggal}`,
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { total_jam_hadir: number }[] };
    return body.data[0]?.total_jam_hadir ?? 0;
  };

  await masuk(page, AKUN.sekretaris);
  await page.goto(`/absensi-guru?tanggal=${tanggal}`);

  // 1) Catat 1 JP "Hadir" (bawaan form) pada jam yang tidak dipakai seed.
  const pertama = await isiForm(page, { tanggal, jam: jamGuru, indeksGuru });
  const sebelum = await jamHadirRekap(pertama.id);
  await pertama.dialog.getByRole('button', { name: 'Catat kehadiran' }).click();
  await expect(page.getByText('Kehadiran dicatat.')).toBeVisible();
  await expect(pertama.dialog).toBeHidden();
  const [th, bl, hr] = tanggal.split('-');
  await expect(
    page.getByRole('button', {
      name: `Ubah catatan ${pertama.nama}, ${hr}/${bl}/${th}, jam ke-${jamGuru}`,
    }),
  ).toBeVisible();

  // 2) Guru, tanggal, dan jam yang sama → ditolak karena bentrok.
  const kedua = await isiForm(page, { tanggal, jam: jamGuru, indeksGuru, guruId: pertama.id });
  await kedua.dialog.getByRole('button', { name: 'Catat kehadiran' }).click();
  await expect(kedua.dialog.getByRole('alert')).toContainText('Jam bentrok');
  // Form berisi: Batal meminta konfirmasi agar isian tidak terbuang tanpa sengaja.
  await kedua.dialog.getByRole('button', { name: 'Batal' }).click();
  await page
    .getByRole('dialog', { name: 'Buang perubahan?' })
    .getByRole('button', { name: 'Buang perubahan' })
    .click();
  await expect(kedua.dialog).toBeHidden();

  // 3) Rekap pekan guru itu dihitung ulang: jam hadir bertambah 1 JP (bukan 2).
  expect(await jamHadirRekap(pertama.id)).toBe(sebelum + 1);
  await manajemen.dispose();
});
