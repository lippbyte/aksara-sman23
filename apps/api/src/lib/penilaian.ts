import {
  jendelaPenilaian,
  pekanBelumDisinkron,
  pekanDalamBulan,
  type JendelaPenilaian,
  type PenggunaSesi,
  type Periode,
  type RentangPekan,
} from '@sms/shared';
import { catatAudit, type KonteksAudit } from './audit';
import { businessRule } from './errors';
import type { Db } from './prisma';
import type { PengaturanSekolah } from './sekolah';
import { hariIni } from './waktu';

const NAMA_BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function namaPeriode(p: Periode): string {
  return `${NAMA_BULAN[p.bulan - 1] ?? p.bulan} ${p.tahun}`;
}

export function infoJendela(
  p: Periode,
  pengaturan: PengaturanSekolah,
): JendelaPenilaian & { hari: number } {
  return {
    ...jendelaPenilaian(hariIni(), p.bulan, p.tahun, pengaturan.jendela_penilaian_hari),
    hari: pengaturan.jendela_penilaian_hari,
  };
}

/**
 * Jendela penilaian (§6.4): pengisian hanya pada N hari terakhir bulan periode itu.
 * Di luar jendela → 422, kecuali admin; pengisian admin di luar jendela dicatat terpisah di log.
 *
 * @returns true bila pengisian dilakukan admin di luar jendela.
 */
export function periksaJendela(
  user: PenggunaSesi,
  p: Periode,
  pengaturan: PengaturanSekolah,
): boolean {
  const j = infoJendela(p, pengaturan);
  if (j.terbuka) return false;
  if (user.role === 'admin') return true;
  throw businessRule(
    `Jendela penilaian ${namaPeriode(p)} tertutup. Pengisian dibuka ${j.buka} s.d. ${j.tutup}.`,
    { jendela: j },
  );
}

/**
 * Pekan bulan periode yang sudah selesai tetapi belum punya rekap sama sekali (satu query
 * agregat). Pemilihan pekan dari fungsi domain.
 */
export async function pekanBelumDisinkronPeriode(
  db: Db,
  p: Periode,
  pengaturan: PengaturanSekolah,
): Promise<RentangPekan[]> {
  const pekan = pekanDalamBulan(p.bulan, p.tahun, pengaturan.pekan);
  if (pekan.length === 0) return [];
  const tersimpan = await db.rekapKehadiranGuru.groupBy({
    by: ['tahun', 'minggu_ke'],
    where: { OR: pekan.map((w) => ({ tahun: w.tahun, minggu_ke: w.minggu_ke })) },
  });
  return pekanBelumDisinkron(pekan, tersimpan, hariIni());
}

export async function catatDiLuarJendela(
  db: Db,
  audit: KonteksAudit,
  jenis: 'kinerja' | 'MGMP',
  p: Periode,
  entityType: string,
  entityId: number,
): Promise<void> {
  await catatAudit(db, audit, {
    module: 'Penilaian',
    aktivitas: 'PENILAIAN_DI_LUAR_JENDELA',
    entity_type: entityType,
    entity_id: entityId,
    description: `Admin mengisi penilaian ${jenis} ${namaPeriode(p)} di luar jendela penilaian.`,
  });
}
