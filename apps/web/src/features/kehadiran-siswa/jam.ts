import type { JadwalHari } from '@sms/shared';

/** Keterangan tampilan satu jam pelajaran di pemilih jam absensi siswa. */
export interface InfoJam {
  /** Mapel terjadwal yang mencakup jam ini (hanya petunjuk; D7 opsi a). */
  mapel?: string;
  /** Absensi siswa kelas ini untuk jam ini sudah tersimpan pada tanggal itu. */
  tersimpan?: boolean;
}

/** Item pemilih berbasis jadwal pelajaran untuk komponen `PilihJam`. */
export interface ItemJadwalJam {
  jam_ke: number;
  jam_akhir: number;
  judul: string;
  subjudul: string;
  tersimpan?: boolean;
}

/**
 * Susun opsi pemilih berbasis jadwal pelajaran pada hari itu, digabung dengan jam yang
 * sudah tersimpan di luar jadwal agar data tersimpan tetap bisa diakses.
 */
export function buatOpsiJadwal(
  jadwal: readonly Pick<JadwalHari, 'jam_ke' | 'total_jam_mengajar' | 'mata_pelajaran'>[],
  jamTersimpan: Iterable<number>,
): ItemJadwalJam[] {
  const tersimpanSet = new Set(jamTersimpan);
  const perJamMulai = new Map<number, { mapel: string; akhir: number }>();

  for (const j of jadwal) {
    const akhir = j.jam_ke + Math.max(1, j.total_jam_mengajar) - 1;
    const ada = perJamMulai.get(j.jam_ke);
    if (ada) {
      perJamMulai.set(j.jam_ke, {
        mapel: `${ada.mapel} / ${j.mata_pelajaran}`,
        akhir: Math.max(ada.akhir, akhir),
      });
    } else {
      perJamMulai.set(j.jam_ke, { mapel: j.mata_pelajaran, akhir });
    }
  }

  const hasil: ItemJadwalJam[] = [];
  const tercakup = new Set<number>();

  for (const [jamKe, data] of [...perJamMulai.entries()].sort(([a], [b]) => a - b)) {
    let sudahTersimpan = false;
    for (let jam = jamKe; jam <= data.akhir; jam += 1) {
      tercakup.add(jam);
      if (tersimpanSet.has(jam)) sudahTersimpan = true;
    }
    hasil.push({
      jam_ke: jamKe,
      jam_akhir: data.akhir,
      judul: data.mapel,
      subjudul: data.akhir > jamKe ? `Jam ${jamKe}–${data.akhir}` : `Jam ${jamKe}`,
      tersimpan: sudahTersimpan,
    });
  }

  for (const jam of [...tersimpanSet].sort((a, b) => a - b)) {
    if (!tercakup.has(jam)) {
      hasil.push({
        jam_ke: jam,
        jam_akhir: jam,
        judul: `Jam ke-${jam}`,
        subjudul: 'Di luar jadwal',
        tersimpan: true,
      });
    }
  }

  return hasil.sort((a, b) => a.jam_ke - b.jam_ke);
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
