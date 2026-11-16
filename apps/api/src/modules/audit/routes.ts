import { auditQuerySchema } from '@sms/shared';
import { Router } from 'express';
import { requireAuth, requireRole } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import * as repo from './repo';

/** Log aktivitas: hanya admin, hanya baca (tidak ada rute ubah atau hapus). */
export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole('admin'));

auditRouter.get(
  '/',
  validate({ query: auditQuerySchema }, async ({ query }) => {
    const hasil = await repo.daftar(query);
    return {
      data: hasil.rows,
      meta: { page: query.page, pageSize: query.pageSize, total: hasil.total },
    };
  }),
);

auditRouter.get(
  '/pengguna',
  validate({}, async () => ({ data: await repo.daftarPengguna() })),
);
