import type { StatusKehadiran, StatusTugas, TanggalISO } from '@sms/shared';
import type {
  StatusKehadiran as StatusKehadiranDb,
  StatusTugas as StatusTugasDb,
} from '../generated/prisma/enums';

/**
 * Konversi antara bentuk basis data (Prisma) dan bentuk API/domain.
 * - ID BIGINT → number (tepat sampai 2^53).
 * - DATE → string `YYYY-MM-DD`.
 * - DECIMAL → number.
 * - Enum berspasi: nilai di DB "Tidak Hadir", pengenal Prisma `Tidak_Hadir`.
 */

export function keNumber(id: bigint): number;
export function keNumber(id: bigint | null | undefined): number | null;
export function keNumber(id: bigint | null | undefined): number | null {
  return id === null || id === undefined ? null : Number(id);
}

/** DATE dari Prisma (tengah malam UTC) → `YYYY-MM-DD`. */
export function keTanggalISO(tanggal: Date): TanggalISO {
  return tanggal.toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` → Date tengah malam UTC untuk kolom DATE. */
export function keDate(tanggal: TanggalISO): Date {
  return new Date(`${tanggal}T00:00:00.000Z`);
}

export function keAngka(nilai: { toNumber(): number } | number): number;
export function keAngka(nilai: { toNumber(): number } | number | null): number | null;
export function keAngka(nilai: { toNumber(): number } | number | null): number | null {
  if (nilai === null) return null;
  return typeof nilai === 'number' ? nilai : nilai.toNumber();
}

const STATUS_KEHADIRAN_KE_DB: Record<StatusKehadiran, StatusKehadiranDb> = {
  Hadir: 'Hadir',
  Mendampingi: 'Mendampingi',
  'Tidak Hadir': 'Tidak_Hadir',
};
const STATUS_KEHADIRAN_DARI_DB: Record<StatusKehadiranDb, StatusKehadiran> = {
  Hadir: 'Hadir',
  Mendampingi: 'Mendampingi',
  Tidak_Hadir: 'Tidak Hadir',
};
const STATUS_TUGAS_KE_DB: Record<StatusTugas, StatusTugasDb> = {
  Ada: 'Ada',
  'Tidak Ada': 'Tidak_Ada',
};
const STATUS_TUGAS_DARI_DB: Record<StatusTugasDb, StatusTugas> = {
  Ada: 'Ada',
  Tidak_Ada: 'Tidak Ada',
};

export const statusKehadiranKeDb = (s: StatusKehadiran): StatusKehadiranDb =>
  STATUS_KEHADIRAN_KE_DB[s];
export const statusKehadiranDariDb = (s: StatusKehadiranDb): StatusKehadiran =>
  STATUS_KEHADIRAN_DARI_DB[s];
export const statusTugasKeDb = (s: StatusTugas): StatusTugasDb => STATUS_TUGAS_KE_DB[s];
export const statusTugasDariDb = (s: StatusTugasDb): StatusTugas => STATUS_TUGAS_DARI_DB[s];
