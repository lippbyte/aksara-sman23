import {
  idParamSchema,
  rekapFilterSchema,
  rekapQuerySchema,
  syncRekapSchema,
  ubahRekapSchema,
  type Rekap,
  type RekapFilter,
} from '@sms/shared';
import { Router } from 'express';
import { catatAudit } from '../../lib/audit';
import { keCsv, kirimCsv, type KolomCsv } from '../../lib/csv';
import { prisma } from '../../lib/prisma';
import { hariIni } from '../../lib/waktu';
import { requireAuth, requireRole } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import * as repo from './repo';
import * as service from './service';

/** Rekap kehadiran guru: lihat, sinkron, ubah, hapus, ekspor → admin dan manajemen_guru (§4). */
export const rekapRouter = Router();
rekapRouter.use(requireAuth, requireRole('admin', 'manajemen_guru'));

rekapRouter.get(
  '/',
  validate({ query: rekapQuerySchema }, ({ query }) => service.daftar(query)),
);

rekapRouter.get(
  '/pekan',
  validate({}, async () => ({ data: await service.daftarPekan() })),
);

rekapRouter.get(
  '/mapel',
  validate({}, async () => ({ data: await repo.daftarMapel() })),
);

const KOLOM_CSV: KolomCsv<Rekap>[] = [
  { judul: 'Tahun', nilai: (r) => r.tahun },
  { judul: 'Pekan', nilai: (r) => r.minggu_ke },
  { judul: 'Tanggal Mulai', nilai: (r) => r.tanggal_mulai },
  { judul: 'Tanggal Selesai', nilai: (r) => r.tanggal_selesai },
  { judul: 'Kode Guru', nilai: (r) => r.kode_guru },
  { judul: 'Nama Guru', nilai: (r) => r.nama_guru },
  { judul: 'Mata Pelajaran', nilai: (r) => r.mata_pelajaran },
  { judul: 'Jam Wajib', nilai: (r) => r.total_jam_wajib },
  { judul: 'Jam Hadir', nilai: (r) => r.total_jam_hadir },
  { judul: 'Persentase Kehadiran', nilai: (r) => r.persentase_kehadiran.toFixed(2) },
];

function uraianFilter(f: RekapFilter): string {
  const bagian = [
    f.minggu_ke !== undefined ? `pekan ${f.minggu_ke}/${f.tahun}` : 'semua pekan',
    f.guru_id !== undefined ? `guru #${f.guru_id}` : null,
    f.mapel ? `mapel ${f.mapel}` : null,
    f.kelas_id !== undefined ? `kelas #${f.kelas_id}` : null,
    f.tanggal_dari || f.tanggal_sampai
      ? `${f.tanggal_dari ?? 'awal'} s.d. ${f.tanggal_sampai ?? 'akhir'}`
      : null,
  ];
  return bagian.filter(Boolean).join(', ');
}

rekapRouter.get(
  '/export',
  validate({ query: rekapFilterSchema }, async ({ res, query, audit }) => {
    const { rows } = await repo.daftar(query);
    await catatAudit(prisma, audit, {
      module: 'Rekap',
      aktivitas: 'EXPORT_REKAP',
      entity_type: 'rekap_kehadiran_guru',
      description: `Mengekspor rekap kehadiran guru (${uraianFilter(query)}), ${rows.length} baris.`,
    });
    const nama =
      query.minggu_ke !== undefined
        ? `rekap-kehadiran-guru_pekan-${query.minggu_ke}-${query.tahun}`
        : 'rekap-kehadiran-guru';
    kirimCsv(res, `${nama}_${hariIni()}.csv`, keCsv(KOLOM_CSV, rows));
  }),
);

rekapRouter.post(
  '/sync',
  validate({ body: syncRekapSchema }, async ({ body, audit }) => ({
    data: await service.sinkron(body, audit),
  })),
);

rekapRouter.put(
  '/:id',
  validate({ params: idParamSchema, body: ubahRekapSchema }, async ({ params, body, audit }) => ({
    data: await service.ubah(params.id, body, audit),
  })),
);

rekapRouter.delete(
  '/:id',
  validate({ params: idParamSchema }, ({ params, audit }) => service.hapus(params.id, audit)),
);
