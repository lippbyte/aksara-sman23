import {
  jendelaPenilaian,
  pekanBelumDisinkron,
  pekanDalamBulan,
  pekanRekapSebagian,
  type JendelaPenilaian,
  type PekanSebagian,
  type PenggunaSesi,
  type Periode,
  type RentangPekan,
} from '@sms/shared';
import { catatAudit, type KonteksAudit } from './audit';
import { keNumber } from './konversi';
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
 * Status sinkron pekan-pekan bulan periode (yang sudah selesai):
 * - `belum`: belum punya baris rekap sama sekali;
 * - `sebagian`: punya baris, tetapi kurang dari jumlah guru aktif berjam wajib > 0.
 * Tiga query; pemilihan pekan oleh fungsi domain.
 */
export async function statusSinkronPeriode(
  db: Db,
  p: Periode,
  pengaturan: PengaturanSekolah,
): Promise<{ belum: RentangPekan[]; sebagian: PekanSebagian[] }> {
  const pekan = pekanDalamBulan(p.bulan, p.tahun, pengaturan.pekan);
  if (pekan.length === 0) return { belum: [], sebagian: [] };
  const [rekap, jadwal] = await Promise.all([
    db.rekapKehadiranGuru.findMany({
      where: { OR: pekan.map((w) => ({ tahun: w.tahun, minggu_ke: w.minggu_ke })) },
      select: { tahun: true, minggu_ke: true, guru_id: true },
    }),
    // Jam wajib = jadwal pada hari efektif (§6.3); hanya guru aktif.
    db.jadwalMengajar.groupBy({
      by: ['guru_id'],
      where: { guru: { status: 'aktif' }, hari: { in: [...pengaturan.pekan.hari_efektif] } },
      _sum: { total_jam_mengajar: true },
    }),
  ]);
  const hari = hariIni();
  const baris = rekap.map((r) => ({ ...r, guru_id: keNumber(r.guru_id) }));
  const guruBerjadwal = jadwal
    .filter((j) => (j._sum.total_jam_mengajar ?? 0) > 0)
    .map((j) => keNumber(j.guru_id));
  return {
    belum: pekanBelumDisinkron(pekan, baris, hari),
    sebagian: pekanRekapSebagian(pekan, baris, guruBerjadwal, hari),
  };
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
