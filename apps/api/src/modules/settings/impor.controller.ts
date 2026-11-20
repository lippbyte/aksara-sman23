import {
  hapusDataPilotSchema,
  jenisImporParamSchema,
  pratinjauImporSchema,
  simpanImporSchema,
} from '@sms/shared';
import type { RequestHandler } from 'express';
import { kirimCsv } from '../../lib/csv';
import { badRequest } from '../../lib/errors';
import { validate } from '../../middleware/validate';
import { impor, templatCsv } from './impor.service';

export const imporController = {
  templat: ((req, res) => {
    const parsed = jenisImporParamSchema.safeParse(req.params);
    if (!parsed.success) throw badRequest('Jenis impor tidak valid.');
    const { namaBerkas, isi } = templatCsv(parsed.data.jenis);
    kirimCsv(res, namaBerkas, isi);
  }) satisfies RequestHandler,

  pratinjau: validate(
    { params: jenisImporParamSchema, body: pratinjauImporSchema },
    async ({ params, body }) => ({
      data: await impor.pratinjau(params.jenis, body.csv),
    }),
  ),

  simpan: validate(
    { params: jenisImporParamSchema, body: simpanImporSchema },
    async ({ params, body, audit }) => ({
      data: await impor.simpan(params.jenis, body.csv, body.izinkan_buat_referensi, audit),
    }),
  ),

  hapusDataPilot: validate({ body: hapusDataPilotSchema }, async ({ body, audit }) => ({
    data: await impor.hapusDataPilot(body.konfirmasi_nama_sekolah, audit),
  })),
};
