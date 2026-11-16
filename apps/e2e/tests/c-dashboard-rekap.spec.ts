import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { dataTable, masuk } from './bantuan';
import { AKUN } from './konstanta';

test('manajemen: dashboard dengan grafik dan tabel alternatif → rekap → ekspor CSV terunduh', async ({
  page,
}) => {
  await masuk(page, AKUN.manajemen);

  // Dashboard ringkasan: grafik tren (SVG) dan tabel alternatif lewat "Lihat tabel".
  const kartuTren = page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: 'Tren kehadiran guru per pekan' }) })
    .filter({ has: page.locator('svg.recharts-surface') })
    .last();
  await expect(kartuTren).toBeVisible();
  await expect(kartuTren.locator('svg.recharts-surface').first()).toBeVisible();
  await page
    .locator('details')
    .filter({ has: page.locator('caption', { hasText: /^Tren kehadiran guru per pekan/ }) })
    .locator('summary')
    .click();
  const tabelTren = page.getByRole('table', { name: /^Tren kehadiran guru per pekan/ });
  await expect(tabelTren).toBeVisible();
  await expect(tabelTren.getByRole('row')).not.toHaveCount(1);

  // Rekap kehadiran guru (pekan berjalan bawaan, data seed fiktif).
  await page.goto('/rekap-kehadiran');
  const rekap = dataTable(page, 'Rekap kehadiran guru per pekan');
  await expect(rekap).toBeVisible();
  await expect(rekap.getByRole('progressbar').first()).toBeVisible();

  // Ekspor CSV terunduh: nama berkas, BOM UTF-8, dan judul kolom.
  const [unduhan] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Ekspor CSV' }).click(),
  ]);
  expect(unduhan.suggestedFilename()).toMatch(
    /^rekap-kehadiran-guru_pekan-\d+-\d{4}_\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const jalur = await unduhan.path();
  const isi = await readFile(jalur, 'utf8');
  expect(isi.startsWith('﻿')).toBe(true);
  const garis = isi.slice(1).split('\r\n').filter(Boolean);
  expect(garis[0]).toMatch(/^Tahun,Pekan,Tanggal Mulai,Tanggal Selesai,Kode Guru,Nama Guru/);
  expect(garis.length).toBeGreaterThan(1);
});
