import {
  laporanSiswaFilterSchema,
  laporanSiswaQuerySchema,
  type LaporanSiswaBaris,
  type LaporanSiswaFilter,
} from '@sms/shared';
import { Router } from 'express';
import { catatAudit } from '../../lib/audit';
import { keCsv, kirimCsv, type KolomCsv } from '../../lib/csv';
import { prisma } from '../../lib/prisma';
import { hariIni } from '../../lib/waktu';
import { requireAuth, requireRole } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import * as repo from './repo';

/** Laporan rekap siswa + ekspor: admin dan manajemen_guru (PROJECT-CONTEXT §4). */
export const laporanRouter = Router();
laporanRouter.use(requireAuth, requireRole('admin', 'manajemen_guru'));

laporanRouter.get(
  '/siswa',
  validate({ query: laporanSiswaQuerySchema }, async ({ query }) => {
    const { page, pageSize, ...filter } = query;
    const hasil = await repo.laporanSiswa(filter, { page, pageSize });
    return { data: hasil.rows, meta: { page, pageSize, total: hasil.total } };
  }),
);

const KOLOM_CSV: KolomCsv<LaporanSiswaBaris>[] = [
  { judul: 'NIS', nilai: (b) => b.nis },
  { judul: 'Nama Siswa', nilai: (b) => b.nama_siswa },
  { judul: 'Kelas', nilai: (b) => b.nama_kelas },
  { judul: 'Hadir', nilai: (b) => b.hadir },
  { judul: 'Izin', nilai: (b) => b.izin },
  { judul: 'Sakit', nilai: (b) => b.sakit },
  { judul: 'Alpa', nilai: (b) => b.alpa },
  { judul: 'Total Catatan', nilai: (b) => b.total },
];

function uraianFilter(f: LaporanSiswaFilter, kelas: string | null): string {
  const bagian = [
    kelas ? `kelas ${kelas}` : 'semua kelas',
    f.siswa_id ? `siswa #${f.siswa_id}` : null,
    f.tanggal_dari || f.tanggal_sampai
      ? `${f.tanggal_dari ?? 'awal'} s.d. ${f.tanggal_sampai ?? 'akhir'}`
      : 'semua tanggal',
  ];
  return bagian.filter(Boolean).join(', ');
}

laporanRouter.get(
  '/siswa/export',
  validate({ query: laporanSiswaFilterSchema }, async ({ res, query, audit }) => {
    const { rows } = await repo.laporanSiswa(query);
    const kelas = query.kelas_id !== undefined ? await repo.namaKelas(query.kelas_id) : null;
    // Ekspor data anak selalu tercatat (AGENTS §6).
    await catatAudit(prisma, audit, {
      module: 'Laporan',
      aktivitas: 'EXPORT_LAPORAN_SISWA',
      entity_type: 'kehadiran_siswa',
      description: `Mengekspor laporan rekap siswa (${uraianFilter(query, kelas)}), ${rows.length} baris.`,
    });
    const bagianNama = ['laporan-siswa', kelas, query.tanggal_dari, query.tanggal_sampai]
      .filter(Boolean)
      .join('_');
    kirimCsv(res, `${bagianNama || 'laporan-siswa'}_${hariIni()}.csv`, keCsv(KOLOM_CSV, rows));
  }),
);
