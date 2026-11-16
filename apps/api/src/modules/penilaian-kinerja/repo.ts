import { rentangBulan, type Periode, type RekapPekanRingkas } from '@sms/shared';
import { Prisma } from '../../generated/prisma/client';
import { keAngka, keDate, keNumber, keTanggalISO } from '../../lib/konversi';
import { prisma, type Db } from '../../lib/prisma';

/**
 * Rekap pekan yang beririsan dengan bulan, dikelompokkan per guru (satu query).
 * Pemilihan pekan yang beririsan tetap dilakukan fungsi domain; query hanya mempersempit.
 */
export async function rekapPerGuru(
  db: Db,
  guruIds: readonly number[],
  p: Periode,
): Promise<Map<number, RekapPekanRingkas[]>> {
  const { awal, akhir } = rentangBulan(p.bulan, p.tahun);
  const rows = await db.rekapKehadiranGuru.findMany({
    where: {
      guru_id: { in: [...guruIds] },
      tanggal_mulai: { lte: keDate(akhir) },
      tanggal_selesai: { gte: keDate(awal) },
    },
    select: {
      guru_id: true,
      tanggal_mulai: true,
      tanggal_selesai: true,
      persentase_kehadiran: true,
    },
  });
  const peta = new Map<number, RekapPekanRingkas[]>();
  for (const r of rows) {
    const id = keNumber(r.guru_id);
    const daftar = peta.get(id) ?? [];
    daftar.push({
      tanggal_mulai: keTanggalISO(r.tanggal_mulai),
      tanggal_selesai: keTanggalISO(r.tanggal_selesai),
      persentase_kehadiran: keAngka(r.persentase_kehadiran),
    });
    peta.set(id, daftar);
  }
  return peta;
}

export async function guruAktif(db: Db): Promise<number[]> {
  const rows = await db.guru.findMany({ where: { status: 'aktif' }, select: { id: true } });
  return rows.map((r) => keNumber(r.id));
}

export async function penilaianPeriode(db: Db, guruIds: readonly number[], p: Periode) {
  const rows = await db.penilaianKinerjaBulanan.findMany({
    where: { guru_id: { in: [...guruIds] }, bulan: p.bulan, tahun: p.tahun },
  });
  return new Map(
    rows.map((r) => [
      keNumber(r.guru_id),
      {
        skor_administrasi_avg: keAngka(r.skor_administrasi_avg),
        skor_manajemen_avg: keAngka(r.skor_manajemen_avg),
      },
    ]),
  );
}

/** Upsert massal hasil sinkron dalam satu pernyataan. Isian penilai tidak disentuh. */
export async function upsertSinkron(
  db: Db,
  p: Periode,
  baris: readonly { guru_id: number; skor_kehadiran: number; skor_akhir: number }[],
): Promise<void> {
  if (baris.length === 0) return;
  const nilai = baris.map(
    (b) =>
      Prisma.sql`(${b.guru_id}, ${p.bulan}, ${p.tahun}, ${b.skor_kehadiran}, 0, NULL, ${b.skor_akhir}, NOW(3), NOW(3))`,
  );
  await db.$executeRaw`
    INSERT INTO penilaian_kinerja_bulanan
      (guru_id, bulan, tahun, skor_kehadiran, skor_administrasi_avg, skor_manajemen_avg,
       skor_akhir, created_at, updated_at)
    VALUES ${Prisma.join(nilai)}
    ON DUPLICATE KEY UPDATE
      skor_kehadiran = VALUES(skor_kehadiran),
      skor_akhir = VALUES(skor_akhir),
      updated_at = VALUES(updated_at)`;
}

const includeGuru = (p: Periode) =>
  ({
    penilaian: {
      where: { bulan: p.bulan, tahun: p.tahun },
      include: { penilai: { select: { name: true } } },
    },
  }) as const;

/** Guru aktif, ditambah guru nonaktif yang sudah punya penilaian pada periode itu. */
export async function daftar(
  p: Periode & { q?: string },
  halaman?: { page: number; pageSize: number },
) {
  const where = {
    OR: [{ status: 'aktif' as const }, { penilaian: { some: { bulan: p.bulan, tahun: p.tahun } } }],
    ...(p.q
      ? { AND: [{ OR: [{ nama_guru: { contains: p.q } }, { kode_guru: { contains: p.q } }] }] }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.guru.findMany({
      where,
      include: includeGuru(p),
      orderBy: [{ nama_guru: 'asc' }, { id: 'asc' }],
      ...(halaman ? { skip: (halaman.page - 1) * halaman.pageSize, take: halaman.pageSize } : {}),
    }),
    prisma.guru.count({ where }),
  ]);
  return { rows, total };
}

export async function ambilGuru(db: Db, id: number) {
  return db.guru.findUnique({ where: { id } });
}

export async function simpan(
  db: Db,
  data: {
    guru_id: number;
    bulan: number;
    tahun: number;
    skor_kehadiran: number;
    skor_administrasi_avg: number;
    skor_manajemen_avg: number | null;
    skor_akhir: number;
    catatan: string | null;
    dinilai_oleh: number;
  },
) {
  const { guru_id, bulan, tahun, ...isi } = data;
  return db.penilaianKinerjaBulanan.upsert({
    where: { guru_id_bulan_tahun: { guru_id, bulan, tahun } },
    create: data,
    update: isi,
  });
}
