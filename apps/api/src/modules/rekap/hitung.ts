import {
  hitungMingguKe,
  persentaseKehadiran,
  rentangPekan,
  STATUS_DIHITUNG_HADIR,
  tahunPekan,
  type RentangPekan,
  type TanggalISO,
} from '@sms/shared';
import { Prisma } from '../../generated/prisma/client';
import { keDate, keNumber, statusKehadiranKeDb } from '../../lib/konversi';
import type { Db } from '../../lib/prisma';
import type { PengaturanSekolah } from '../../lib/sekolah';

/**
 * Menghitung ulang rekap satu pekan untuk sekumpulan guru (§6.3) dengan DUA query
 * agregat (`GROUP BY guru_id`) dan SATU upsert massal, bukan loop query per guru
 * (perbaikan §8.9). Rumus persentase tetap dari fungsi domain.
 *
 * @returns jumlah baris rekap yang ditulis.
 */
export async function hitungUlangRekapPekan(
  db: Db,
  pengaturan: PengaturanSekolah,
  guruIds: readonly number[],
  pekan: RentangPekan,
): Promise<number> {
  const ids = [...new Set(guruIds)];
  if (ids.length === 0) return 0;

  const [wajib, hadir] = await Promise.all([
    // Jam wajib: jadwal pada hari efektif saja (perbaikan §8.2).
    db.jadwalMengajar.groupBy({
      by: ['guru_id'],
      where: { guru_id: { in: ids }, hari: { in: [...pengaturan.pekan.hari_efektif] } },
      _sum: { total_jam_mengajar: true },
    }),
    // Jam hadir: Hadir atau Mendampingi di dalam rentang pekan.
    db.kehadiran.groupBy({
      by: ['guru_id'],
      where: {
        guru_id: { in: ids },
        tanggal: { gte: keDate(pekan.tanggal_mulai), lte: keDate(pekan.tanggal_selesai) },
        status_kehadiran: { in: STATUS_DIHITUNG_HADIR.map(statusKehadiranKeDb) },
      },
      _sum: { lama_jam: true },
    }),
  ]);

  const petaWajib = new Map(
    wajib.map((w) => [keNumber(w.guru_id), w._sum.total_jam_mengajar ?? 0]),
  );
  const petaHadir = new Map(hadir.map((h) => [keNumber(h.guru_id), h._sum.lama_jam ?? 0]));

  const baris = ids.map((guruId) => {
    const totalWajib = petaWajib.get(guruId) ?? 0;
    const totalHadir = petaHadir.get(guruId) ?? 0;
    return Prisma.sql`(${guruId}, ${pekan.tahun}, ${pekan.minggu_ke}, ${pekan.tanggal_mulai}, ${pekan.tanggal_selesai}, ${totalWajib}, ${totalHadir}, ${persentaseKehadiran(totalHadir, totalWajib)}, NOW(3), NOW(3))`;
  });

  // Unik (guru_id, tahun, minggu_ke): baris lama diperbarui, baris baru disisipkan.
  await db.$executeRaw`
    INSERT INTO rekap_kehadiran_guru
      (guru_id, tahun, minggu_ke, tanggal_mulai, tanggal_selesai,
       total_jam_wajib, total_jam_hadir, persentase_kehadiran, created_at, updated_at)
    VALUES ${Prisma.join(baris)}
    ON DUPLICATE KEY UPDATE
      tanggal_mulai = VALUES(tanggal_mulai),
      tanggal_selesai = VALUES(tanggal_selesai),
      total_jam_wajib = VALUES(total_jam_wajib),
      total_jam_hadir = VALUES(total_jam_hadir),
      persentase_kehadiran = VALUES(persentase_kehadiran),
      updated_at = VALUES(updated_at)`;

  return baris.length;
}

export function pekanUntukTanggal(
  pengaturan: PengaturanSekolah,
  tanggal: TanggalISO,
): RentangPekan {
  const awal = pengaturan.pekan.tanggal_awal_pekan;
  const mingguKe = hitungMingguKe(tanggal, awal);
  return rentangPekan(mingguKe, tahunPekan(mingguKe, awal), pengaturan.pekan);
}

/**
 * Menghitung ulang rekap untuk pasangan (guru, tanggal) yang terdampak perubahan
 * kehadiran: pekan lama dan pekan baru, guru lama dan guru baru (§6.1).
 */
export async function hitungUlangRekapTerdampak(
  db: Db,
  pengaturan: PengaturanSekolah,
  terdampak: readonly { guru_id: number; tanggal: TanggalISO }[],
): Promise<void> {
  const perPekan = new Map<number, { pekan: RentangPekan; guru: Set<number> }>();
  for (const t of terdampak) {
    const pekan = pekanUntukTanggal(pengaturan, t.tanggal);
    const entri = perPekan.get(pekan.minggu_ke) ?? { pekan, guru: new Set<number>() };
    entri.guru.add(t.guru_id);
    perPekan.set(pekan.minggu_ke, entri);
  }
  for (const { pekan, guru } of perPekan.values()) {
    await hitungUlangRekapPekan(db, pengaturan, [...guru], pekan);
  }
}
