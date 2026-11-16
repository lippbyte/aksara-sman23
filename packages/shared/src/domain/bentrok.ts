export interface RentangJam {
  /** Diisi untuk catatan yang sudah tersimpan; dipakai mengabaikan dirinya sendiri saat ubah. */
  id?: number | bigint | null;
  jam_ke: number;
  lama_jam: number;
}

function jamTerakhir(c: RentangJam): number {
  return c.jam_ke + c.lama_jam - 1;
}

function idSama(a: RentangJam['id'], b: RentangJam['id']): boolean {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  return String(a) === String(b);
}

/**
 * Catatan lama yang rentang jamnya `[jam_ke, jam_ke + lama_jam − 1]` beririsan dengan
 * catatan baru (§6.1). `daftarLama` harus berisi catatan guru dan tanggal yang sama.
 * Catatan dengan `id` yang sama dengan `baru.id` diabaikan (kasus ubah).
 */
export function cariJamBentrok<T extends RentangJam>(
  baru: RentangJam,
  daftarLama: readonly T[],
): T[] {
  const awalBaru = baru.jam_ke;
  const akhirBaru = jamTerakhir(baru);
  return daftarLama.filter(
    (lama) =>
      !idSama(lama.id, baru.id) && lama.jam_ke <= akhirBaru && jamTerakhir(lama) >= awalBaru,
  );
}

export function apakahJamBentrok(baru: RentangJam, daftarLama: readonly RentangJam[]): boolean {
  return cariJamBentrok(baru, daftarLama).length > 0;
}
