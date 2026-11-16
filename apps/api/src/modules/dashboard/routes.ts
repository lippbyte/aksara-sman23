import { dashboardKelasQuerySchema, idParamSchema } from '@sms/shared';
import { Router } from 'express';
import { requireAuth, requireRole, scopeKelas } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import { dashboardKelas } from './kelas.service';
import { penilai, ringkasan } from './ringkasan.service';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth, scopeKelas);

/** Dashboard utama: admin dan manajemen_guru (log aktivitas terbaru hanya untuk admin). */
dashboardRouter.get(
  '/ringkasan',
  requireRole('admin', 'manajemen_guru'),
  validate({}, async ({ user }) => ({ data: await ringkasan(user) })),
);

/** Dashboard ringkas penilai: guru_penilai, juga admin dan manajemen_guru. */
dashboardRouter.get(
  '/penilai',
  requireRole('admin', 'manajemen_guru', 'guru_penilai'),
  validate({}, async () => ({ data: await penilai() })),
);

/** Dashboard kelas: admin dan manajemen (semua kelas), sekretaris (kelasnya sendiri). */
dashboardRouter.get(
  '/kelas/:id',
  requireRole('admin', 'manajemen_guru', 'sekretaris_kelas'),
  validate(
    { params: idParamSchema, query: dashboardKelasQuerySchema },
    async ({ params, query, kelasScope }) => ({
      data: await dashboardKelas(params.id, query, kelasScope),
    }),
  ),
);
