import { STATUS_DIHITUNG_HADIR, type StatusKehadiran } from '../constants';
import { bulatkan2 } from './angka';
import { rentangBeririsan } from './pekan';
import { rentangBulan, type TanggalISO } from './tanggal';

/**
 * Persentase kehadiran pekan (§6.3): `min(100, round(hadir / wajib × 100, 2))`;
 * 0 bila jam wajib 0.
 */
export function persentaseKehadiran(totalJamHadir: number, totalJamWajib: number): number {
  if (!(totalJamWajib > 0) || !(totalJamHadir > 0)) return 0;
  return Math.min(100, bulatkan2((totalJamHadir / totalJamWajib) * 100));
}

/**
 * Jam wajib pekan: jumlah `total_jam_mengajar` jadwal guru pada hari efektif saja
 * (perbaikan §8.2: Sabtu tidak ikut bila bukan hari efektif).
 */
export function totalJamWajib(
  jadwal: readonly { hari: number; total_jam_mengajar: number }[],
  hariEfektif: readonly number[],
): number {
  return jadwal
    .filter((j) => hariEfektif.includes(j.hari))
    .reduce((jumlah, j) => jumlah + j.total_jam_mengajar, 0);
}

/**
 * Jam hadir pekan: jumlah `lama_jam` untuk status Hadir atau Mendampingi
 * dengan tanggal di dalam rentang pekan (inklusif).
 */
export function totalJamHadir(
  kehadiran: readonly {
    tanggal: TanggalISO;
    lama_jam: number;
    status_kehadiran: StatusKehadiran;
  }[],
  rentang: { tanggal_mulai: TanggalISO; tanggal_selesai: TanggalISO },
): number {
  return kehadiran
    .filter(
      (k) =>
        k.tanggal >= rentang.tanggal_mulai &&
        k.tanggal <= rentang.tanggal_selesai &&
        STATUS_DIHITUNG_HADIR.includes(k.status_kehadiran),
    )
    .reduce((jumlah, k) => jumlah + k.lama_jam, 0);
}

export interface RekapPekanRingkas {
  tanggal_mulai: TanggalISO;
  tanggal_selesai: TanggalISO;
  persentase_kehadiran: number;
}

/** Pekan yang beririsan dengan bulan (sebagian harinya jatuh di bulan itu). */
export function pekanBeririsanBulan<T extends RekapPekanRingkas>(
  rekapPekan: readonly T[],
  bulan: number,
  tahun: number,
): T[] {
  const b = rentangBulan(bulan, tahun);
  return rekapPekan.filter((r) =>
    rentangBeririsan({ awal: r.tanggal_mulai, akhir: r.tanggal_selesai }, b),
  );
}

/**
 * Skor kehadiran bulanan (§6.4): rata-rata `persentase_kehadiran` pekan-pekan yang
 * BERIRISAN dengan bulan (perbaikan §8.3). 0 bila tidak ada pekan.
 */
export function rataRataBulanan(
  rekapPekan: readonly RekapPekanRingkas[],
  bulan: number,
  tahun: number,
): number {
  const terpilih = pekanBeririsanBulan(rekapPekan, bulan, tahun);
  if (terpilih.length === 0) return 0;
  const jumlah = terpilih.reduce((s, r) => s + r.persentase_kehadiran, 0);
  return bulatkan2(jumlah / terpilih.length);
}

/** Rata-rata sederhana dua desimal; 0 bila kosong. */
export function rataRata(nilai: readonly number[]): number {
  if (nilai.length === 0) return 0;
  return bulatkan2(nilai.reduce((s, n) => s + n, 0) / nilai.length);
}

/**
 * Skor kehadiran MGMP (§6.5): rata-rata kehadiran guru aktif anggota MGMP pada pekan
 * yang beririsan dengan bulan.
 *
 * ASUMSI: dihitung sebagai rata-rata dari skor kehadiran bulanan tiap guru
 * (`rataRataBulanan`), hanya untuk guru yang punya rekap pada bulan itu. Guru tanpa
 * rekap tidak dihitung sebagai 0. Pembulatan hanya di hasil akhir.
 *
 * @param rekapPerGuru rekap pekan tiap guru aktif anggota MGMP.
 */
export function skorKehadiranMgmp(
  rekapPerGuru: readonly (readonly RekapPekanRingkas[])[],
  bulan: number,
  tahun: number,
): number {
  const perGuru = rekapPerGuru
    .map((rekap) => pekanBeririsanBulan(rekap, bulan, tahun))
    .filter((pekan) => pekan.length > 0)
    .map((pekan) => pekan.reduce((s, r) => s + r.persentase_kehadiran, 0) / pekan.length);
  if (perGuru.length === 0) return 0;
  return bulatkan2(perGuru.reduce((s, n) => s + n, 0) / perGuru.length);
}

/**
 * Persentase jam terisi hari ini (dashboard, DESIGN §7): JP yang sudah dicatat dibanding
 * JP terjadwal. `min(100, round(tercatat / terjadwal × 100, 2))`; 0 bila tidak ada jadwal.
 */
export function persentaseJamTerisi(jpTercatat: number, jpTerjadwal: number): number {
  return persentaseKehadiran(jpTercatat, jpTerjadwal);
}

/**
 * Persentase kehadiran guru rata-rata satu pekan (tren dashboard).
 * ASUMSI: rata-rata persentase tiap guru; guru tanpa jam wajib (0) tidak dihitung.
 * Kosong bila tidak ada guru yang punya jam wajib → null (bukan 0).
 */
export function rataRataPekanGuru(
  rekap: readonly { total_jam_wajib: number; persentase_kehadiran: number }[],
): number | null {
  const berjadwal = rekap.filter((r) => r.total_jam_wajib > 0);
  return berjadwal.length === 0 ? null : rataRata(berjadwal.map((r) => r.persentase_kehadiran));
}
