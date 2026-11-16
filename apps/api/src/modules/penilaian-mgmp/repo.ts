import type { KehadiranGuruMgmp, Periode } from '@sms/shared';
import { Prisma } from '../../generated/prisma/client';
import { keAngka, keNumber } from '../../lib/konversi';
import { prisma, type Db } from '../../lib/prisma';
import { rekapPerGuru } from '../penilaian-kinerja/repo';

/**
 * Data kehadiran guru aktif per MGMP untuk `skorKehadiranMgmp` (tiga query: guru aktif,
 * jam wajib jadwal per guru pada hari efektif, rekap pekan yang beririsan dengan bulan).
 */
export async function kehadiranPerMgmp(
  db: Db,
  p: Periode,
  hariEfektif: readonly number[],
  mgmpIds?: readonly number[],
): Promise<Map<number, KehadiranGuruMgmp[]>> {
  const guru = await db.guru.findMany({
    where: {
      status: 'aktif',
      mgmp_id: mgmpIds ? { in: [...mgmpIds] } : { not: null },
    },
    select: { id: true, mgmp_id: true },
  });
  const ids = guru.map((g) => keNumber(g.id));
  const [rekap, jadwal] = await Promise.all([
    rekapPerGuru(db, ids, p),
    db.jadwalMengajar.groupBy({
      by: ['guru_id'],
      where: { guru_id: { in: ids }, hari: { in: [...hariEfektif] } },
      _sum: { total_jam_mengajar: true },
    }),
  ]);
  const jamWajib = new Map(
    jadwal.map((j) => [keNumber(j.guru_id), j._sum.total_jam_mengajar ?? 0]),
  );

  const peta = new Map<number, KehadiranGuruMgmp[]>();
  for (const g of guru) {
    if (g.mgmp_id === null) continue;
    const id = keNumber(g.mgmp_id);
    const daftar = peta.get(id) ?? [];
    daftar.push({
      jam_wajib_jadwal: jamWajib.get(keNumber(g.id)) ?? 0,
      rekap: rekap.get(keNumber(g.id)) ?? [],
    });
    peta.set(id, daftar);
  }
  return peta;
}

/** Skor siswa per kelas yang sudah diisi, dikelompokkan per MGMP. */
export async function skorSiswaPerMgmp(
  db: Db,
  p: Periode,
  mgmpIds?: readonly number[],
): Promise<Map<number, number[]>> {
  const rows = await db.penilaianMgmpSiswa.findMany({
    where: {
      bulan: p.bulan,
      tahun: p.tahun,
      ...(mgmpIds ? { mgmp_id: { in: [...mgmpIds] } } : {}),
    },
    select: { mgmp_id: true, skor: true },
  });
  const peta = new Map<number, number[]>();
  for (const r of rows) {
    const id = keNumber(r.mgmp_id);
    peta.set(id, [...(peta.get(id) ?? []), keAngka(r.skor)]);
  }
  return peta;
}

/** Skor siswa yang diisi satu kelas untuk semua MGMP pada periode itu. */
export async function skorKelas(p: Periode, kelasId: number): Promise<Map<number, number>> {
  const rows = await prisma.penilaianMgmpSiswa.findMany({
    where: { bulan: p.bulan, tahun: p.tahun, kelas_id: kelasId },
    select: { mgmp_id: true, skor: true },
  });
  return new Map(rows.map((r) => [keNumber(r.mgmp_id), keAngka(r.skor)]));
}

export async function jumlahKelas(db: Db = prisma): Promise<number> {
  return db.kelas.count();
}

/** Rincian skor siswa satu MGMP: semua kelas (atau satu kelas), terisi maupun belum. */
export async function rincianSkorSiswa(p: Periode & { mgmp_id: number }, kelasId: number | null) {
  return prisma.kelas.findMany({
    where: kelasId === null ? {} : { id: kelasId },
    select: {
      id: true,
      nama_kelas: true,
      penilaian_mgmp_siswa: {
        where: { mgmp_id: p.mgmp_id, bulan: p.bulan, tahun: p.tahun },
        include: { pengisi: { select: { name: true } } },
      },
    },
    orderBy: { nama_kelas: 'asc' },
  });
}

/**
 * Mengunci baris MGMP (`SELECT … FOR UPDATE`) agar pengisian skor siswa beberapa kelas
 * yang bersamaan tidak saling menimpa rata-rata. Dipanggil PERTAMA di dalam transaksi.
 */
export async function kunciMgmp(db: Db, mgmpIds?: readonly number[]): Promise<number[]> {
  const rows = mgmpIds
    ? mgmpIds.length === 0
      ? []
      : await db.$queryRaw<{ id: bigint }[]>`
          SELECT id FROM mgmp WHERE id IN (${Prisma.join([...mgmpIds])}) ORDER BY id FOR UPDATE`
    : await db.$queryRaw<{ id: bigint }[]>`SELECT id FROM mgmp ORDER BY id FOR UPDATE`;
  return rows.map((r) => keNumber(r.id));
}

export async function penilaianPeriode(db: Db, p: Periode) {
  const rows = await db.penilaianMgmp.findMany({ where: { bulan: p.bulan, tahun: p.tahun } });
  return new Map(
    rows.map((r) => [
      keNumber(r.mgmp_id),
      {
        id: keNumber(r.id),
        skor_administrasi: keAngka(r.skor_administrasi),
        catatan: r.catatan,
      },
    ]),
  );
}

export async function upsertSinkron(
  db: Db,
  p: Periode,
  baris: readonly {
    mgmp_id: number;
    skor_kehadiran: number;
    skor_siswa: number;
    skor_akhir: number;
  }[],
): Promise<void> {
  if (baris.length === 0) return;
  const nilai = baris.map(
    (b) =>
      Prisma.sql`(${b.mgmp_id}, ${p.bulan}, ${p.tahun}, ${b.skor_kehadiran}, ${b.skor_siswa}, 0, ${b.skor_akhir}, NOW(3), NOW(3))`,
  );
  await db.$executeRaw`
    INSERT INTO penilaian_mgmp
      (mgmp_id, bulan, tahun, skor_kehadiran, skor_siswa, skor_administrasi,
       skor_akhir, created_at, updated_at)
    VALUES ${Prisma.join(nilai)}
    ON DUPLICATE KEY UPDATE
      skor_kehadiran = VALUES(skor_kehadiran),
      skor_siswa = VALUES(skor_siswa),
      skor_akhir = VALUES(skor_akhir),
      updated_at = VALUES(updated_at)`;
}

export async function daftar(p: Periode) {
  return prisma.mgmp.findMany({
    include: {
      penilaian: {
        where: { bulan: p.bulan, tahun: p.tahun },
        include: { penilai: { select: { name: true } } },
      },
      _count: {
        select: {
          guru: { where: { status: 'aktif' } },
          penilaian_siswa: { where: { bulan: p.bulan, tahun: p.tahun } },
        },
      },
    },
    orderBy: { nama_mapel: 'asc' },
  });
}

export async function ambilMgmp(db: Db, id: number) {
  return db.mgmp.findUnique({ where: { id } });
}

export async function ambilKelas(db: Db, id: number) {
  return db.kelas.findUnique({ where: { id } });
}

/** Simpan isian penilai. `dinilai_oleh` tidak diubah bila undefined. */
export async function simpan(
  db: Db,
  data: {
    mgmp_id: number;
    bulan: number;
    tahun: number;
    skor_kehadiran: number;
    skor_siswa: number;
    skor_administrasi: number;
    skor_akhir: number;
    catatan: string | null;
    dinilai_oleh?: number;
  },
) {
  const { mgmp_id, bulan, tahun, ...isi } = data;
  return db.penilaianMgmp.upsert({
    where: { mgmp_id_bulan_tahun: { mgmp_id, bulan, tahun } },
    create: data,
    update: isi,
  });
}

export async function simpanSkorSiswa(
  db: Db,
  data: {
    mgmp_id: number;
    kelas_id: number;
    bulan: number;
    tahun: number;
    skor: number;
    diisi_oleh: number;
  },
) {
  const { mgmp_id, kelas_id, bulan, tahun, ...isi } = data;
  return db.penilaianMgmpSiswa.upsert({
    where: { mgmp_id_kelas_id_bulan_tahun: { mgmp_id, kelas_id, bulan, tahun } },
    create: data,
    update: isi,
  });
}
