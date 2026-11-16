import { berubahSejakKoreksi, type Rekap, type RekapFilter } from '@sms/shared';
import { keAngka, keDate, keNumber, keTanggalISO } from '../../lib/konversi';
import { prisma, type Db } from '../../lib/prisma';

const include = {
  guru: { select: { kode_guru: true, nama_guru: true, mata_pelajaran: true } },
  pengoreksi: { select: { name: true } },
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
    dikoreksi_manual: r.dikoreksi_manual,
    alasan_koreksi: r.alasan_koreksi,
    nama_pengoreksi: r.pengoreksi?.name ?? null,
    dikoreksi_pada: r.dikoreksi_pada ? r.dikoreksi_pada.toISOString() : null,
    berubah_sejak_koreksi: false,
    updated_at: r.updated_at.toISOString(),
  };
}

/**
 * Menandai baris terkoreksi yang catatan kehadiran gurunya pada pekan itu dibuat/diubah
 * setelah dikoreksi (satu query untuk semua baris; perbandingan oleh fungsi domain).
 * Rekap TIDAK dihitung ulang.
 */
async function tandaiPerubahan(db: Db, rows: Rekap[]): Promise<Rekap[]> {
  const terkoreksi = rows.filter((r) => r.dikoreksi_manual && r.dikoreksi_pada !== null);
  if (terkoreksi.length === 0) return rows;
  const awal = terkoreksi.reduce(
    (m, r) => (r.tanggal_mulai < m ? r.tanggal_mulai : m),
    '9999-12-31',
  );
  const akhir = terkoreksi.reduce((m, r) => (r.tanggal_selesai > m ? r.tanggal_selesai : m), '');
  const sejak = terkoreksi.reduce(
    (m, r) => (r.dikoreksi_pada !== null && r.dikoreksi_pada < m ? r.dikoreksi_pada : m),
    '9999-12-31T00:00:00.000Z',
  );
  const kehadiran = await db.kehadiran.findMany({
    where: {
      guru_id: { in: [...new Set(terkoreksi.map((r) => r.guru_id))] },
      tanggal: { gte: keDate(awal), lte: keDate(akhir) },
      updated_at: { gt: new Date(sejak) },
    },
    select: { guru_id: true, tanggal: true, updated_at: true },
  });
  const perGuru = new Map<number, { tanggal: string; updated_at: string }[]>();
  for (const k of kehadiran) {
    const id = keNumber(k.guru_id);
    perGuru.set(id, [
      ...(perGuru.get(id) ?? []),
      { tanggal: keTanggalISO(k.tanggal), updated_at: k.updated_at.toISOString() },
    ]);
  }
  return rows.map((r) =>
    r.dikoreksi_manual
      ? { ...r, berubah_sejak_koreksi: berubahSejakKoreksi(r, perGuru.get(r.guru_id) ?? []) }
      : r,
  );
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
  return { rows: await tandaiPerubahan(prisma, rows.map(keRekap)), total };
}

export async function ambil(db: Db, id: number): Promise<Rekap | null> {
  const r = await db.rekapKehadiranGuru.findUnique({ where: { id }, include });
  return r ? ((await tandaiPerubahan(db, [keRekap(r)]))[0] ?? null) : null;
}

export async function ubah(
  db: Db,
  id: number,
  data: {
    total_jam_wajib: number;
    total_jam_hadir: number;
    persentase_kehadiran: number;
    dikoreksi_manual: boolean;
    alasan_koreksi: string;
    dikoreksi_oleh: number;
    dikoreksi_pada: Date;
  },
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
