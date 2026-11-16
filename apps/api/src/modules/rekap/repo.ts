import type { Rekap, RekapFilter } from '@sms/shared';
import { keAngka, keDate, keNumber, keTanggalISO } from '../../lib/konversi';
import { prisma, type Db } from '../../lib/prisma';

const include = {
  guru: { select: { kode_guru: true, nama_guru: true, mata_pelajaran: true } },
} as const;

type Baris = Awaited<
  ReturnType<typeof prisma.rekapKehadiranGuru.findFirstOrThrow<{ include: typeof include }>>
>;

function keRekap(r: Baris): Rekap {
  return {
    id: keNumber(r.id),
    guru_id: keNumber(r.guru_id),
    kode_guru: r.guru.kode_guru,
    nama_guru: r.guru.nama_guru,
    mata_pelajaran: r.guru.mata_pelajaran,
    tahun: r.tahun,
    minggu_ke: r.minggu_ke,
    tanggal_mulai: keTanggalISO(r.tanggal_mulai),
    tanggal_selesai: keTanggalISO(r.tanggal_selesai),
    total_jam_wajib: r.total_jam_wajib,
    total_jam_hadir: r.total_jam_hadir,
    persentase_kehadiran: keAngka(r.persentase_kehadiran),
    updated_at: r.updated_at.toISOString(),
  };
}

function susunWhere(f: RekapFilter) {
  return {
    ...(f.minggu_ke !== undefined && f.tahun !== undefined
      ? { minggu_ke: f.minggu_ke, tahun: f.tahun }
      : {}),
    ...(f.guru_id !== undefined ? { guru_id: f.guru_id } : {}),
    ...(f.mapel || f.kelas_id !== undefined
      ? {
          guru: {
            ...(f.mapel ? { mata_pelajaran: f.mapel } : {}),
            ...(f.kelas_id !== undefined ? { jadwal: { some: { kelas_id: f.kelas_id } } } : {}),
          },
        }
      : {}),
    // Pekan yang beririsan dengan rentang tanggal.
    ...(f.tanggal_sampai ? { tanggal_mulai: { lte: keDate(f.tanggal_sampai) } } : {}),
    ...(f.tanggal_dari ? { tanggal_selesai: { gte: keDate(f.tanggal_dari) } } : {}),
  };
}

const urutan = [
  { tahun: 'desc' as const },
  { minggu_ke: 'desc' as const },
  { guru: { nama_guru: 'asc' as const } },
  { id: 'asc' as const },
];

export async function daftar(f: RekapFilter, halaman?: { page: number; pageSize: number }) {
  const where = susunWhere(f);
  const [rows, total] = await Promise.all([
    prisma.rekapKehadiranGuru.findMany({
      where,
      include,
      orderBy: urutan,
      ...(halaman ? { skip: (halaman.page - 1) * halaman.pageSize, take: halaman.pageSize } : {}),
    }),
    prisma.rekapKehadiranGuru.count({ where }),
  ]);
  return { rows: rows.map(keRekap), total };
}

export async function ambil(db: Db, id: number): Promise<Rekap | null> {
  const r = await db.rekapKehadiranGuru.findUnique({ where: { id }, include });
  return r ? keRekap(r) : null;
}

export async function ubah(
  db: Db,
  id: number,
  data: { total_jam_wajib: number; total_jam_hadir: number; persentase_kehadiran: number },
): Promise<Rekap> {
  return keRekap(await db.rekapKehadiranGuru.update({ where: { id }, data, include }));
}

export async function hapus(db: Db, id: number): Promise<void> {
  await db.rekapKehadiranGuru.delete({ where: { id } });
}

/** Pekan yang sudah punya rekap, dengan jumlah barisnya. */
export async function pekanTersimpan() {
  const rows = await prisma.rekapKehadiranGuru.groupBy({
    by: ['tahun', 'minggu_ke', 'tanggal_mulai', 'tanggal_selesai'],
    _count: { _all: true },
  });
  return rows.map((r) => ({
    tahun: r.tahun,
    minggu_ke: r.minggu_ke,
    tanggal_mulai: keTanggalISO(r.tanggal_mulai),
    tanggal_selesai: keTanggalISO(r.tanggal_selesai),
    jumlah: r._count._all,
  }));
}

export async function guruAktif(db: Db): Promise<number[]> {
  const rows = await db.guru.findMany({ where: { status: 'aktif' }, select: { id: true } });
  return rows.map((r) => keNumber(r.id));
}

export async function daftarMapel(): Promise<string[]> {
  const rows = await prisma.guru.findMany({
    distinct: ['mata_pelajaran'],
    select: { mata_pelajaran: true },
    orderBy: { mata_pelajaran: 'asc' },
  });
  return rows.map((r) => r.mata_pelajaran);
}
