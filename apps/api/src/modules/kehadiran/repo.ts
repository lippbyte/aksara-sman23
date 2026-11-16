import type {
  JadwalHari,
  Kehadiran,
  KehadiranQuery,
  StatusKehadiran,
  StatusTugas,
  TanggalISO,
} from '@sms/shared';
import {
  keDate,
  keNumber,
  keTanggalISO,
  statusKehadiranDariDb,
  statusKehadiranKeDb,
  statusTugasDariDb,
  statusTugasKeDb,
} from '../../lib/konversi';
import { prisma, type Db } from '../../lib/prisma';

const include = {
  guru: { select: { kode_guru: true, nama_guru: true, mata_pelajaran: true } },
  kelas: { select: { nama_kelas: true } },
  pembuat: { select: { name: true } },
} as const;

type Baris = Awaited<
  ReturnType<typeof prisma.kehadiran.findFirstOrThrow<{ include: typeof include }>>
>;

function keKehadiran(k: Baris): Kehadiran {
  return {
    id: keNumber(k.id),
    tanggal: keTanggalISO(k.tanggal),
    guru_id: keNumber(k.guru_id),
    kode_guru: k.guru.kode_guru,
    nama_guru: k.guru.nama_guru,
    mata_pelajaran: k.guru.mata_pelajaran,
    kelas_id: keNumber(k.kelas_id),
    nama_kelas: k.kelas.nama_kelas,
    jam_ke: k.jam_ke,
    lama_jam: k.lama_jam,
    status_kehadiran: statusKehadiranDariDb(k.status_kehadiran),
    status_tugas: statusTugasDariDb(k.status_tugas),
    keterangan: k.keterangan,
    created_by: keNumber(k.created_by),
    nama_pembuat: k.pembuat.name,
    created_at: k.created_at.toISOString(),
  };
}

export interface FilterKehadiran {
  tanggal?: TanggalISO;
  tanggal_dari?: TanggalISO;
  tanggal_sampai?: TanggalISO;
  kelas_id?: number;
  guru_id?: number;
  status?: StatusKehadiran;
}

/**
 * `kelasScope` (sekretaris_kelas) selalu menang atas filter `kelas_id` dari pengguna,
 * sehingga sekretaris tidak bisa membaca kelas lain.
 */
function susunWhere(f: FilterKehadiran, kelasScope: number | null) {
  const kelasId = kelasScope ?? f.kelas_id;
  const rentang =
    f.tanggal !== undefined
      ? { equals: keDate(f.tanggal) }
      : f.tanggal_dari !== undefined || f.tanggal_sampai !== undefined
        ? {
            ...(f.tanggal_dari ? { gte: keDate(f.tanggal_dari) } : {}),
            ...(f.tanggal_sampai ? { lte: keDate(f.tanggal_sampai) } : {}),
          }
        : undefined;
  return {
    ...(rentang ? { tanggal: rentang } : {}),
    ...(kelasId !== undefined ? { kelas_id: kelasId } : {}),
    ...(f.guru_id !== undefined ? { guru_id: f.guru_id } : {}),
    ...(f.status ? { status_kehadiran: statusKehadiranKeDb(f.status) } : {}),
  };
}

export async function daftar(q: KehadiranQuery, kelasScope: number | null) {
  const where = susunWhere(q, kelasScope);
  const [rows, total] = await Promise.all([
    prisma.kehadiran.findMany({
      where,
      include,
      orderBy: [{ tanggal: 'desc' }, { jam_ke: 'asc' }, { id: 'asc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.kehadiran.count({ where }),
  ]);
  return { rows: rows.map(keKehadiran), total };
}

/** Semua catatan yang cocok (tanpa paginasi), urut jam ke. Dipakai jurnal harian. */
export async function semua(f: FilterKehadiran, kelasScope: number | null): Promise<Kehadiran[]> {
  const rows = await prisma.kehadiran.findMany({
    where: susunWhere(f, kelasScope),
    include,
    orderBy: [{ jam_ke: 'asc' }, { id: 'asc' }],
  });
  return rows.map(keKehadiran);
}

export async function ambil(db: Db, id: number): Promise<Kehadiran | null> {
  const k = await db.kehadiran.findUnique({ where: { id }, include });
  return k ? keKehadiran(k) : null;
}

/** Catatan guru pada satu tanggal (semua kelas), untuk pemeriksaan jam bentrok. */
export async function catatanGuruPadaTanggal(db: Db, guruId: number, tanggal: TanggalISO) {
  const rows = await db.kehadiran.findMany({
    where: { guru_id: guruId, tanggal: keDate(tanggal) },
    select: { id: true, jam_ke: true, lama_jam: true, kelas: { select: { nama_kelas: true } } },
    orderBy: { jam_ke: 'asc' },
  });
  return rows.map((r) => ({
    id: keNumber(r.id),
    jam_ke: r.jam_ke,
    lama_jam: r.lama_jam,
    nama_kelas: r.kelas.nama_kelas,
  }));
}

/**
 * Mengunci baris guru sampai transaksi selesai, supaya dua permintaan bersamaan
 * untuk guru yang sama tidak sama-sama lolos pemeriksaan jam bentrok.
 * @returns false bila guru tidak ada.
 */
export async function kunciGuru(db: Db, guruIds: readonly number[]): Promise<Set<number>> {
  const ada = new Set<number>();
  // Urutan tetap (ID naik) mencegah deadlock antartransaksi.
  for (const id of [...new Set(guruIds)].sort((a, b) => a - b)) {
    const rows = await db.$queryRaw<
      { id: bigint }[]
    >`SELECT id FROM guru WHERE id = ${id} FOR UPDATE`;
    if (rows.length > 0) ada.add(id);
  }
  return ada;
}

export async function kelasAda(db: Db, kelasId: number): Promise<boolean> {
  return (await db.kelas.count({ where: { id: kelasId } })) > 0;
}

export interface DataKehadiran {
  tanggal: TanggalISO;
  guru_id: number;
  kelas_id: number;
  jam_ke: number;
  lama_jam: number;
  status_kehadiran: StatusKehadiran;
  status_tugas: StatusTugas;
  keterangan: string | null;
}

function keDb(d: DataKehadiran) {
  return {
    tanggal: keDate(d.tanggal),
    guru_id: d.guru_id,
    kelas_id: d.kelas_id,
    jam_ke: d.jam_ke,
    lama_jam: d.lama_jam,
    status_kehadiran: statusKehadiranKeDb(d.status_kehadiran),
    status_tugas: statusTugasKeDb(d.status_tugas),
    keterangan: d.keterangan,
  };
}

/** `createdBy` selalu dari sesi (perbaikan §8.5), tidak pernah dari isian form. */
export async function buat(db: Db, data: DataKehadiran, createdBy: number): Promise<Kehadiran> {
  return keKehadiran(
    await db.kehadiran.create({ data: { ...keDb(data), created_by: createdBy }, include }),
  );
}

export async function ubah(db: Db, id: number, data: DataKehadiran): Promise<Kehadiran> {
  return keKehadiran(await db.kehadiran.update({ where: { id }, data: keDb(data), include }));
}

export async function hapus(db: Db, id: number): Promise<void> {
  await db.kehadiran.delete({ where: { id } });
}

/** Jadwal kelas pada hari tertentu + tanda apakah sudah dicatat pada tanggal itu. */
export async function jadwalHari(
  kelasId: number,
  hari: number,
  tanggal: TanggalISO,
): Promise<JadwalHari[]> {
  const [jadwal, tercatat] = await Promise.all([
    prisma.jadwalMengajar.findMany({
      where: { kelas_id: kelasId, hari },
      include: { guru: { select: { kode_guru: true, nama_guru: true, mata_pelajaran: true } } },
      orderBy: [{ jam_ke: 'asc' }, { id: 'asc' }],
    }),
    prisma.kehadiran.findMany({
      where: { kelas_id: kelasId, tanggal: keDate(tanggal) },
      select: { guru_id: true, jam_ke: true, lama_jam: true },
    }),
  ]);
  return jadwal.map((j) => ({
    guru_id: keNumber(j.guru_id),
    kode_guru: j.guru.kode_guru,
    nama_guru: j.guru.nama_guru,
    mata_pelajaran: j.guru.mata_pelajaran,
    jam_ke: j.jam_ke,
    total_jam_mengajar: j.total_jam_mengajar,
    sudah_dicatat: tercatat.some(
      (t) =>
        t.guru_id === j.guru_id && t.jam_ke <= j.jam_ke && t.jam_ke + t.lama_jam - 1 >= j.jam_ke,
    ),
  }));
}

export async function ambilKelas(kelasId: number) {
  const k = await prisma.kelas.findUnique({ where: { id: kelasId } });
  return k ? { id: keNumber(k.id), nama_kelas: k.nama_kelas } : null;
}
