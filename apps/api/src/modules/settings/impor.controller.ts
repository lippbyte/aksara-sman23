import {
  hapusDataPilotSchema,
  jenisImporParamSchema,
  pratinjauImporSchema,
  simpanImporSchema,
  templatImporQuerySchema,
} from '@sms/shared';
import type { RequestHandler } from 'express';
import { kirimCsv } from '../../lib/csv';
import { badRequest } from '../../lib/errors';
import { validate } from '../../middleware/validate';
import { impor, templatCsv, templatXlsx } from './impor.service';

export const imporController = {
  templat: (async (req, res) => {
    const parsed = jenisImporParamSchema.safeParse(req.params);
    if (!parsed.success) throw badRequest('Jenis impor tidak valid.');
    const q = templatImporQuerySchema.safeParse(req.query);
    if (!q.success) throw badRequest('Format templat harus csv atau xlsx.');

    if (q.data.format === 'xlsx') {
      const { namaBerkas, isi } = await templatXlsx(parsed.data.jenis);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${namaBerkas}"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(isi);
      return;
    }

    const { namaBerkas, isi } = templatCsv(parsed.data.jenis);
    kirimCsv(res, namaBerkas, isi);
  }) satisfies RequestHandler,

  pratinjau: validate(
    { params: jenisImporParamSchema, body: pratinjauImporSchema },
    async ({ params, body }) => ({
      data: await impor.pratinjau(params.jenis, body),
    }),
  ),

  simpan: validate(
    { params: jenisImporParamSchema, body: simpanImporSchema },
    async ({ params, body, audit }) => ({
      data: await impor.simpan(params.jenis, body, body.izinkan_buat_referensi, audit),
    }),
  ),

  hapusDataPilot: validate({ body: hapusDataPilotSchema }, async ({ body, audit }) => ({
    data: await impor.hapusDataPilot(body.konfirmasi_nama_sekolah, audit),
  })),
};
