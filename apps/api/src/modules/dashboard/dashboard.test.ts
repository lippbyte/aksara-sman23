import {
  HARI_EFEKTIF_DEFAULT,
  pekanDariTanggal,
  persentaseJamTerisi,
  rataRataPekanGuru,
} from '@sms/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp, tutupSumberDaya } from '../../app';
import { batalkanCacheDashboard } from '../../lib/cache';
import { keAngka, keDate, keNumber } from '../../lib/konversi';
import { prisma } from '../../lib/prisma';
import { Klien, masukSebagai } from '../../test/bantuan';

const app = createApp();
const D = '/api/v1/dashboard';
// Jumat, hari terakhir data seed (pekan 4: 9–13 Nov 2026).
const HARI = '2026-11-13';
const PENGATURAN = { tanggal_awal_pekan: '2026-10-19', hari_efektif: HARI_EFEKTIF_DEFAULT };

let admin: Klien;
let manajemen: Klien;
let penilai: Klien;
let sekretaris: Klien;

async function masukSemua() {
  admin = await masukSebagai(app, 'admin');
  manajemen = await masukSebagai(app, 'manajemen_guru');
  penilai = await masukSebagai(app, 'guru_penilai');
  sekretaris = await masukSebagai(app, 'sekretaris_kelas');
}

beforeAll(async () => {
  // Hanya `Date` yang dipalsukan agar "hari ini" jatuh pada data seed.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${HARI}T03:00:00Z`));
  batalkanCacheDashboard();
  await masukSemua();
});

afterEach(() => batalkanCacheDashboard());

afterAll(async () => {
  vi.useRealTimers();
  await prisma.penilaianKinerjaBulanan.deleteMany({ where: { bulan: 11, tahun: 2026 } });
  await tutupSumberDaya();
});

describe('otorisasi dashboard', () => {
  it('tanpa sesi → 401', async () => {
    const tamu = new Klien(app);
    expect((await tamu.get(`${D}/ringkasan`)).status).toBe(401);
    expect((await tamu.get(`${D}/penilai`)).status).toBe(401);
  });

  it('ringkasan hanya admin & manajemen; penilai untuk penilai/admin/manajemen', async () => {
    expect((await sekretaris.get(`${D}/ringkasan`)).status).toBe(403);
    expect((await penilai.get(`${D}/ringkasan`)).status).toBe(403);
    expect((await sekretaris.get(`${D}/penilai`)).status).toBe(403);
    expect((await penilai.get(`${D}/penilai`)).status).toBe(200);
    expect((await manajemen.get(`${D}/penilai`)).status).toBe(200);
  });
});

describe('GET /dashboard/ringkasan', () => {
  it('KPI dan kehadiran hari ini sesuai data', async () => {
    const res = await manajemen.get(`${D}/ringkasan`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.tanggal).toBe(HARI);
    expect(d.kpi).toEqual({
      guru_aktif: await prisma.guru.count({ where: { status: 'aktif' } }),
      siswa_aktif: await prisma.siswa.count({ where: { status: 'aktif' } }),
      rombel: await prisma.kelas.count(),
      catatan_hari_ini: await prisma.kehadiran.count({ where: { tanggal: keDate(HARI) } }),
    });

    const catatan = await prisma.kehadiran.findMany({ where: { tanggal: keDate(HARI) } });
    const jp = catatan.reduce((s, c) => s + c.lama_jam, 0);
    const jadwalJumat = await prisma.jadwalMengajar.aggregate({
      where: { hari: 5 },
      _sum: { total_jam_mengajar: true },
    });
    const terjadwal = jadwalJumat._sum.total_jam_mengajar ?? 0;
    expect(d.hari_ini.jp_tercatat).toBe(jp);
    expect(d.hari_ini.jp_terjadwal).toBe(terjadwal);
    expect(d.hari_ini.persentase_terisi).toBe(persentaseJamTerisi(jp, terjadwal));
    const total =
      d.hari_ini.per_status.Hadir.catatan +
      d.hari_ini.per_status.Mendampingi.catatan +
      d.hari_ini.per_status['Tidak Hadir'].catatan;
    expect(total).toBe(catatan.length);

    // Bar bertumpuk per kelas: jumlah JP semua kelas = JP tercatat.
    const perKelas = d.hari_ini.per_kelas.reduce(
      (s: number, k: { Hadir: number; Mendampingi: number; 'Tidak Hadir': number }) =>
        s + k.Hadir + k.Mendampingi + k['Tidak Hadir'],
      0,
    );
    expect(perKelas).toBe(jp);
  });

  it('tren 8 pekan: rata-rata persentase guru berjadwal per pekan (fungsi domain)', async () => {
    const d = (await manajemen.get(`${D}/ringkasan`)).body.data;
    const berjalan = pekanDariTanggal(HARI, PENGATURAN);
    // Hari ini Jumat pekan 4: pekan 4 belum selesai, jadi tren berakhir di pekan 3.
    expect(berjalan.minggu_ke).toBe(4);
    expect(d.tren.at(-1)).toMatchObject({ minggu_ke: 3, tahun: 2026 });
    // Pekan berjalan (belum selesai) tidak ikut, agar persentasenya tidak tampak rendah.
    expect(d.tren.map((t: { minggu_ke: number }) => t.minggu_ke)).toEqual([1, 2, 3]);
    for (const t of d.tren) {
      const rekap = await prisma.rekapKehadiranGuru.findMany({
        where: { minggu_ke: t.minggu_ke, tahun: t.tahun, guru: { status: 'aktif' } },
      });
      expect(t.persentase).toBe(
        rataRataPekanGuru(
          rekap.map((r) => ({
            total_jam_wajib: r.total_jam_wajib,
            persentase_kehadiran: keAngka(r.persentase_kehadiran),
          })),
        ),
      );
    }
  });

  it('5 kelas dengan jam kosong terbanyak pekan ini, urut menurun', async () => {
    const d = (await manajemen.get(`${D}/ringkasan`)).body.data;
    expect(d.jam_kosong.pekan).toMatchObject({ minggu_ke: 4, tanggal_mulai: '2026-11-09' });
    expect(d.jam_kosong.data.length).toBeLessThanOrEqual(5);
    const angka = d.jam_kosong.data.map((k: { jp_kosong: number }) => k.jp_kosong);
    expect([...angka].sort((a, b) => b - a)).toEqual(angka);

    const grup = await prisma.kehadiran.groupBy({
      by: ['kelas_id'],
      where: {
        tanggal: { gte: keDate('2026-11-09'), lte: keDate('2026-11-13') },
        status_kehadiran: 'Tidak_Hadir',
      },
      _sum: { lama_jam: true },
    });
    const tertinggi = Math.max(...grup.map((g) => g._sum.lama_jam ?? 0));
    expect(angka[0]).toBe(tertinggi);
  });

  it('5 guru terendah pada pekan selesai terakhir yang punya rekap', async () => {
    const d = (await manajemen.get(`${D}/ringkasan`)).body.data;
    expect(d.guru_terendah.pekan).toMatchObject({ minggu_ke: 3 });
    expect(d.guru_terendah.data).toHaveLength(5);
    const nilai = d.guru_terendah.data.map((g: { persentase: number }) => g.persentase);
    expect([...nilai].sort((a, b) => a - b)).toEqual(nilai);
    const minimum = await prisma.rekapKehadiranGuru.findFirst({
      where: { minggu_ke: 3, tahun: 2026, total_jam_wajib: { gt: 0 }, guru: { status: 'aktif' } },
      orderBy: { persentase_kehadiran: 'asc' },
    });
    expect(nilai[0]).toBe(keAngka(minimum!.persentase_kehadiran));
  });

  it('log aktivitas terbaru hanya untuk admin', async () => {
    const a = (await admin.get(`${D}/ringkasan`)).body.data;
    expect(Array.isArray(a.log_terbaru)).toBe(true);
    expect(a.log_terbaru.length).toBeGreaterThan(0);
    expect((await manajemen.get(`${D}/ringkasan`)).body.data.log_terbaru).toBeNull();
  });

  it('cache dibatalkan saat data kehadiran berubah', async () => {
    const sebelum = (await admin.get(`${D}/ringkasan`)).body.data.kpi.catatan_hari_ini;
    const kelas = await prisma.kelas.findFirstOrThrow({ where: { nama_kelas: 'XII-2' } });
    const guru = await prisma.guru.create({
      data: { kode_guru: 'UJID1', nama_guru: 'Guru Uji Dashboard', mata_pelajaran: 'Uji' },
    });
    const res = await admin.post('/api/v1/kehadiran', {
      tanggal: HARI,
      guru_id: keNumber(guru.id),
      kelas_id: keNumber(kelas.id),
      jam_ke: 12,
      lama_jam: 1,
      status_kehadiran: 'Hadir',
      status_tugas: 'Ada',
    });
    expect(res.status).toBe(201);
    const sesudah = (await admin.get(`${D}/ringkasan`)).body.data.kpi.catatan_hari_ini;
    expect(sesudah).toBe(sebelum + 1);

    await prisma.kehadiran.deleteMany({ where: { guru_id: guru.id } });
    await prisma.rekapKehadiranGuru.deleteMany({ where: { guru_id: guru.id } });
    await prisma.guru.delete({ where: { id: guru.id } });
  });
});

describe('GET /dashboard/penilai', () => {
  it('jendela bulan berjalan dan guru yang belum dinilai', async () => {
    const res = await penilai.get(`${D}/penilai`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.periode).toEqual({ bulan: 11, tahun: 2026 });
    expect(d.jendela).toMatchObject({ buka: '2026-11-28', tutup: '2026-11-30', terbuka: false });
    expect(d.sudah_dinilai + d.belum_dinilai.length).toBe(d.jumlah_guru_aktif);

    // Setelah satu guru dinilai, ia keluar dari daftar.
    const g = d.belum_dinilai[0];
    const penilaiUser = await prisma.user.findFirstOrThrow({ where: { role: 'guru_penilai' } });
    await prisma.penilaianKinerjaBulanan.create({
      data: { guru_id: g.guru_id, bulan: 11, tahun: 2026, dinilai_oleh: penilaiUser.id },
    });
    batalkanCacheDashboard();
    const lagi = (await penilai.get(`${D}/penilai`)).body.data;
    expect(lagi.belum_dinilai.map((b: { guru_id: number }) => b.guru_id)).not.toContain(g.guru_id);
    expect(lagi.sudah_dinilai).toBe(d.sudah_dinilai + 1);
  });
});
