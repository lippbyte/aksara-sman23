import {
  penilaianKinerjaQuerySchema,
  periodeSchema,
  simpanPenilaianKinerjaSchema,
  syncPenilaianSchema,
  type PenilaianKinerjaBaris,
} from '@sms/shared';
import { Router } from 'express';
import { catatAudit } from '../../lib/audit';
import { keCsv, kirimCsv, type KolomCsv } from '../../lib/csv';
import { namaPeriode } from '../../lib/penilaian';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import * as service from './service';

/** Penilaian kinerja bulanan: admin, manajemen_guru, guru_penilai (PROJECT-CONTEXT §4). */
export const penilaianKinerjaRouter = Router();
penilaianKinerjaRouter.use(requireAuth, requireRole('admin', 'manajemen_guru', 'guru_penilai'));

penilaianKinerjaRouter.get(
  '/',
  validate({ query: penilaianKinerjaQuerySchema }, ({ query }) => service.daftar(query)),
);

penilaianKinerjaRouter.post(
  '/sync',
  validate({ body: syncPenilaianSchema }, async ({ body, audit }) => ({
    data: await service.sinkron(body, audit),
  })),
);

penilaianKinerjaRouter.put(
  '/',
  validate({ body: simpanPenilaianKinerjaSchema }, async ({ body, user, audit }) => ({
    data: await service.simpan(body, user, audit),
  })),
);

const angka2 = (n: number | null) => (n === null ? '' : n.toFixed(2));
const KOLOM_CSV: KolomCsv<PenilaianKinerjaBaris>[] = [
  { judul: 'Kode Guru', nilai: (b) => b.kode_guru },
  { judul: 'Nama Guru', nilai: (b) => b.nama_guru },
  { judul: 'Mata Pelajaran', nilai: (b) => b.mata_pelajaran },
  { judul: 'Skor Kehadiran', nilai: (b) => angka2(b.skor_kehadiran) },
  { judul: 'Skor Administrasi', nilai: (b) => angka2(b.skor_administrasi_avg) },
  { judul: 'Skor Manajemen', nilai: (b) => angka2(b.skor_manajemen_avg) },
  { judul: 'Skor Akhir', nilai: (b) => angka2(b.skor_akhir) },
  { judul: 'Predikat', nilai: (b) => b.predikat ?? 'Belum dinilai' },
  { judul: 'Catatan', nilai: (b) => b.catatan },
  { judul: 'Penilai', nilai: (b) => b.nama_penilai },
];

penilaianKinerjaRouter.get(
  '/export',
  validate({ query: periodeSchema }, async ({ res, query, audit }) => {
    const rows = await service.semua(query);
    await catatAudit(prisma, audit, {
      module: 'Penilaian',
      aktivitas: 'EXPORT_PENILAIAN_KINERJA',
      entity_type: 'penilaian_kinerja_bulanan',
      description: `Mengekspor penilaian kinerja ${namaPeriode(query)}, ${rows.length} baris.`,
    });
    const bulan = String(query.bulan).padStart(2, '0');
    kirimCsv(res, `penilaian-kinerja_${query.tahun}-${bulan}.csv`, keCsv(KOLOM_CSV, rows));
  }),
);
