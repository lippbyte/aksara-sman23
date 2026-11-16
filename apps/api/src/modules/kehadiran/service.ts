import {
  cariJamBentrok,
  hariDalamPekan,
  type Halaman,
  type JadwalHari,
  type Kehadiran,
  type KehadiranInput,
  type KehadiranQuery,
  type PenggunaSesi,
  type TanggalISO,
} from '@sms/shared';
import { catatAudit, type KonteksAudit } from '../../lib/audit';
import { batalkanCacheDashboard } from '../../lib/cache';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors';
import { prisma, type Db } from '../../lib/prisma';
import { ambilPengaturan } from '../../lib/sekolah';
import { hitungUlangRekapTerdampak } from '../rekap/hitung';
import * as repo from './repo';
import type { DataKehadiran } from './repo';

function rentangJam(jamKe: number, lamaJam: number): string {
  return lamaJam > 1 ? `jam ke-${jamKe}–${jamKe + lamaJam - 1}` : `jam ke-${jamKe}`;
}

function ringkas(k: Kehadiran): string {
  return `${k.nama_guru} di ${k.nama_kelas}, ${k.tanggal} ${rentangJam(k.jam_ke, k.lama_jam)} (${k.status_kehadiran})`;
}

/**
 * Kelas catatan: sekretaris_kelas selalu memakai kelas dari akunnya (bukan dari form);
 * peran lain wajib memilih kelas.
 */
function tentukanKelas(input: KehadiranInput, kelasScope: number | null): number {
  if (kelasScope !== null) return kelasScope;
  if (input.kelas_id === null) throw badRequest('Kelas wajib dipilih.');
  return input.kelas_id;
}

/** Tolak bila rentang jam beririsan dengan catatan lain guru itu di tanggal yang sama (§6.1). */
async function tolakBilaBentrok(db: Db, data: DataKehadiran, kecualiId?: number): Promise<void> {
  const lama = await repo.catatanGuruPadaTanggal(db, data.guru_id, data.tanggal);
  const bentrok = cariJamBentrok(
    { id: kecualiId, jam_ke: data.jam_ke, lama_jam: data.lama_jam },
    lama,
  );
  const pertama = bentrok[0];
  if (pertama) {
    throw conflict(
      `Jam bentrok: guru ini sudah dicatat pada ${rentangJam(pertama.jam_ke, pertama.lama_jam)} di kelas ${pertama.nama_kelas} pada tanggal yang sama.`,
      { bentrok },
    );
  }
}

/** Baris harus ada dan, untuk sekretaris, harus milik kelasnya. */
async function ambilMilik(db: Db, id: number, kelasScope: number | null): Promise<Kehadiran> {
  const k = await repo.ambil(db, id);
  if (!k) throw notFound('Catatan kehadiran tidak ditemukan.');
  if (kelasScope !== null && k.kelas_id !== kelasScope) {
    throw forbidden('Catatan ini milik kelas lain.');
  }
  return k;
}

export async function daftar(
  q: KehadiranQuery,
  kelasScope: number | null,
): Promise<Halaman<Kehadiran>> {
  const hasil = await repo.daftar(q, kelasScope);
  return { data: hasil.rows, meta: { page: q.page, pageSize: q.pageSize, total: hasil.total } };
}

export function ambil(id: number, kelasScope: number | null): Promise<Kehadiran> {
  return ambilMilik(prisma, id, kelasScope);
}

/**
 * Tambah catatan. Satu transaksi: kunci guru → periksa bentrok → simpan → log aktivitas →
 * hitung ulang rekap pekan; setelah commit cache dashboard dibatalkan (§6.1).
 */
export async function buat(
  input: KehadiranInput,
  user: PenggunaSesi,
  kelasScope: number | null,
  audit: KonteksAudit,
): Promise<Kehadiran> {
  const data: DataKehadiran = { ...input, kelas_id: tentukanKelas(input, kelasScope) };
  const pengaturan = await ambilPengaturan(prisma);

  const baru = await prisma.$transaction(async (tx) => {
    const guruAda = await repo.kunciGuru(tx, [data.guru_id]);
    if (!guruAda.has(data.guru_id)) throw badRequest('Guru tidak ditemukan.');
    if (!(await repo.kelasAda(tx, data.kelas_id))) throw badRequest('Kelas tidak ditemukan.');
    await tolakBilaBentrok(tx, data);

    const k = await repo.buat(tx, data, user.id);
    await catatAudit(tx, audit, {
      module: 'Piket',
      aktivitas: 'CREATE_KEHADIRAN',
      entity_type: 'kehadiran',
      entity_id: k.id,
      description: `Mencatat kehadiran: ${ringkas(k)}.`,
    });
    await hitungUlangRekapTerdampak(tx, pengaturan, [{ guru_id: k.guru_id, tanggal: k.tanggal }]);
    return k;
  });
  batalkanCacheDashboard();
  return baru;
}

export async function ubah(
  id: number,
  input: KehadiranInput,
  kelasScope: number | null,
  audit: KonteksAudit,
): Promise<Kehadiran> {
  const data: DataKehadiran = { ...input, kelas_id: tentukanKelas(input, kelasScope) };
  const pengaturan = await ambilPengaturan(prisma);

  const baru = await prisma.$transaction(async (tx) => {
    const lama = await ambilMilik(tx, id, kelasScope);
    const guruAda = await repo.kunciGuru(tx, [lama.guru_id, data.guru_id]);
    if (!guruAda.has(data.guru_id)) throw badRequest('Guru tidak ditemukan.');
    if (!(await repo.kelasAda(tx, data.kelas_id))) throw badRequest('Kelas tidak ditemukan.');
    await tolakBilaBentrok(tx, data, id);

    const k = await repo.ubah(tx, id, data);
    await catatAudit(tx, audit, {
      module: 'Piket',
      aktivitas: 'UPDATE_KEHADIRAN',
      entity_type: 'kehadiran',
      entity_id: id,
      description: `Mengubah kehadiran: ${ringkas(lama)} menjadi ${ringkas(k)}.`,
    });
    // Pekan lama dan pekan baru; guru lama dan guru baru.
    await hitungUlangRekapTerdampak(tx, pengaturan, [
      { guru_id: lama.guru_id, tanggal: lama.tanggal },
      { guru_id: k.guru_id, tanggal: k.tanggal },
    ]);
    return k;
  });
  batalkanCacheDashboard();
  return baru;
}

export async function hapus(
  id: number,
  kelasScope: number | null,
  audit: KonteksAudit,
): Promise<void> {
  const pengaturan = await ambilPengaturan(prisma);
  await prisma.$transaction(async (tx) => {
    const lama = await ambilMilik(tx, id, kelasScope);
    await repo.kunciGuru(tx, [lama.guru_id]);
    await repo.hapus(tx, id);
    await catatAudit(tx, audit, {
      module: 'Piket',
      aktivitas: 'DELETE_KEHADIRAN',
      entity_type: 'kehadiran',
      entity_id: id,
      description: `Menghapus kehadiran: ${ringkas(lama)}.`,
    });
    await hitungUlangRekapTerdampak(tx, pengaturan, [
      { guru_id: lama.guru_id, tanggal: lama.tanggal },
    ]);
  });
  batalkanCacheDashboard();
}

/** Jadwal kelas pada tanggal itu, untuk mengisi form dengan cepat. */
export async function jadwalHari(
  kelasId: number | undefined,
  tanggal: TanggalISO,
  kelasScope: number | null,
): Promise<JadwalHari[]> {
  const id = kelasScope ?? kelasId;
  if (id === undefined) throw badRequest('Kelas wajib dipilih.');
  return repo.jadwalHari(id, hariDalamPekan(tanggal), tanggal);
}
