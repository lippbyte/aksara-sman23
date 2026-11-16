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

/** Data kehadiran satu guru aktif anggota MGMP untuk `skorKehadiranMgmp`. */
export interface KehadiranGuruMgmp {
  /** Jam wajib per pekan menurut jadwal saat ini (hari efektif saja, `totalJamWajib`). */
  jam_wajib_jadwal: number;
  /** Rekap pekan guru itu (cukup yang beririsan dengan bulan; sisanya disaring di sini). */
  rekap: readonly (RekapPekanRingkas & { total_jam_wajib: number })[];
}

/**
 * Skor kehadiran bulanan satu guru untuk MGMP; `null` bila guru tidak punya jam wajib
 * pada bulan itu (tidak ikut dirata-rata).
 *
 * - Pekan yang dihitung: beririsan dengan bulan DAN punya jam wajib > 0.
 * - Ada rekap pekan, tetapi semuanya jam wajib 0 → `null`.
 * - Tidak ada rekap sama sekali: berjadwal (jam wajib jadwal > 0) → 0; tidak berjadwal → `null`.
 *
 * ASUMSI: pekan dengan jam wajib 0 milik guru yang punya pekan lain berjadwal dilewati,
 * bukan dihitung 0%.
 */
export function skorKehadiranGuruMgmp(
  guru: KehadiranGuruMgmp,
  bulan: number,
  tahun: number,
): number | null {
  const pekan = pekanBeririsanBulan(guru.rekap, bulan, tahun);
  if (pekan.length === 0) return guru.jam_wajib_jadwal > 0 ? 0 : null;
  const berjadwal = pekan.filter((r) => r.total_jam_wajib > 0);
  if (berjadwal.length === 0) return null;
  return berjadwal.reduce((s, r) => s + r.persentase_kehadiran, 0) / berjadwal.length;
}

/**
 * Skor kehadiran MGMP (§6.5): rata-rata skor kehadiran bulanan guru aktif anggota MGMP
 * (`skorKehadiranGuruMgmp`). Hanya guru TANPA jam wajib yang dikeluarkan; guru berjadwal
 * yang belum punya catatan/rekap dihitung 0. Pembulatan hanya di hasil akhir; 0 bila
 * tidak ada guru yang dihitung.
 */
export function skorKehadiranMgmp(
  guru: readonly KehadiranGuruMgmp[],
  bulan: number,
  tahun: number,
): number {
  const perGuru = guru
    .map((g) => skorKehadiranGuruMgmp(g, bulan, tahun))
    .filter((s): s is number => s !== null);
  if (perGuru.length === 0) return 0;
  return bulatkan2(perGuru.reduce((s, n) => s + n, 0) / perGuru.length);
}

/**
 * Baris rekap yang dikoreksi manual: adakah catatan kehadiran guru itu pada pekan tersebut
 * yang dibuat atau diubah SETELAH `dikoreksi_pada`? Hanya penanda; rekap tidak dihitung ulang.
 *
 * ASUMSI: catatan yang DIHAPUS tidak terdeteksi (tidak ada jejak per guru/tanggal selain log).
 *
 * @param kehadiran catatan kehadiran guru itu; `updated_at` ISO (UTC).
 */
export function berubahSejakKoreksi(
  rekap: { tanggal_mulai: TanggalISO; tanggal_selesai: TanggalISO; dikoreksi_pada: string | null },
  kehadiran: readonly { tanggal: TanggalISO; updated_at: string }[],
): boolean {
  const pada = rekap.dikoreksi_pada;
  if (pada === null) return false;
  const batas = new Date(pada).getTime();
  return kehadiran.some(
    (k) =>
      k.tanggal >= rekap.tanggal_mulai &&
      k.tanggal <= rekap.tanggal_selesai &&
      new Date(k.updated_at).getTime() > batas,
  );
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
