import { expect, test } from '@playwright/test';
import { hariKerjaTerakhir, klienApi, masuk, slot, tanggalPendek } from './bantuan';
import { AKUN } from './konstanta';

test('sekretaris mengabsen siswa kelasnya secara massal; riwayat tampil; kelas lain tidak terlihat', async ({
  page,
}, info) => {
  const tanggal = hariKerjaTerakhir();
  const { jamSiswa } = slot(info);

  await masuk(page, AKUN.sekretaris);
  await page.goto(`/absensi-siswa?tanggal=${tanggal}&jam_ke=${jamSiswa}`);

  // Sekretaris tidak memilih kelas: langsung kelasnya sendiri.
  await expect(page.getByRole('combobox', { name: 'Kelas' })).toHaveCount(0);
  await expect(page.getByText(`Kelas X-1 · Jam ke-${jamSiswa}`)).toBeVisible();
  await expect(page.getByText('Sesi ini belum diisi.', { exact: false })).toBeVisible();

  // Semua siswa bawaan "Hadir"; satu diubah menjadi "Sakit", lalu simpan sekaligus.
  const statusPertama = page.getByRole('radiogroup', { name: /^Status / }).first();
  await statusPertama.getByRole('radio', { name: 'Sakit' }).click();
  await expect(page.getByText('1 perubahan belum disimpan.')).toBeVisible();
  await page.getByRole('button', { name: 'Simpan absensi' }).click();
  await expect(
    page.getByText(/^Absensi X-1 tersimpan: \d+ hadir, 0 izin, 1 sakit, 0 alpa\.$/),
  ).toBeVisible();

  // Riwayat: sesi baru tercatat (dicek juga lewat API dengan sesi pengguna yang sama).
  const riwayat = page.getByRole('region', { name: 'Riwayat absensi' });
  await expect(riwayat).toContainText(tanggalPendek(tanggal));
  const res = await page.request.get('/api/v1/kehadiran-siswa/riwayat?page=1&pageSize=50');
  expect(res.status()).toBe(200);
  const isi = (await res.json()) as {
    data: { tanggal: string; jam_ke: number; sakit: number; total: number }[];
  };
  expect(isi.data).toContainEqual(expect.objectContaining({ tanggal, jam_ke: jamSiswa, sakit: 1 }));

  // Referensi kelas untuk sekretaris hanya berisi kelasnya sendiri.
  const refSaya = (await (await page.request.get('/api/v1/referensi/kelas')).json()) as {
    data: { id: number; nama_kelas: string }[];
  };
  expect(refSaya.data.map((k) => k.nama_kelas)).toEqual(['X-1']);

  // Kelas lain tidak terlihat: kelas_id lain di URL maupun di API diabaikan.
  // ID kelas X-2 diambil lewat akun manajemen.
  const manajemen = await klienApi(AKUN.manajemen);
  const semua = (await (await manajemen.get('/api/v1/referensi/kelas')).json()) as {
    data: { id: number; nama_kelas: string }[];
  };
  await manajemen.dispose();
  const x2 = semua.data.find((k) => k.nama_kelas === 'X-2');
  expect(x2).toBeDefined();
  await page.goto(`/absensi-siswa?kelas_id=${x2?.id}&tanggal=${tanggal}&jam_ke=${jamSiswa}`);
  await expect(page.getByText(`Kelas X-1 · Jam ke-${jamSiswa}`)).toBeVisible();
  await expect(page.getByText('Kelas X-2', { exact: false })).toHaveCount(0);

  const sesiLain = await page.request.get(
    `/api/v1/kehadiran-siswa/sesi?kelas_id=${x2?.id}&tanggal=${tanggal}&jam_ke=${jamSiswa}`,
  );
  expect(sesiLain.status()).toBe(200);
  const sesi = (await sesiLain.json()) as { data: { kelas: { nama_kelas: string } } };
  expect(sesi.data.kelas.nama_kelas).toBe('X-1');

  // Dashboard kelas lain → tidak boleh.
  const dashLain = await page.request.get(`/api/v1/dashboard/kelas/${x2?.id}`);
  expect(dashLain.status()).toBe(403);
});
