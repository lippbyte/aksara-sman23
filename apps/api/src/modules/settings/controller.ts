import {
  akunBuatSchema,
  akunQuerySchema,
  akunUbahSchema,
  daftarQuerySchema,
  guruQuerySchema,
  guruSchema,
  idParamSchema,
  jadwalQuerySchema,
  jadwalSchema,
  kelasSchema,
  logoSchema,
  mgmpSchema,
  resetPasswordSchema,
  sekolahSchema,
  siswaQuerySchema,
  siswaSchema,
} from '@sms/shared';
import type { z } from 'zod';
import type { KonteksAudit } from '../../lib/audit';
import { validate } from '../../middleware/validate';
import type { HasilDaftar } from './repo';
import * as service from './service';

interface LayananCrud<I, D, Q> {
  daftar(q: Q): Promise<HasilDaftar<D>>;
  buat(input: I, audit: KonteksAudit): Promise<D>;
  ubah(id: number, input: I, audit: KonteksAudit): Promise<D>;
  hapus(id: number, audit: KonteksAudit): Promise<void>;
}

/** Empat handler CRUD tipis untuk satu sumber daya Pengaturan. */
function crud<SB extends z.ZodType, SQ extends z.ZodType<{ page: number; pageSize: number }>, D>(
  skema: SB,
  skemaQuery: SQ,
  layanan: LayananCrud<z.output<SB>, D, z.output<SQ>>,
) {
  return {
    // Di dalam fungsi generik TypeScript belum bisa menyelesaikan tipe kondisional
    // keluaran skema, jadi dipersempit secara eksplisit (nilainya sudah divalidasi zod).
    daftar: validate({ query: skemaQuery }, async ({ query }) => {
      const q = query as z.output<SQ>;
      return service.keHalaman(await layanan.daftar(q), q);
    }),
    buat: validate({ body: skema }, async ({ res, body, audit }) => {
      res.status(201);
      return { data: await layanan.buat(body as z.output<SB>, audit) };
    }),
    ubah: validate({ body: skema, params: idParamSchema }, async ({ params, body, audit }) => ({
      data: await layanan.ubah(params.id, body as z.output<SB>, audit),
    })),
    hapus: validate({ params: idParamSchema }, ({ params, audit }) =>
      layanan.hapus(params.id, audit),
    ),
  };
}

export const kelas = crud(kelasSchema, daftarQuerySchema, service.kelas);
export const mgmp = crud(mgmpSchema, daftarQuerySchema, service.mgmp);
export const guru = crud(guruSchema, guruQuerySchema, service.guru);
export const siswa = crud(siswaSchema, siswaQuerySchema, service.siswa);
export const jadwal = crud(jadwalSchema, jadwalQuerySchema, service.jadwal);

export const users = {
  daftar: validate({ query: akunQuerySchema }, async ({ query }) =>
    service.keHalaman(await service.users.daftar(query), query),
  ),
  buat: validate({ body: akunBuatSchema }, async ({ res, body, audit }) => {
    res.status(201);
    return { data: await service.users.buat(body, audit) };
  }),
  ubah: validate(
    { body: akunUbahSchema, params: idParamSchema },
    async ({ params, body, user, audit }) => ({
      data: await service.users.ubah(params.id, body, user, audit),
    }),
  ),
  hapus: validate({ params: idParamSchema }, ({ params, user, audit }) =>
    service.users.hapus(params.id, user, audit),
  ),
  resetPassword: validate(
    { body: resetPasswordSchema, params: idParamSchema },
    ({ params, body, audit }) => service.users.resetPassword(params.id, body.password_baru, audit),
  ),
};

export const sekolah = {
  ambil: validate({}, async () => ({ data: await service.sekolah.ambil() })),
  simpan: validate({ body: sekolahSchema }, async ({ body, audit }) => ({
    data: await service.sekolah.simpan(body, audit),
  })),
  simpanLogo: validate({ body: logoSchema }, async ({ body, audit }) => ({
    data: await service.sekolah.simpanLogo(body, audit),
  })),
  hapusLogo: validate({}, async ({ audit }) => ({ data: await service.sekolah.hapusLogo(audit) })),
};
