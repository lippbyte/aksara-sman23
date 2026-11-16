import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, tutupSumberDaya } from '../../app';
import { keAngka, keNumber } from '../../lib/konversi';
import { prisma } from '../../lib/prisma';
import { Klien, masukSebagai } from '../../test/bantuan';

const app = createApp();
const K = '/api/v1/kehadiran';

// Data uji: pekan 2 = 26–30 Okt 2026, pekan 3 = 2–6 Nov 2026 (awal pekan 2026-10-19).
const SENIN_P2 = '2026-10-26';
const RABU_P2 = '2026-10-28';
const SENIN_P3 = '2026-11-02';

let admin: Klien;
let sekretaris: Klien;
let penilai: Klien;
let guruA: number; // jadwal: Senin 2 JP + Rabu 2 JP (+ Sabtu 4 JP yang tidak dihitung)
let guruB: number;
let kelasX1: number; // kelas sekretaris
let kelasX2: number;

async function rekap(guruId: number, mingguKe: number) {
  const r = await prisma.rekapKehadiranGuru.findFirst({
    where: { guru_id: guruId, minggu_ke: mingguKe },
  });
  return r
    ? {
        wajib: r.total_jam_wajib,
        hadir: r.total_jam_hadir,
        persen: keAngka(r.persentase_kehadiran),
        tahun: r.tahun,
      }
    : null;
}

function isi(ubah: Record<string, unknown> = {}) {
  return {
    tanggal: SENIN_P2,
    guru_id: guruA,
    kelas_id: kelasX2,
    jam_ke: 1,
    lama_jam: 2,
    status_kehadiran: 'Hadir',
    status_tugas: 'Ada',
    keterangan: '',
    ...ubah,
  };
}

beforeAll(async () => {
  admin = await masukSebagai(app, 'admin');
  sekretaris = await masukSebagai(app, 'sekretaris_kelas');
  penilai = await masukSebagai(app, 'guru_penilai');

  const kelas = await prisma.kelas.findMany({ where: { nama_kelas: { in: ['X-1', 'X-2'] } } });
  kelasX1 = keNumber(kelas.find((k) => k.nama_kelas === 'X-1')!.id);
  kelasX2 = keNumber(kelas.find((k) => k.nama_kelas === 'X-2')!.id);

  const a = await prisma.guru.create({
    data: { kode_guru: 'UJIK1', nama_guru: 'Guru Uji Kehadiran A', mata_pelajaran: 'Uji' },
  });
  const b = await prisma.guru.create({
    data: { kode_guru: 'UJIK2', nama_guru: 'Guru Uji Kehadiran B', mata_pelajaran: 'Uji' },
  });
  guruA = keNumber(a.id);
  guruB = keNumber(b.id);
  await prisma.jadwalMengajar.createMany({
    data: [
      { guru_id: guruA, kelas_id: kelasX2, hari: 1, jam_ke: 1, total_jam_mengajar: 2 },
      { guru_id: guruA, kelas_id: kelasX2, hari: 3, jam_ke: 3, total_jam_mengajar: 2 },
      // Sabtu bukan hari efektif: tidak boleh masuk jam wajib.
      { guru_id: guruA, kelas_id: kelasX2, hari: 6, jam_ke: 1, total_jam_mengajar: 4 },
    ],
  });
});

afterAll(async () => {
  const guru = { kode_guru: { startsWith: 'UJIK' } };
  await prisma.kehadiran.deleteMany({ where: { guru } });
  await prisma.rekapKehadiranGuru.deleteMany({ where: { guru } });
  await prisma.jadwalMengajar.deleteMany({ where: { guru } });
  await prisma.guru.deleteMany({ where: guru });
  await tutupSumberDaya();
});

describe('otorisasi /kehadiran', () => {
  it('tanpa sesi → 401', async () => {
    const tamu = new Klien(app);
    expect((await tamu.get(K)).status).toBe(401);
    expect((await tamu.get(`${K}/jadwal?tanggal=${SENIN_P2}`)).status).toBe(401);
    expect((await tamu.post(K, isi())).status).toBe(401);
    expect((await tamu.put(`${K}/1`, isi())).status).toBe(401);
    expect((await tamu.delete(`${K}/1`)).status).toBe(401);
    expect((await request(app).get('/api/v1/dashboard/kelas/1')).status).toBe(401);
  });
});

describe('POST /kehadiran', () => {
  it('validasi → 400', async () => {
    expect((await admin.post(K, isi({ jam_ke: 13 }))).status).toBe(400);
    expect((await admin.post(K, isi({ jam_ke: -1 }))).status).toBe(400);
    expect((await admin.post(K, isi({ lama_jam: 5 }))).status).toBe(400);
    expect((await admin.post(K, isi({ lama_jam: 0 }))).status).toBe(400);
    expect((await admin.post(K, isi({ status_kehadiran: 'Izin' }))).status).toBe(400);
    expect((await admin.post(K, isi({ status_tugas: 'Mungkin' }))).status).toBe(400);
    expect((await admin.post(K, isi({ tanggal: '2026-02-30' }))).status).toBe(400);
    expect((await admin.post(K, isi({ guru_id: 99999999 }))).status).toBe(400);
    // Selain sekretaris, kelas wajib dipilih.
    const tanpaKelas = await admin.post(K, isi({ kelas_id: null }));
    expect(tanpaKelas.status).toBe(400);
    expect(tanpaKelas.body.error.message).toBe('Kelas wajib dipilih.');
  });

  it('menyimpan catatan, created_by dari sesi, log tercatat, rekap pekan ikut berubah', async () => {
    expect(await rekap(guruA, 2)).toBeNull();

    const res = await admin.post(K, isi({ created_by: 999 }));
    expect(res.status).toBe(201);
    const saya = (await admin.get('/api/v1/auth/me')).body.data.user;
    expect(res.body.data).toMatchObject({
      tanggal: SENIN_P2,
      nama_guru: 'Guru Uji Kehadiran A',
      nama_kelas: 'X-2',
      status_kehadiran: 'Hadir',
      keterangan: null,
      created_by: saya.id,
    });

    // Jam wajib 4 (Senin 2 + Rabu 2; Sabtu 4 JP tidak dihitung), hadir 2 → 50%.
    expect(await rekap(guruA, 2)).toEqual({ wajib: 4, hadir: 2, persen: 50, tahun: 2026 });

    const log = await prisma.auditLog.findFirst({
      where: { aktivitas: 'CREATE_KEHADIRAN', entity_id: String(res.body.data.id) },
    });
    expect(log).toMatchObject({ module: 'Piket', user_id: BigInt(saya.id) });
  });

  it('jam bentrok di batas rentang (catatan lama: jam ke-1–2)', async () => {
    // Tepat setelahnya: jam ke-3 → boleh.
    const setelah = await admin.post(
      K,
      isi({ jam_ke: 3, lama_jam: 1, status_kehadiran: 'Tidak Hadir' }),
    );
    expect(setelah.status).toBe(201);

    // Menyentuh jam terakhir (jam ke-2) → bentrok.
    const sentuhAkhir = await admin.post(K, isi({ jam_ke: 2, lama_jam: 1 }));
    expect(sentuhAkhir.status).toBe(409);
    expect(sentuhAkhir.body.error.code).toBe('CONFLICT');
    expect(sentuhAkhir.body.error.message).toContain('jam ke-1–2');

    // Jam ke-0 selama 2 JP (0–1) menyentuh jam pertama → bentrok.
    expect((await admin.post(K, isi({ jam_ke: 0, lama_jam: 2 }))).status).toBe(409);
    // Jam ke-0 selama 1 JP berakhir tepat sebelumnya → boleh.
    expect((await admin.post(K, isi({ jam_ke: 0, lama_jam: 1 }))).status).toBe(201);

    // Guru yang sama di kelas lain pada jam yang sama tetap bentrok.
    expect((await admin.post(K, isi({ kelas_id: kelasX1 }))).status).toBe(409);
    // Guru lain pada kelas dan jam yang sama tidak bentrok.
    expect((await admin.post(K, isi({ guru_id: guruB }))).status).toBe(201);
    // Tanggal lain tidak bentrok.
    expect((await admin.post(K, isi({ tanggal: RABU_P2, jam_ke: 3 }))).status).toBe(201);

    // Hadir 2 (Senin 1–2) + 1 (jam 0) + 2 (Rabu) = 5 dari 4 → dibatasi 100%.
    expect(await rekap(guruA, 2)).toMatchObject({ wajib: 4, hadir: 5, persen: 100 });
  });

  it('dua permintaan bersamaan untuk jam yang sama: hanya satu yang tersimpan', async () => {
    const data = isi({ tanggal: SENIN_P3, guru_id: guruB, jam_ke: 5, lama_jam: 2 });
    const [a, b] = await Promise.all([admin.post(K, data), penilai.post(K, data)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const jumlah = await prisma.kehadiran.count({
      where: { guru_id: guruB, tanggal: new Date(`${SENIN_P3}T00:00:00Z`), jam_ke: 5 },
    });
    expect(jumlah).toBe(1);
  });
});

describe('PUT /kehadiran/:id', () => {
  it('mengubah dirinya sendiri tidak dianggap bentrok; status mengubah jam hadir', async () => {
    const daftar = await admin.get(`${K}?guru_id=${guruA}&tanggal=${SENIN_P2}`);
    const catatan = daftar.body.data.find((k: { jam_ke: number }) => k.jam_ke === 1);

    const sama = await admin.put(`${K}/${catatan.id}`, isi({ keterangan: 'Catatan diperbarui' }));
    expect(sama.status).toBe(200);
    expect(sama.body.data.keterangan).toBe('Catatan diperbarui');

    const sebelum = await rekap(guruA, 2);
    const tidakHadir = await admin.put(
      `${K}/${catatan.id}`,
      isi({ status_kehadiran: 'Tidak Hadir', status_tugas: 'Tidak Ada' }),
    );
    expect(tidakHadir.status).toBe(200);
    expect((await rekap(guruA, 2))?.hadir).toBe((sebelum?.hadir ?? 0) - 2);

    // Mendampingi dihitung sebagai jam hadir.
    await admin.put(`${K}/${catatan.id}`, isi({ status_kehadiran: 'Mendampingi' }));
    expect((await rekap(guruA, 2))?.hadir).toBe(sebelum?.hadir);
  });

  it('memindahkan tanggal ke pekan lain menghitung ulang pekan lama DAN pekan baru', async () => {
    const daftar = await admin.get(`${K}?guru_id=${guruA}&tanggal=${RABU_P2}`);
    const catatan = daftar.body.data[0];
    const p2Sebelum = await rekap(guruA, 2);
    expect(await rekap(guruA, 3)).toBeNull();

    const pindah = await admin.put(`${K}/${catatan.id}`, isi({ tanggal: SENIN_P3, jam_ke: 3 }));
    expect(pindah.status).toBe(200);

    expect((await rekap(guruA, 2))?.hadir).toBe((p2Sebelum?.hadir ?? 0) - 2);
    expect(await rekap(guruA, 3)).toMatchObject({ wajib: 4, hadir: 2, persen: 50 });
  });

  it('mengganti guru menghitung ulang rekap guru lama dan guru baru', async () => {
    const daftar = await admin.get(`${K}?guru_id=${guruA}&tanggal=${SENIN_P3}`);
    const catatan = daftar.body.data[0];
    const bSebelum = (await rekap(guruB, 3))?.hadir ?? 0;

    const ganti = await admin.put(
      `${K}/${catatan.id}`,
      isi({ tanggal: SENIN_P3, jam_ke: 3, guru_id: guruB }),
    );
    expect(ganti.status).toBe(200);
    expect((await rekap(guruA, 3))?.hadir).toBe(0);
    expect((await rekap(guruB, 3))?.hadir).toBe(bSebelum + 2);
  });

  it('ubah yang menimbulkan bentrok → 409; ID tidak ada → 404', async () => {
    const daftar = await admin.get(`${K}?guru_id=${guruA}&tanggal=${SENIN_P2}`);
    const jam3 = daftar.body.data.find((k: { jam_ke: number }) => k.jam_ke === 3);
    expect((await admin.put(`${K}/${jam3.id}`, isi({ jam_ke: 2, lama_jam: 2 }))).status).toBe(409);
    expect((await admin.put(`${K}/99999999`, isi())).status).toBe(404);
  });
});

describe('pembatasan kelas untuk sekretaris_kelas', () => {
  let milikKelasLain: number;
  let milikSendiri: number;

  it('kelas selalu dari akun, bukan dari isian form', async () => {
    const res = await sekretaris.post(
      K,
      isi({ tanggal: RABU_P2, guru_id: guruB, kelas_id: kelasX2, jam_ke: 7, lama_jam: 1 }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data.kelas_id).toBe(kelasX1);
    expect(res.body.data.nama_kelas).toBe('X-1');
    milikSendiri = res.body.data.id;

    // Tanpa kelas_id pun tetap tersimpan di kelasnya.
    const tanpa = await sekretaris.post(
      K,
      isi({ tanggal: RABU_P2, guru_id: guruB, kelas_id: null, jam_ke: 8, lama_jam: 1 }),
    );
    expect(tanpa.status).toBe(201);
    expect(tanpa.body.data.kelas_id).toBe(kelasX1);
  });

  it('daftar hanya berisi kelasnya walau meminta kelas lain', async () => {
    const res = await sekretaris.get(`${K}?kelas_id=${kelasX2}&pageSize=100`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((k: { kelas_id: number }) => k.kelas_id === kelasX1)).toBe(true);
  });

  it('lihat, ubah, dan hapus catatan kelas lain berdasarkan ID → 403', async () => {
    const lain = await admin.get(`${K}?kelas_id=${kelasX2}&guru_id=${guruA}`);
    milikKelasLain = lain.body.data[0].id;

    expect((await sekretaris.get(`${K}/${milikKelasLain}`)).status).toBe(403);
    const ubah = await sekretaris.put(
      `${K}/${milikKelasLain}`,
      isi({ keterangan: 'diubah sekretaris' }),
    );
    expect(ubah.status).toBe(403);
    expect(ubah.body.error.code).toBe('FORBIDDEN');
    expect((await sekretaris.delete(`${K}/${milikKelasLain}`)).status).toBe(403);

    const utuh = await prisma.kehadiran.findUnique({ where: { id: milikKelasLain } });
    expect(utuh).not.toBeNull();
    expect(utuh?.keterangan).not.toBe('diubah sekretaris');
  });

  it('sekretaris boleh mengubah dan menghapus catatan kelasnya sendiri', async () => {
    const ubah = await sekretaris.put(
      `${K}/${milikSendiri}`,
      isi({
        tanggal: RABU_P2,
        guru_id: guruB,
        jam_ke: 7,
        lama_jam: 1,
        status_kehadiran: 'Mendampingi',
      }),
    );
    expect(ubah.status).toBe(200);
    expect(ubah.body.data.kelas_id).toBe(kelasX1);
    expect((await sekretaris.delete(`${K}/${milikSendiri}`)).status).toBe(204);
  });

  it('jadwal: sekretaris selalu mendapat jadwal kelasnya', async () => {
    const res = await sekretaris.get(`${K}/jadwal?tanggal=2026-11-13&kelas_id=${kelasX2}`);
    expect(res.status).toBe(200);
    // Seed: X-1 punya 4 slot per hari dan semuanya sudah dicatat pada 13 Nov.
    expect(res.body.data).toHaveLength(4);
    expect(res.body.data.every((j: { sudah_dicatat: boolean }) => j.sudah_dicatat)).toBe(true);
  });
});

describe('DELETE /kehadiran/:id', () => {
  it('guru_penilai boleh menambah dan mengubah, tetapi tidak boleh menghapus → 403', async () => {
    const buat = await penilai.post(
      K,
      isi({ tanggal: SENIN_P3, guru_id: guruA, jam_ke: 9, lama_jam: 1 }),
    );
    expect(buat.status).toBe(201);
    const id = buat.body.data.id;
    expect(
      (
        await penilai.put(
          `${K}/${id}`,
          isi({ tanggal: SENIN_P3, jam_ke: 9, lama_jam: 1, keterangan: 'ok' }),
        )
      ).status,
    ).toBe(200);

    const hapus = await penilai.delete(`${K}/${id}`);
    expect(hapus.status).toBe(403);
    expect(await prisma.kehadiran.count({ where: { id } })).toBe(1);
  });

  it('manajemen_guru menghapus; rekap dihitung ulang; log tercatat', async () => {
    const manajemen = await masukSebagai(app, 'manajemen_guru');
    const daftar = await admin.get(`${K}?guru_id=${guruA}&tanggal=${SENIN_P3}`);
    const catatan = daftar.body.data.find((k: { jam_ke: number }) => k.jam_ke === 9);
    const sebelum = (await rekap(guruA, 3))?.hadir ?? 0;

    expect((await manajemen.delete(`${K}/${catatan.id}`)).status).toBe(204);
    expect((await rekap(guruA, 3))?.hadir).toBe(sebelum - 1);
    expect((await manajemen.delete(`${K}/${catatan.id}`)).status).toBe(404);

    const log = await prisma.auditLog.findMany({
      where: { entity_type: 'kehadiran', entity_id: String(catatan.id) },
      orderBy: { id: 'asc' },
    });
    expect(log.map((l) => l.aktivitas)).toEqual([
      'CREATE_KEHADIRAN',
      'UPDATE_KEHADIRAN',
      'DELETE_KEHADIRAN',
    ]);
  });
});

describe('GET /kehadiran', () => {
  it('filter tanggal, kelas, guru, status dan paginasi 20', async () => {
    const semua = await admin.get(`${K}?tanggal=2026-11-13`);
    expect(semua.status).toBe(200);
    // Seed: 6 kelas × 4 slot per hari.
    expect(semua.body.meta).toEqual({ page: 1, pageSize: 20, total: 24 });
    expect(semua.body.data).toHaveLength(20);

    const kelas = await admin.get(`${K}?tanggal=2026-11-13&kelas_id=${kelasX1}`);
    expect(kelas.body.meta.total).toBe(4);

    const status = await admin.get(
      `${K}?tanggal_dari=2026-11-09&tanggal_sampai=2026-11-13&status=Tidak Hadir&pageSize=100`,
    );
    expect(
      status.body.data.every(
        (k: { status_kehadiran: string }) => k.status_kehadiran === 'Tidak Hadir',
      ),
    ).toBe(true);

    expect((await admin.get(`${K}?status=Bolos`)).status).toBe(400);
    expect((await admin.get(`${K}?tanggal=13-11-2026`)).status).toBe(400);
  });
});

describe('GET /dashboard/kelas/:id', () => {
  it('sekretaris: kelas sendiri 200, kelas lain 403; guru_penilai 403', async () => {
    const sendiri = await sekretaris.get(`/api/v1/dashboard/kelas/${kelasX1}?tanggal=2026-11-13`);
    expect(sendiri.status).toBe(200);
    expect(sendiri.body.data.kelas.nama_kelas).toBe('X-1');
    expect(sendiri.body.data.jurnal).toHaveLength(4);
    const h = sendiri.body.data.hitungan;
    expect(h.Hadir + h.Mendampingi + h['Tidak Hadir']).toBe(4);
    const j = sendiri.body.data.jam;
    expect(j.Hadir + j.Mendampingi + j['Tidak Hadir']).toBe(8);

    expect((await sekretaris.get(`/api/v1/dashboard/kelas/${kelasX2}`)).status).toBe(403);
    expect((await penilai.get(`/api/v1/dashboard/kelas/${kelasX1}`)).status).toBe(403);
  });

  it('admin: filter guru dan status hanya menyaring jurnal, hitungan tetap utuh', async () => {
    const semua = await admin.get(`/api/v1/dashboard/kelas/${kelasX1}?tanggal=2026-11-13`);
    const guruId = semua.body.data.jurnal[0].guru_id;
    const saring = await admin.get(
      `/api/v1/dashboard/kelas/${kelasX1}?tanggal=2026-11-13&guru_id=${guruId}`,
    );
    expect(saring.body.data.jurnal.length).toBeLessThan(4);
    expect(saring.body.data.jurnal.every((k: { guru_id: number }) => k.guru_id === guruId)).toBe(
      true,
    );
    expect(saring.body.data.hitungan).toEqual(semua.body.data.hitungan);

    expect((await admin.get('/api/v1/dashboard/kelas/99999999')).status).toBe(404);
  });
});
