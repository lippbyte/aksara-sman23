import {
  periodeSchema,
  simpanPenilaianMgmpSchema,
  simpanSkorSiswaMgmpSchema,
  skorSiswaMgmpQuerySchema,
  syncPenilaianSchema,
  type PenilaianMgmpBaris,
} from '@sms/shared';
import { Router } from 'express';
import { catatAudit } from '../../lib/audit';
import { keCsv, kirimCsv, type KolomCsv } from '../../lib/csv';
import { namaPeriode } from '../../lib/penilaian';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole, scopeKelas } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import * as service from './service';

/**
 * Penilaian MGMP: admin, manajemen_guru, guru_penilai penuh;
 * sekretaris_kelas hanya melihat dan mengisi skor siswa KELASNYA (PROJECT-CONTEXT §4).
 */
export const penilaianMgmpRouter = Router();
penilaianMgmpRouter.use(
  requireAuth,
  requireRole('admin', 'manajemen_guru', 'sekretaris_kelas', 'guru_penilai'),
);
const bukanSekretaris = requireRole('admin', 'manajemen_guru', 'guru_penilai');

penilaianMgmpRouter.get(
  '/',
  validate({ query: periodeSchema }, ({ query, user }) => service.daftar(query, user)),
);

penilaianMgmpRouter.put(
  '/',
  bukanSekretaris,
  validate({ body: simpanPenilaianMgmpSchema }, async ({ body, user, audit }) => ({
    data: await service.simpan(body, user, audit),
  })),
);

/** Skor siswa per kelas: sekretaris hanya kelasnya; peran lain semua kelas. */
penilaianMgmpRouter.get(
  '/skor-siswa',
  scopeKelas,
  validate({ query: skorSiswaMgmpQuerySchema }, async ({ query, kelasScope }) => ({
    data: await service.rincianSkorSiswa(query, kelasScope),
  })),
);

penilaianMgmpRouter.put(
  '/skor-siswa',
  scopeKelas,
  validate({ body: simpanSkorSiswaMgmpSchema }, async ({ body, user, kelasScope, audit }) => ({
    data: await service.simpanSkorSiswa(body, user, kelasScope, audit),
  })),
);

penilaianMgmpRouter.post(
  '/sync',
  bukanSekretaris,
  validate({ body: syncPenilaianSchema }, async ({ body, audit }) => ({
    data: await service.sinkron(body, audit),
  })),
);

const angka2 = (n: number | null) => (n === null ? '' : n.toFixed(2));
const KOLOM_CSV: KolomCsv<PenilaianMgmpBaris>[] = [
  { judul: 'MGMP', nilai: (b) => b.nama_mapel },
  { judul: 'Guru Aktif', nilai: (b) => b.jumlah_guru_aktif },
  { judul: 'Skor Kehadiran', nilai: (b) => angka2(b.skor_kehadiran) },
  { judul: 'Skor Siswa', nilai: (b) => angka2(b.skor_siswa) },
  { judul: 'Kelas Mengisi', nilai: (b) => `${b.kelas_terisi} dari ${b.jumlah_kelas}` },
  { judul: 'Skor Administrasi', nilai: (b) => angka2(b.skor_administrasi) },
  { judul: 'Skor Akhir', nilai: (b) => angka2(b.skor_akhir) },
  { judul: 'Predikat', nilai: (b) => b.predikat ?? 'Belum dinilai' },
  { judul: 'Catatan', nilai: (b) => b.catatan },
  { judul: 'Penilai', nilai: (b) => b.nama_penilai },
];

penilaianMgmpRouter.get(
  '/export',
  bukanSekretaris,
  validate({ query: periodeSchema }, async ({ res, query, user, audit }) => {
    const { data } = await service.daftar(query, user);
    await catatAudit(prisma, audit, {
      module: 'Penilaian',
      aktivitas: 'EXPORT_PENILAIAN_MGMP',
      entity_type: 'penilaian_mgmp',
      description: `Mengekspor penilaian MGMP ${namaPeriode(query)}, ${data.length} baris.`,
    });
    const bulan = String(query.bulan).padStart(2, '0');
    kirimCsv(res, `penilaian-mgmp_${query.tahun}-${bulan}.csv`, keCsv(KOLOM_CSV, data));
  }),
);
