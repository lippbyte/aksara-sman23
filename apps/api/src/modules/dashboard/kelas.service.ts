import {
  hariDalamPekan,
  STATUS_KEHADIRAN,
  type DashboardKelas,
  type DashboardKelasQuery,
  type StatusKehadiran,
} from '@sms/shared';
import { forbidden, notFound } from '../../lib/errors';
import { hariIni } from '../../lib/waktu';
import * as kehadiranRepo from '../kehadiran/repo';

function nol(): Record<StatusKehadiran, number> {
  return { Hadir: 0, Mendampingi: 0, 'Tidak Hadir': 0 };
}

/**
 * Dashboard kelas: jurnal mengajar satu tanggal, hitungan per status, dan jadwal hari itu.
 * Sekretaris hanya boleh membuka kelasnya sendiri.
 */
export async function dashboardKelas(
  kelasId: number,
  q: DashboardKelasQuery,
  kelasScope: number | null,
): Promise<DashboardKelas> {
  if (kelasScope !== null && kelasScope !== kelasId) {
    throw forbidden('Anda hanya dapat melihat dashboard kelas Anda sendiri.');
  }
  const kelas = await kehadiranRepo.ambilKelas(kelasId);
  if (!kelas) throw notFound('Kelas tidak ditemukan.');

  const tanggal = q.tanggal ?? hariIni();
  const [semuaHariItu, jadwal] = await Promise.all([
    kehadiranRepo.semua({ tanggal, kelas_id: kelasId }, kelasScope),
    kehadiranRepo.jadwalHari(kelasId, hariDalamPekan(tanggal), tanggal),
  ]);

  // Hitungan selalu dari seluruh catatan hari itu; filter hanya menyaring jurnal.
  const hitungan = nol();
  const jam = nol();
  for (const k of semuaHariItu) {
    hitungan[k.status_kehadiran] += 1;
    jam[k.status_kehadiran] += k.lama_jam;
  }

  const jurnal = semuaHariItu.filter(
    (k) =>
      (q.guru_id === undefined || k.guru_id === q.guru_id) &&
      (q.status === undefined || k.status_kehadiran === q.status),
  );

  return { kelas, tanggal, hitungan, jam, jurnal, jadwal };
}

export const URUTAN_STATUS = STATUS_KEHADIRAN;
