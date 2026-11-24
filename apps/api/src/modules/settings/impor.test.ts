import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isiDataContoh } from '../../../prisma/seed-data';
import { createApp, tutupSumberDaya } from '../../app';
import { BOM } from '../../lib/csv';
import { prisma } from '../../lib/prisma';
import { BUKAN_ADMIN, Klien, masukSebagai } from '../../test/bantuan';
import { HARI_INI_UJI, PASSWORD_UJI } from '../../test/globalSetup';

const app = createApp();
const BASE = '/api/v1/settings';
let admin: Klien;

beforeAll(async () => {
  admin = await masukSebagai(app, 'admin');
});

afterAll(async () => {
  // Kembalikan data contoh fiktif agar berkas test sesudahnya tetap berjalan pada kondisi awal.
  await isiDataContoh(prisma, { hariIni: HARI_INI_UJI, password: PASSWORD_UJI });
  await tutupSumberDaya();
});

describe('otorisasi impor data master & hapus data pilot', () => {
  const RUTE: [string, string][] = [
    ['get', `${BASE}/impor/guru/templat`],
    ['post', `${BASE}/impor/guru/pratinjau`],
    ['post', `${BASE}/impor/guru/simpan`],
    ['post', `${BASE}/hapus-data-pilot`],
  ];

  it('tanpa sesi → 401', async () => {
    const tamu = new Klien(app);
    for (const [m, p] of RUTE) {
      const res = m === 'get' ? await tamu.get(p) : await tamu.post(p, {});
      expect(res.status, `${m} ${p}`).toBe(401);
    }
  });

  it.each(BUKAN_ADMIN)('%s → 403', async (role) => {
    const klien = await masukSebagai(app, role);
    for (const [m, p] of RUTE) {
      const res = m === 'get' ? await klien.get(p) : await klien.post(p, {});
      expect(res.status, `${role} ${m} ${p}`).toBe(403);
    }
  });
});

describe('templat dan validasi CSV impor data master', () => {
  it('unduh templat kosong UTF-8 BOM untuk guru, siswa, jadwal', async () => {
    const guru = await admin.get(`${BASE}/impor/guru/templat`);
    expect(guru.status).toBe(200);
    expect(guru.text.startsWith(BOM)).toBe(true);
    expect(guru.text.slice(1).trim()).toBe(
      'kode_guru,nip,nama_guru,mata_pelajaran,jabatan,nama_mgmp,status',
    );

    const siswa = await admin.get(`${BASE}/impor/siswa/templat`);
    expect(siswa.status).toBe(200);
    expect(siswa.text.slice(1).trim()).toBe(
      'nis,nama_siswa,jenis_kelamin,nama_kelas,wali_kelas,bk,status',
    );

    const jadwal = await admin.get(`${BASE}/impor/jadwal/templat`);
    expect(jadwal.status).toBe(200);
    expect(jadwal.text.slice(1).trim()).toBe('kode_guru,nama_kelas,hari,jam_ke,total_jam_mengajar');
  });

  it('unduh templat Excel (.xlsx) untuk guru, siswa, jadwal', async () => {
    for (const jenis of ['guru', 'siswa', 'jadwal'] as const) {
      const res = await admin
        .get(`${BASE}/impor/${jenis}/templat?format=xlsx`)
        .buffer(true)
        .parse((r, cb) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status, jenis).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      const buf = res.body as Buffer;
      expect(buf.subarray(0, 2).toString(), jenis).toBe('PK');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as never);
      expect(wb.worksheets.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('menolak kolom tak dikenal dan CSV rusak', async () => {
    const kolomAsing = await admin.post(`${BASE}/impor/siswa/pratinjau`, {
      csv: 'nis,nama_siswa,jenis_kelamin,nama_kelas,alamat\nUJI9001,Siswa Fiktif,L,X-1,Jl. Uji\n',
    });
    expect(kolomAsing.status).toBe(400);
    expect(kolomAsing.body.error.message).toContain('Kolom tidak dikenal: alamat');

    const kutipRusak = await admin.post(`${BASE}/impor/siswa/pratinjau`, {
      csv: 'nis,nama_siswa,jenis_kelamin,nama_kelas\n"UJI9002,Siswa Rusak,L,X-1\n',
    });
    expect(kutipRusak.status).toBe(400);
    expect(kutipRusak.body.error.message).toContain('Format CSV rusak');
  });

  it('mendeteksi NIS kosong, baris ganda, dan tidak melakukan simpan parsial (atomik)', async () => {
    const csvCampuran = [
      'nis,nama_siswa,jenis_kelamin,nama_kelas,status',
      'IMP-001,Siswa Sah Fiktif,L,X-1,aktif',
      ',Siswa Tanpa NIS,P,X-1,aktif',
      'IMP-001,Siswa Ganda Fiktif,P,X-1,aktif',
    ].join('\r\n');

    const pratinjau = await admin.post(`${BASE}/impor/siswa/pratinjau`, { csv: csvCampuran });
    expect(pratinjau.status).toBe(200);
    expect(pratinjau.body.data.ringkasan).toEqual({
      total: 3,
      baru: 1,
      diperbarui: 0,
      ditolak: 2,
    });
    expect(pratinjau.body.data.dapat_disimpan).toBe(false);
    expect(pratinjau.body.data.galat).toHaveLength(2);

    // Simpan harus gagal 422 dan baris valid pertama TIDAK boleh tersimpan parsial.
    const simpan = await admin.post(`${BASE}/impor/siswa/simpan`, {
      csv: csvCampuran,
      izinkan_buat_referensi: true,
    });
    expect(simpan.status).toBe(422);
    expect(await prisma.siswa.findUnique({ where: { nis: 'IMP-001' } })).toBeNull();
  });

  it('kelas baru hanya dibuat setelah dikonfirmasi; pembaruan tidak menghapus data lain; log hanya mencatat jumlah', async () => {
    const totalSiswaAwal = await prisma.siswa.count();
    const csvBaru = [
      'nis,nama_siswa,jenis_kelamin,nama_kelas,status',
      'IMP-101,Siswa Impor Satu,L,XII-IMPOR,aktif',
      'IMP-102,Siswa Impor Dua,P,XII-IMPOR,aktif',
    ].join('\n');

    const prat = await admin.post(`${BASE}/impor/siswa/pratinjau`, { csv: csvBaru });
    expect(prat.status).toBe(200);
    expect(prat.body.data.referensi_baru.kelas).toEqual(['XII-IMPOR']);
    expect(prat.body.data.dapat_disimpan).toBe(true);

    // Tanpa konfirmasi referensi baru → ditolak 422.
    const tolak = await admin.post(`${BASE}/impor/siswa/simpan`, {
      csv: csvBaru,
      izinkan_buat_referensi: false,
    });
    expect(tolak.status).toBe(422);
    expect(await prisma.kelas.findUnique({ where: { nama_kelas: 'XII-IMPOR' } })).toBeNull();

    // Dengan konfirmasi → transaksi membuat kelas baru & 2 siswa baru.
    const ok = await admin.post(`${BASE}/impor/siswa/simpan`, {
      csv: csvBaru,
      izinkan_buat_referensi: true,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual({
      jenis: 'siswa',
      baru: 2,
      diperbarui: 0,
      kelas_dibuat: 1,
      mgmp_dibuat: 0,
    });
    expect(await prisma.siswa.count()).toBe(totalSiswaAwal + 2);

    // Impor ulang dengan NIS sama → memperbarui tanpa menghapus siswa lain.
    const csvUpdate = [
      'nis,nama_siswa,jenis_kelamin,nama_kelas,status',
      'IMP-101,Siswa Impor Satu Diperbarui,L,XII-IMPOR,aktif',
    ].join('\n');
    const upd = await admin.post(`${BASE}/impor/siswa/simpan`, {
      csv: csvUpdate,
      izinkan_buat_referensi: false,
    });
    expect(upd.status).toBe(200);
    expect(upd.body.data).toMatchObject({ baru: 0, diperbarui: 1 });
    expect(await prisma.siswa.count()).toBe(totalSiswaAwal + 2);

    const log = await prisma.auditLog.findFirst({
      where: { aktivitas: 'IMPOR_SISWA' },
      orderBy: { id: 'desc' },
    });
    expect(log).not.toBeNull();
    // Log tidak boleh berisi nama pribadi/NIS siswa.
    expect(log?.description).not.toContain('Siswa Impor');
    expect(log?.description).not.toContain('IMP-101');
  });

  it('impor guru + MGMP baru lalu impor jadwal mengajar dengan kunci unik (guru, hari, jam_ke)', async () => {
    const csvGuru = [
      'kode_guru,nip,nama_guru,mata_pelajaran,jabatan,nama_mgmp,status',
      'GIMP1,,Guru Impor Fiktif,Informatika,Guru Mapel,MGMP Impor,aktif',
    ].join('\n');
    const simpanGuru = await admin.post(`${BASE}/impor/guru/simpan`, {
      csv: csvGuru,
      izinkan_buat_referensi: true,
    });
    expect(simpanGuru.status).toBe(200);
    expect(simpanGuru.body.data).toMatchObject({ baru: 1, mgmp_dibuat: 1 });

    const csvJadwal = [
      'kode_guru,nama_kelas,hari,jam_ke,total_jam_mengajar',
      'GIMP1,X-1,Senin,7,2',
      'GIMP1,X-2,2,8,1',
    ].join('\n');
    const simpanJadwal = await admin.post(`${BASE}/impor/jadwal/simpan`, {
      csv: csvJadwal,
      izinkan_buat_referensi: false,
    });
    expect(simpanJadwal.status).toBe(200);
    expect(simpanJadwal.body.data).toMatchObject({ baru: 2, diperbarui: 0 });

    // Jadwal dengan guru tidak dikenal → ditolak di pratinjau.
    const jadwalSalah = await admin.post(`${BASE}/impor/jadwal/pratinjau`, {
      csv: 'kode_guru,nama_kelas,hari,jam_ke,total_jam_mengajar\nTIDAKADA,X-1,Senin,1,1\n',
    });
    expect(jadwalSalah.status).toBe(200);
    expect(jadwalSalah.body.data.ringkasan.ditolak).toBe(1);
    expect(jadwalSalah.body.data.dapat_disimpan).toBe(false);
  });

  it('impor Excel (.xlsx) multi-sheet siswa (X, XI, XII dengan Wali Kelas & BK) dan guru (Nama Pengajar, Mata Pelajaran, Kode)', async () => {
    // 1. Workbook Excel siswa dengan multi-sheet (kelas X, XI, XII) dan kolom tambahan yang diabaikan.
    const wbSiswa = new ExcelJS.Workbook();
    wbSiswa.addWorksheet('Rekap'); // sheet tanpa header siswa harus dilewati

    const wsX = wbSiswa.addWorksheet('X-XLSX');
    wsX.addRow(['DAFTAR SISWA KELAS X-XLSX']);
    wsX.addRow(['Wali Kelas : Ibu Wali X Fiktif', '', 'Guru BK : Bpk. BK X Fiktif']);
    wsX.addRow([]);
    wsX.addRow(['No', 'NIS', 'NAMA', 'JK', 'Alamat', 'Keterangan']);
    wsX.addRow([1, 2601001, 'Siswa Excel X Satu', 'L', 'Jl. Contoh 1', 'Diabaikan']);
    wsX.addRow([2, '2601002', 'Siswa Excel X Dua', 'Perempuan', 'Jl. Contoh 2', 'Diabaikan']);

    const wsXI = wbSiswa.addWorksheet('XI-XLSX');
    wsXI.addRow(['No', 'NIS', 'NAMA', 'L/P', 'Kelas', 'Wali Kelas', 'BK']);
    wsXI.addRow([
      1,
      '2602001',
      'Siswa Excel XI Satu',
      'Laki-laki',
      'XI-XLSX',
      'Ibu Wali XI Fiktif',
      'Ibu BK XI Fiktif',
    ]);

    const wsXII = wbSiswa.addWorksheet('Kelas XII-XLSX');
    wsXII.addRow(['NIS', 'NAMA', 'JK', 'Wali Kelas', 'Guru BK']);
    wsXII.addRow([
      '2603001',
      'Siswa Excel XII Satu',
      'P',
      'Bpk. Wali XII Fiktif',
      'Ibu BK XII Fiktif',
    ]);

    const bufSiswa = Buffer.from(await wbSiswa.xlsx.writeBuffer());
    const b64Siswa = bufSiswa.toString('base64');

    const pratSiswa = await admin.post(`${BASE}/impor/siswa/pratinjau`, { xlsx_base64: b64Siswa });
    expect(pratSiswa.status).toBe(200);
    expect(pratSiswa.body.data.ringkasan).toEqual({
      total: 4,
      baru: 4,
      diperbarui: 0,
      ditolak: 0,
    });
    expect(pratSiswa.body.data.referensi_baru.kelas).toEqual(['X-XLSX', 'XI-XLSX', 'XII-XLSX']);
    expect(pratSiswa.body.data.dapat_disimpan).toBe(true);

    const simpanSiswa = await admin.post(`${BASE}/impor/siswa/simpan`, {
      xlsx_base64: b64Siswa,
      izinkan_buat_referensi: true,
    });
    expect(simpanSiswa.status).toBe(200);
    expect(simpanSiswa.body.data).toMatchObject({ baru: 4, kelas_dibuat: 3 });

    const cekX = await prisma.siswa.findUniqueOrThrow({ where: { nis: '2601001' } });
    expect(cekX.wali_kelas).toBe('Ibu Wali X Fiktif');
    expect(cekX.bk).toBe('Bpk. BK X Fiktif');
    expect(cekX.jenis_kelamin).toBe('L');

    const cekXII = await prisma.siswa.findUniqueOrThrow({ where: { nis: '2603001' } });
    expect(cekXII.wali_kelas).toBe('Bpk. Wali XII Fiktif');
    expect(cekXII.bk).toBe('Ibu BK XII Fiktif');

    // 2. Workbook Excel guru (Nama Pengajar, Mata Pelajaran, Kode + kolom ekstra diabaikan).
    const wbGuru = new ExcelJS.Workbook();
    const wsGuru = wbGuru.addWorksheet('Daftar Pengajar');
    wsGuru.addRow(['No', 'Kode', 'Nama Pengajar', 'Mata Pelajaran', 'Total JP']);
    wsGuru.addRow([1, 'GX1', 'Guru Excel Satu Fiktif', 'Matematika Lanjut', 24]);
    wsGuru.addRow([2, 'GX2', 'Guru Excel Dua Fiktif', 'Bahasa Indonesia', 18]);

    const b64Guru = Buffer.from(await wbGuru.xlsx.writeBuffer()).toString('base64');
    const simpanGuru = await admin.post(`${BASE}/impor/guru/simpan`, {
      xlsx_base64: b64Guru,
      izinkan_buat_referensi: false,
    });
    expect(simpanGuru.status).toBe(200);
    expect(simpanGuru.body.data).toMatchObject({ baru: 2, diperbarui: 0 });

    const guruDb = await prisma.guru.findUniqueOrThrow({ where: { kode_guru: 'GX1' } });
    expect(guruDb.nama_guru).toBe('Guru Excel Satu Fiktif');
    expect(guruDb.mata_pelajaran).toBe('Matematika Lanjut');

    // 3. Berkas non-xlsx ditolak 400.
    const bukanXlsx = await admin.post(`${BASE}/impor/guru/pratinjau`, {
      xlsx_base64: Buffer.from('bukan-file-excel').toString('base64'),
    });
    expect(bukanXlsx.status).toBe(400);
  });
});

describe('hapus data pilot', () => {
  it('nama sekolah salah ditolak 422; nama persis menghapus data pilot dan mencatat log', async () => {
    const sekolah = await prisma.sekolahSettings.findFirstOrThrow();
    const tolak = await admin.post(`${BASE}/hapus-data-pilot`, {
      konfirmasi_nama_sekolah: 'Nama Salah',
    });
    expect(tolak.status).toBe(422);
    expect(await prisma.guru.count()).toBeGreaterThan(0);

    const ok = await admin.post(`${BASE}/hapus-data-pilot`, {
      konfirmasi_nama_sekolah: sekolah.nama_sekolah,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.data.dihapus.guru).toBeGreaterThan(0);
    expect(ok.body.data.dihapus.siswa).toBeGreaterThan(0);

    expect(await prisma.guru.count()).toBe(0);
    expect(await prisma.siswa.count()).toBe(0);
    expect(await prisma.jadwalMengajar.count()).toBe(0);
    expect(await prisma.kehadiran.count()).toBe(0);
    expect(await prisma.kehadiranSiswa.count()).toBe(0);
    expect(await prisma.rekapKehadiranGuru.count()).toBe(0);
    expect(await prisma.penilaianKinerjaBulanan.count()).toBe(0);
    expect(await prisma.penilaianMgmp.count()).toBe(0);
    // Akun dan pengaturan sekolah tetap dipertahankan.
    expect(await prisma.user.count()).toBeGreaterThan(0);
    expect(await prisma.sekolahSettings.count()).toBe(1);

    const log = await prisma.auditLog.findFirst({
      where: { aktivitas: 'HAPUS_DATA_PILOT' },
      orderBy: { id: 'desc' },
    });
    expect(log).not.toBeNull();
  });
});
