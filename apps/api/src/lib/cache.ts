/**
 * Cache memori sederhana dengan masa berlaku, untuk widget dashboard.
 * Satu instalasi = satu proses API, jadi tidak perlu penyimpanan bersama.
 */
interface Entri {
  kedaluwarsa: number;
  nilai: unknown;
}

const penyimpanan = new Map<string, Entri>();

export async function ambilAtauHitung<T>(
  kunci: string,
  ttlDetik: number,
  hitung: () => Promise<T>,
): Promise<T> {
  const ada = penyimpanan.get(kunci);
  if (ada && ada.kedaluwarsa > Date.now()) return ada.nilai as T;
  const nilai = await hitung();
  penyimpanan.set(kunci, { kedaluwarsa: Date.now() + ttlDetik * 1000, nilai });
  return nilai;
}

/** Membatalkan semua entri yang kuncinya berawalan `awalan`. */
export function batalkanCache(awalan: string): void {
  for (const kunci of penyimpanan.keys()) {
    if (kunci.startsWith(awalan)) penyimpanan.delete(kunci);
  }
}

export const AWALAN_DASHBOARD = 'dashboard:';

/** Dipanggil setiap kali data kehadiran, rekap, atau data master berubah. */
export function batalkanCacheDashboard(): void {
  batalkanCache(AWALAN_DASHBOARD);
}
