import type { JadwalHari } from '@sms/shared';

/** Keterangan tampilan satu jam pelajaran di pemilih jam absensi siswa. */
export interface InfoJam {
  /** Mapel terjadwal yang mencakup jam ini (hanya petunjuk; D7 opsi a). */
  mapel?: string;
  /** Absensi siswa kelas ini untuk jam ini sudah tersimpan pada tanggal itu. */
  tersimpan?: boolean;
}

/**
 * Gabungkan jadwal hari itu dan daftar jam yang sudah tersimpan menjadi info per jam.
 * Slot jadwal `jam_ke` s.d. `jam_ke + total_jam_mengajar − 1` menandai semua jam yang
 * dicakupnya. Ini hanya tampilan: tidak ada aturan bahwa absensi siswa mengikuti jadwal
 * (keputusan D7 opsi a, docs/AUDIT-UIUX.md §10.4).
 */
export function petaInfoJam(
  jadwal: readonly Pick<JadwalHari, 'jam_ke' | 'total_jam_mengajar' | 'mata_pelajaran'>[],
  jamTersimpan: Iterable<number>,
): Map<number, InfoJam> {
  const peta = new Map<number, InfoJam>();
  for (const j of jadwal) {
    const lama = Math.max(1, j.total_jam_mengajar);
    for (let jam = j.jam_ke; jam < j.jam_ke + lama; jam += 1) {
      const ada = peta.get(jam);
      // Dua slot di jam yang sama (data jadwal bentrok): tampilkan keduanya, jangan pilih satu.
      const mapel = ada?.mapel ? `${ada.mapel} / ${j.mata_pelajaran}` : j.mata_pelajaran;
      peta.set(jam, { ...ada, mapel });
    }
  }
  for (const jam of jamTersimpan) {
    peta.set(jam, { ...peta.get(jam), tersimpan: true });
  }
  return peta;
}
