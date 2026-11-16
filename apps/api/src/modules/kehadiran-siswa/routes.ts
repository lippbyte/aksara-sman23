import {
  hapusSesiSiswaQuerySchema,
  idParamSchema,
  riwayatSiswaQuerySchema,
  sesiSiswaQuerySchema,
  simpanKehadiranSiswaSchema,
} from '@sms/shared';
import { Router } from 'express';
import { requireAuth, requireRole, scopeKelas } from '../../middleware/requireAuth';
import { validate } from '../../middleware/validate';
import * as service from './service';

/**
 * Kehadiran siswa (PROJECT-CONTEXT §4, versi diperketat §8.6):
 * lihat → admin, manajemen_guru (lihat saja), sekretaris_kelas (kelasnya);
 * tambah/ubah/hapus → admin, sekretaris_kelas (kelasnya). guru_penilai tidak punya akses.
 */
export const kehadiranSiswaRouter = Router();
kehadiranSiswaRouter.use(
  requireAuth,
  requireRole('admin', 'manajemen_guru', 'sekretaris_kelas'),
  scopeKelas,
);

const bolehUbah = requireRole('admin', 'sekretaris_kelas');

kehadiranSiswaRouter.get(
  '/sesi',
  validate({ query: sesiSiswaQuerySchema }, async ({ query, kelasScope }) => ({
    data: await service.sesi(query, kelasScope),
  })),
);

kehadiranSiswaRouter.get(
  '/riwayat',
  validate({ query: riwayatSiswaQuerySchema }, ({ query, kelasScope }) =>
    service.riwayat(query, kelasScope),
  ),
);

kehadiranSiswaRouter.put(
  '/sesi',
  bolehUbah,
  validate({ body: simpanKehadiranSiswaSchema }, async ({ body, user, kelasScope, audit }) => ({
    data: await service.simpan(body, user, kelasScope, audit),
  })),
);

kehadiranSiswaRouter.delete(
  '/sesi',
  bolehUbah,
  validate({ query: hapusSesiSiswaQuerySchema }, async ({ query, kelasScope, audit }) => ({
    data: await service.hapusSesi(query, kelasScope, audit),
  })),
);

kehadiranSiswaRouter.delete(
  '/:id',
  bolehUbah,
  validate({ params: idParamSchema }, ({ params, kelasScope, audit }) =>
    service.hapusCatatan(params.id, kelasScope, audit),
  ),
);
