import {
  PREDIKAT,
  type BobotKinerja,
  type BobotMgmp,
  type PredikatKinerja,
  type PredikatMgmp,
} from '../constants';
import { batasiSkor, bulatkan2 } from './angka';
import { rentangBulan, type TanggalISO } from './tanggal';

export interface SkorKinerja {
  skor_kehadiran: number;
  skor_administrasi_avg: number;
  /** Kosong (null/undefined) atau 0 → rumus tanpa manajemen. */
  skor_manajemen_avg?: number | null;
}

/**
 * Skor akhir penilaian kinerja bulanan (§6.4).
 * - manajemen kosong atau 0 → kehadiran + administrasi (default 50/50);
 * - manajemen ada → kehadiran + administrasi + manajemen (default 50/30/20).
 * Bobot dalam persen, dibaca dari `sekolah_settings`. Pembulatan hanya di nilai akhir.
 */
export function skorAkhirKinerja(skor: SkorKinerja, bobot: BobotKinerja): number {
  const kehadiran = batasiSkor(skor.skor_kehadiran);
  const administrasi = batasiSkor(skor.skor_administrasi_avg);
  const manajemen = batasiSkor(skor.skor_manajemen_avg ?? 0);

  if (manajemen > 0) {
    const b = bobot.dengan_manajemen;
    return bulatkan2(
      batasiSkor(
        (kehadiran * b.kehadiran + administrasi * b.administrasi + manajemen * b.manajemen) / 100,
      ),
    );
  }
  const b = bobot.tanpa_manajemen;
  return bulatkan2(batasiSkor((kehadiran * b.kehadiran + administrasi * b.administrasi) / 100));
}

export interface SkorMgmp {
  skor_kehadiran: number;
  skor_siswa: number;
  skor_administrasi: number;
}

/**
 * Skor siswa MGMP (§6.5): rata-rata skor yang sudah diisi sekretaris tiap kelas
 * (`penilaian_mgmp_siswa`). Kelas yang belum mengisi tidak ikut dirata-rata; 0 bila
 * belum ada kelas yang mengisi. Pembulatan hanya di hasil akhir.
 */
export function skorSiswaMgmp(skorPerKelas: readonly number[]): number {
  if (skorPerKelas.length === 0) return 0;
  const jumlah = skorPerKelas.reduce((s, n) => s + batasiSkor(n), 0);
  return bulatkan2(jumlah / skorPerKelas.length);
}

/**
 * Kelas yang wajib mengisi skor siswa tiap MGMP: kelas yang punya jadwal mengajar dari guru
 * aktif anggota MGMP itu. Hasil: MGMP → ID kelas unik, terurut.
 *
 * @param jadwal jadwal guru AKTIF yang punya MGMP (`mgmp_id` guru, `kelas_id` jadwal).
 */
export function kelasBerjadwalPerMgmp(
  jadwal: readonly { mgmp_id: number; kelas_id: number }[],
): Map<number, number[]> {
  const peta = new Map<number, Set<number>>();
  for (const j of jadwal) {
    const set = peta.get(j.mgmp_id) ?? new Set<number>();
    set.add(j.kelas_id);
    peta.set(j.mgmp_id, set);
  }
  return new Map([...peta].map(([m, s]) => [m, [...s].sort((a, b) => a - b)]));
}

export interface RingkasanSkorSiswaMgmp {
  /** Rata-rata skor kelas berjadwal yang sudah mengisi (`skorSiswaMgmp`). */
  skor_siswa: number;
  /** n: kelas berjadwal yang sudah mengisi. */
  kelas_terisi: number;
  /** m: kelas berjadwal (punya jadwal dari guru aktif MGMP itu). */
  jumlah_kelas: number;
}

/**
 * Skor siswa MGMP dan "n dari m kelas" (§6.5). Hanya isian dari kelas berjadwal yang
 * dihitung; isian dari kelas lain (mis. jadwal sudah berubah) disimpan tetapi diabaikan.
 * MGMP tanpa jadwal → 0 dari 0 kelas, skor 0.
 */
export function ringkasanSkorSiswaMgmp(
  kelasBerjadwal: readonly number[],
  isian: readonly { kelas_id: number; skor: number }[],
): RingkasanSkorSiswaMgmp {
  const berjadwal = new Set(kelasBerjadwal);
  const dihitung = isian.filter((i) => berjadwal.has(i.kelas_id));
  return {
    skor_siswa: skorSiswaMgmp(dihitung.map((i) => i.skor)),
    kelas_terisi: new Set(dihitung.map((i) => i.kelas_id)).size,
    jumlah_kelas: berjadwal.size,
  };
}

/** Skor akhir MGMP (§6.5): kehadiran + siswa + administrasi (default 40/30/30). */
export function skorAkhirMgmp(skor: SkorMgmp, bobot: BobotMgmp): number {
  const nilai =
    (batasiSkor(skor.skor_kehadiran) * bobot.kehadiran +
      batasiSkor(skor.skor_siswa) * bobot.siswa +
      batasiSkor(skor.skor_administrasi) * bobot.administrasi) /
    100;
  return bulatkan2(batasiSkor(nilai));
}

function cariPredikat<L extends string>(
  skor: number,
  ambang: readonly { min: number; label: L }[],
): L {
  const terakhir = ambang[ambang.length - 1];
  if (!terakhir) throw new Error('Daftar ambang predikat kosong.');
  return ambang.find((a) => skor >= a.min)?.label ?? terakhir.label;
}

/** ≥91 Sangat Baik · ≥76 Baik · ≥61 Cukup · selain itu Kurang. */
export function predikatKinerja(skor: number): PredikatKinerja {
  return cariPredikat(skor, PREDIKAT.kinerja);
}

/** ≥90 Sangat Aktif · ≥75 Aktif · ≥60 Cukup Aktif · selain itu Kurang Aktif. */
export function predikatMgmp(skor: number): PredikatMgmp {
  return cariPredikat(skor, PREDIKAT.mgmp);
}

/** Jumlah bobot harus tepat 100. */
export function apakahBobotValid(bobot: readonly number[]): boolean {
  return (
    bobot.every((b) => Number.isFinite(b) && b >= 0 && b <= 100) &&
    Math.abs(bobot.reduce((s, b) => s + b, 0) - 100) < 1e-9
  );
}

export interface JendelaPenilaian {
  /** Hari pertama jendela. */
  buka: TanggalISO;
  /** Hari terakhir bulan (tenggat). */
  tutup: TanggalISO;
  terbuka: boolean;
}

/**
 * Jendela penilaian (§6.4): pengisian untuk periode (`bulan`, `tahun`) dibuka pada
 * `jendelaHari` hari terakhir bulan itu. `hariIni` adalah tanggal di zona Asia/Jakarta.
 */
export function jendelaPenilaian(
  hariIni: TanggalISO,
  bulan: number,
  tahun: number,
  jendelaHari: number,
): JendelaPenilaian {
  const { awal, akhir } = rentangBulan(bulan, tahun);
  const jumlahHari = Number(akhir.slice(8, 10));
  const n = Math.min(jumlahHari, Math.max(1, Math.trunc(jendelaHari)));
  const hariBuka = jumlahHari - n + 1;
  const buka = `${awal.slice(0, 8)}${String(hariBuka).padStart(2, '0')}`;
  return { buka, tutup: akhir, terbuka: hariIni >= buka && hariIni <= akhir };
}
