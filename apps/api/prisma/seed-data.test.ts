import { hitungMingguKe, persentaseKehadiran, ROLES, STATUS_DIHITUNG_HADIR } from '@sms/shared';
import argon2 from 'argon2';
import { afterAll, describe, expect, it } from 'vitest';
import { keAngka, keTanggalISO, statusKehadiranDariDb } from '../src/lib/konversi';
import { prisma } from '../src/lib/prisma';
import { HARI_INI_UJI, PASSWORD_UJI } from '../src/test/globalSetup';
import { AKUN_CONTOH } from './seed-data';

afterAll(() => prisma.$disconnect());

describe('seed data fiktif', () => {
  it('jumlah data sesuai Fase 1', async () => {
    expect(await prisma.sekolahSettings.count()).toBe(1);
    expect(await prisma.mgmp.count()).toBe(3);
    expect(await prisma.guru.count({ where: { kode_guru: { startsWith: 'G' } } })).toBe(12);
    expect(await prisma.kelas.count()).toBe(6);
    expect(await prisma.siswa.count()).toBe(180);
    const perKelas = await prisma.siswa.groupBy({ by: ['kelas_id'], _count: true });
    expect(perKelas.every((k) => k._count === 30)).toBe(true);
  });

  it('satu akun per peran; sekretaris terikat ke satu kelas; kata sandi di-hash', async () => {
    // Berkas test lain boleh menambah akun; yang diperiksa hanya akun contoh dari seeder.
    const users = await prisma.user.findMany({
      where: { email: { in: AKUN_CONTOH.map((a) => a.email) } },
    });
    expect(users.map((u) => u.role).sort()).toEqual([...ROLES].sort());
    for (const u of users) {
      expect(u.password.startsWith('$argon2id$')).toBe(true);
      expect(u.kelas_id !== null).toBe(u.role === 'sekretaris_kelas');
    }
    const admin = users.find((u) => u.role === 'admin');
    expect(await argon2.verify(admin?.password ?? '', PASSWORD_UJI)).toBe(true);
  });

  it('semua nama dan email jelas fiktif', async () => {
    const guru = await prisma.guru.findMany();
    const siswa = await prisma.siswa.findMany();
    const settings = await prisma.sekolahSettings.findFirstOrThrow();
    expect(guru.every((g) => g.nama_guru.includes('Contoh'))).toBe(true);
    expect(siswa.every((s) => s.nama_siswa.includes('Contoh') && s.nis.startsWith('99'))).toBe(
      true,
    );
    expect(settings.nama_sekolah).toContain('Contoh');
    expect(AKUN_CONTOH.every((a) => a.email.endsWith('@contoh.test'))).toBe(true);
  });

  it('jadwal: tidak ada guru di dua kelas pada jam yang sama, hanya hari efektif', async () => {
    const jadwal = await prisma.jadwalMengajar.findMany({
      where: { guru: { kode_guru: { startsWith: 'G' } } },
    });
    const kunci = new Set(jadwal.map((j) => `${j.guru_id}-${j.hari}-${j.jam_ke}`));
    expect(kunci.size).toBe(jadwal.length);
    expect(jadwal.every((j) => j.hari >= 1 && j.hari <= 5)).toBe(true);
  });

  it('kehadiran mencakup 4 pekan sampai hari ini dan tidak ada jam bentrok', async () => {
    const settings = await prisma.sekolahSettings.findFirstOrThrow();
    const awal = keTanggalISO(settings.tanggal_awal_pekan);
    expect(awal).toBe('2026-10-19');
    expect(hitungMingguKe(HARI_INI_UJI, awal)).toBe(4);

    const kehadiran = await prisma.kehadiran.findMany({
      where: { guru: { kode_guru: { startsWith: 'G' } } },
    });
    const tanggal = kehadiran.map((k) => keTanggalISO(k.tanggal)).sort();
    expect(tanggal[0]).toBe(awal);
    expect(tanggal.at(-1)).toBe(HARI_INI_UJI);

    const terisi = new Set<string>();
    for (const k of kehadiran) {
      for (let j = k.jam_ke; j < k.jam_ke + k.lama_jam; j++) {
        const kunci = `${k.guru_id}-${keTanggalISO(k.tanggal)}-${j}`;
        expect(terisi.has(kunci)).toBe(false);
        terisi.add(kunci);
      }
    }
  });

  it('rekap pekan sama dengan hitungan fungsi domain dari data mentah', async () => {
    const seeder = { guru: { kode_guru: { startsWith: 'G' } } };
    const rekap = await prisma.rekapKehadiranGuru.findMany({ where: seeder });
    expect(rekap).toHaveLength(12 * 4);
    const kehadiran = await prisma.kehadiran.findMany({ where: seeder });
    const jadwal = await prisma.jadwalMengajar.findMany({ where: seeder });

    for (const r of rekap) {
      const mulai = keTanggalISO(r.tanggal_mulai);
      const selesai = keTanggalISO(r.tanggal_selesai);
      const wajib = jadwal
        .filter((j) => j.guru_id === r.guru_id)
        .reduce((s, j) => s + j.total_jam_mengajar, 0);
      const hadir = kehadiran
        .filter((k) => {
          const t = keTanggalISO(k.tanggal);
          return (
            k.guru_id === r.guru_id &&
            t >= mulai &&
            t <= selesai &&
            STATUS_DIHITUNG_HADIR.includes(statusKehadiranDariDb(k.status_kehadiran))
          );
        })
        .reduce((s, k) => s + k.lama_jam, 0);
      expect(r.total_jam_wajib).toBe(wajib);
      expect(r.total_jam_hadir).toBe(hadir);
      expect(keAngka(r.persentase_kehadiran)).toBe(persentaseKehadiran(hadir, wajib));
      expect(hitungMingguKe(mulai, '2026-10-19')).toBe(r.minggu_ke);
    }
  });
});
