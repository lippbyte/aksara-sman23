import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, tutupSumberDaya } from '../../app';
import { BOM } from '../../lib/csv';
import { keDate, keNumber } from '../../lib/konversi';
import { prisma } from '../../lib/prisma';
import { Klien, masukSebagai } from '../../test/bantuan';

const app = createApp();
const KS = '/api/v1/kehadiran-siswa';
const L = '/api/v1/laporan/siswa';

// Tanggal di luar data seed (seed: 19 Okt–13 Nov 2026, jam ke-1).
const BARU = '2026-11-16';
const SABTU = '2026-11-14';

let admin: Klien;
let manajemen: Klien;
let sekretaris: Klien;
let penilai: Klien;
let kelasX1: number;
let kelasX2: number;
let siswaX1: number[];
let siswaX2: number[];

async function idSiswa(kelasId: number): Promise<number[]> {
  const rows = await prisma.siswa.findMany({
    where: { kelas_id: kelasId, status: 'aktif', nis: { startsWith: '99' } },
    orderBy: { nama_siswa: 'asc' },
  });
  return rows.map((r) => keNumber(r.id));
}

function items(ids: number[], ubah: Record<number, string> = {}) {
  return ids.map((siswa_id) => ({ siswa_id, status: ubah[siswa_id] ?? 'hadir', keterangan: '' }));
}

beforeAll(async () => {
  admin = await masukSebagai(app, 'admin');
  manajemen = await masukSebagai(app, 'manajemen_guru');
  sekretaris = await masukSebagai(app, 'sekretaris_kelas');
  penilai = await masukSebagai(app, 'guru_penilai');
  const kelas = await prisma.kelas.findMany({ where: { nama_kelas: { in: ['X-1', 'X-2'] } } });
  kelasX1 = keNumber(kelas.find((k) => k.nama_kelas === 'X-1')!.id);
  kelasX2 = keNumber(kelas.find((k) => k.nama_kelas === 'X-2')!.id);
  siswaX1 = await idSiswa(kelasX1);
  siswaX2 = await idSiswa(kelasX2);
});

afterAll(async () => {
  await prisma.kehadiranSiswa.deleteMany({
    where: {
      OR: [
        { tanggal: { in: [keDate(BARU), keDate(SABTU)] } },
        { siswa: { nis: { startsWith: 'UJIS' } } },
      ],
    },
  });
  await prisma.siswa.deleteMany({ where: { nis: { startsWith: 'UJIS' } } });
  await tutupSumberDaya();
});

describe('otorisasi', () => {
  const rute: [string, string][] = [
    ['get', `${KS}/sesi?tanggal=${BARU}&kelas_id=1`],
    ['get', `${KS}/riwayat`],
    ['put', `${KS}/sesi`],
    ['delete', `${KS}/sesi?tanggal=${BARU}&kelas_id=1`],
    ['delete', `${KS}/1`],
    ['get', L],
    ['get', `${L}/export`],
    ['get', '/api/v1/referensi/siswa'],
  ];

  function panggil(k: Klien, metode: string, path: string) {
    if (metode === 'get') return k.get(path);
    if (metode === 'put') return k.put(path, {});
    return k.delete(path);
  }

  it('tanpa sesi → 401', async () => {
    const tamu = new Klien(app);
    for (const [m, p] of rute) expect((await panggil(tamu, m, p)).status, `${m} ${p}`).toBe(401);
  });

  it('guru_penilai tidak punya akses ke data siswa (diperketat §8.6) → 403', async () => {
    for (const [m, p] of rute) expect((await panggil(penilai, m, p)).status, `${m} ${p}`).toBe(403);
  });

  it('manajemen_guru hanya melihat: GET 200, ubah dan hapus 403', async () => {
    expect((await manajemen.get(`${KS}/sesi?tanggal=2026-11-13&kelas_id=${kelasX2}`)).status).toBe(
      200,
    );
    expect((await manajemen.get(`${KS}/riwayat`)).status).toBe(200);
    expect(
      (
        await manajemen.put(`${KS}/sesi`, {
          kelas_id: kelasX2,
          tanggal: BARU,
          items: items(siswaX2),
        })
      ).status,
    ).toBe(403);
    expect(
      (await manajemen.delete(`${KS}/sesi?tanggal=2026-11-13&kelas_id=${kelasX2}`)).status,
    ).toBe(403);
  });

  it('sekretaris tidak boleh membuka laporan → 403', async () => {
    expect((await sekretaris.get(L)).status).toBe(403);
    expect((await sekretaris.get(`${L}/export`)).status).toBe(403);
  });
});

describe('GET /kehadiran-siswa/sesi', () => {
  it('sesi yang sudah diisi memuat status tersimpan', async () => {
    const res = await admin.get(`${KS}/sesi?tanggal=2026-11-13&kelas_id=${kelasX2}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ tanggal: '2026-11-13', jam_ke: 1, sudah_diisi: true });
    expect(res.body.data.kelas.nama_kelas).toBe('X-2');
    expect(res.body.data.siswa).toHaveLength(30);
    expect(res.body.data.siswa.every((s: { id: number | null }) => s.id !== null)).toBe(true);
  });

  it('sesi baru: semua siswa aktif tampil dengan default hadir', async () => {
    const res = await admin.get(`${KS}/sesi?tanggal=${SABTU}&kelas_id=${kelasX2}&jam_ke=1`);
    expect(res.body.data.sudah_diisi).toBe(false);
    expect(res.body.data.siswa).toHaveLength(30);
    expect(
      res.body.data.siswa.every(
        (s: { status: string; id: number | null }) => s.status === 'hadir' && s.id === null,
      ),
    ).toBe(true);
  });

  it('validasi: tanggal wajib, jam ke 0–12, admin wajib memilih kelas', async () => {
    expect((await admin.get(`${KS}/sesi?kelas_id=${kelasX2}`)).status).toBe(400);
    expect(
      (await admin.get(`${KS}/sesi?tanggal=${BARU}&kelas_id=${kelasX2}&jam_ke=13`)).status,
    ).toBe(400);
    expect((await admin.get(`${KS}/sesi?tanggal=${BARU}`)).status).toBe(400);
    expect((await admin.get(`${KS}/sesi?tanggal=${BARU}&kelas_id=99999999`)).status).toBe(404);
  });

  it('sekretaris selalu mendapat kelasnya walau meminta kelas lain', async () => {
    const res = await sekretaris.get(`${KS}/sesi?tanggal=2026-11-13&kelas_id=${kelasX2}`);
    expect(res.status).toBe(200);
    expect(res.body.data.kelas.nama_kelas).toBe('X-1');
    // Tanpa kelas_id pun berhasil.
    expect((await sekretaris.get(`${KS}/sesi?tanggal=2026-11-13`)).body.data.kelas.id).toBe(
      kelasX1,
    );
  });
});

describe('PUT /kehadiran-siswa/sesi (upsert massal)', () => {
  it('menyimpan sesi baru lalu memperbarui tanpa menggandakan baris', async () => {
    const sasaran = siswaX2[0]!;
    const awal = await admin.put(`${KS}/sesi`, {
      kelas_id: kelasX2,
      tanggal: BARU,
      jam_ke: 2,
      items: items(siswaX2, { [sasaran]: 'izin' }),
    });
    expect(awal.status).toBe(200);
    expect(awal.body.data).toEqual({
      disimpan: 30,
      hitungan: { hadir: 29, izin: 1, sakit: 0, alpa: 0 },
    });

    const where = { kelas_id: kelasX2, tanggal: keDate(BARU), jam_ke: 2 };
    const pembuat = (await prisma.kehadiranSiswa.findFirst({ where }))?.created_by;
    expect(await prisma.kehadiranSiswa.count({ where })).toBe(30);

    // Simpan ulang (oleh pengguna lain) dengan status berbeda.
    const ulang = await admin.put(`${KS}/sesi`, {
      kelas_id: kelasX2,
      tanggal: BARU,
      jam_ke: 2,
      items: [{ siswa_id: sasaran, status: 'sakit', keterangan: 'Demam (contoh)' }],
    });
    expect(ulang.status).toBe(200);
    expect(await prisma.kehadiranSiswa.count({ where })).toBe(30);
    const baris = await prisma.kehadiranSiswa.findFirst({ where: { ...where, siswa_id: sasaran } });
    expect(baris).toMatchObject({
      status: 'sakit',
      keterangan: 'Demam (contoh)',
      created_by: pembuat,
    });

    const sesi = await admin.get(`${KS}/sesi?tanggal=${BARU}&kelas_id=${kelasX2}&jam_ke=2`);
    expect(sesi.body.data.sudah_diisi).toBe(true);

    const log = await prisma.auditLog.findFirst({
      where: { aktivitas: 'SIMPAN_KEHADIRAN_SISWA', entity_id: `${kelasX2}:${BARU}:2` },
    });
    expect(log).toMatchObject({ module: 'Siswa' });
    expect(log?.description).toContain('29 hadir, 1 izin');
  });

  it('validasi → 400: kosong, siswa ganda, status salah, admin tanpa kelas', async () => {
    const dasar = { kelas_id: kelasX2, tanggal: BARU, jam_ke: 3 };
    expect((await admin.put(`${KS}/sesi`, { ...dasar, items: [] })).status).toBe(400);
    const s = siswaX2[0]!;
    const ganda = await admin.put(`${KS}/sesi`, {
      ...dasar,
      items: [
        { siswa_id: s, status: 'hadir' },
        { siswa_id: s, status: 'alpa' },
      ],
    });
    expect(ganda.status).toBe(400);
    expect(
      (await admin.put(`${KS}/sesi`, { ...dasar, items: [{ siswa_id: s, status: 'bolos' }] }))
        .status,
    ).toBe(400);
    const tanpaKelas = await admin.put(`${KS}/sesi`, {
      ...dasar,
      kelas_id: null,
      items: items([s]),
    });
    expect(tanpaKelas.status).toBe(400);
  });

  it('siswa dari kelas lain → 422 dan tidak ada yang tersimpan', async () => {
    const res = await admin.put(`${KS}/sesi`, {
      kelas_id: kelasX2,
      tanggal: BARU,
      jam_ke: 4,
      items: [...items(siswaX2.slice(0, 2)), ...items(siswaX1.slice(0, 1))],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.details.siswa_id).toEqual([siswaX1[0]]);
    expect(await prisma.kehadiranSiswa.count({ where: { tanggal: keDate(BARU), jam_ke: 4 } })).toBe(
      0,
    );
  });

  it('sekretaris: kelas dari akun, bukan isian; siswa kelas lain ditolak', async () => {
    const res = await sekretaris.put(`${KS}/sesi`, {
      kelas_id: kelasX2,
      tanggal: BARU,
      jam_ke: 1,
      items: items(siswaX1, { [siswaX1[1]!]: 'alpa' }),
    });
    expect(res.status).toBe(200);
    expect(
      await prisma.kehadiranSiswa.count({
        where: { kelas_id: kelasX1, tanggal: keDate(BARU), jam_ke: 1 },
      }),
    ).toBe(30);

    const kelasLain = await sekretaris.put(`${KS}/sesi`, {
      kelas_id: kelasX2,
      tanggal: BARU,
      jam_ke: 1,
      items: items(siswaX2.slice(0, 1)),
    });
    expect(kelasLain.status).toBe(422);
  });

  it('siswa nonaktif tidak tampil di sesi baru, tetapi tetap tampil di sesi yang sudah mencatatnya', async () => {
    const baru = await prisma.siswa.create({
      data: {
        nis: 'UJIS01',
        nama_siswa: 'Siswa Uji Nonaktif',
        jenis_kelamin: 'L',
        kelas_id: kelasX2,
      },
    });
    const id = keNumber(baru.id);
    await admin.put(`${KS}/sesi`, {
      kelas_id: kelasX2,
      tanggal: BARU,
      jam_ke: 5,
      items: items([id]),
    });
    await prisma.siswa.update({ where: { id }, data: { status: 'tidak_aktif' } });

    const lama = await admin.get(`${KS}/sesi?tanggal=${BARU}&kelas_id=${kelasX2}&jam_ke=5`);
    expect(lama.body.data.siswa.map((s: { siswa_id: number }) => s.siswa_id)).toContain(id);
    const sesiBaru = await admin.get(`${KS}/sesi?tanggal=${BARU}&kelas_id=${kelasX2}&jam_ke=6`);
    expect(sesiBaru.body.data.siswa.map((s: { siswa_id: number }) => s.siswa_id)).not.toContain(id);
    // Menyimpan siswa nonaktif ke sesi baru ditolak.
    expect(
      (
        await admin.put(`${KS}/sesi`, {
          kelas_id: kelasX2,
          tanggal: BARU,
          jam_ke: 6,
          items: items([id]),
        })
      ).status,
    ).toBe(422);
  });
});

describe('hapus', () => {
  it('sekretaris: hapus catatan kelas lain → 403, kelas sendiri → 204', async () => {
    const lain = await prisma.kehadiranSiswa.findFirst({
      where: { kelas_id: kelasX2, tanggal: keDate(BARU) },
    });
    expect((await sekretaris.delete(`${KS}/${lain!.id}`)).status).toBe(403);
    expect(await prisma.kehadiranSiswa.count({ where: { id: lain!.id } })).toBe(1);

    const sendiri = await prisma.kehadiranSiswa.findFirst({
      where: { kelas_id: kelasX1, tanggal: keDate(BARU) },
    });
    expect((await sekretaris.delete(`${KS}/${sendiri!.id}`)).status).toBe(204);
    expect((await sekretaris.delete(`${KS}/${sendiri!.id}`)).status).toBe(404);
  });

  it('hapus satu sesi: semua catatan sesi itu terhapus dan tercatat di log', async () => {
    const res = await admin.delete(`${KS}/sesi?kelas_id=${kelasX2}&tanggal=${BARU}&jam_ke=2`);
    expect(res.status).toBe(200);
    expect(res.body.data.dihapus).toBe(30);
    expect(
      (await admin.delete(`${KS}/sesi?kelas_id=${kelasX2}&tanggal=${BARU}&jam_ke=2`)).status,
    ).toBe(404);
    const log = await prisma.auditLog.findFirst({
      where: { aktivitas: 'DELETE_SESI_KEHADIRAN_SISWA' },
    });
    expect(log?.description).toContain('30 catatan');
  });
});

describe('GET /kehadiran-siswa/riwayat', () => {
  it('ringkasan per sesi; sekretaris hanya kelasnya', async () => {
    const res = await admin.get(
      `${KS}/riwayat?kelas_id=${kelasX2}&tanggal_dari=2026-11-09&tanggal_sampai=2026-11-13`,
    );
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(5);
    const s = res.body.data[0];
    expect(s).toMatchObject({ tanggal: '2026-11-13', jam_ke: 1, nama_kelas: 'X-2', total: 30 });
    expect(s.hadir + s.izin + s.sakit + s.alpa).toBe(30);

    const milik = await sekretaris.get(`${KS}/riwayat?kelas_id=${kelasX2}&pageSize=100`);
    expect(milik.body.data.every((r: { kelas_id: number }) => r.kelas_id === kelasX1)).toBe(true);

    expect(
      (await admin.get(`${KS}/riwayat?tanggal_dari=2026-11-13&tanggal_sampai=2026-11-01`)).status,
    ).toBe(400);
  });
});

describe('laporan rekap siswa', () => {
  const rentang = 'tanggal_dari=2026-11-09&tanggal_sampai=2026-11-13';

  it('ringkasan per siswa sama dengan hitungan langsung dari basis data', async () => {
    const res = await manajemen.get(`${L}?kelas_id=${kelasX1}&${rentang}&pageSize=100`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(30);

    const mentah = await prisma.kehadiranSiswa.groupBy({
      by: ['siswa_id', 'status'],
      where: {
        kelas_id: kelasX1,
        tanggal: { gte: keDate('2026-11-09'), lte: keDate('2026-11-13') },
      },
      _count: true,
    });
    for (const baris of res.body.data) {
      expect(baris.total).toBe(5);
      for (const status of ['hadir', 'izin', 'sakit', 'alpa'] as const) {
        const n =
          mentah.find((m) => keNumber(m.siswa_id) === baris.siswa_id && m.status === status)
            ?._count ?? 0;
        expect(baris[status], `${baris.nama_siswa} ${status}`).toBe(n);
      }
    }
  });

  it('filter siswa dan paginasi', async () => {
    const satu = await admin.get(`${L}?siswa_id=${siswaX2[0]}&${rentang}`);
    expect(satu.body.data).toHaveLength(1);
    expect(satu.body.data[0].siswa_id).toBe(siswaX2[0]);

    const hal2 = await admin.get(`${L}?${rentang}&page=2&pageSize=20`);
    expect(hal2.body.data).toHaveLength(20);
    expect(hal2.body.meta.page).toBe(2);
    expect((await admin.get(`${L}?tanggal_dari=2026-11-13&tanggal_sampai=2026-11-01`)).status).toBe(
      400,
    );
  });

  it('ekspor CSV: BOM, judul kolom, rumus dinetralkan, tercatat di log', async () => {
    const jahil = await prisma.siswa.create({
      data: {
        nis: 'UJIS02',
        nama_siswa: '=HYPERLINK("http://contoh.test") Contoh',
        jenis_kelamin: 'P',
        kelas_id: kelasX2,
      },
    });
    await admin.put(`${KS}/sesi`, {
      kelas_id: kelasX2,
      tanggal: SABTU,
      jam_ke: 1,
      items: items([keNumber(jahil.id)]),
    });

    const res = await admin.get(
      `${L}/export?kelas_id=${kelasX2}&tanggal_dari=${SABTU}&tanggal_sampai=${SABTU}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="laporan-siswa_X-2_2026-11-14_2026-11-14_\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const teks: string = res.text;
    expect(teks.startsWith(BOM)).toBe(true);
    const garis = teks.slice(1).split('\r\n');
    expect(garis[0]).toBe('NIS,Nama Siswa,Kelas,Hadir,Izin,Sakit,Alpa,Total Catatan');
    // 30 siswa aktif X-2 + 1 siswa uji.
    expect(garis.filter(Boolean)).toHaveLength(32);
    expect(teks).toContain('UJIS02,"\'=HYPERLINK(""http://contoh.test"") Contoh",X-2,1,0,0,0,1');
    expect(teks).not.toMatch(/,=HYPERLINK/);

    const log = await prisma.auditLog.findFirst({
      where: { aktivitas: 'EXPORT_LAPORAN_SISWA' },
      orderBy: { id: 'desc' },
    });
    expect(log).toMatchObject({ module: 'Laporan' });
    expect(log?.description).toContain('kelas X-2');
  });
});

describe('GET /referensi/siswa', () => {
  it('sekretaris hanya mendapat siswa kelasnya', async () => {
    const res = await sekretaris.get(`/api/v1/referensi/siswa?kelas_id=${kelasX2}`);
    expect(res.status).toBe(200);
    expect(res.body.data.every((s: { kelas_id: number }) => s.kelas_id === kelasX1)).toBe(true);
    const adm = await admin.get(`/api/v1/referensi/siswa?kelas_id=${kelasX2}`);
    expect(adm.body.data.every((s: { kelas_id: number }) => s.kelas_id === kelasX2)).toBe(true);
  });
});
