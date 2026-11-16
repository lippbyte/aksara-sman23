import {
  idParamSchema,
  jadwalHariQuerySchema,
  kehadiranQuerySchema,
  kehadiranSchema,
} from '@sms/shared';
import { validate } from '../../middleware/validate';
import * as service from './service';

export const daftar = validate({ query: kehadiranQuerySchema }, ({ query, kelasScope }) =>
  service.daftar(query, kelasScope),
);

export const jadwalHari = validate(
  { query: jadwalHariQuerySchema },
  async ({ query, kelasScope }) => ({
    data: await service.jadwalHari(query.kelas_id, query.tanggal, kelasScope),
  }),
);

export const ambil = validate({ params: idParamSchema }, async ({ params, kelasScope }) => ({
  data: await service.ambil(params.id, kelasScope),
}));

export const buat = validate(
  { body: kehadiranSchema },
  async ({ res, body, user, kelasScope, audit }) => {
    res.status(201);
    return { data: await service.buat(body, user, kelasScope, audit) };
  },
);

export const ubah = validate(
  { body: kehadiranSchema, params: idParamSchema },
  async ({ params, body, kelasScope, audit }) => ({
    data: await service.ubah(params.id, body, kelasScope, audit),
  }),
);

export const hapus = validate({ params: idParamSchema }, ({ params, kelasScope, audit }) =>
  service.hapus(params.id, kelasScope, audit),
);
