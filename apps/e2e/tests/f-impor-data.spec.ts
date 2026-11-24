import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { masuk } from './bantuan';
import { AKUN } from './konstanta';

test('admin: unduh templat CSV, pratinjau & impor guru fiktif dengan konfirmasi MGMP baru', async ({
  page,
}, info) => {
  await masuk(page, AKUN.admin);
  await page.goto('/pengaturan/impor');
  await expect(
    page.getByRole('heading', { name: 'Impor data master (Excel .xlsx / CSV)' }),
  ).toBeVisible();

  // 1) Unduh templat CSV kosong.
  const [unduhan] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Unduh templat CSV' }).click(),
  ]);
  expect(unduhan.suggestedFilename()).toBe('templat-impor-guru.csv');
  const isiTemplat = await readFile(await unduhan.path(), 'utf8');
  expect(isiTemplat.startsWith('\uFEFF')).toBe(true);
  expect(isiTemplat.slice(1).trim()).toBe(
    'kode_guru,nip,nama_guru,mata_pelajaran,jabatan,nama_mgmp,status',
  );

  // 2) Unduh templat Excel (.xlsx) kosong.
  const [unduhanXlsx] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Unduh templat Excel (.xlsx)' }).click(),
  ]);
  expect(unduhanXlsx.suggestedFilename()).toBe('templat-impor-guru.xlsx');

  // 3) Unggah berkas CSV fiktif → pratinjau menampilkan 1 guru baru + 1 MGMP baru.
  const kode = info.project.name === 'ponsel-360' ? 'GE2E1' : 'GE2E2';
  const namaMgmp = info.project.name === 'ponsel-360' ? 'MGMP Uji E2E M' : 'MGMP Uji E2E D';
  const csvFiktif = [
    'kode_guru,nip,nama_guru,mata_pelajaran,jabatan,nama_mgmp,status',
    `${kode},,Guru E2E Fiktif ${kode},Informatika,Guru Mapel,${namaMgmp},aktif`,
  ].join('\r\n');

  await page.getByLabel('Pilih berkas Excel atau CSV Guru').setInputFiles({
    name: 'guru-fiktif.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csvFiktif, 'utf8'),
  });

  await expect(page.getByText('Semua baris sah dan siap disimpan.')).toBeVisible();
  await expect(page.getByText(`MGMP baru: ${namaMgmp}`)).toBeVisible();

  // Tombol simpan terkunci sampai referensi baru dikonfirmasi.
  const tombolSimpan = page.getByRole('button', { name: 'Simpan hasil impor' });
  await expect(tombolSimpan).toBeDisabled();
  await page.getByRole('checkbox', { name: /Saya setuju membuat kelas\/MGMP baru/ }).check();
  await expect(tombolSimpan).toBeEnabled();

  await tombolSimpan.click();
  await expect(page.getByText(/Impor guru tersimpan: 1 baru, 0 diperbarui/)).toBeVisible();
});
