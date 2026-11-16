import {
  pekanDariTanggal,
  persentaseKehadiran,
  rentangPekan,
  tahunPekan,
  type Halaman,
  type HasilSyncRekap,
  type PekanRekap,
  type PekanTersedia,
  type PenggunaSesi,
  type PratinjauSyncRekap,
  type Rekap,
  type RekapQuery,
  type RentangPekan,
  type SyncRekapInput,
  type UbahRekapInput,
} from '@sms/shared';
import { catatAudit, type KonteksAudit } from '../../lib/audit';
import { batalkanCacheDashboard } from '../../lib/cache';
import { businessRule, forbidden, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import { ambilPengaturan, type PengaturanSekolah } from '../../lib/sekolah';
import { hariIni } from '../../lib/waktu';
import { hitungTerkoreksi, hitungUlangRekapPekan } from './hitung';
import * as repo from './repo';

export async function daftar(q: RekapQuery): Promise<Halaman<Rekap>> {
  const { page, pageSize, ...filter } = q;
  const hasil = await repo.daftar(filter, { page, pageSize });
  return { data: hasil.rows, meta: { page, pageSize, total: hasil.total } };
}

/**
 * Pekan yang bisa dipilih: pekan 1 sampai pekan berjalan (dari pengaturan sekolah),
 * ditambah pekan lain yang sudah punya rekap. Urut terbaru dulu.
 */
export async function daftarPekan(): Promise<PekanTersedia[]> {
  const pengaturan = await ambilPengaturan(prisma);
  const berjalan = pekanDariTanggal(hariIni(), pengaturan.pekan);
  const awal = pengaturan.pekan.tanggal_awal_pekan;

  const peta = new Map<string, PekanTersedia>();
  for (let m = 1; m <= berjalan.minggu_ke; m++) {
    const p = rentangPekan(m, tahunPekan(m, awal), pengaturan.pekan);
    peta.set(`${p.tahun}-${p.minggu_ke}`, {
      ...p,
      jumlah_rekap: 0,
      berjalan: m === berjalan.minggu_ke,
    });
  }
  for (const t of await repo.pekanTersimpan()) {
    const kunci = `${t.tahun}-${t.minggu_ke}`;
    const ada = peta.get(kunci);
    if (ada) ada.jumlah_rekap += t.jumlah;
    else {
      peta.set(kunci, {
        minggu_ke: t.minggu_ke,
        tahun: t.tahun,
        tanggal_mulai: t.tanggal_mulai,
        tanggal_selesai: t.tanggal_selesai,
        jumlah_rekap: t.jumlah,
        berjalan: false,
      });
    }
  }
  return [...peta.values()].sort((a, b) => b.tahun - a.tahun || b.minggu_ke - a.minggu_ke);
}

function periksaPekan(input: PekanRekap, pengaturan: PengaturanSekolah): RentangPekan {
  let pekan;
  try {
    // Pasangan (minggu_ke, tahun) diperiksa terhadap kalender (perbaikan §8.1).
    pekan = rentangPekan(input.minggu_ke, input.tahun, pengaturan.pekan);
  } catch (err) {
    throw businessRule(err instanceof Error ? err.message : 'Pekan tidak valid.');
  }
  // ASUMSI: pekan yang belum dimulai tidak disinkronkan, agar tidak muncul rekap 0% palsu.
  if (pekan.tanggal_mulai > hariIni()) {
    throw businessRule(`Pekan ${pekan.minggu_ke} belum dimulai.`);
  }
  return pekan;
}

/** Jumlah baris terkoreksi manual pada pekan itu (untuk dialog konfirmasi sinkron). */
export async function pratinjauSinkron(input: PekanRekap): Promise<PratinjauSyncRekap> {
  const pengaturan = await ambilPengaturan(prisma);
  const pekan = periksaPekan(input, pengaturan);
  const guru = await repo.guruAktif(prisma);
  return {
    minggu_ke: pekan.minggu_ke,
    tahun: pekan.tahun,
    terkoreksi: await hitungTerkoreksi(prisma, pekan, guru),
  };
}

/**
 * Sinkron massal: hitung ulang satu pekan untuk SEMUA guru aktif dengan query agregat
 * (`GROUP BY guru_id`), bukan loop per guru (§6.3, perbaikan §8.9).
 * Baris terkoreksi manual dilewati; `timpa_koreksi` hanya untuk admin.
 */
export async function sinkron(
  input: SyncRekapInput,
  user: PenggunaSesi,
  audit: KonteksAudit,
): Promise<HasilSyncRekap> {
  if (input.timpa_koreksi && user.role !== 'admin') {
    throw forbidden('Hanya admin yang boleh menimpa rekap yang sudah dikoreksi manual.');
  }
  const pengaturan = await ambilPengaturan(prisma);
  const pekan = periksaPekan(input, pengaturan);

  const hasil = await prisma.$transaction(async (tx) => {
    const guru = await repo.guruAktif(tx);
    const h = await hitungUlangRekapPekan(tx, pengaturan, guru, pekan, {
      timpaKoreksi: input.timpa_koreksi,
    });
    const rincian = h.ditimpa
      ? `; ${h.ditimpa} baris koreksi manual DITIMPA`
      : h.dilewati
        ? `; ${h.dilewati} baris koreksi manual dilewati`
        : '';
    await catatAudit(tx, audit, {
      module: 'Rekap',
      aktivitas: 'SYNC_REKAP',
      entity_type: 'rekap_kehadiran_guru',
      entity_id: `${pekan.tahun}-${pekan.minggu_ke}`,
      description: `Sinkron rekap pekan ${pekan.minggu_ke} (${pekan.tanggal_mulai} s.d. ${pekan.tanggal_selesai}): ${h.ditulis} baris ditulis${rincian}.`,
    });
    if (h.ditimpa > 0) {
      await catatAudit(tx, audit, {
        module: 'Rekap',
        aktivitas: 'TIMPA_KOREKSI_REKAP',
        entity_type: 'rekap_kehadiran_guru',
        entity_id: `${pekan.tahun}-${pekan.minggu_ke}`,
        description: `Menimpa ${h.ditimpa} baris rekap yang dikoreksi manual pada pekan ${pekan.minggu_ke}/${pekan.tahun} dengan hasil sinkron.`,
      });
    }
    return h;
  });
  batalkanCacheDashboard();
  return { pekan, disinkronkan: hasil.ditulis, dilewati: hasil.dilewati, ditimpa: hasil.ditimpa };
}

/**
 * Koreksi manual jam wajib/hadir dengan alasan. Persentase dihitung ulang dengan fungsi
 * domain. Baris ditandai `dikoreksi_manual` sehingga sinkron berikutnya melewatinya.
 */
export async function ubah(
  id: number,
  input: UbahRekapInput,
  user: PenggunaSesi,
  audit: KonteksAudit,
): Promise<Rekap> {
  const hasil = await prisma.$transaction(async (tx) => {
    const lama = await repo.ambil(tx, id);
    if (!lama) throw notFound('Rekap tidak ditemukan.');
    const baru = await repo.ubah(tx, id, {
      total_jam_wajib: input.total_jam_wajib,
      total_jam_hadir: input.total_jam_hadir,
      persentase_kehadiran: persentaseKehadiran(input.total_jam_hadir, input.total_jam_wajib),
      dikoreksi_manual: true,
      alasan_koreksi: input.alasan_koreksi,
      dikoreksi_oleh: user.id,
      dikoreksi_pada: new Date(),
    });
    await catatAudit(tx, audit, {
      module: 'Rekap',
      aktivitas: 'UPDATE_REKAP',
      entity_type: 'rekap_kehadiran_guru',
      entity_id: id,
      description: `Mengoreksi rekap ${lama.nama_guru} pekan ${lama.minggu_ke}/${lama.tahun}: jam ${lama.total_jam_hadir}/${lama.total_jam_wajib} menjadi ${baru.total_jam_hadir}/${baru.total_jam_wajib} (${baru.persentase_kehadiran}%). Alasan: ${input.alasan_koreksi}`,
    });
    return baru;
  });
  batalkanCacheDashboard();
  return hasil;
}

export async function hapus(id: number, audit: KonteksAudit): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lama = await repo.ambil(tx, id);
    if (!lama) throw notFound('Rekap tidak ditemukan.');
    await repo.hapus(tx, id);
    await catatAudit(tx, audit, {
      module: 'Rekap',
      aktivitas: 'DELETE_REKAP',
      entity_type: 'rekap_kehadiran_guru',
      entity_id: id,
      description: `Menghapus rekap ${lama.nama_guru} pekan ${lama.minggu_ke}/${lama.tahun}.`,
    });
  });
  batalkanCacheDashboard();
}
