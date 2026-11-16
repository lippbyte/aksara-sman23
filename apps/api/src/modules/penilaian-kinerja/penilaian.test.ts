import {
  BOBOT_DEFAULT,
  predikatKinerja,
  predikatMgmp,
  rataRataBulanan,
  skorAkhirKinerja,
  skorAkhirMgmp,
  skorKehadiranMgmp,
  skorSiswaMgmp,
  totalJamWajib,
  type RekapPekanRingkas,
} from '@sms/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp, tutupSumberDaya } from '../../app';
import { BOM } from '../../lib/csv';
import { keAngka, keNumber, keTanggalISO } from '../../lib/konversi';
import { prisma } from '../../lib/prisma';
import { Klien, masukSebagai } from '../../test/bantuan';

const app = createApp();
const PK = '/api/v1/penilaian-kinerja';
const PM = '/api/v1/penilaian-mgmp';

let admin: Klien;
let manajemen: Klien;
let penilai: Klien;
let sekretaris: Klien;
let guru: { id: number; nama: string }[];
let mgmpMat: number;

/** Masuk ulang semua klien: sesi berumur 8 jam mengikuti jam sistem. */
async function masukSemua() {
  admin = await masukSebagai(app, 'admin');
  manajemen = await masukSebagai(app, 'manajemen_guru');
  penilai = await masukSebagai(app, 'guru_penilai');
  sekretaris = await masukSebagai(app, 'sekretaris_kelas');
}

/** Hanya `Date` yang dipalsukan; timer I/O (basis data, HTTP) tetap berjalan normal. */
async function aturHariIni(tanggal: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  // 10.00 WIB pada tanggal itu.
  vi.setSystemTime(new Date(`${tanggal}T03:00:00Z`));
  await masukSemua();
}

async function rekapGuru(guruId: number): Promise<RekapPekanRingkas[]> {
  const rows = await prisma.rekapKehadiranGuru.findMany({ where: { guru_id: guruId } });
  return rows.map((r) => ({
    tanggal_mulai: keTanggalISO(r.tanggal_mulai),
    tanggal_selesai: keTanggalISO(r.tanggal_selesai),
    persentase_kehadiran: keAngka(r.persentase_kehadiran),
  }));
}

beforeAll(async () => {
  await masukSemua();
  const rows = await prisma.guru.findMany({
    where: { kode_guru: { startsWith: 'G' }, status: 'aktif' },
    orderBy: { kode_guru: 'asc' },
  });
  guru = rows.map((g) => ({ id: keNumber(g.id), nama: g.nama_guru }));
  mgmpMat = keNumber(
    (await prisma.mgmp.findFirstOrThrow({ where: { nama_mapel: 'Matematika' } })).id,
  );
});

afterEach(async () => {
  if (vi.isFakeTimers()) {
    vi.useRealTimers();
    await masukSemua();
  }
});

afterAll(async () => {
  await prisma.penilaianKinerjaBulanan.deleteMany();
  await prisma.penilaianMgmpSiswa.deleteMany();
  await prisma.penilaianMgmp.deleteMany();
  await prisma.sekolahSettings.updateMany({
    data: {
      bobot_kinerja_kehadiran: 50,
      bobot_kinerja_administrasi: 30,
      bobot_kinerja_manajemen: 20,
    },
  });
  await tutupSumberDaya();
});

describe('otorisasi', () => {
  it('tanpa sesi → 401', async () => {
    const tamu = new Klien(app);
    expect((await tamu.get(`${PK}?bulan=10&tahun=2026`)).status).toBe(401);
    expect((await tamu.put(PK, {})).status).toBe(401);
    expect((await tamu.post(`${PK}/sync`, {})).status).toBe(401);
    expect((await tamu.get(`${PM}?bulan=10&tahun=2026`)).status).toBe(401);
    expect((await tamu.put(PM, {})).status).toBe(401);
    expect((await tamu.put(`${PM}/skor-siswa`, {})).status).toBe(401);
    expect((await tamu.get(`${PM}/skor-siswa?mgmp_id=1&bulan=10&tahun=2026`)).status).toBe(401);
  });

  it('sekretaris: penilaian kinerja 403; MGMP boleh lihat tetapi tidak boleh sinkron/ekspor', async () => {
    expect((await sekretaris.get(`${PK}?bulan=10&tahun=2026`)).status).toBe(403);
    expect((await sekretaris.put(PK, {})).status).toBe(403);
    expect((await sekretaris.post(`${PK}/sync`, { bulan: 10, tahun: 2026 })).status).toBe(403);
    expect((await sekretaris.get(`${PK}/export?bulan=10&tahun=2026`)).status).toBe(403);

    expect((await sekretaris.get(`${PM}?bulan=10&tahun=2026`)).status).toBe(200);
    expect((await sekretaris.put(PM, { mgmp_id: 1, bulan: 10, tahun: 2026 })).status).toBe(403);
    expect((await sekretaris.post(`${PM}/sync`, { bulan: 10, tahun: 2026 })).status).toBe(403);
    expect((await sekretaris.get(`${PM}/export?bulan=10&tahun=2026`)).status).toBe(403);
  });
});

describe('penilaian kinerja bulanan', () => {
  it('sinkron: skor kehadiran = rata-rata rekap pekan yang BERIRISAN dengan bulan', async () => {
    const res = await penilai.post(`${PK}/sync`, { bulan: 10, tahun: 2026 });
    expect(res.status).toBe(200);
    expect(res.body.data.disinkronkan).toBeGreaterThanOrEqual(12);

    const daftar = await manajemen.get(`${PK}?bulan=10&tahun=2026&pageSize=100`);
    expect(daftar.status).toBe(200);
    for (const g of guru) {
      const baris = daftar.body.data.find((b: { guru_id: number }) => b.guru_id === g.id);
      expect(baris.skor_kehadiran).toBe(rataRataBulanan(await rekapGuru(g.id), 10, 2026));
      // Hasil sinkron saja belum dihitung "dinilai".
      expect(baris).toMatchObject({ sudah_dinilai: false, predikat: null, skor_akhir: null });
    }
    const log = await prisma.auditLog.findFirst({ where: { aktivitas: 'SYNC_PENILAIAN_KINERJA' } });
    expect(log?.description).toContain('Oktober 2026');
  });

  it('dalam jendela (3 hari terakhir): guru_penilai menyimpan; skor akhir dan predikat dari fungsi domain', async () => {
    await aturHariIni('2026-10-29');
    const g = guru[0]!;
    const daftar = await penilai.get(`${PK}?bulan=10&tahun=2026`);
    expect(daftar.body.jendela).toMatchObject({
      buka: '2026-10-29',
      tutup: '2026-10-31',
      terbuka: true,
      hari: 3,
    });

    // Manajemen kosong → kehadiran 50% + administrasi 50%.
    const tanpa = await penilai.put(PK, {
      guru_id: g.id,
      bulan: 10,
      tahun: 2026,
      skor_administrasi_avg: 88.5,
      skor_manajemen_avg: null,
      catatan: 'Catatan contoh',
    });
    expect(tanpa.status).toBe(200);
    const kehadiran = rataRataBulanan(await rekapGuru(g.id), 10, 2026);
    const harapTanpa = skorAkhirKinerja(
      { skor_kehadiran: kehadiran, skor_administrasi_avg: 88.5 },
      BOBOT_DEFAULT.kinerja,
    );
    expect(tanpa.body.data).toMatchObject({
      skor_kehadiran: kehadiran,
      skor_administrasi_avg: 88.5,
      skor_manajemen_avg: null,
      skor_akhir: harapTanpa,
      predikat: predikatKinerja(harapTanpa),
      sudah_dinilai: true,
      nama_penilai: 'Guru Penilai Contoh',
    });

    // Manajemen 0 diperlakukan sama dengan kosong.
    const nol = await penilai.put(PK, {
      guru_id: g.id,
      bulan: 10,
      tahun: 2026,
      skor_administrasi_avg: 88.5,
      skor_manajemen_avg: 0,
    });
    expect(nol.body.data.skor_akhir).toBe(harapTanpa);

    // Manajemen terisi → 50/30/20.
    const dengan = await penilai.put(PK, {
      guru_id: g.id,
      bulan: 10,
      tahun: 2026,
      skor_administrasi_avg: 88.5,
      skor_manajemen_avg: 70,
    });
    expect(dengan.body.data.skor_akhir).toBe(
      skorAkhirKinerja(
        { skor_kehadiran: kehadiran, skor_administrasi_avg: 88.5, skor_manajemen_avg: 70 },
        BOBOT_DEFAULT.kinerja,
      ),
    );
    expect(
      await prisma.penilaianKinerjaBulanan.count({
        where: { guru_id: g.id, bulan: 10, tahun: 2026 },
      }),
    ).toBe(1);
  });

  it('bobot dibaca dari pengaturan sekolah, tidak di-hardcode', async () => {
    await aturHariIni('2026-10-30');
    await prisma.sekolahSettings.updateMany({
      data: {
        bobot_kinerja_kehadiran: 20,
        bobot_kinerja_administrasi: 40,
        bobot_kinerja_manajemen: 40,
      },
    });
    const g = guru[1]!;
    const res = await manajemen.put(PK, {
      guru_id: g.id,
      bulan: 10,
      tahun: 2026,
      skor_administrasi_avg: 100,
      skor_manajemen_avg: 50,
    });
    const kehadiran = rataRataBulanan(await rekapGuru(g.id), 10, 2026);
    expect(res.body.data.skor_akhir).toBe(
      skorAkhirKinerja(
        { skor_kehadiran: kehadiran, skor_administrasi_avg: 100, skor_manajemen_avg: 50 },
        {
          dengan_manajemen: { kehadiran: 20, administrasi: 40, manajemen: 40 },
          tanpa_manajemen: BOBOT_DEFAULT.kinerja.tanpa_manajemen,
        },
      ),
    );
    await prisma.sekolahSettings.updateMany({
      data: {
        bobot_kinerja_kehadiran: 50,
        bobot_kinerja_administrasi: 30,
        bobot_kinerja_manajemen: 20,
      },
    });
  });

  it('di luar jendela: non-admin → 422; admin boleh dan tercatat di log', async () => {
    await aturHariIni('2026-10-28');
    const g = guru[2]!;
    const isi = { guru_id: g.id, bulan: 10, tahun: 2026, skor_administrasi_avg: 80 };

    const ditolak = await penilai.put(PK, isi);
    expect(ditolak.status).toBe(422);
    expect(ditolak.body.error.message).toContain('Jendela penilaian Oktober 2026 tertutup');
    expect((await manajemen.put(PK, isi)).status).toBe(422);

    const olehAdmin = await admin.put(PK, isi);
    expect(olehAdmin.status).toBe(200);
    const log = await prisma.auditLog.findFirst({
      where: { aktivitas: 'PENILAIAN_DI_LUAR_JENDELA' },
      orderBy: { id: 'desc' },
    });
    expect(log?.description).toContain('kinerja Oktober 2026');

    // Bulan lalu tetap tertutup walau hari ini akhir bulan berjalan.
    await aturHariIni('2026-11-30');
    expect((await penilai.put(PK, isi)).status).toBe(422);
  });

  it('validasi → 400', async () => {
    await aturHariIni('2026-10-31');
    const g = guru[3]!;
    const dasar = { guru_id: g.id, bulan: 10, tahun: 2026 };
    expect((await penilai.put(PK, { ...dasar, skor_administrasi_avg: 100.5 })).status).toBe(400);
    expect((await penilai.put(PK, { ...dasar, skor_administrasi_avg: 80.123 })).status).toBe(400);
    expect((await penilai.put(PK, { ...dasar, skor_administrasi_avg: -1 })).status).toBe(400);
    expect((await penilai.put(PK, { ...dasar, bulan: 13, skor_administrasi_avg: 80 })).status).toBe(
      400,
    );
    expect(
      (await penilai.put(PK, { ...dasar, guru_id: 99999999, skor_administrasi_avg: 80 })).status,
    ).toBe(400);
    expect((await penilai.get(`${PK}?bulan=0&tahun=2026`)).status).toBe(400);
  });

  it('ekspor CSV: belum dinilai ditandai; tercatat di log', async () => {
    const res = await manajemen.get(`${PK}/export?bulan=10&tahun=2026`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('penilaian-kinerja_2026-10.csv');
    const teks: string = res.text;
    expect(teks.startsWith(BOM)).toBe(true);
    expect(teks).toContain(
      'Kode Guru,Nama Guru,Mata Pelajaran,Skor Kehadiran,Skor Administrasi,Skor Manajemen,Skor Akhir,Predikat,Catatan,Penilai',
    );
    expect(teks).toContain('Belum dinilai');
    expect(await prisma.auditLog.count({ where: { aktivitas: 'EXPORT_PENILAIAN_KINERJA' } })).toBe(
      1,
    );
  });
});

describe('penilaian MGMP', () => {
  const HARI_EFEKTIF = [1, 2, 3, 4, 5];
  let kelasX1: number;
  let kelasX2: number;

  beforeAll(async () => {
    kelasX1 = keNumber((await prisma.kelas.findFirstOrThrow({ where: { nama_kelas: 'X-1' } })).id);
    kelasX2 = keNumber((await prisma.kelas.findFirstOrThrow({ where: { nama_kelas: 'X-2' } })).id);
  });

  async function harapanKehadiranMgmp(mgmpId: number, bulan: number) {
    const anggota = await prisma.guru.findMany({
      where: { mgmp_id: mgmpId, status: 'aktif' },
      include: { jadwal: true, rekap: true },
    });
    return skorKehadiranMgmp(
      anggota.map((a) => ({
        jam_wajib_jadwal: totalJamWajib(a.jadwal, HARI_EFEKTIF),
        rekap: a.rekap.map((r) => ({
          tanggal_mulai: keTanggalISO(r.tanggal_mulai),
          tanggal_selesai: keTanggalISO(r.tanggal_selesai),
          persentase_kehadiran: keAngka(r.persentase_kehadiran),
          total_jam_wajib: r.total_jam_wajib,
        })),
      })),
      bulan,
      2026,
    );
  }

  it('sinkron: skor kehadiran MGMP dari rekap guru aktif anggotanya', async () => {
    const res = await manajemen.post(`${PM}/sync`, { bulan: 11, tahun: 2026 });
    expect(res.status).toBe(200);
    expect(res.body.data.disinkronkan).toBe(3);

    const daftar = await manajemen.get(`${PM}?bulan=11&tahun=2026`);
    expect(daftar.body.data).toHaveLength(3);
    for (const baris of daftar.body.data) {
      expect(baris.skor_kehadiran).toBe(await harapanKehadiranMgmp(baris.mgmp_id, 11));
      expect(baris.jumlah_guru_aktif).toBe(
        await prisma.guru.count({ where: { mgmp_id: baris.mgmp_id, status: 'aktif' } }),
      );
      expect(baris).toMatchObject({
        kelas_terisi: 0,
        jumlah_kelas: await prisma.kelas.count(),
        skor_siswa: null,
        skor_kelas_saya: null,
      });
    }
  });

  it('skor kehadiran: guru berjadwal tanpa catatan dihitung 0; guru tanpa jam wajib dikeluarkan', async () => {
    const sebelum = await harapanKehadiranMgmp(mgmpMat, 11);
    const berjadwal = await prisma.guru.create({
      data: {
        kode_guru: 'UJI-MGMP-1',
        nama_guru: 'Guru Berjadwal Contoh',
        mata_pelajaran: 'Matematika',
        mgmp_id: mgmpMat,
        jadwal: { create: { kelas_id: kelasX2, hari: 3, jam_ke: 11, total_jam_mengajar: 2 } },
      },
    });
    const tanpaJadwal = await prisma.guru.create({
      data: {
        kode_guru: 'UJI-MGMP-2',
        nama_guru: 'Guru Tanpa Jadwal Contoh',
        mata_pelajaran: 'Matematika',
        mgmp_id: mgmpMat,
        // Jadwal hanya hari Sabtu (bukan hari efektif) → tanpa jam wajib.
        jadwal: { create: { kelas_id: kelasX2, hari: 6, jam_ke: 11, total_jam_mengajar: 2 } },
      },
    });
    try {
      await manajemen.post(`${PM}/sync`, { bulan: 11, tahun: 2026 });
      const baris = (await manajemen.get(`${PM}?bulan=11&tahun=2026`)).body.data.find(
        (b: { mgmp_id: number }) => b.mgmp_id === mgmpMat,
      );
      const harapan = await harapanKehadiranMgmp(mgmpMat, 11);
      expect(baris.skor_kehadiran).toBe(harapan);
      // n guru dihitung → n + 1 (guru berjadwal = 0); guru tanpa jam wajib tidak dihitung.
      const n = await prisma.guru.count({
        where: { mgmp_id: mgmpMat, status: 'aktif', kode_guru: { startsWith: 'G' } },
      });
      expect(harapan).toBeCloseTo((sebelum * n) / (n + 1), 1);
      expect(harapan).toBeLessThan(sebelum);
    } finally {
      await prisma.jadwalMengajar.deleteMany({
        where: { guru_id: { in: [berjadwal.id, tanpaJadwal.id] } },
      });
      await prisma.guru.deleteMany({ where: { id: { in: [berjadwal.id, tanpaJadwal.id] } } });
      await manajemen.post(`${PM}/sync`, { bulan: 11, tahun: 2026 });
    }
  });

  it('sekretaris mengisi skor siswa KELASNYA saja; isian penilai → 403', async () => {
    await aturHariIni('2026-11-28');
    const dasar = { mgmp_id: mgmpMat, bulan: 11, tahun: 2026 };

    // kelas_id di form diabaikan: kelas selalu dari akun.
    const res = await sekretaris.put(`${PM}/skor-siswa`, { ...dasar, kelas_id: kelasX2, skor: 80 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      skor_kelas_saya: 80,
      kelas_terisi: 1,
      // Sekretaris tidak melihat rata-rata, skor lain, catatan, maupun skor akhir.
      skor_siswa: null,
      skor_administrasi: null,
      skor_kehadiran: null,
      skor_akhir: null,
      predikat: null,
      catatan: null,
    });
    const isian = await prisma.penilaianMgmpSiswa.findMany({ where: { mgmp_id: mgmpMat } });
    expect(isian).toHaveLength(1);
    expect(keNumber(isian[0]?.kelas_id ?? 0n)).toBe(kelasX1);

    // Mengisi ulang memperbarui baris kelas yang sama.
    expect((await sekretaris.put(`${PM}/skor-siswa`, { ...dasar, skor: 70 })).status).toBe(200);
    expect(await prisma.penilaianMgmpSiswa.count({ where: { mgmp_id: mgmpMat } })).toBe(1);
    expect((await sekretaris.put(`${PM}/skor-siswa`, { ...dasar, skor: 80 })).status).toBe(200);

    const adm = await sekretaris.put(PM, { ...dasar, skor_administrasi: 70 });
    expect(adm.status).toBe(403);
    expect((await sekretaris.put(PM, { ...dasar, catatan: 'x' })).status).toBe(403);
    expect((await sekretaris.put(`${PM}/skor-siswa`, dasar)).status).toBe(400);
    expect((await sekretaris.put(`${PM}/skor-siswa`, { ...dasar, skor: 101 })).status).toBe(400);

    // Rincian per kelas: sekretaris hanya melihat kelasnya.
    const rinci = await sekretaris.get(`${PM}/skor-siswa?mgmp_id=${mgmpMat}&bulan=11&tahun=2026`);
    expect(rinci.status).toBe(200);
    expect(rinci.body.data).toEqual([
      expect.objectContaining({ kelas_id: kelasX1, nama_kelas: 'X-1', skor: 80 }),
    ]);

    // Pengisian skor siswa tidak menjadikan baris "sudah dinilai".
    const baris = await prisma.penilaianMgmp.findFirstOrThrow({
      where: { mgmp_id: mgmpMat, bulan: 11 },
    });
    expect(keAngka(baris.skor_siswa)).toBe(80);
    expect(keAngka(baris.skor_administrasi)).toBe(0);
    expect(baris.dinilai_oleh).toBeNull();
    const log = await prisma.auditLog.findFirst({ where: { aktivitas: 'SIMPAN_SKOR_SISWA_MGMP' } });
    expect(log?.description).toContain('kelas X-1');
  });

  it('skor siswa = rata-rata kelas yang mengisi; "n dari m kelas"; peran lain wajib memilih kelas', async () => {
    await aturHariIni('2026-11-28');
    const dasar = { mgmp_id: mgmpMat, bulan: 11, tahun: 2026 };

    const tanpaKelas = await penilai.put(`${PM}/skor-siswa`, { ...dasar, skor: 90 });
    expect(tanpaKelas.status).toBe(400);
    expect(
      (await penilai.put(`${PM}/skor-siswa`, { ...dasar, kelas_id: 99999999, skor: 90 })).status,
    ).toBe(400);

    const res = await penilai.put(`${PM}/skor-siswa`, { ...dasar, kelas_id: kelasX2, skor: 90 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      kelas_terisi: 2,
      jumlah_kelas: await prisma.kelas.count(),
      skor_siswa: skorSiswaMgmp([80, 90]),
      skor_kelas_saya: null,
    });

    const rinci = await admin.get(`${PM}/skor-siswa?mgmp_id=${mgmpMat}&bulan=11&tahun=2026`);
    expect(rinci.body.data).toHaveLength(await prisma.kelas.count());
    const terisi = rinci.body.data.filter((k: { skor: number | null }) => k.skor !== null);
    expect(terisi.map((k: { nama_kelas: string }) => k.nama_kelas)).toEqual(['X-1', 'X-2']);
  });

  it('isian penilai tidak menghapus skor siswa; skor akhir 40/30/30 dan predikat', async () => {
    await aturHariIni('2026-11-29');
    const dasar = { mgmp_id: mgmpMat, bulan: 11, tahun: 2026 };
    const res = await penilai.put(PM, {
      ...dasar,
      skor_administrasi: 90,
      catatan: 'Rapat rutin (contoh)',
    });
    expect(res.status).toBe(200);
    const kehadiran = await harapanKehadiranMgmp(mgmpMat, 11);
    const akhir = skorAkhirMgmp(
      { skor_kehadiran: kehadiran, skor_siswa: 85, skor_administrasi: 90 },
      BOBOT_DEFAULT.mgmp,
    );
    expect(res.body.data).toMatchObject({
      skor_kehadiran: kehadiran,
      skor_siswa: 85,
      skor_administrasi: 90,
      skor_akhir: akhir,
      predikat: predikatMgmp(akhir),
      catatan: 'Rapat rutin (contoh)',
      sudah_dinilai: true,
    });

    // Validasi: minimal satu isian; skor_siswa tidak lagi diisi lewat rute ini.
    expect((await penilai.put(PM, dasar)).status).toBe(400);
    expect((await penilai.put(PM, { ...dasar, skor_siswa: 50 })).status).toBe(400);
    expect((await penilai.put(PM, { ...dasar, skor_administrasi: 101 })).status).toBe(400);
    expect(
      (await penilai.put(PM, { ...dasar, mgmp_id: 99999999, skor_administrasi: 50 })).status,
    ).toBe(400);
  });

  it('sinkron menghitung ulang skor siswa dari baris per kelas', async () => {
    await prisma.penilaianMgmp.updateMany({
      where: { mgmp_id: mgmpMat, bulan: 11, tahun: 2026 },
      data: { skor_siswa: 0 },
    });
    expect((await manajemen.post(`${PM}/sync`, { bulan: 11, tahun: 2026 })).status).toBe(200);
    const baris = await prisma.penilaianMgmp.findFirstOrThrow({
      where: { mgmp_id: mgmpMat, bulan: 11, tahun: 2026 },
    });
    expect(keAngka(baris.skor_siswa)).toBe(85);
    expect(keAngka(baris.skor_administrasi)).toBe(90);
  });

  it('di luar jendela: sekretaris → 422', async () => {
    await aturHariIni('2026-11-20');
    const res = await sekretaris.put(`${PM}/skor-siswa`, {
      mgmp_id: mgmpMat,
      bulan: 11,
      tahun: 2026,
      skor: 60,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details.jendela).toMatchObject({
      buka: '2026-11-28',
      tutup: '2026-11-30',
    });
  });

  it('m = kelas yang punya jadwal dari guru aktif MGMP itu', async () => {
    const jadwal = await prisma.jadwalMengajar.findMany({
      where: { guru: { mgmp_id: mgmpMat, status: 'aktif' } },
      select: { kelas_id: true },
    });
    const harapan = new Set(jadwal.map((j) => keNumber(j.kelas_id))).size;
    const baris = (await admin.get(`${PM}?bulan=11&tahun=2026`)).body.data.find(
      (b: { mgmp_id: number }) => b.mgmp_id === mgmpMat,
    );
    expect(harapan).toBeGreaterThan(0);
    expect(baris.jumlah_kelas).toBe(harapan);
  });

  it('kasus tepi: MGMP tanpa jadwal sama sekali; kelas tanpa jadwal MGMP itu', async () => {
    await aturHariIni('2026-11-28');
    const tanpaJadwal = await prisma.mgmp.create({ data: { nama_mapel: 'Uji Tanpa Jadwal' } });
    const satuKelas = await prisma.mgmp.create({ data: { nama_mapel: 'Uji Satu Kelas' } });
    const guruUji = await prisma.guru.create({
      data: {
        kode_guru: 'UJI-MGMP-3',
        nama_guru: 'Guru Satu Kelas Contoh',
        mata_pelajaran: 'Uji Satu Kelas',
        mgmp_id: satuKelas.id,
        jadwal: { create: { kelas_id: kelasX2, hari: 2, jam_ke: 12, total_jam_mengajar: 1 } },
      },
    });
    const idTanpa = keNumber(tanpaJadwal.id);
    const idSatu = keNumber(satuKelas.id);
    try {
      // Admin: 0 dari 0 kelas; 0 dari 1 kelas.
      const daftarAdmin = (await admin.get(`${PM}?bulan=11&tahun=2026`)).body.data;
      const cari = (id: number) => daftarAdmin.find((b: { mgmp_id: number }) => b.mgmp_id === id);
      expect(cari(idTanpa)).toMatchObject({ kelas_terisi: 0, jumlah_kelas: 0, skor_siswa: null });
      expect(cari(idSatu)).toMatchObject({ kelas_terisi: 0, jumlah_kelas: 1 });

      // Sekretaris X-1: kedua MGMP tidak tampil; mengisi atau melihat rincian → 403.
      const daftarSek = (await sekretaris.get(`${PM}?bulan=11&tahun=2026`)).body.data;
      const terlihat = daftarSek.map((b: { mgmp_id: number }) => b.mgmp_id);
      expect(terlihat).toContain(mgmpMat);
      expect(terlihat).not.toContain(idTanpa);
      expect(terlihat).not.toContain(idSatu);
      for (const id of [idTanpa, idSatu]) {
        const isi = await sekretaris.put(`${PM}/skor-siswa`, {
          mgmp_id: id,
          bulan: 11,
          tahun: 2026,
          skor: 70,
        });
        expect(isi.status).toBe(403);
        expect(isi.body.error.message).toBe('Guru MGMP ini tidak punya jadwal di kelas Anda.');
        expect(
          (await sekretaris.get(`${PM}/skor-siswa?mgmp_id=${id}&bulan=11&tahun=2026`)).status,
        ).toBe(403);
      }
      // Tetap 403 di luar jendela (akses diperiksa lebih dulu).
      await aturHariIni('2026-11-20');
      expect(
        (
          await sekretaris.put(`${PM}/skor-siswa`, {
            mgmp_id: idSatu,
            bulan: 11,
            tahun: 2026,
            skor: 70,
          })
        ).status,
      ).toBe(403);
      await aturHariIni('2026-11-28');

      // Peran lain: kelas tanpa jadwal → 422 dengan pesan yang jelas; kelas berjadwal → 200.
      const dasar = { mgmp_id: idSatu, bulan: 11, tahun: 2026 };
      const tolak = await penilai.put(`${PM}/skor-siswa`, {
        ...dasar,
        kelas_id: kelasX1,
        skor: 60,
      });
      expect(tolak.status).toBe(422);
      expect(tolak.body.error.message).toBe(
        'Kelas X-1 tidak diajar oleh guru aktif MGMP Uji Satu Kelas, sehingga skor siswanya tidak dapat diisi. Pilih kelas yang punya jadwal mengajar guru MGMP ini.',
      );
      expect(tolak.body.error.details).toEqual({
        kelas_id: ['Kelas ini tidak punya jadwal mengajar guru MGMP ini.'],
      });
      const tolakTanpa = await penilai.put(`${PM}/skor-siswa`, {
        ...dasar,
        mgmp_id: idTanpa,
        kelas_id: kelasX1,
        skor: 60,
      });
      expect(tolakTanpa.status).toBe(422);
      expect(tolakTanpa.body.error.message).toContain('MGMP Uji Tanpa Jadwal');
      expect(
        (await penilai.put(`${PM}/skor-siswa`, { ...dasar, kelas_id: 99999999, skor: 60 })).body
          .error.message,
      ).toBe('Kelas tidak ditemukan.');
      const ok = await penilai.put(`${PM}/skor-siswa`, { ...dasar, kelas_id: kelasX2, skor: 70 });
      expect(ok.status).toBe(200);
      expect(ok.body.data).toMatchObject({ kelas_terisi: 1, jumlah_kelas: 1, skor_siswa: 70 });

      // Isian lama dari kelas yang kini tak berjadwal: tampil di rincian, tidak dihitung.
      const pengisi = await prisma.user.findFirstOrThrow({ where: { role: 'admin' } });
      await prisma.penilaianMgmpSiswa.create({
        data: { ...dasar, kelas_id: kelasX1, skor: 10, diisi_oleh: pengisi.id },
      });
      const rinci = (await admin.get(`${PM}/skor-siswa?mgmp_id=${idSatu}&bulan=11&tahun=2026`)).body
        .data;
      expect(rinci).toEqual([
        expect.objectContaining({ nama_kelas: 'X-1', skor: 10, berjadwal: false }),
        expect.objectContaining({ nama_kelas: 'X-2', skor: 70, berjadwal: true }),
      ]);
      expect((await admin.post(`${PM}/sync`, { bulan: 11, tahun: 2026 })).status).toBe(200);
      const setelah = (await admin.get(`${PM}?bulan=11&tahun=2026`)).body.data.find(
        (b: { mgmp_id: number }) => b.mgmp_id === idSatu,
      );
      expect(setelah).toMatchObject({ kelas_terisi: 1, jumlah_kelas: 1, skor_siswa: 70 });
    } finally {
      const ids = [tanpaJadwal.id, satuKelas.id];
      await prisma.penilaianMgmpSiswa.deleteMany({ where: { mgmp_id: { in: ids } } });
      await prisma.penilaianMgmp.deleteMany({ where: { mgmp_id: { in: ids } } });
      await prisma.jadwalMengajar.deleteMany({ where: { guru_id: guruUji.id } });
      await prisma.guru.delete({ where: { id: guruUji.id } });
      await prisma.mgmp.deleteMany({ where: { id: { in: ids } } });
    }
  });

  it('ekspor CSV MGMP', async () => {
    const res = await admin.get(`${PM}/export?bulan=11&tahun=2026`);
    expect(res.status).toBe(200);
    const garis = (res.text as string).slice(1).split('\r\n').filter(Boolean);
    expect(garis[0]).toBe(
      'MGMP,Guru Aktif,Skor Kehadiran,Skor Siswa,Kelas Mengisi,Skor Administrasi,Skor Akhir,Predikat,Catatan,Penilai',
    );
    expect(garis).toHaveLength(4);
    const mat = garis.find((g) => g.startsWith('Matematika'));
    expect(mat).toContain('Rapat rutin (contoh)');
    expect(mat).toContain(`2 dari ${await prisma.kelas.count()}`);
  });
});

describe('peringatan pekan belum disinkron', () => {
  it('pekan November yang sudah selesai tanpa rekap dilaporkan; tidak dihitung 0', async () => {
    // Pastikan pekan 6 (23–27 Nov) belum punya rekap; pekan 3 (2–6 Nov) sudah.
    await prisma.rekapKehadiranGuru.deleteMany({ where: { tahun: 2026, minggu_ke: 6 } });
    expect(
      await prisma.rekapKehadiranGuru.count({ where: { tahun: 2026, minggu_ke: 3 } }),
    ).toBeGreaterThan(0);
    await aturHariIni('2026-11-28');

    for (const url of [`${PK}?bulan=11&tahun=2026`, `${PM}?bulan=11&tahun=2026`]) {
      const res = await manajemen.get(url);
      expect(res.status).toBe(200);
      const nomor =
        res.body.data.length >= 0 &&
        res.body.pekan_belum_disinkron.map((p: { minggu_ke: number }) => p.minggu_ke);
      expect(nomor).toContain(6);
      expect(nomor).not.toContain(3);
      // Pekan 7 (30 Nov – 4 Des) belum selesai.
      expect(nomor).not.toContain(7);
    }

    // Skor kehadiran hanya dari pekan yang punya rekap (bukan dirata-rata dengan 0).
    await penilai.post(`${PK}/sync`, { bulan: 11, tahun: 2026 });
    const daftar = await manajemen.get(`${PK}?bulan=11&tahun=2026&pageSize=100`);
    const g = guru[0]!;
    const baris = daftar.body.data.find((b: { guru_id: number }) => b.guru_id === g.id);
    expect(baris.skor_kehadiran).toBe(rataRataBulanan(await rekapGuru(g.id), 11, 2026));
  });

  it('pekan dengan rekap sebagian (kurang dari guru aktif berjadwal) dilaporkan terpisah', async () => {
    await aturHariIni('2026-11-28');
    // Pekan 4 (9–13 Nov) disinkron penuh, lalu satu baris guru dihapus.
    expect(
      (await manajemen.post('/api/v1/rekap-kehadiran/sync', { minggu_ke: 4, tahun: 2026 })).status,
    ).toBe(200);
    const g = guru[0]!;
    await prisma.rekapKehadiranGuru.deleteMany({
      where: { guru_id: g.id, tahun: 2026, minggu_ke: 4 },
    });
    await prisma.rekapKehadiranGuru.deleteMany({ where: { tahun: 2026, minggu_ke: 6 } });

    const jadwal = await prisma.jadwalMengajar.groupBy({
      by: ['guru_id'],
      where: { guru: { status: 'aktif' }, hari: { in: [1, 2, 3, 4, 5] } },
      _sum: { total_jam_mengajar: true },
    });
    const berjadwal = jadwal.filter((j) => (j._sum.total_jam_mengajar ?? 0) > 0).length;

    for (const url of [`${PK}?bulan=11&tahun=2026`, `${PM}?bulan=11&tahun=2026`]) {
      const body = (await manajemen.get(url)).body;
      expect(body.pekan_rekap_sebagian).toContainEqual(
        expect.objectContaining({ minggu_ke: 4, terekap: berjadwal - 1, jumlah_guru: berjadwal }),
      );
      // Pekan tanpa baris sama sekali hanya muncul sebagai "belum disinkron", tidak ganda.
      const sebagian = body.pekan_rekap_sebagian.map((p: { minggu_ke: number }) => p.minggu_ke);
      expect(sebagian).not.toContain(6);
      expect(body.pekan_belum_disinkron.map((p: { minggu_ke: number }) => p.minggu_ke)).toContain(
        6,
      );
      expect(
        body.pekan_belum_disinkron.map((p: { minggu_ke: number }) => p.minggu_ke),
      ).not.toContain(4);
    }

    // Setelah sinkron ulang, pekan 4 lengkap lagi.
    await manajemen.post('/api/v1/rekap-kehadiran/sync', { minggu_ke: 4, tahun: 2026 });
    const lagi = (await manajemen.get(`${PK}?bulan=11&tahun=2026`)).body;
    expect(lagi.pekan_rekap_sebagian.map((p: { minggu_ke: number }) => p.minggu_ke)).not.toContain(
      4,
    );
  });

  it('bulan berjalan tanpa pekan yang selesai → daftar kosong', async () => {
    await aturHariIni('2026-11-03');
    const res = await manajemen.get(`${PK}?bulan=12&tahun=2026`);
    expect(res.body.pekan_belum_disinkron).toEqual([]);
    expect(res.body.pekan_rekap_sebagian).toEqual([]);
  });
});
