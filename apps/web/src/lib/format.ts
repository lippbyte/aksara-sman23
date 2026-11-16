import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

/**
 * Format tanggal dan angka (DESIGN §8): locale id-ID, zona Asia/Jakarta.
 * Tanggal kalender (`YYYY-MM-DD`) diformat apa adanya, tanpa pergeseran zona.
 */

const ZONA = 'Asia/Jakarta';

/** `Senin, 16 Nov 2026` */
export function tanggalPanjang(tanggal: string): string {
  return format(parseISO(tanggal), 'EEEE, d MMM yyyy', { locale: id });
}

/** `16/11/2026` */
export function tanggalPendek(tanggal: string): string {
  return format(parseISO(tanggal), 'dd/MM/yyyy');
}

/** `16 Nov` */
export function tanggalRingkas(tanggal: string): string {
  return format(parseISO(tanggal), 'd MMM', { locale: id });
}

/** `Pekan 45 (10–14 Nov)`; lintas bulan: `Pekan 25 (29 Jun–3 Jul)`. */
export function labelPekan(mingguKe: number, mulai: string, selesai: string): string {
  const a = parseISO(mulai);
  const b = parseISO(selesai);
  const samaBulan = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const awal = samaBulan ? format(a, 'd') : format(a, 'd MMM', { locale: id });
  return `Pekan ${mingguKe} (${awal}–${format(b, 'd MMM', { locale: id })})`;
}

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

export function namaBulan(bulan: number): string {
  return NAMA_BULAN[bulan - 1] ?? String(bulan);
}

const formatWaktu = new Intl.DateTimeFormat('id-ID', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Instan (ISO dengan jam) → `16/11/2026 14.05` waktu Jakarta. */
export function waktu(instan: string): string {
  return formatWaktu.format(new Date(instan)).replace(',', '');
}

/** Tanggal hari ini (`YYYY-MM-DD`) di zona Jakarta. */
export function hariIni(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const formatBulat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const formatDesimal = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `1.234` */
export function angka(nilai: number): string {
  return formatBulat.format(nilai);
}

/** `87,50` */
export function desimal(nilai: number): string {
  return formatDesimal.format(nilai);
}

/** `87,50%` */
export function persen(nilai: number): string {
  return `${formatDesimal.format(nilai)}%`;
}
