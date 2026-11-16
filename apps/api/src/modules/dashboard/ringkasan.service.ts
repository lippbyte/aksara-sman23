import {
  hariDalamPekan,
  pekanDariTanggal,
  persentaseJamTerisi,
  rataRataPekanGuru,
  rentangPekan,
  STATUS_KEHADIRAN,
  tahunPekan,
  type DashboardPenilai,
  type DashboardRingkasan,
  type KehadiranKelasHariIni,
  type PenggunaSesi,
  type RentangPekan,
  type StatusKehadiran,
  type TitikTren,
} from '@sms/shared';
import { AWALAN_DASHBOARD, ambilAtauHitung } from '../../lib/cache';
import { keAngka, keDate, keNumber, statusKehadiranDariDb } from '../../lib/konversi';
import { infoJendela } from '../../lib/penilaian';
import { prisma } from '../../lib/prisma';
import { ambilPengaturan, type PengaturanSekolah } from '../../lib/sekolah';
import { hariIni } from '../../lib/waktu';
import * as auditRepo from '../audit/repo';

/** Masa simpan cache dashboard; dibatalkan lebih awal setiap kali data berubah. */
const TTL_DETIK = 120;
const JUMLAH_PEKAN_TREN = 8;

function nol(): Record<StatusKehadiran, number> {
  return { Hadir: 0, Mendampingi: 0, 'Tidak Hadir': 0 };
}

async function kpi() {
  const [guru_aktif, siswa_aktif, rombel, catatan_hari_ini] = await Promise.all([
    prisma.guru.count({ where: { status: 'aktif' } }),
    prisma.siswa.count({ where: { status: 'aktif' } }),
    prisma.kelas.count(),
    prisma.kehadiran.count({ where: { tanggal: keDate(hariIni()) } }),
  ]);
  return { guru_aktif, siswa_aktif, rombel, catatan_hari_ini };
}

/** Satu query agregat (GROUP BY kelas, status) + jumlah JP terjadwal hari ini. */
async function kehadiranHariIni(pengaturan: PengaturanSekolah, tanggal: string) {
  const hari = hariDalamPekan(tanggal);
  const [grup, kelas, jadwal] = await Promise.all([
    prisma.kehadiran.groupBy({
      by: ['kelas_id', 'status_kehadiran'],
      where: { tanggal: keDate(tanggal) },
      _sum: { lama_jam: true },
      _count: { _all: true },
    }),
    prisma.kelas.findMany({ orderBy: { nama_kelas: 'asc' } }),
    pengaturan.pekan.hari_efektif.includes(hari)
      ? prisma.jadwalMengajar.aggregate({ where: { hari }, _sum: { total_jam_mengajar: true } })
      : Promise.resolve(null),
  ]);

  const perStatus = {
    Hadir: { catatan: 0, jp: 0 },
    Mendampingi: { catatan: 0, jp: 0 },
    'Tidak Hadir': { catatan: 0, jp: 0 },
  } satisfies DashboardRingkasan['hari_ini']['per_status'];
  const perKelas = new Map<number, Record<StatusKehadiran, number>>();
  for (const g of grup) {
    const status = statusKehadiranDariDb(g.status_kehadiran);
    const jp = g._sum.lama_jam ?? 0;
    perStatus[status].catatan += g._count._all;
    perStatus[status].jp += jp;
    const id = keNumber(g.kelas_id);
    const baris = perKelas.get(id) ?? nol();
    baris[status] += jp;
    perKelas.set(id, baris);
  }
  const jpTercatat = STATUS_KEHADIRAN.reduce((s, st) => s + perStatus[st].jp, 0);
  const jpTerjadwal = jadwal?._sum.total_jam_mengajar ?? 0;

  return {
    per_status: perStatus,
    jp_terjadwal: jpTerjadwal,
    jp_tercatat: jpTercatat,
    persentase_terisi: persentaseJamTerisi(jpTercatat, jpTerjadwal),
    per_kelas: kelas.map((k): KehadiranKelasHariIni => ({
      kelas_id: keNumber(k.id),
      nama_kelas: k.nama_kelas,
      ...(perKelas.get(keNumber(k.id)) ?? nol()),
    })),
  };
}

/**
 * Nomor pekan terakhir yang sudah selesai (hari efektif terakhirnya sudah lewat); 0 bila
 * belum ada. ASUMSI: pekan berjalan tidak dipakai untuk persentase, karena jam hadirnya
 * baru sebagian sedangkan jam wajibnya sepekan penuh sehingga tampak rendah.
 */
function pekanSelesaiTerakhir(berjalan: RentangPekan, tanggal: string): number {
  return berjalan.tanggal_selesai < tanggal ? berjalan.minggu_ke : berjalan.minggu_ke - 1;
}

/** Tren 8 pekan terakhir yang sudah selesai: satu query rekap. */
async function tren(pengaturan: PengaturanSekolah, mingguTerakhir: number): Promise<TitikTren[]> {
  const awal = pengaturan.pekan.tanggal_awal_pekan;
  const pekan: RentangPekan[] = [];
  if (mingguTerakhir < 1) return [];
  for (let m = Math.max(1, mingguTerakhir - JUMLAH_PEKAN_TREN + 1); m <= mingguTerakhir; m++) {
    pekan.push(rentangPekan(m, tahunPekan(m, awal), pengaturan.pekan));
  }
  const rows = await prisma.rekapKehadiranGuru.findMany({
    where: {
      OR: pekan.map((p) => ({ minggu_ke: p.minggu_ke, tahun: p.tahun })),
      guru: { status: 'aktif' },
    },
    select: { minggu_ke: true, tahun: true, total_jam_wajib: true, persentase_kehadiran: true },
  });
  return pekan.map((p) => {
    const milik = rows
      .filter((r) => r.minggu_ke === p.minggu_ke && r.tahun === p.tahun)
      .map((r) => ({
        total_jam_wajib: r.total_jam_wajib,
        persentase_kehadiran: keAngka(r.persentase_kehadiran),
      }));
    return {
      minggu_ke: p.minggu_ke,
      tahun: p.tahun,
      tanggal_mulai: p.tanggal_mulai,
      tanggal_selesai: p.tanggal_selesai,
      persentase: rataRataPekanGuru(milik),
      jumlah_guru: milik.filter((m) => m.total_jam_wajib > 0).length,
    };
  });
}

/**
 * 5 kelas dengan jam kosong terbanyak pekan ini: satu query agregat.
 * ASUMSI: "jam kosong" = JP berstatus Tidak Hadir (guru tidak hadir di kelas).
 */
async function jamKosong(berjalan: RentangPekan) {
  const grup = await prisma.kehadiran.groupBy({
    by: ['kelas_id'],
    where: {
      tanggal: { gte: keDate(berjalan.tanggal_mulai), lte: keDate(berjalan.tanggal_selesai) },
      status_kehadiran: 'Tidak_Hadir',
    },
    _sum: { lama_jam: true },
    orderBy: { _sum: { lama_jam: 'desc' } },
    take: 5,
  });
  const kelas = await prisma.kelas.findMany({
    where: { id: { in: grup.map((g) => g.kelas_id) } },
  });
  return {
    pekan: berjalan,
    data: grup
      .map((g) => ({
        kelas_id: keNumber(g.kelas_id),
        nama_kelas: kelas.find((k) => k.id === g.kelas_id)?.nama_kelas ?? '—',
        jp_kosong: g._sum.lama_jam ?? 0,
      }))
      .filter((k) => k.jp_kosong > 0),
  };
}

/** 5 guru dengan persentase terendah pada pekan selesai terakhir yang sudah punya rekap. */
async function guruTerendah(pengaturan: PengaturanSekolah, tanggal: string) {
  const terakhir = await prisma.rekapKehadiranGuru.findFirst({
    where: { tanggal_selesai: { lt: keDate(tanggal) }, total_jam_wajib: { gt: 0 } },
    orderBy: [{ tanggal_mulai: 'desc' }],
    select: { minggu_ke: true, tahun: true },
  });
  if (!terakhir) return { pekan: null, data: [] };
  const rows = await prisma.rekapKehadiranGuru.findMany({
    where: {
      minggu_ke: terakhir.minggu_ke,
      tahun: terakhir.tahun,
      total_jam_wajib: { gt: 0 },
      guru: { status: 'aktif' },
    },
    include: { guru: { select: { nama_guru: true, mata_pelajaran: true } } },
    orderBy: [{ persentase_kehadiran: 'asc' }, { guru: { nama_guru: 'asc' } }],
    take: 5,
  });
  let pekan: RentangPekan | null;
  try {
    pekan = rentangPekan(terakhir.minggu_ke, terakhir.tahun, pengaturan.pekan);
  } catch {
    pekan = null;
  }
  return {
    pekan,
    data: rows.map((r) => ({
      guru_id: keNumber(r.guru_id),
      nama_guru: r.guru.nama_guru,
      mata_pelajaran: r.guru.mata_pelajaran,
      persentase: keAngka(r.persentase_kehadiran),
      jam_hadir: r.total_jam_hadir,
      jam_wajib: r.total_jam_wajib,
    })),
  };
}

/** Dashboard utama. Widget data di-cache singkat; log aktivitas (admin) selalu segar. */
export async function ringkasan(user: PenggunaSesi): Promise<DashboardRingkasan> {
  const tanggal = hariIni();
  const isi = await ambilAtauHitung(
    `${AWALAN_DASHBOARD}ringkasan:${tanggal}`,
    TTL_DETIK,
    async () => {
      const pengaturan = await ambilPengaturan(prisma);
      const berjalan = pekanDariTanggal(tanggal, pengaturan.pekan);
      const [k, h, t, jk, gt] = await Promise.all([
        kpi(),
        kehadiranHariIni(pengaturan, tanggal),
        tren(pengaturan, pekanSelesaiTerakhir(berjalan, tanggal)),
        jamKosong(berjalan),
        guruTerendah(pengaturan, tanggal),
      ]);
      return { tanggal, kpi: k, hari_ini: h, tren: t, jam_kosong: jk, guru_terendah: gt };
    },
  );

  const log_terbaru =
    user.role === 'admin' ? (await auditRepo.daftar({ page: 1, pageSize: 8 })).rows : null;
  return { ...isi, log_terbaru };
}

/** Dashboard ringkas penilai: jendela penilaian bulan berjalan + guru yang belum dinilai. */
export async function penilai(): Promise<DashboardPenilai> {
  const tanggal = hariIni();
  return ambilAtauHitung(`${AWALAN_DASHBOARD}penilai:${tanggal}`, TTL_DETIK, async () => {
    const pengaturan = await ambilPengaturan(prisma);
    const periode = { bulan: Number(tanggal.slice(5, 7)), tahun: Number(tanggal.slice(0, 4)) };
    const [aktif, belum] = await Promise.all([
      prisma.guru.count({ where: { status: 'aktif' } }),
      prisma.guru.findMany({
        where: {
          status: 'aktif',
          penilaian: {
            none: { bulan: periode.bulan, tahun: periode.tahun, dinilai_oleh: { not: null } },
          },
        },
        select: { id: true, kode_guru: true, nama_guru: true, mata_pelajaran: true },
        orderBy: { nama_guru: 'asc' },
      }),
    ]);
    return {
      periode,
      jendela: infoJendela(periode, pengaturan),
      jumlah_guru_aktif: aktif,
      sudah_dinilai: aktif - belum.length,
      belum_dinilai: belum.map((g) => ({
        guru_id: keNumber(g.id),
        kode_guru: g.kode_guru,
        nama_guru: g.nama_guru,
        mata_pelajaran: g.mata_pelajaran,
      })),
    };
  });
}
