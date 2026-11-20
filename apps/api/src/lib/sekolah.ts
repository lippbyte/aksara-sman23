import type { BobotKinerja, BobotMgmp, PengaturanPekan } from '@sms/shared';
import { z } from 'zod';
import { businessRule } from './errors';
import { keAngka, keNumber, keTanggalISO } from './konversi';
import type { Db } from './prisma';

const hariEfektifSchema = z.array(z.number().int().min(1).max(7)).min(1);

export interface PengaturanSekolah {
  id: number;
  nama_sekolah: string;
  logo_path: string | null;
  tahun_ajaran: string;
  pekan: PengaturanPekan;
  bobot: { kinerja: BobotKinerja; mgmp: BobotMgmp };
  jendela_penilaian_hari: number;
}

export function uraiHariEfektif(nilai: unknown): number[] {
  const hasil = hariEfektifSchema.safeParse(nilai);
  if (!hasil.success) {
    throw businessRule('Hari efektif di pengaturan sekolah tidak valid. Perbaiki di Pengaturan.');
  }
  return hasil.data;
}

/**
 * Pengaturan sekolah dalam bentuk yang dipakai fungsi domain.
 * Tanggal awal pekan, hari efektif, bobot, dan jendela penilaian selalu dibaca dari sini
 * (AGENTS §5), tidak di-hardcode.
 */
export async function ambilPengaturan(db: Db): Promise<PengaturanSekolah> {
  const s = await db.sekolahSettings.findFirst({ orderBy: { id: 'asc' } });
  if (!s) {
    throw businessRule('Pengaturan sekolah belum diisi. Minta admin melengkapinya di Pengaturan.');
  }
  return {
    id: keNumber(s.id),
    nama_sekolah: s.nama_sekolah,
    logo_path: s.logo_path,
    tahun_ajaran: s.tahun_ajaran,
    pekan: {
      tanggal_awal_pekan: keTanggalISO(s.tanggal_awal_pekan),
      hari_efektif: uraiHariEfektif(s.hari_efektif),
    },
    bobot: {
      kinerja: {
        dengan_manajemen: {
          kehadiran: keAngka(s.bobot_kinerja_kehadiran),
          administrasi: keAngka(s.bobot_kinerja_administrasi),
          manajemen: keAngka(s.bobot_kinerja_manajemen),
        },
        tanpa_manajemen: {
          kehadiran: keAngka(s.bobot_kinerja_kehadiran_tanpa_manajemen),
          administrasi: keAngka(s.bobot_kinerja_administrasi_tanpa_manajemen),
        },
      },
      mgmp: {
        kehadiran: keAngka(s.bobot_mgmp_kehadiran),
        siswa: keAngka(s.bobot_mgmp_siswa),
        administrasi: keAngka(s.bobot_mgmp_administrasi),
      },
    },
    jendela_penilaian_hari: s.jendela_penilaian_hari,
  };
}

export function urlLogo(logoPath: string | null): string | null {
  return logoPath ? `/api/v1/sekolah/logo?v=${encodeURIComponent(logoPath)}` : null;
}

export function urlLatarMasuk(latarPath: string | null): string | null {
  return latarPath ? `/api/v1/sekolah/latar/masuk?v=${encodeURIComponent(latarPath)}` : null;
}

export function urlLatarDashboard(latarPath: string | null): string | null {
  return latarPath ? `/api/v1/sekolah/latar/dashboard?v=${encodeURIComponent(latarPath)}` : null;
}
