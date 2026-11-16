import {
  idOpsionalQuery,
  type RefGuru,
  type RefKelas,
  type RefMgmp,
  type RefSiswa,
} from '@sms/shared';
import { Router } from 'express';
import { z } from 'zod';
import { keNumber } from '../../lib/konversi';
import { prisma } from '../../lib/prisma';
import { requireAuth, requireRole, scopeKelas } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';

/**
 * Pilihan dropdown (ID + nama saja) untuk semua pengguna yang sudah masuk.
 * Rute /settings hanya untuk admin, sedangkan form absensi dan penilaian
 * membutuhkan daftar kelas, guru, dan MGMP.
 */
export const referensiRouter = Router();
referensiRouter.use(requireAuth, scopeKelas);

referensiRouter.get(
  '/kelas',
  validate({}, async ({ kelasScope }) => {
    // Sekretaris hanya melihat kelasnya sendiri.
    const rows = await prisma.kelas.findMany({
      where: kelasScope !== null ? { id: kelasScope } : {},
      select: { id: true, nama_kelas: true },
      orderBy: { nama_kelas: 'asc' },
    });
    const data: RefKelas[] = rows.map((k) => ({ id: keNumber(k.id), nama_kelas: k.nama_kelas }));
    return { data };
  }),
);

referensiRouter.get(
  '/guru',
  validate({}, async () => {
    const rows = await prisma.guru.findMany({
      where: { status: 'aktif' },
      select: { id: true, kode_guru: true, nama_guru: true, mata_pelajaran: true },
      orderBy: { nama_guru: 'asc' },
    });
    const data: RefGuru[] = rows.map((g) => ({ ...g, id: keNumber(g.id) }));
    return { data };
  }),
);

referensiRouter.get(
  '/mgmp',
  validate({}, async () => {
    const rows = await prisma.mgmp.findMany({
      select: { id: true, nama_mapel: true },
      orderBy: { nama_mapel: 'asc' },
    });
    const data: RefMgmp[] = rows.map((m) => ({ id: keNumber(m.id), nama_mapel: m.nama_mapel }));
    return { data };
  }),
);

/**
 * Daftar siswa (data anak): hanya peran yang boleh melihat kehadiran siswa.
 * Sekretaris dibatasi ke kelasnya walau meminta kelas lain.
 */
referensiRouter.get(
  '/siswa',
  requireRole('admin', 'manajemen_guru', 'sekretaris_kelas'),
  validate({ query: z.object({ kelas_id: idOpsionalQuery }) }, async ({ query, kelasScope }) => {
    const kelasId = kelasScope ?? query.kelas_id;
    const rows = await prisma.siswa.findMany({
      where: kelasId !== undefined ? { kelas_id: kelasId } : {},
      select: { id: true, nis: true, nama_siswa: true, kelas_id: true },
      orderBy: { nama_siswa: 'asc' },
    });
    const data: RefSiswa[] = rows.map((r) => ({
      id: keNumber(r.id),
      nis: r.nis,
      nama_siswa: r.nama_siswa,
      kelas_id: keNumber(r.kelas_id),
    }));
    return { data };
  }),
);
