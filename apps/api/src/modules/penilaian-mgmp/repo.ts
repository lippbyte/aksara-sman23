import type { Periode, RekapPekanRingkas } from '@sms/shared';
import { Prisma } from '../../generated/prisma/client';
import { keAngka, keNumber } from '../../lib/konversi';
import { prisma, type Db } from '../../lib/prisma';
import { rekapPerGuru } from '../penilaian-kinerja/repo';

/** Rekap per guru aktif, dikelompokkan per MGMP (dua query: guru aktif + rekap). */
export async function rekapPerMgmp(
  db: Db,
  p: Periode,
  mgmpIds?: readonly number[],
): Promise<Map<number, RekapPekanRingkas[][]>> {
  const guru = await db.guru.findMany({
    where: {
      status: 'aktif',
      mgmp_id: mgmpIds ? { in: [...mgmpIds] } : { not: null },
    },
    select: { id: true, mgmp_id: true },
  });
  const rekap = await rekapPerGuru(
    db,
    guru.map((g) => keNumber(g.id)),
    p,
  );
  const peta = new Map<number, RekapPekanRingkas[][]>();
  for (const g of guru) {
    if (g.mgmp_id === null) continue;
    const id = keNumber(g.mgmp_id);
    const daftar = peta.get(id) ?? [];
    daftar.push(rekap.get(keNumber(g.id)) ?? []);
    peta.set(id, daftar);
  }
  return peta;
}

export async function semuaMgmp(db: Db): Promise<number[]> {
  const rows = await db.mgmp.findMany({ select: { id: true } });
  return rows.map((r) => keNumber(r.id));
}

export async function penilaianPeriode(db: Db, p: Periode) {
  const rows = await db.penilaianMgmp.findMany({ where: { bulan: p.bulan, tahun: p.tahun } });
  return new Map(
    rows.map((r) => [
      keNumber(r.mgmp_id),
      {
        id: keNumber(r.id),
        skor_siswa: keAngka(r.skor_siswa),
        skor_administrasi: keAngka(r.skor_administrasi),
        catatan: r.catatan,
      },
    ]),
  );
}

export async function upsertSinkron(
  db: Db,
  p: Periode,
  baris: readonly { mgmp_id: number; skor_kehadiran: number; skor_akhir: number }[],
): Promise<void> {
  if (baris.length === 0) return;
  const nilai = baris.map(
    (b) =>
      Prisma.sql`(${b.mgmp_id}, ${p.bulan}, ${p.tahun}, ${b.skor_kehadiran}, 0, 0, ${b.skor_akhir}, NOW(3), NOW(3))`,
  );
  await db.$executeRaw`
    INSERT INTO penilaian_mgmp
      (mgmp_id, bulan, tahun, skor_kehadiran, skor_siswa, skor_administrasi,
       skor_akhir, created_at, updated_at)
    VALUES ${Prisma.join(nilai)}
    ON DUPLICATE KEY UPDATE
      skor_kehadiran = VALUES(skor_kehadiran),
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
      _count: { select: { guru: { where: { status: 'aktif' } } } },
    },
    orderBy: { nama_mapel: 'asc' },
  });
}

export async function ambilMgmp(db: Db, id: number) {
  return db.mgmp.findUnique({ where: { id } });
}

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
    dinilai_oleh: number;
  },
) {
  const { mgmp_id, bulan, tahun, ...isi } = data;
  return db.penilaianMgmp.upsert({
    where: { mgmp_id_bulan_tahun: { mgmp_id, bulan, tahun } },
    create: data,
    update: isi,
  });
}
