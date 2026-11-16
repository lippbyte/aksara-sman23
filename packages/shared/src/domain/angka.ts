/**
 * Pembulatan dua desimal (§6.6), setengah ke atas, tahan galat biner
 * (mis. 1.005 → 1.01, bukan 1.00).
 */
export function bulatkan2(nilai: number): number {
  if (!Number.isFinite(nilai)) return 0;
  const hasil = Number(`${Math.round(Number(`${nilai}e2`))}e-2`);
  // Notasi eksponen (mis. 1e-7) tidak bisa disambung dengan "e2"; pakai jalur biasa.
  return Number.isNaN(hasil) ? Math.round(nilai * 100) / 100 : hasil;
}

/** Membatasi skor ke rentang 0–100. */
export function batasiSkor(nilai: number): number {
  if (!Number.isFinite(nilai)) return 0;
  return Math.min(100, Math.max(0, nilai));
}
