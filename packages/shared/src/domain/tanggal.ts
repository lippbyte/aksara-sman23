/**
 * Helper tanggal kalender murni. Tanggal domain selalu string `YYYY-MM-DD`
 * (tanpa jam dan zona waktu) supaya hasil tidak bergantung pada zona mesin.
 */

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_HARI = 86_400_000;

export type TanggalISO = string;

function keUtc(tanggal: TanggalISO): number {
  const cocok = POLA_TANGGAL.exec(tanggal);
  if (!cocok) throw new RangeError(`Tanggal tidak valid: "${tanggal}" (harus YYYY-MM-DD)`);
  const [, y, m, d] = cocok;
  const tahun = Number(y);
  const bulan = Number(m);
  const hari = Number(d);
  const ms = Date.UTC(tahun, bulan - 1, hari);
  const cek = new Date(ms);
  if (
    cek.getUTCFullYear() !== tahun ||
    cek.getUTCMonth() !== bulan - 1 ||
    cek.getUTCDate() !== hari
  ) {
    throw new RangeError(`Tanggal tidak ada di kalender: "${tanggal}"`);
  }
  return ms;
}

function dariUtc(ms: number): TanggalISO {
  return new Date(ms).toISOString().slice(0, 10);
}

export function apakahTanggalValid(tanggal: string): boolean {
  try {
    keUtc(tanggal);
    return true;
  } catch {
    return false;
  }
}

export function tambahHari(tanggal: TanggalISO, jumlah: number): TanggalISO {
  return dariUtc(keUtc(tanggal) + jumlah * MS_PER_HARI);
}

/** `b − a` dalam hari. */
export function selisihHari(a: TanggalISO, b: TanggalISO): number {
  return Math.round((keUtc(b) - keUtc(a)) / MS_PER_HARI);
}

/** 1 = Senin … 7 = Minggu. */
export function hariDalamPekan(tanggal: TanggalISO): number {
  const h = new Date(keUtc(tanggal)).getUTCDay();
  return h === 0 ? 7 : h;
}

/** Senin pada pekan yang memuat `tanggal`. */
export function seninDari(tanggal: TanggalISO): TanggalISO {
  return tambahHari(tanggal, 1 - hariDalamPekan(tanggal));
}

export function tahunDari(tanggal: TanggalISO): number {
  return new Date(keUtc(tanggal)).getUTCFullYear();
}

export function bulanDari(tanggal: TanggalISO): number {
  return new Date(keUtc(tanggal)).getUTCMonth() + 1;
}

/** Tanggal pertama dan terakhir sebuah bulan (bulan 1–12). */
export function rentangBulan(
  bulan: number,
  tahun: number,
): { awal: TanggalISO; akhir: TanggalISO } {
  if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
    throw new RangeError(`Bulan tidak valid: ${bulan}`);
  }
  if (!Number.isInteger(tahun)) throw new RangeError(`Tahun tidak valid: ${tahun}`);
  return {
    awal: dariUtc(Date.UTC(tahun, bulan - 1, 1)),
    akhir: dariUtc(Date.UTC(tahun, bulan, 0)),
  };
}

/** Tanggal kalender (YYYY-MM-DD) dari sebuah instan pada zona waktu tertentu. */
export function tanggalDiZona(instan: Date, zona = 'Asia/Jakarta'): TanggalISO {
  const bagian = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instan);
  const ambil = (jenis: string) => bagian.find((b) => b.type === jenis)?.value ?? '';
  return `${ambil('year')}-${ambil('month')}-${ambil('day')}`;
}
