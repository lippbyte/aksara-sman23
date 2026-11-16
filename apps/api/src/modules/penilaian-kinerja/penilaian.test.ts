import {
  BOBOT_DEFAULT,
  predikatKinerja,
  predikatMgmp,
  rataRataBulanan,
  skorAkhirKinerja,
  skorAkhirMgmp,
  skorKehadiranMgmp,
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
  });

  it('sekretaris: penilaian kinerja 403; MGMP boleh lihat tetapi tidak boleh sinkron/ekspor', async () => {
    expect((await sekretaris.get(`${PK}?bulan=10&tahun=2026`)).status).toBe(403);
    expect((await sekretaris.put(PK, {})).status).toBe(403);
    expect((await sekretaris.post(`${PK}/sync`, { bulan: 10, tahun: 2026 })).status).toBe(403);
    expect((await sekretaris.get(`${PK}/export?bulan=10&tahun=2026`)).status).toBe(403);

    expect((await sekretaris.get(`${PM}?bulan=10&tahun=2026`)).status).toBe(200);
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
  async function harapanKehadiranMgmp(mgmpId: number, bulan: number) {
    const anggota = await prisma.guru.findMany({ where: { mgmp_id: mgmpId, status: 'aktif' } });
    const rekap = await Promise.all(anggota.map((a) => rekapGuru(keNumber(a.id))));
    return skorKehadiranMgmp(rekap, bulan, 2026);
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
    }
  });

  it('sekretaris hanya boleh mengisi skor_siswa; isian lain → 403', async () => {
    await aturHariIni('2026-11-28');
    const dasar = { mgmp_id: mgmpMat, bulan: 11, tahun: 2026 };

    const siswa = await sekretaris.put(PM, { ...dasar, skor_siswa: 80 });
    expect(siswa.status).toBe(200);
    // Sekretaris tidak melihat skor lain, catatan, maupun skor akhir.
    expect(siswa.body.data).toMatchObject({
      skor_siswa: 80,
      skor_administrasi: null,
      skor_kehadiran: null,
      skor_akhir: null,
      predikat: null,
      catatan: null,
    });

    const adm = await sekretaris.put(PM, { ...dasar, skor_administrasi: 70 });
    expect(adm.status).toBe(403);
    expect(adm.body.error.message).toBe('Sekretaris kelas hanya boleh mengisi skor siswa.');
    expect((await sekretaris.put(PM, { ...dasar, skor_siswa: 80, catatan: 'x' })).status).toBe(403);
    expect((await sekretaris.put(PM, dasar)).status).toBe(400);

    const baris = await prisma.penilaianMgmp.findFirstOrThrow({
      where: { mgmp_id: mgmpMat, bulan: 11 },
    });
    expect(keAngka(baris.skor_administrasi)).toBe(0);
  });

  it('pengisian sebagian tidak menghapus isian lain; skor akhir 40/30/30 dan predikat', async () => {
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
      { skor_kehadiran: kehadiran, skor_siswa: 80, skor_administrasi: 90 },
      BOBOT_DEFAULT.mgmp,
    );
    expect(res.body.data).toMatchObject({
      skor_kehadiran: kehadiran,
      skor_siswa: 80,
      skor_administrasi: 90,
      skor_akhir: akhir,
      predikat: predikatMgmp(akhir),
      catatan: 'Rapat rutin (contoh)',
    });

    // Validasi: harus mengisi minimal satu nilai; skor 0–100.
    expect((await penilai.put(PM, dasar)).status).toBe(400);
    expect((await penilai.put(PM, { ...dasar, skor_siswa: 101 })).status).toBe(400);
    expect((await penilai.put(PM, { ...dasar, mgmp_id: 99999999, skor_siswa: 50 })).status).toBe(
      400,
    );
  });

  it('di luar jendela: sekretaris → 422', async () => {
    await aturHariIni('2026-11-20');
    const res = await sekretaris.put(PM, {
      mgmp_id: mgmpMat,
      bulan: 11,
      tahun: 2026,
      skor_siswa: 60,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details.jendela).toMatchObject({
      buka: '2026-11-28',
      tutup: '2026-11-30',
    });
  });

  it('ekspor CSV MGMP', async () => {
    const res = await admin.get(`${PM}/export?bulan=11&tahun=2026`);
    expect(res.status).toBe(200);
    const garis = (res.text as string).slice(1).split('\r\n').filter(Boolean);
    expect(garis[0]).toBe(
      'MGMP,Guru Aktif,Skor Kehadiran,Skor Siswa,Skor Administrasi,Skor Akhir,Predikat,Catatan,Penilai',
    );
    expect(garis).toHaveLength(4);
    expect(garis.find((g) => g.startsWith('Matematika'))).toContain('Rapat rutin (contoh)');
  });
});
