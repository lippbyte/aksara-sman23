import {
  STATUS_SISWA,
  type BarisAbsenSiswa,
  type HitunganSiswa,
  type RiwayatSesiSiswa,
  type RiwayatSiswaQuery,
  type StatusSiswa,
  type TanggalISO,
} from '@sms/shared';
import { Prisma } from '../../generated/prisma/client';
import { keDate, keNumber, keTanggalISO } from '../../lib/konversi';
import { prisma, type Db } from '../../lib/prisma';

export function hitunganKosong(): HitunganSiswa {
  return { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
}

export async function ambilKelas(db: Db, kelasId: number) {
  const k = await db.kelas.findUnique({ where: { id: kelasId } });
  return k ? { id: keNumber(k.id), nama_kelas: k.nama_kelas } : null;
}

/**
 * Siswa satu sesi: semua siswa aktif kelas itu, ditambah siswa yang sudah punya catatan
 * pada sesi itu (mis. kemudian dinonaktifkan). Tanpa catatan → default `hadir` (§6.2).
 */
export async function daftarSesi(
  kelasId: number,
  tanggal: TanggalISO,
  jamKe: number,
): Promise<{ siswa: BarisAbsenSiswa[]; sudahDiisi: boolean }> {
  const catatan = await prisma.kehadiranSiswa.findMany({
    where: { kelas_id: kelasId, tanggal: keDate(tanggal), jam_ke: jamKe },
  });
  const peta = new Map(catatan.map((c) => [keNumber(c.siswa_id), c]));

  const siswa = await prisma.siswa.findMany({
    where: {
      OR: [{ kelas_id: kelasId, status: 'aktif' }, { id: { in: catatan.map((c) => c.siswa_id) } }],
    },
    orderBy: { nama_siswa: 'asc' },
  });

  return {
    sudahDiisi: catatan.length > 0,
    siswa: siswa.map((s) => {
      const c = peta.get(keNumber(s.id));
      return {
        siswa_id: keNumber(s.id),
        nis: s.nis,
        nama_siswa: s.nama_siswa,
        jenis_kelamin: s.jenis_kelamin,
        id: c ? keNumber(c.id) : null,
        status: c?.status ?? 'hadir',
        keterangan: c?.keterangan ?? null,
      };
    }),
  };
}

/** Siswa yang boleh dicatat di sesi ini: anggota kelas dan (aktif atau sudah punya catatan). */
export async function siswaSah(
  db: Db,
  kelasId: number,
  tanggal: TanggalISO,
  jamKe: number,
  siswaIds: readonly number[],
): Promise<Set<number>> {
  const rows = await db.siswa.findMany({
    where: {
      id: { in: [...siswaIds] },
      kelas_id: kelasId,
      OR: [
        { status: 'aktif' },
        { kehadiran: { some: { tanggal: keDate(tanggal), jam_ke: jamKe } } },
      ],
    },
    select: { id: true },
  });
  return new Set(rows.map((r) => keNumber(r.id)));
}

export interface ItemSimpan {
  siswa_id: number;
  status: StatusSiswa;
  keterangan: string | null;
}

/**
 * Upsert massal dalam satu pernyataan: unik (siswa_id, tanggal, jam_ke).
 * `created_by` hanya diisi saat baris baru; pembaruan tidak mengubah pembuat.
 */
export async function upsertSesi(
  db: Db,
  kelasId: number,
  tanggal: TanggalISO,
  jamKe: number,
  items: readonly ItemSimpan[],
  createdBy: number,
): Promise<void> {
  const nilai = items.map(
    (i) =>
      Prisma.sql`(${i.siswa_id}, ${kelasId}, ${tanggal}, ${jamKe}, ${i.status}, ${i.keterangan}, ${createdBy}, NOW(3), NOW(3))`,
  );
  await db.$executeRaw`
    INSERT INTO kehadiran_siswa
      (siswa_id, kelas_id, tanggal, jam_ke, status, keterangan, created_by, created_at, updated_at)
    VALUES ${Prisma.join(nilai)}
    ON DUPLICATE KEY UPDATE
      kelas_id = VALUES(kelas_id),
      status = VALUES(status),
      keterangan = VALUES(keterangan),
      updated_at = VALUES(updated_at)`;
}

export async function ambilCatatan(db: Db, id: number) {
  const c = await db.kehadiranSiswa.findUnique({
    where: { id },
    include: { siswa: { select: { nama_siswa: true } }, kelas: { select: { nama_kelas: true } } },
  });
  return c
    ? {
        id: keNumber(c.id),
        kelas_id: keNumber(c.kelas_id),
        nama_kelas: c.kelas.nama_kelas,
        nama_siswa: c.siswa.nama_siswa,
        tanggal: keTanggalISO(c.tanggal),
        jam_ke: c.jam_ke,
        status: c.status,
      }
    : null;
}

export async function hapusCatatan(db: Db, id: number): Promise<void> {
  await db.kehadiranSiswa.delete({ where: { id } });
}

export async function hapusSesi(
  db: Db,
  kelasId: number,
  tanggal: TanggalISO,
  jamKe: number,
): Promise<number> {
  const hasil = await db.kehadiranSiswa.deleteMany({
    where: { kelas_id: kelasId, tanggal: keDate(tanggal), jam_ke: jamKe },
  });
  return hasil.count;
}

/** Riwayat per sesi (tanggal + jam ke + kelas) dengan hitungan per status: satu query agregat. */
export async function riwayat(
  q: RiwayatSiswaQuery,
  kelasScope: number | null,
): Promise<{ rows: RiwayatSesiSiswa[]; total: number }> {
  const kelasId = kelasScope ?? q.kelas_id;
  const syarat: Prisma.Sql[] = [Prisma.sql`1 = 1`];
  if (kelasId !== undefined) syarat.push(Prisma.sql`ks.kelas_id = ${kelasId}`);
  if (q.tanggal_dari) syarat.push(Prisma.sql`ks.tanggal >= ${q.tanggal_dari}`);
  if (q.tanggal_sampai) syarat.push(Prisma.sql`ks.tanggal <= ${q.tanggal_sampai}`);
  const where = Prisma.join(syarat, ' AND ');

  const [rows, jumlah] = await Promise.all([
    prisma.$queryRaw<
      {
        tanggal: Date;
        jam_ke: number;
        kelas_id: bigint;
        nama_kelas: string;
        hadir: bigint | number;
        izin: bigint | number;
        sakit: bigint | number;
        alpa: bigint | number;
        total: bigint | number;
      }[]
    >`
      SELECT ks.tanggal, ks.jam_ke, ks.kelas_id, k.nama_kelas,
        SUM(ks.status = 'hadir') AS hadir,
        SUM(ks.status = 'izin') AS izin,
        SUM(ks.status = 'sakit') AS sakit,
        SUM(ks.status = 'alpa') AS alpa,
        COUNT(*) AS total
      FROM kehadiran_siswa ks
      JOIN kelas k ON k.id = ks.kelas_id
      WHERE ${where}
      GROUP BY ks.tanggal, ks.jam_ke, ks.kelas_id, k.nama_kelas
      ORDER BY ks.tanggal DESC, k.nama_kelas ASC, ks.jam_ke ASC
      LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    prisma.$queryRaw<{ n: bigint | number }[]>`
      SELECT COUNT(*) AS n FROM (
        SELECT 1 FROM kehadiran_siswa ks WHERE ${where}
        GROUP BY ks.tanggal, ks.jam_ke, ks.kelas_id
      ) AS sesi`,
  ]);

  return {
    total: Number(jumlah[0]?.n ?? 0),
    rows: rows.map((r) => ({
      tanggal: keTanggalISO(r.tanggal),
      jam_ke: Number(r.jam_ke),
      kelas_id: keNumber(r.kelas_id),
      nama_kelas: r.nama_kelas,
      hadir: Number(r.hadir),
      izin: Number(r.izin),
      sakit: Number(r.sakit),
      alpa: Number(r.alpa),
      total: Number(r.total),
    })),
  };
}

export const URUTAN_STATUS_SISWA = STATUS_SISWA;
