import { Router } from 'express';
import { requireAuth, requireRole, scopeKelas } from '../../middleware/requireAuth';
import * as controller from './controller';

/**
 * Kehadiran guru (PROJECT-CONTEXT §4):
 * lihat, tambah, ubah → semua peran (sekretaris hanya kelasnya);
 * hapus → admin, manajemen_guru, sekretaris (kelasnya); guru_penilai tidak boleh.
 */
export const kehadiranRouter = Router();
kehadiranRouter.use(
  requireAuth,
  requireRole('admin', 'manajemen_guru', 'sekretaris_kelas', 'guru_penilai'),
  scopeKelas,
);

kehadiranRouter.get('/', controller.daftar);
kehadiranRouter.get('/jadwal', controller.jadwalHari);
kehadiranRouter.get('/:id', controller.ambil);
kehadiranRouter.post('/', controller.buat);
kehadiranRouter.put('/:id', controller.ubah);
kehadiranRouter.delete(
  '/:id',
  requireRole('admin', 'manajemen_guru', 'sekretaris_kelas'),
  controller.hapus,
);
