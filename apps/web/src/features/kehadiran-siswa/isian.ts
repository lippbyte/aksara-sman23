import type { StatusSiswa } from '@sms/shared';

export interface IsianSiswa {
  status: StatusSiswa;
  keterangan: string;
}

export type PetaIsian = Map<number, IsianSiswa>;

export const samaIsian = (a: IsianSiswa, b: IsianSiswa) =>
  a.status === b.status && a.keterangan === b.keterangan;

/**
 * Gabung tiga arah saat data server berubah di tengah pengisian absensi: baris yang sudah
 * diubah pengguna dipertahankan; baris lain mengikuti server; siswa baru ikut, siswa yang
 * sudah tidak ada dibuang. Mencegah isian hilang saat data dimuat ulang (audit C2).
 */
export function gabungIsian(lokal: PetaIsian, dasarLama: PetaIsian, dasarBaru: PetaIsian) {
  const hasil: PetaIsian = new Map();
  for (const [id, baru] of dasarBaru) {
    const milikPengguna = lokal.get(id);
    const lama = dasarLama.get(id);
    hasil.set(id, milikPengguna && lama && !samaIsian(milikPengguna, lama) ? milikPengguna : baru);
  }
  return hasil;
}

/** Jumlah baris yang berbeda dari data server. */
export function hitungBerubah(isian: PetaIsian, dasar: PetaIsian): number {
  let n = 0;
  for (const [id, v] of isian) {
    const a = dasar.get(id);
    if (!a || !samaIsian(a, v)) n += 1;
  }
  return n;
}
