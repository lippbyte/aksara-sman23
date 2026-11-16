import { tanggalDiZona, type TanggalISO } from '@sms/shared';

export const ZONA_APLIKASI = 'Asia/Jakarta';

/** Tanggal hari ini (YYYY-MM-DD) di zona waktu aplikasi. */
export function hariIni(): TanggalISO {
  return tanggalDiZona(new Date(), ZONA_APLIKASI);
}

/** Awal hari (00.00 WIB) sebagai instan UTC, untuk menyaring kolom DATETIME. */
export function awalHariWib(tanggal: TanggalISO): Date {
  return new Date(`${tanggal}T00:00:00.000+07:00`);
}

/** Awal hari berikutnya (batas atas eksklusif). */
export function akhirHariWib(tanggal: TanggalISO): Date {
  return new Date(awalHariWib(tanggal).getTime() + 86_400_000);
}
