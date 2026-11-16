import { rm } from 'node:fs/promises';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, tutupSumberDaya } from '../../app';
import { DIR_UNGGAH } from '../../env';
import { prisma } from '../../lib/prisma';
import { BUKAN_ADMIN, Klien, masukSebagai } from '../../test/bantuan';
import { PASSWORD_UJI } from '../../test/globalSetup';

const app = createApp();
const S = '/api/v1/settings';
let admin: Klien;

beforeAll(async () => {
  admin = await masukSebagai(app, 'admin');
});

afterAll(async () => {
  // Bersihkan data buatan test (berawalan UJI) agar berkas test lain tidak terpengaruh.
  await prisma.jadwalMengajar.deleteMany({ where: { guru: { kode_guru: { startsWith: 'UJI' } } } });
  await prisma.siswa.deleteMany({ where: { nis: { startsWith: 'UJI' } } });
  await prisma.guru.deleteMany({ where: { kode_guru: { startsWith: 'UJI' } } });
  await prisma.auditLog.deleteMany({ where: { user: { email: { startsWith: 'uji.' } } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: 'uji.' } } });
  await prisma.kelas.deleteMany({ where: { nama_kelas: { startsWith: 'UJI' } } });
  await prisma.mgmp.deleteMany({ where: { nama_mapel: { startsWith: 'UJI' } } });
  await rm(DIR_UNGGAH, { recursive: true, force: true });
  await tutupSumberDaya();
});

const SUMBER = ['guru', 'kelas', 'siswa', 'jadwal', 'mgmp', 'users'] as const;

/** Semua rute Pengaturan dan Log Aktivitas (metode, path). */
const RUTE_ADMIN: [string, string][] = [
  ['get', `${S}/sekolah`],
  ['put', `${S}/sekolah`],
  ['put', `${S}/sekolah/logo`],
  ['delete', `${S}/sekolah/logo`],
  ...SUMBER.flatMap((s): [string, string][] => [
    ['get', `${S}/${s}`],
    ['post', `${S}/${s}`],
    ['put', `${S}/${s}/1`],
    ['delete', `${S}/${s}/1`],
  ]),
  ['post', `${S}/users/1/reset-password`],
  ['get', '/api/v1/audit-logs'],
  ['get', '/api/v1/audit-logs/pengguna'],
];

function panggil(klien: Klien, metode: string, path: string) {
  switch (metode) {
    case 'get':
      return klien.get(path);
    case 'post':
      return klien.post(path, {});
    case 'put':
      return klien.put(path, {});
    default:
      return klien.delete(path);
  }
}

describe('otorisasi Pengaturan dan Log Aktivitas', () => {
  it('tanpa sesi → 401 untuk semua rute', async () => {
    const tamu = new Klien(app);
    for (const [metode, path] of RUTE_ADMIN) {
      const res = await panggil(tamu, metode, path);
      expect(res.status, `${metode} ${path}`).toBe(401);
    }
  });

  it.each(BUKAN_ADMIN)('%s → 403 untuk semua rute', async (role) => {
    const klien = await masukSebagai(app, role);
    for (const [metode, path] of RUTE_ADMIN) {
      const res = await panggil(klien, metode, path);
      expect(res.status, `${role} ${metode} ${path}`).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
  });
});

describe('Pengaturan sekolah', () => {
  it('admin membaca dan mengubah pengaturan; perubahan tercatat', async () => {
    const awal = await admin.get(`${S}/sekolah`);
    expect(awal.status).toBe(200);
    expect(awal.body.data.hari_efektif).toEqual([1, 2, 3, 4, 5]);
    expect(awal.body.data.tanggal_awal_pekan).toBe('2026-10-19');

    const { id: _id, logo_url: _logo, ...isi } = awal.body.data;
    const ubah = await admin.put(`${S}/sekolah`, { ...isi, jendela_penilaian_hari: 5 });
    expect(ubah.status).toBe(200);
    expect(ubah.body.data.jendela_penilaian_hari).toBe(5);

    // Kembalikan seperti semula.
    expect((await admin.put(`${S}/sekolah`, isi)).status).toBe(200);
    const log = await prisma.auditLog.findFirst({ where: { aktivitas: 'UPDATE_SEKOLAH' } });
    expect(log?.module).toBe('Settings');
  });

  it('menolak tanggal awal pekan yang bukan Senin dan bobot yang jumlahnya bukan 100', async () => {
    const { id: _id, logo_url: _logo, ...isi } = (await admin.get(`${S}/sekolah`)).body.data;

    const bukanSenin = await admin.put(`${S}/sekolah`, {
      ...isi,
      tanggal_awal_pekan: '2026-10-20',
    });
    expect(bukanSenin.status).toBe(400);

    const bobot = await admin.put(`${S}/sekolah`, { ...isi, bobot_mgmp_kehadiran: 50 });
    expect(bobot.status).toBe(400);
    expect(JSON.stringify(bobot.body.error.details)).toContain('Jumlah bobot harus 100');

    const hari = await admin.put(`${S}/sekolah`, { ...isi, hari_efektif: [] });
    expect(hari.status).toBe(400);
  });

  it('logo: hanya gambar yang valid; bisa diunggah, disajikan, dan dihapus', async () => {
    // PNG 1×1 piksel.
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const palsu = `data:image/png;base64,${Buffer.from('<svg onload=alert(1)>').toString('base64')}`;

    expect((await admin.put(`${S}/sekolah/logo`, { data_url: palsu })).status).toBe(400);
    expect(
      (await admin.put(`${S}/sekolah/logo`, { data_url: 'data:image/svg+xml;base64,AAAA' })).status,
    ).toBe(400);

    const simpan = await admin.put(`${S}/sekolah/logo`, { data_url: png });
    expect(simpan.status).toBe(200);
    expect(simpan.body.data.logo_url).toMatch(
      /^\/api\/v1\/sekolah\/logo\?v=logo-[a-f0-9]{16}\.png$/,
    );

    const berkas = await request(app).get('/api/v1/sekolah/logo');
    expect(berkas.status).toBe(200);
    expect(berkas.headers['content-type']).toBe('image/png');

    const hapus = await admin.delete(`${S}/sekolah/logo`);
    expect(hapus.status).toBe(200);
    expect(hapus.body.data.logo_url).toBeNull();
    expect((await request(app).get('/api/v1/sekolah/logo')).status).toBe(404);
  });
});

describe('CRUD kelas, MGMP, guru, siswa', () => {
  it('daftar berhalaman dengan meta', async () => {
    const res = await admin.get(`${S}/siswa?page=2&pageSize=20`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(20);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 20, total: 180 });
    expect(typeof res.body.data[0].id).toBe('number');
  });

  it('filter dan pencarian', async () => {
    const kelas = (await admin.get(`${S}/kelas?q=XII-1`)).body.data;
    expect(kelas).toHaveLength(1);
    const siswa = await admin.get(`${S}/siswa?kelas_id=${kelas[0].id}&pageSize=100`);
    expect(siswa.body.meta.total).toBe(30);
    expect(siswa.body.data.every((s: { nama_kelas: string }) => s.nama_kelas === 'XII-1')).toBe(
      true,
    );
    const guru = await admin.get(`${S}/guru?q=Contoh 03`);
    expect(guru.body.meta.total).toBe(1);
  });

  it('query tidak valid → 400', async () => {
    expect((await admin.get(`${S}/guru?page=0`)).status).toBe(400);
    expect((await admin.get(`${S}/guru?pageSize=1000`)).status).toBe(400);
    expect((await admin.get(`${S}/guru?status=lain`)).status).toBe(400);
  });

  it('kelas: tambah, duplikat 409, ubah, hapus, 404', async () => {
    const buat = await admin.post(`${S}/kelas`, { nama_kelas: 'UJI-1' });
    expect(buat.status).toBe(201);
    const id = buat.body.data.id;

    expect((await admin.post(`${S}/kelas`, { nama_kelas: 'UJI-1' })).status).toBe(409);
    expect((await admin.post(`${S}/kelas`, { nama_kelas: '  ' })).status).toBe(400);

    const ubah = await admin.put(`${S}/kelas/${id}`, { nama_kelas: 'UJI-2' });
    expect(ubah.body.data.nama_kelas).toBe('UJI-2');

    expect((await admin.delete(`${S}/kelas/${id}`)).status).toBe(204);
    expect((await admin.delete(`${S}/kelas/${id}`)).status).toBe(404);
    expect((await admin.put(`${S}/kelas/abc`, { nama_kelas: 'UJI-3' })).status).toBe(400);

    const log = await prisma.auditLog.findMany({
      where: { entity_type: 'kelas', entity_id: String(id) },
      orderBy: { id: 'asc' },
    });
    expect(log.map((l) => l.aktivitas)).toEqual(['CREATE_KELAS', 'UPDATE_KELAS', 'DELETE_KELAS']);
  });

  it('kelas yang masih punya siswa tidak bisa dihapus → 409', async () => {
    const kelas = (await admin.get(`${S}/kelas?q=X-1`)).body.data[0];
    const res = await admin.delete(`${S}/kelas/${kelas.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('masih dipakai');
  });

  it('guru: kolom mata_pelajaran konsisten; kode dan NIP unik; teks kosong menjadi null', async () => {
    const mgmp = (await admin.get(`${S}/mgmp`)).body.data[0];
    const data = {
      kode_guru: 'UJI01',
      nip: '',
      nama_guru: 'Guru Uji Contoh',
      mata_pelajaran: 'Sejarah',
      jabatan: '',
      mgmp_id: mgmp.id,
      status: 'aktif',
    };
    const buat = await admin.post(`${S}/guru`, data);
    expect(buat.status).toBe(201);
    expect(buat.body.data).toMatchObject({
      mata_pelajaran: 'Sejarah',
      nip: null,
      jabatan: null,
      nama_mgmp: mgmp.nama_mapel,
    });
    expect(buat.body.data.nama_pelajaran).toBeUndefined();

    expect((await admin.post(`${S}/guru`, data)).status).toBe(409);
    expect(
      (await admin.post(`${S}/guru`, { ...data, kode_guru: 'UJI02', mgmp_id: 999999 })).status,
    ).toBe(400);
    expect(
      (await admin.post(`${S}/guru`, { ...data, kode_guru: 'UJI03', status: 'cuti' })).status,
    ).toBe(400);
    expect((await admin.delete(`${S}/guru/${buat.body.data.id}`)).status).toBe(204);
  });

  it('siswa: wajib kelas yang ada; NIS unik', async () => {
    const kelas = (await admin.get(`${S}/kelas?q=X-2`)).body.data[0];
    const data = {
      nis: 'UJI001',
      nama_siswa: 'Siswa Uji Contoh',
      jenis_kelamin: 'P',
      kelas_id: kelas.id,
      wali_kelas: null,
      status: 'aktif',
    };
    const buat = await admin.post(`${S}/siswa`, data);
    expect(buat.status).toBe(201);
    expect(buat.body.data.nama_kelas).toBe('X-2');
    expect((await admin.post(`${S}/siswa`, data)).status).toBe(409);
    expect(
      (await admin.post(`${S}/siswa`, { ...data, nis: 'UJI002', kelas_id: 999999 })).status,
    ).toBe(400);
    expect(
      (await admin.post(`${S}/siswa`, { ...data, nis: 'UJI003', jenis_kelamin: 'X' })).status,
    ).toBe(400);
    expect((await admin.delete(`${S}/siswa/${buat.body.data.id}`)).status).toBe(204);
  });
});

describe('jadwal mengajar', () => {
  it('unik (guru, hari, jam_ke) → 409, termasuk saat ubah', async () => {
    const kelas = (await admin.get(`${S}/kelas?pageSize=100`)).body.data;
    const guru = await admin.post(`${S}/guru`, {
      kode_guru: 'UJI10',
      nama_guru: 'Guru Jadwal Contoh',
      mata_pelajaran: 'Seni',
      mgmp_id: null,
      status: 'aktif',
    });
    const guruId = guru.body.data.id;
    const dasar = {
      guru_id: guruId,
      kelas_id: kelas[0].id,
      hari: 6,
      jam_ke: 1,
      total_jam_mengajar: 2,
    };

    const a = await admin.post(`${S}/jadwal`, dasar);
    expect(a.status).toBe(201);
    expect(a.body.data).toMatchObject({ nama_guru: 'Guru Jadwal Contoh', hari: 6 });

    // Guru yang sama, hari dan jam sama, kelas lain → tetap bentrok.
    const duplikat = await admin.post(`${S}/jadwal`, { ...dasar, kelas_id: kelas[1].id });
    expect(duplikat.status).toBe(409);

    const b = await admin.post(`${S}/jadwal`, { ...dasar, jam_ke: 3 });
    expect(b.status).toBe(201);
    expect((await admin.put(`${S}/jadwal/${b.body.data.id}`, dasar)).status).toBe(409);
    // Mengubah dirinya sendiri tanpa mengganti kunci tetap boleh.
    expect(
      (
        await admin.put(`${S}/jadwal/${b.body.data.id}`, {
          ...dasar,
          jam_ke: 3,
          total_jam_mengajar: 1,
        })
      ).status,
    ).toBe(200);

    expect((await admin.post(`${S}/jadwal`, { ...dasar, hari: 7 })).status).toBe(400);
    expect((await admin.post(`${S}/jadwal`, { ...dasar, jam_ke: 13 })).status).toBe(400);
    expect((await admin.post(`${S}/jadwal`, { ...dasar, total_jam_mengajar: 5 })).status).toBe(400);

    const daftar = await admin.get(`${S}/jadwal?guru_id=${guruId}`);
    expect(daftar.body.meta.total).toBe(2);

    // Guru yang masih punya jadwal tidak bisa dihapus.
    expect((await admin.delete(`${S}/guru/${guruId}`)).status).toBe(409);
    await admin.delete(`${S}/jadwal/${a.body.data.id}`);
    await admin.delete(`${S}/jadwal/${b.body.data.id}`);
    expect((await admin.delete(`${S}/guru/${guruId}`)).status).toBe(204);
  });
});

describe('akun', () => {
  const dasar = {
    name: 'Akun Uji Contoh',
    email: 'uji.akun@contoh.test',
    password: 'kata-sandi-awal-1',
    role: 'guru_penilai',
    kelas_id: null,
    is_active: true,
  };

  it('daftar akun tidak pernah memuat kata sandi', async () => {
    const res = await admin.get(`${S}/users`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('argon2');
    expect(res.body.data[0].password).toBeUndefined();
  });

  it('sekretaris_kelas wajib punya kelas_id', async () => {
    const res = await admin.post(`${S}/users`, {
      ...dasar,
      email: 'uji.sekretaris@contoh.test',
      role: 'sekretaris_kelas',
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body.error.details)).toContain('wajib terikat ke satu kelas');
  });

  it('tambah, email unik, ubah, reset kata sandi, hapus', async () => {
    const kelas = (await admin.get(`${S}/kelas?q=XI-1`)).body.data[0];

    const buat = await admin.post(`${S}/users`, dasar);
    expect(buat.status).toBe(201);
    expect(buat.body.data.password).toBeUndefined();
    const id = buat.body.data.id;
    expect((await admin.post(`${S}/users`, dasar)).status).toBe(409);
    expect(
      (await admin.post(`${S}/users`, { ...dasar, email: 'uji.b@contoh.test', password: '123' }))
        .status,
    ).toBe(400);

    // Peran selain sekretaris tidak menyimpan kelas walau dikirim.
    const { password: _p, ...tanpaSandi } = dasar;
    const ubah = await admin.put(`${S}/users/${id}`, { ...tanpaSandi, kelas_id: kelas.id });
    expect(ubah.body.data.kelas_id).toBeNull();

    const jadiSekretaris = await admin.put(`${S}/users/${id}`, {
      ...tanpaSandi,
      role: 'sekretaris_kelas',
      kelas_id: kelas.id,
    });
    expect(jadiSekretaris.body.data).toMatchObject({
      role: 'sekretaris_kelas',
      nama_kelas: 'XI-1',
    });

    // Pengguna masuk di dua perangkat, lalu admin mereset kata sandinya: semua sesinya berakhir.
    const pengguna = new Klien(app);
    const pengguna2 = new Klien(app);
    expect((await pengguna.masuk(dasar.email, dasar.password)).status).toBe(200);
    expect((await pengguna2.masuk(dasar.email, dasar.password)).status).toBe(200);
    const reset = await admin.post(`${S}/users/${id}/reset-password`, {
      password_baru: 'kata-sandi-reset-2',
    });
    expect(reset.status).toBe(204);
    expect((await pengguna.get('/api/v1/auth/me')).status).toBe(401);
    expect((await pengguna2.get('/api/v1/auth/me')).status).toBe(401);
    expect((await admin.get('/api/v1/auth/me')).status).toBe(200);
    expect((await new Klien(app).masuk(dasar.email, dasar.password)).status).toBe(401);
    expect((await new Klien(app).masuk(dasar.email, 'kata-sandi-reset-2')).status).toBe(200);

    const log = await prisma.auditLog.findFirst({ where: { aktivitas: 'RESET_PASSWORD' } });
    expect(log?.description).not.toContain('kata-sandi-reset-2');

    // Akun yang sudah punya riwayat aktivitas tidak dihapus, hanya dinonaktifkan.
    const hapus = await admin.delete(`${S}/users/${id}`);
    expect(hapus.status).toBe(409);
    expect(hapus.body.error.message).toContain('Nonaktifkan');
  });

  it('admin mereset kata sandinya sendiri: sesi yang dipakai tetap, sesi lain berakhir', async () => {
    const email = 'admin.kedua@contoh.test';
    const buat = await admin.post(`${S}/users`, {
      ...dasar,
      name: 'Admin Kedua Contoh',
      email,
      role: 'admin',
      kelas_id: null,
    });
    expect(buat.status).toBe(201);
    const idAdmin2 = buat.body.data.id;

    const dipakai = new Klien(app);
    const lain = new Klien(app);
    expect((await dipakai.masuk(email, dasar.password)).status).toBe(200);
    expect((await lain.masuk(email, dasar.password)).status).toBe(200);

    const reset = await dipakai.post(`${S}/users/${idAdmin2}/reset-password`, {
      password_baru: 'kata-sandi-reset-3',
    });
    expect(reset.status).toBe(204);
    expect((await dipakai.get('/api/v1/auth/me')).status).toBe(200);
    expect((await lain.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('akun tanpa riwayat bisa dihapus', async () => {
    const buat = await admin.post(`${S}/users`, { ...dasar, email: 'uji.hapus@contoh.test' });
    expect((await admin.delete(`${S}/users/${buat.body.data.id}`)).status).toBe(204);
  });

  it('admin tidak bisa mengunci dirinya sendiri', async () => {
    const saya = (await admin.get('/api/v1/auth/me')).body.data.user;
    const isi = { name: saya.name, email: saya.email, kelas_id: null };
    expect(
      (await admin.put(`${S}/users/${saya.id}`, { ...isi, role: 'admin', is_active: false }))
        .status,
    ).toBe(422);
    expect(
      (await admin.put(`${S}/users/${saya.id}`, { ...isi, role: 'guru_penilai', is_active: true }))
        .status,
    ).toBe(422);
    expect((await admin.delete(`${S}/users/${saya.id}`)).status).toBe(422);
    expect((await new Klien(app).masuk(saya.email, PASSWORD_UJI)).status).toBe(200);
  });
});

describe('log aktivitas', () => {
  it('admin melihat log terbaru dengan filter modul, pengguna, dan tanggal', async () => {
    const semua = await admin.get('/api/v1/audit-logs');
    expect(semua.status).toBe(200);
    expect(semua.body.meta.total).toBeGreaterThan(0);
    expect(semua.body.data.length).toBeLessThanOrEqual(20);
    expect(semua.body.data[0]).toHaveProperty('nama_pengguna');
    expect(semua.body.data[0].user_agent).toBeUndefined();

    const settings = await admin.get('/api/v1/audit-logs?module=Settings&pageSize=100');
    expect(settings.body.data.every((l: { module: string }) => l.module === 'Settings')).toBe(true);

    const saya = (await admin.get('/api/v1/auth/me')).body.data.user;
    const milikSaya = await admin.get(`/api/v1/audit-logs?user_id=${saya.id}&pageSize=100`);
    expect(milikSaya.body.data.every((l: { user_id: number }) => l.user_id === saya.id)).toBe(true);

    const lampau = await admin.get('/api/v1/audit-logs?tanggal_sampai=2020-01-01');
    expect(lampau.body.meta.total).toBe(0);

    expect((await admin.get('/api/v1/audit-logs?module=Lain')).status).toBe(400);
    expect((await admin.get('/api/v1/audit-logs?tanggal_dari=01-01-2026')).status).toBe(400);
  });

  it('tidak ada rute untuk mengubah atau menghapus log', async () => {
    expect((await admin.delete('/api/v1/audit-logs/1')).status).toBe(404);
    expect((await admin.put('/api/v1/audit-logs/1', {})).status).toBe(404);
  });
});

describe('referensi (pilihan dropdown)', () => {
  it('tanpa sesi → 401', async () => {
    for (const r of ['kelas', 'guru', 'mgmp']) {
      expect((await request(app).get(`/api/v1/referensi/${r}`)).status).toBe(401);
    }
  });

  it('sekretaris hanya melihat kelasnya sendiri; peran lain melihat semua', async () => {
    const sekretaris = await masukSebagai(app, 'sekretaris_kelas');
    const milik = await sekretaris.get('/api/v1/referensi/kelas');
    expect(milik.body.data).toEqual([expect.objectContaining({ nama_kelas: 'X-1' })]);

    const penilai = await masukSebagai(app, 'guru_penilai');
    expect((await penilai.get('/api/v1/referensi/kelas')).body.data.length).toBeGreaterThanOrEqual(
      6,
    );
    const guru = (await penilai.get('/api/v1/referensi/guru')).body.data;
    expect(guru.length).toBeGreaterThanOrEqual(12);
    expect(Object.keys(guru[0]).sort()).toEqual(['id', 'kode_guru', 'mata_pelajaran', 'nama_guru']);
    expect((await penilai.get('/api/v1/referensi/mgmp')).body.data).toHaveLength(3);
  });
});
