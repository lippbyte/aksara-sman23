import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge perlu tahu token sudut kustom (tokens.css: `--radius-kontrol|kartu|lembar`)
 * agar `rounded-kontrol` dan `rounded-2xl` dari pemanggil tidak sama-sama tertinggal di kelas.
 */
const twMerge = extendTailwindMerge({
  extend: { theme: { radius: ['kontrol', 'kartu', 'lembar'] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Dua huruf inisial untuk avatar pengguna. */
export function inisialNama(nama: string | undefined): string {
  if (!nama) return 'AK';
  const bagian = nama.trim().split(/\s+/).filter(Boolean);
  if (bagian.length === 1) return bagian[0]!.slice(0, 2).toUpperCase();
  return `${bagian[0]![0] ?? ''}${bagian[1]![0] ?? ''}`.toUpperCase();
}

/** Gulir halus hanya bila pengguna tidak meminta gerak dikurangi. */
export function gulirKeAtas() {
  const kurangi =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: kurangi ? 'auto' : 'smooth' });
}
