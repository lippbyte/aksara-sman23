import type { LaporanSiswaBaris, LaporanSiswaFilter } from '@sms/shared';
import { Prisma } from '../../generated/prisma/client';
import { keNumber } from '../../lib/konversi';
import { prisma } from '../../lib/prisma';

/**
 * Siswa yang masuk laporan: sesuai filter kelas/siswa, dan (aktif ATAU punya catatan
 * dalam rentang). Hitungan per status dihitung dengan satu query agregat.
 */
function syaratSiswa(f: LaporanSiswaFilter): Prisma.Sql {
  const syarat: Prisma.Sql[] = [];
  if (f.kelas_id !== undefined) syarat.push(Prisma.sql`s.kelas_id = ${f.kelas_id}`);
  if (f.siswa_id !== undefined) syarat.push(Prisma.sql`s.id = ${f.siswa_id}`);
  syarat.push(Prisma.sql`(s.status = 'aktif' OR agg.total > 0)`);
  return Prisma.join(syarat, ' AND ');
}

function syaratTanggal(f: LaporanSiswaFilter): Prisma.Sql {
  const syarat: Prisma.Sql[] = [Prisma.sql`1 = 1`];
  if (f.tanggal_dari) syarat.push(Prisma.sql`ks.tanggal >= ${f.tanggal_dari}`);
  if (f.tanggal_sampai) syarat.push(Prisma.sql`ks.tanggal <= ${f.tanggal_sampai}`);
  return Prisma.join(syarat, ' AND ');
}

interface BarisMentah {
  siswa_id: bigint;
  nis: string;
  nama_siswa: string;
  nama_kelas: string;
  hadir: bigint | number | null;
  izin: bigint | number | null;
  sakit: bigint | number | null;
  alpa: bigint | number | null;
  total: bigint | number | null;
}

export async function laporanSiswa(
  f: LaporanSiswaFilter,
  halaman?: { page: number; pageSize: number },
): Promise<{ rows: LaporanSiswaBaris[]; total: number }> {
  const agregat = Prisma.sql`
    LEFT JOIN (
      SELECT ks.siswa_id,
        SUM(ks.status = 'hadir') AS hadir,
        SUM(ks.status = 'izin') AS izin,
        SUM(ks.status = 'sakit') AS sakit,
        SUM(ks.status = 'alpa') AS alpa,
        COUNT(*) AS total
      FROM kehadiran_siswa ks
      WHERE ${syaratTanggal(f)}
      GROUP BY ks.siswa_id
    ) agg ON agg.siswa_id = s.id`;
  const where = syaratSiswa(f);
  const batas = halaman
    ? Prisma.sql`LIMIT ${halaman.pageSize} OFFSET ${(halaman.page - 1) * halaman.pageSize}`
    : Prisma.empty;

  const [rows, jumlah] = await Promise.all([
    prisma.$queryRaw<BarisMentah[]>`
      SELECT s.id AS siswa_id, s.nis, s.nama_siswa, k.nama_kelas,
        agg.hadir, agg.izin, agg.sakit, agg.alpa, agg.total
      FROM siswa s
      JOIN kelas k ON k.id = s.kelas_id
      ${agregat}
      WHERE ${where}
      ORDER BY k.nama_kelas ASC, s.nama_siswa ASC, s.id ASC
      ${batas}`,
    prisma.$queryRaw<{ n: bigint | number }[]>`
      SELECT COUNT(*) AS n FROM siswa s ${agregat} WHERE ${where}`,
  ]);

  return {
    total: Number(jumlah[0]?.n ?? 0),
    rows: rows.map((r) => ({
      siswa_id: keNumber(r.siswa_id),
      nis: r.nis,
      nama_siswa: r.nama_siswa,
      nama_kelas: r.nama_kelas,
      hadir: Number(r.hadir ?? 0),
      izin: Number(r.izin ?? 0),
      sakit: Number(r.sakit ?? 0),
      alpa: Number(r.alpa ?? 0),
      total: Number(r.total ?? 0),
    })),
  };
}

export async function namaKelas(kelasId: number): Promise<string | null> {
  const k = await prisma.kelas.findUnique({ where: { id: kelasId }, select: { nama_kelas: true } });
  return k?.nama_kelas ?? null;
}
