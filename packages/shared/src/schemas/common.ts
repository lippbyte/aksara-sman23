import { z } from 'zod';

/** Bentuk galat API: `{ error: { code, message, details? } }` (AGENTS §4). */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

export const healthSchema = z.object({
  status: z.literal('ok'),
  waktu: z.string(),
});
export type Health = z.infer<typeof healthSchema>;

/** Query daftar: `?page=1&pageSize=20`. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
