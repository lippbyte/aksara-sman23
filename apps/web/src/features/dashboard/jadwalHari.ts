import type { JadwalHari, Kehadiran } from '@sms/shared';

/** Satu baris daftar periksa "Jadwal hari ini" di dashboard kelas. */
export interface BarisJadwalHari {
  kunci: string;
  jam_ke: number;
  /** Jam terakhir (inklusif). */
  akhir: number;
  guru_id: number;
  nama_guru: string;
  mata_pelajaran: string;
  /** `false` = catatan tanpa slot jadwal yang cocok (mis. guru pengganti). */
  terjadwal: boolean;
  /** Catatan kehadiran yang mengisi slot ini, bila ada. */
  catatan: Kehadiran | null;
  tercatat: boolean;
}

/**
 * Gabungkan jadwal hari itu dengan catatan kehadiran (jurnal tanpa filter).
 *
 * Pencocokan mengikuti aturan server untuk `sudah_dicatat` (kehadiran/repo.ts `jadwalHari`):
 * slot tercatat bila ada catatan guru yang sama yang mencakup **jam awal** slot. Catatan yang
 * tidak dipakai slot mana pun ditampilkan sebagai "di luar jadwal" agar tidak ada yang hilang.
 */
export function susunJadwalHari(
  jadwal: readonly JadwalHari[],
  jurnal: readonly Kehadiran[],
): BarisJadwalHari[] {
  const dipakai = new Set<number>();
  const baris: BarisJadwalHari[] = jadwal.map((j) => {
    const catatan =
      jurnal.find(
        (k) =>
          k.guru_id === j.guru_id && k.jam_ke <= j.jam_ke && k.jam_ke + k.lama_jam - 1 >= j.jam_ke,
      ) ?? null;
    if (catatan) dipakai.add(catatan.id);
    return {
      kunci: `jadwal-${j.guru_id}-${j.jam_ke}`,
      jam_ke: j.jam_ke,
      akhir: j.jam_ke + Math.max(1, j.total_jam_mengajar) - 1,
      guru_id: j.guru_id,
      nama_guru: j.nama_guru,
      mata_pelajaran: j.mata_pelajaran,
      terjadwal: true,
      catatan,
      tercatat: j.sudah_dicatat || catatan !== null,
    };
  });

  for (const k of jurnal) {
    if (dipakai.has(k.id)) continue;
    baris.push({
      kunci: `catatan-${k.id}`,
      jam_ke: k.jam_ke,
      akhir: k.jam_ke + k.lama_jam - 1,
      guru_id: k.guru_id,
      nama_guru: k.nama_guru,
      mata_pelajaran: k.mata_pelajaran,
      terjadwal: false,
      catatan: k,
      tercatat: true,
    });
  }

  // Urut jam; pada jam yang sama, slot terjadwal lebih dulu.
  return baris.sort((a, b) => a.jam_ke - b.jam_ke || Number(b.terjadwal) - Number(a.terjadwal));
}

/** `1–2` atau `5`. */
export function labelRentang(b: { jam_ke: number; akhir: number }): string {
  return b.akhir > b.jam_ke ? `${b.jam_ke}–${b.akhir}` : String(b.jam_ke);
}
