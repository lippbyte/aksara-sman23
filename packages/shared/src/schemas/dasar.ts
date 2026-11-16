import { z } from 'zod';
import { apakahTanggalValid } from '../domain/tanggal';

/** ID baris (BIGINT di DB, number di API). */
export const idSchema = z.coerce
  .number({ error: 'ID tidak valid.' })
  .int('ID tidak valid.')
  .positive('ID tidak valid.');

/** ID wajib dari pilihan dropdown, dengan pesan yang menyebut isiannya. */
export const idWajib = (label: string) =>
  z.coerce
    .number({ error: `${label} wajib dipilih.` })
    .int(`${label} wajib dipilih.`)
    .positive(`${label} wajib dipilih.`);

export const idParamSchema = z.object({ id: idSchema });
export type IdParam = z.infer<typeof idParamSchema>;

/** Tanggal kalender `YYYY-MM-DD`. */
export const tanggalSchema = z
  .string({ error: 'Tanggal wajib diisi.' })
  .refine(apakahTanggalValid, 'Tanggal tidak valid (format YYYY-MM-DD).');

/** Skor 0–100, paling banyak dua desimal. */
export const skorSchema = z
  .number({ error: 'Skor wajib berupa angka.' })
  .min(0, 'Skor minimal 0.')
  .max(100, 'Skor maksimal 100.')
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Paling banyak dua desimal.');

/** Teks opsional: string kosong disimpan sebagai null. */
export const teksOpsional = (maks: number) =>
  z
    .string()
    .trim()
    .max(maks, `Maksimal ${maks} karakter.`)
    .nullish()
    .transform((v) => (v ? v : null));

export const teksWajib = (label: string, maks: number) =>
  z
    .string({ error: `${label} wajib diisi.` })
    .trim()
    .min(1, `${label} wajib diisi.`)
    .max(maks, `${label} maksimal ${maks} karakter.`);

/** ID opsional dari query string; string kosong dianggap tidak diisi. */
export const idOpsionalQuery = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  idSchema.optional(),
);

export const tanggalOpsionalQuery = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  tanggalSchema.optional(),
);

export const teksOpsionalQuery = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().trim().max(100).optional(),
);

/** Respons daftar berhalaman. */
export interface Halaman<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}

export interface Respons<T> {
  data: T;
}
