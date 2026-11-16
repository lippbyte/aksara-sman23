import {
  HARI_EFEKTIF_DEFAULT,
  pekanDariTanggal,
  persentaseKehadiran,
  rentangPekan,
  totalJamHadir,
  totalJamWajib,
} from '@sms/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, tutupSumberDaya } from '../../app';
import { BOM } from '../../lib/csv';
import { keAngka, keDate, keNumber, keTanggalISO, statusKehadiranDariDb } from '../../lib/konversi';
import { prisma } from '../../lib/prisma';
import { ambilPengaturan } from '../../lib/sekolah';
import { hariIni } from '../../lib/waktu';
import { BUKAN_ADMIN, Klien, masukSebagai } from '../../test/bantuan';
import { hitungUlangRekapTerdampak } from './hitung';

const app = createApp();
const R = '/api/v1/rekap-kehadiran';
const AWAL = '2026-10-19';
const PENGATURAN = { tanggal_awal_pekan: AWAL, hari_efektif: HARI_EFEKTIF_DEFAULT };

let admin: Klien;
let manajemen: Klien;
let guruSabtu: number;

beforeAll(async () => {
  admin = await masukSebagai(app, 'admin');
  manajemen = await masukSebagai(app, 'manajemen_guru');

  // Guru uji: Senin 2 JP + Sabtu 4 JP; Sabtu bukan hari efektif.
  const kelas = await prisma.kelas.findFirstOrThrow({ where: { nama_kelas: 'XII-2' } });
  const g = await prisma.guru.create({
    data: { kode_guru: 'UJIR1', nama_guru: 'Guru Uji Rekap', mata_pelajaran: 'Mapel Uji Rekap' },
  });
  guruSabtu = keNumber(g.id);
  const admUser = await prisma.user.findFirstOrThrow({ where: { role: 'admin' } });
  await prisma.jadwalMengajar.createMany({
    data: [
      { guru_id: g.id, kelas_id: kelas.id, hari: 1, jam_ke: 11, total_jam_mengajar: 2 },
      { guru_id: g.id, kelas_id: kelas.id, hari: 6, jam_ke: 1, total_jam_mengajar: 4 },
    ],
  });
  // Pekan 3 (2–6 Nov): hadir 2 JP Senin + 4 JP Sabtu 7 Nov (di luar rentang pekan).
  await prisma.kehadiran.createMany({
    data: [
      {
        tanggal: keDate('2026-11-02'),
        guru_id: g.id,
        kelas_id: kelas.id,
        jam_ke: 11,
        lama_jam: 2,
        status_kehadiran: 'Hadir',
        status_tugas: 'Ada',
        created_by: admUser.id,
      },
      {
        tanggal: keDate('2026-11-07'),
        guru_id: g.id,
        kelas_id: kelas.id,
        jam_ke: 1,
        lama_jam: 4,
        status_kehadiran: 'Hadir',
        status_tugas: 'Ada',
        created_by: admUser.id,
      },
      // Pekan 4: 2 JP + 2 JP (Mendampingi) melebihi jam wajib 2 → dibatasi 100%.
      {
        tanggal: keDate('2026-11-09'),
        guru_id: g.id,
        kelas_id: kelas.id,
        jam_ke: 11,
        lama_jam: 2,
        status_kehadiran: 'Hadir',
        status_tugas: 'Ada',
        created_by: admUser.id,
      },
      {
        tanggal: keDate('2026-11-10'),
        guru_id: g.id,
        kelas_id: kelas.id,
        jam_ke: 11,
        lama_jam: 2,
        status_kehadiran: 'Mendampingi',
        status_tugas: 'Ada',
        created_by: admUser.id,
      },
    ],
  });
});

afterAll(async () => {
  const guru = { kode_guru: { startsWith: 'UJIR' } };
  await prisma.kehadiran.deleteMany({ where: { guru } });
  await prisma.rekapKehadiranGuru.deleteMany({ where: { guru } });
  await prisma.jadwalMengajar.deleteMany({ where: { guru } });
  await prisma.guru.deleteMany({ where: guru });
  await tutupSumberDaya();
});

describe('otorisasi /rekap-kehadiran', () => {
  const rute: [string, string][] = [
    ['get', R],
    ['get', `${R}/pekan`],
    ['get', `${R}/mapel`],
    ['get', `${R}/export`],
    ['post', `${R}/sync`],
    ['get', `${R}/sync/pratinjau?minggu_ke=1&tahun=2026`],
    ['put', `${R}/1`],
    ['delete', `${R}/1`],
  ];
  const panggil = (k: Klien, m: string, p: string) =>
    m === 'get'
      ? k.get(p)
      : m === 'post'
        ? k.post(p, {})
        : m === 'put'
          ? k.put(p, {})
          : k.delete(p);

  it('tanpa sesi → 401', async () => {
    const tamu = new Klien(app);
    for (const [m, p] of rute) expect((await panggil(tamu, m, p)).status, `${m} ${p}`).toBe(401);
  });

  it.each(BUKAN_ADMIN.filter((r) => r !== 'manajemen_guru'))('%s → 403', async (role) => {
    const k = await masukSebagai(app, role);
    for (const [m, p] of rute)
      expect((await panggil(k, m, p)).status, `${role} ${m} ${p}`).toBe(403);
  });
});

describe('POST /rekap-kehadiran/sync', () => {
  it('hasil sinkron sama dengan fungsi domain untuk data seed (pekan 1–4)', async () => {
    // Kosongkan rekap guru seed agar benar-benar dihitung ulang oleh sinkron.
    await prisma.rekapKehadiranGuru.deleteMany({
      where: { guru: { kode_guru: { startsWith: 'G' } } },
    });

    for (let minggu = 1; minggu <= 4; minggu++) {
      const res = await manajemen.post(`${R}/sync`, { minggu_ke: minggu, tahun: 2026 });
      expect(res.status).toBe(200);
      expect(res.body.data.pekan).toEqual(rentangPekan(minggu, 2026, PENGATURAN));
    }

    const guru = await prisma.guru.findMany({ where: { kode_guru: { startsWith: 'G' } } });
    const jadwal = await prisma.jadwalMengajar.findMany();
    const kehadiran = (await prisma.kehadiran.findMany()).map((k) => ({
      guru_id: k.guru_id,
      tanggal: keTanggalISO(k.tanggal),
      lama_jam: k.lama_jam,
      status_kehadiran: statusKehadiranDariDb(k.status_kehadiran),
    }));
    const rekap = await prisma.rekapKehadiranGuru.findMany({
      where: { guru: { kode_guru: { startsWith: 'G' } } },
    });
    expect(rekap).toHaveLength(guru.length * 4);

    for (const r of rekap) {
      const pekan = rentangPekan(r.minggu_ke, r.tahun, PENGATURAN);
      const wajib = totalJamWajib(
        jadwal.filter((j) => j.guru_id === r.guru_id),
        HARI_EFEKTIF_DEFAULT,
      );
      const hadir = totalJamHadir(
        kehadiran.filter((k) => k.guru_id === r.guru_id),
        pekan,
      );
      expect(keTanggalISO(r.tanggal_mulai)).toBe(pekan.tanggal_mulai);
      expect(keTanggalISO(r.tanggal_selesai)).toBe(pekan.tanggal_selesai);
      expect(r.total_jam_wajib).toBe(wajib);
      expect(r.total_jam_hadir).toBe(hadir);
      expect(keAngka(r.persentase_kehadiran)).toBe(persentaseKehadiran(hadir, wajib));
    }

    const log = await prisma.auditLog.findFirst({
      where: { aktivitas: 'SYNC_REKAP', entity_id: '2026-4' },
    });
    expect(log?.module).toBe('Rekap');
  });

  it('jam wajib hanya hari efektif: Sabtu tidak dihitung di jam wajib maupun jam hadir', async () => {
    await admin.post(`${R}/sync`, { minggu_ke: 3, tahun: 2026 });
    const r = await prisma.rekapKehadiranGuru.findFirst({
      where: { guru_id: guruSabtu, minggu_ke: 3 },
    });
    expect(r).toMatchObject({ total_jam_wajib: 2, total_jam_hadir: 2 });
    expect(keAngka(r!.persentase_kehadiran)).toBe(100);
  });

  it('persentase dibatasi 100 bila jam hadir melebihi jam wajib', async () => {
    await admin.post(`${R}/sync`, { minggu_ke: 4, tahun: 2026 });
    const r = await prisma.rekapKehadiranGuru.findFirst({
      where: { guru_id: guruSabtu, minggu_ke: 4 },
    });
    expect(r).toMatchObject({ total_jam_wajib: 2, total_jam_hadir: 4 });
    expect(keAngka(r!.persentase_kehadiran)).toBe(100);
  });

  it('sinkron ulang tidak menggandakan baris; guru nonaktif tidak ikut', async () => {
    const sebelum = await prisma.rekapKehadiranGuru.count({ where: { minggu_ke: 2, tahun: 2026 } });
    await admin.post(`${R}/sync`, { minggu_ke: 2, tahun: 2026 });
    expect(await prisma.rekapKehadiranGuru.count({ where: { minggu_ke: 2, tahun: 2026 } })).toBe(
      sebelum,
    );

    await prisma.guru.update({ where: { id: guruSabtu }, data: { status: 'tidak_aktif' } });
    await prisma.rekapKehadiranGuru.deleteMany({ where: { guru_id: guruSabtu, minggu_ke: 1 } });
    const res = await admin.post(`${R}/sync`, { minggu_ke: 1, tahun: 2026 });
    expect(res.body.data.disinkronkan).toBe(12);
    expect(
      await prisma.rekapKehadiranGuru.count({ where: { guru_id: guruSabtu, minggu_ke: 1 } }),
    ).toBe(0);
    await prisma.guru.update({ where: { id: guruSabtu }, data: { status: 'aktif' } });
  });

  it('validasi: 400 untuk isian rusak; 422 bila tahun tidak cocok dengan pekan atau pekan belum dimulai', async () => {
    expect((await admin.post(`${R}/sync`, { minggu_ke: 0, tahun: 2026 })).status).toBe(400);
    expect((await admin.post(`${R}/sync`, { minggu_ke: 2 })).status).toBe(400);

    // Pekan 11 = 28 Des 2026 – 1 Jan 2027: tahunnya 2026, bukan 2027 (perbaikan §8.1).
    const salahTahun = await admin.post(`${R}/sync`, { minggu_ke: 11, tahun: 2027 });
    expect(salahTahun.status).toBe(422);
    expect(salahTahun.body.error.message).toContain('tahun 2026');

    const belum = await admin.post(`${R}/sync`, { minggu_ke: 500, tahun: 2036 });
    expect(belum.status).toBe(422);
    expect(belum.body.error.message).toContain('belum dimulai');
  });
});

describe('GET /rekap-kehadiran', () => {
  it('filter pekan, guru, mapel, kelas, dan rentang tanggal', async () => {
    const pekan4 = await manajemen.get(`${R}?minggu_ke=4&tahun=2026&pageSize=100`);
    expect(pekan4.status).toBe(200);
    expect(pekan4.body.meta.total).toBe(13);
    expect(pekan4.body.data.every((r: { minggu_ke: number }) => r.minggu_ke === 4)).toBe(true);
    expect(pekan4.body.data[0]).toMatchObject({
      tanggal_mulai: '2026-11-09',
      tanggal_selesai: '2026-11-13',
    });

    const mapel = await admin.get(`${R}?mapel=Mapel Uji Rekap`);
    expect(mapel.body.data.every((r: { guru_id: number }) => r.guru_id === guruSabtu)).toBe(true);

    const kelas = await prisma.kelas.findFirstOrThrow({ where: { nama_kelas: 'XII-2' } });
    const perKelas = await admin.get(
      `${R}?kelas_id=${kelas.id}&minggu_ke=4&tahun=2026&pageSize=100`,
    );
    const guruKelas = await prisma.jadwalMengajar.findMany({
      where: { kelas_id: kelas.id },
      distinct: ['guru_id'],
    });
    expect(perKelas.body.meta.total).toBe(guruKelas.length);

    // Rentang 4–6 Nov hanya beririsan dengan pekan 3.
    const rentang = await admin.get(
      `${R}?tanggal_dari=2026-11-04&tanggal_sampai=2026-11-06&pageSize=100`,
    );
    expect(rentang.body.data.every((r: { minggu_ke: number }) => r.minggu_ke === 3)).toBe(true);

    expect((await admin.get(`${R}?minggu_ke=4`)).status).toBe(400);
    expect((await admin.get(`${R}?tanggal_dari=2026-11-10&tanggal_sampai=2026-11-01`)).status).toBe(
      400,
    );
  });

  it('daftar pekan: pekan 1 sampai pekan berjalan, terbaru dulu, dengan jumlah rekap', async () => {
    const res = await manajemen.get(`${R}/pekan`);
    expect(res.status).toBe(200);
    const berjalan = pekanDariTanggal(hariIni(), PENGATURAN);
    expect(res.body.data[0]).toMatchObject({ minggu_ke: berjalan.minggu_ke, berjalan: true });
    const p4 = res.body.data.find((p: { minggu_ke: number }) => p.minggu_ke === 4);
    expect(p4).toMatchObject({
      tahun: 2026,
      tanggal_mulai: '2026-11-09',
      jumlah_rekap: 13,
      berjalan: false,
    });
    expect(res.body.data.at(-1).minggu_ke).toBe(1);
  });

  it('daftar mapel untuk filter', async () => {
    const res = await admin.get(`${R}/mapel`);
    expect(res.body.data).toContain('Matematika');
    expect(res.body.data).toContain('Mapel Uji Rekap');
  });
});

describe('koreksi manual', () => {
  const ambilPekan2 = () =>
    prisma.rekapKehadiranGuru.findFirstOrThrow({ where: { guru_id: guruSabtu, minggu_ke: 2 } });

  it('wajib alasan; persentase dari fungsi domain; baris ditandai; tercatat di log', async () => {
    const r = await ambilPekan2();
    const tanpaAlasan = await admin.put(`${R}/${r.id}`, { total_jam_wajib: 3, total_jam_hadir: 2 });
    expect(tanpaAlasan.status).toBe(400);
    expect(
      (
        await admin.put(`${R}/${r.id}`, {
          total_jam_wajib: 3,
          total_jam_hadir: 2,
          alasan_koreksi: '  ',
        })
      ).status,
    ).toBe(400);

    const nol = await admin.put(`${R}/${r.id}`, {
      total_jam_wajib: 0,
      total_jam_hadir: 2,
      alasan_koreksi: 'Uji jam wajib nol',
    });
    expect(nol.body.data.persentase_kehadiran).toBe(0);

    const res = await manajemen.put(`${R}/${r.id}`, {
      total_jam_wajib: 3,
      total_jam_hadir: 2,
      alasan_koreksi: 'Guru mengajar pengganti (contoh)',
    });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      total_jam_wajib: 3,
      total_jam_hadir: 2,
      persentase_kehadiran: 66.67,
      dikoreksi_manual: true,
      alasan_koreksi: 'Guru mengajar pengganti (contoh)',
      nama_pengoreksi: 'Kepala Sekolah Contoh',
    });
    expect(res.body.data.dikoreksi_pada).toEqual(expect.any(String));

    expect(
      (
        await admin.put(`${R}/${r.id}`, {
          total_jam_wajib: -1,
          total_jam_hadir: 2,
          alasan_koreksi: 'x',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await admin.put(`${R}/99999999`, {
          total_jam_wajib: 1,
          total_jam_hadir: 1,
          alasan_koreksi: 'x',
        })
      ).status,
    ).toBe(404);
    const log = await prisma.auditLog.findFirst({
      where: { aktivitas: 'UPDATE_REKAP', entity_id: String(r.id) },
      orderBy: { id: 'desc' },
    });
    expect(log?.description).toContain('66.67%');
    expect(log?.description).toContain('Alasan: Guru mengajar pengganti (contoh)');
  });

  it('pratinjau sinkron menyebut jumlah baris terkoreksi', async () => {
    const res = await manajemen.get(`${R}/sync/pratinjau?minggu_ke=2&tahun=2026`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ minggu_ke: 2, tahun: 2026, terkoreksi: 1 });
    expect((await manajemen.get(`${R}/sync/pratinjau?minggu_ke=1&tahun=2026`)).body.data).toEqual({
      minggu_ke: 1,
      tahun: 2026,
      terkoreksi: 0,
    });
    expect((await manajemen.get(`${R}/sync/pratinjau?minggu_ke=0&tahun=2026`)).status).toBe(400);
    expect((await manajemen.get(`${R}/sync/pratinjau?minggu_ke=500&tahun=2036`)).status).toBe(422);
  });

  it('sinkron melewati baris terkoreksi; tercatat di log', async () => {
    const res = await manajemen.post(`${R}/sync`, { minggu_ke: 2, tahun: 2026 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ dilewati: 1, ditimpa: 0 });
    const aktif = await prisma.guru.count({ where: { status: 'aktif' } });
    expect(res.body.data.disinkronkan).toBe(aktif - 1);

    const r = await ambilPekan2();
    expect(r).toMatchObject({ total_jam_wajib: 3, total_jam_hadir: 2, dikoreksi_manual: true });
    expect(keAngka(r.persentase_kehadiran)).toBe(66.67);
    const log = await prisma.auditLog.findFirst({
      where: { aktivitas: 'SYNC_REKAP' },
      orderBy: { id: 'desc' },
    });
    expect(log?.description).toContain('1 baris koreksi manual dilewati');
  });

  it('hitung ulang otomatis dari perubahan kehadiran juga tidak menimpa koreksi', async () => {
    const pengaturan = await ambilPengaturan(prisma);
    await hitungUlangRekapTerdampak(prisma, pengaturan, [
      { guru_id: guruSabtu, tanggal: '2026-10-27' },
    ]);
    expect(await ambilPekan2()).toMatchObject({ total_jam_wajib: 3, dikoreksi_manual: true });
  });

  it('lencana "berubah sejak dikoreksi": hanya bila ada catatan pekan itu setelah koreksi; rekap tidak dihitung ulang', async () => {
    const cariBaris = async () =>
      (await manajemen.get(`${R}?minggu_ke=2&tahun=2026&guru_id=${guruSabtu}`)).body.data[0];
    expect(await cariBaris()).toMatchObject({
      dikoreksi_manual: true,
      berubah_sejak_koreksi: false,
    });

    const kelas = await prisma.kelas.findFirstOrThrow({ where: { nama_kelas: 'XII-2' } });
    const admUser = await prisma.user.findFirstOrThrow({ where: { role: 'admin' } });
    // Catatan pekan lain tidak memicu lencana.
    await prisma.kehadiran.create({
      data: {
        tanggal: keDate('2026-11-16'),
        guru_id: guruSabtu,
        kelas_id: kelas.id,
        jam_ke: 11,
        lama_jam: 2,
        status_kehadiran: 'Tidak_Hadir',
        status_tugas: 'Ada',
        created_by: admUser.id,
      },
    });
    expect((await cariBaris()).berubah_sejak_koreksi).toBe(false);

    // Catatan pekan 2 (Senin 26 Okt) yang dibuat setelah koreksi.
    await prisma.kehadiran.create({
      data: {
        tanggal: keDate('2026-10-26'),
        guru_id: guruSabtu,
        kelas_id: kelas.id,
        jam_ke: 11,
        lama_jam: 2,
        status_kehadiran: 'Tidak_Hadir',
        status_tugas: 'Tidak_Ada',
        created_by: admUser.id,
      },
    });
    const baris = await cariBaris();
    expect(baris).toMatchObject({
      berubah_sejak_koreksi: true,
      // Tidak dihitung ulang otomatis.
      total_jam_wajib: 3,
      total_jam_hadir: 2,
      persentase_kehadiran: 66.67,
    });
    // Baris yang tidak dikoreksi tidak pernah berlencana.
    const lain = await manajemen.get(`${R}?minggu_ke=2&tahun=2026&pageSize=100`);
    for (const r of lain.body.data.filter(
      (x: { dikoreksi_manual: boolean }) => !x.dikoreksi_manual,
    ))
      expect(r.berubah_sejak_koreksi).toBe(false);

    // Koreksi ulang → lencana hilang.
    const ulang = await admin.put(`${R}/${baris.id}`, {
      total_jam_wajib: 3,
      total_jam_hadir: 2,
      alasan_koreksi: 'Diperiksa ulang (contoh)',
    });
    expect(ulang.body.data.berubah_sejak_koreksi).toBe(false);
    // Snapshot jumlah catatan pekan itu disimpan saat koreksi.
    const catatanPekan = await prisma.kehadiran.count({
      where: {
        guru_id: guruSabtu,
        tanggal: { gte: keDate('2026-10-26'), lte: keDate('2026-10-30') },
      },
    });
    expect(ulang.body.data.jumlah_catatan_saat_koreksi).toBe(catatanPekan);
  });

  it('lencana juga muncul bila catatan pekan itu DIHAPUS setelah koreksi', async () => {
    const cariBaris = async () =>
      (await manajemen.get(`${R}?minggu_ke=2&tahun=2026&guru_id=${guruSabtu}`)).body.data[0];
    expect((await cariBaris()).berubah_sejak_koreksi).toBe(false);
    // Catatan 26 Okt sudah ada sebelum koreksi; menghapusnya tidak meninggalkan jejak waktu.
    const hapus = await prisma.kehadiran.deleteMany({
      where: { guru_id: guruSabtu, tanggal: keDate('2026-10-26') },
    });
    expect(hapus.count).toBeGreaterThan(0);
    expect(await cariBaris()).toMatchObject({
      berubah_sejak_koreksi: true,
      // Tetap tidak dihitung ulang.
      total_jam_wajib: 3,
      total_jam_hadir: 2,
    });
  });

  it('timpa_koreksi: manajemen → 403; admin menimpa, tanda koreksi dihapus, tercatat di log', async () => {
    const tolak = await manajemen.post(`${R}/sync`, {
      minggu_ke: 2,
      tahun: 2026,
      timpa_koreksi: true,
    });
    expect(tolak.status).toBe(403);
    expect((await ambilPekan2()).dikoreksi_manual).toBe(true);
    expect(
      (await admin.post(`${R}/sync`, { minggu_ke: 2, tahun: 2026, timpa_koreksi: 'ya' })).status,
    ).toBe(400);

    const res = await admin.post(`${R}/sync`, { minggu_ke: 2, tahun: 2026, timpa_koreksi: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ dilewati: 0, ditimpa: 1 });

    const r = await ambilPekan2();
    // Kembali ke hasil hitung: jadwal Senin 2 JP (hari efektif), tanpa kehadiran pekan 2.
    expect(r).toMatchObject({
      total_jam_wajib: 2,
      total_jam_hadir: 0,
      dikoreksi_manual: false,
      alasan_koreksi: null,
      dikoreksi_oleh: null,
      dikoreksi_pada: null,
      jumlah_catatan_saat_koreksi: null,
    });
    const log = await prisma.auditLog.findFirst({ where: { aktivitas: 'TIMPA_KOREKSI_REKAP' } });
    expect(log?.description).toContain('Menimpa 1 baris');
  });
});

describe('hapus, ekspor', () => {
  it('hapus → 204, lalu 404', async () => {
    const r = await prisma.rekapKehadiranGuru.findFirstOrThrow({
      where: { guru_id: guruSabtu, minggu_ke: 2 },
    });
    expect((await manajemen.delete(`${R}/${r.id}`)).status).toBe(204);
    expect((await manajemen.delete(`${R}/${r.id}`)).status).toBe(404);
  });

  it('ekspor CSV: BOM, judul kolom, persentase dua desimal, tercatat di log', async () => {
    const res = await manajemen.get(`${R}/export?minggu_ke=4&tahun=2026`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/rekap-kehadiran-guru_pekan-4-2026_/);
    const teks: string = res.text;
    expect(teks.startsWith(BOM)).toBe(true);
    const garis = teks.slice(1).split('\r\n').filter(Boolean);
    expect(garis[0]).toBe(
      'Tahun,Pekan,Tanggal Mulai,Tanggal Selesai,Kode Guru,Nama Guru,Mata Pelajaran,Jam Wajib,Jam Hadir,Persentase Kehadiran,Dikoreksi Manual,Alasan Koreksi,Dikoreksi Oleh',
    );
    expect(garis).toHaveLength(14);
    expect(garis.find((g) => g.includes('UJIR1'))).toMatch(/,2,4,100\.00,Tidak,,$/);
    const log = await prisma.auditLog.findFirst({ where: { aktivitas: 'EXPORT_REKAP' } });
    expect(log?.description).toContain('pekan 4/2026');
  });
});
