import { HARI_EFEKTIF_DEFAULT } from '../constants';
import { seninDari, selisihHari, tahunDari, tambahHari, type TanggalISO } from './tanggal';

export interface PengaturanPekan {
  /** `sekolah_settings.tanggal_awal_pekan`; dinormalkan ke Senin pekannya. */
  tanggal_awal_pekan: TanggalISO;
  /** Hari efektif, 1 = Senin … 6 = Sabtu. */
  hari_efektif: readonly number[];
}

export interface RentangPekan {
  minggu_ke: number;
  /** Tahun kalender dari Senin pekan itu. */
  tahun: number;
  /** Senin. */
  tanggal_mulai: TanggalISO;
  /** Hari efektif terakhir pekan itu. */
  tanggal_selesai: TanggalISO;
}

/**
 * Nomor pekan sebuah tanggal (§6.3).
 *
 * Pekan dimulai Senin. Pekan 1 adalah pekan yang memuat `tanggalAwalPekan`;
 * tanggal sebelum itu masuk pekan 1.
 *
 * ASUMSI: nomor pekan berlanjut melewati pergantian tahun (tidak kembali ke 1 pada
 * 1 Januari), karena dihitung dari tanggal awal di pengaturan sekolah. Kolom `tahun`
 * pada rekap adalah tahun kalender dari Senin pekan itu (lihat `tahunPekan`).
 */
export function hitungMingguKe(tanggal: TanggalISO, tanggalAwalPekan: TanggalISO): number {
  const selisih = selisihHari(seninDari(tanggalAwalPekan), seninDari(tanggal));
  return Math.max(1, Math.floor(selisih / 7) + 1);
}

function hariEfektifTerakhir(hariEfektif: readonly number[]): number {
  const valid = hariEfektif.filter((h) => Number.isInteger(h) && h >= 1 && h <= 7);
  const daftar = valid.length > 0 ? valid : HARI_EFEKTIF_DEFAULT;
  return Math.max(...daftar);
}

/** Senin pekan ke-`mingguKe`. */
export function seninPekan(mingguKe: number, tanggalAwalPekan: TanggalISO): TanggalISO {
  if (!Number.isInteger(mingguKe) || mingguKe < 1) {
    throw new RangeError(`minggu_ke tidak valid: ${mingguKe}`);
  }
  return tambahHari(seninDari(tanggalAwalPekan), (mingguKe - 1) * 7);
}

/** Tahun kalender yang disimpan bersama `minggu_ke` (tahun dari Senin pekan itu). */
export function tahunPekan(mingguKe: number, tanggalAwalPekan: TanggalISO): number {
  return tahunDari(seninPekan(mingguKe, tanggalAwalPekan));
}

/**
 * Rentang tanggal pekan: Senin sampai hari efektif terakhir (default Jumat).
 *
 * `tahun` diperiksa, tidak diabaikan: bila pasangan (`mingguKe`, `tahun`) tidak cocok
 * dengan kalender (perbaikan §8.1), fungsi melempar RangeError.
 */
export function rentangPekan(
  mingguKe: number,
  tahun: number,
  settings: PengaturanPekan,
): RentangPekan {
  const mulai = seninPekan(mingguKe, settings.tanggal_awal_pekan);
  const tahunSeharusnya = tahunDari(mulai);
  if (tahun !== tahunSeharusnya) {
    throw new RangeError(`Pekan ${mingguKe} berada di tahun ${tahunSeharusnya}, bukan ${tahun}.`);
  }
  return {
    minggu_ke: mingguKe,
    tahun,
    tanggal_mulai: mulai,
    tanggal_selesai: tambahHari(mulai, hariEfektifTerakhir(settings.hari_efektif) - 1),
  };
}

/** Pekan (nomor, tahun, rentang) yang memuat sebuah tanggal. */
export function pekanDariTanggal(tanggal: TanggalISO, settings: PengaturanPekan): RentangPekan {
  const mingguKe = hitungMingguKe(tanggal, settings.tanggal_awal_pekan);
  return rentangPekan(mingguKe, tahunPekan(mingguKe, settings.tanggal_awal_pekan), settings);
}

/** Dua rentang tanggal inklusif beririsan? */
export function rentangBeririsan(
  a: { awal: TanggalISO; akhir: TanggalISO },
  b: { awal: TanggalISO; akhir: TanggalISO },
): boolean {
  return a.awal <= b.akhir && a.akhir >= b.awal;
}
