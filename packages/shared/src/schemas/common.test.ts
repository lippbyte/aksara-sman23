import { describe, expect, it } from 'vitest';
import { apiErrorSchema, paginationQuerySchema } from './common';

describe('paginationQuerySchema', () => {
  it('memakai default page 1 dan pageSize 20', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('mengubah string query menjadi angka', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it('menolak page 0 dan pageSize di atas 100', () => {
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
  });
});

describe('apiErrorSchema', () => {
  it('menerima galat tanpa details', () => {
    const galat = { error: { code: 'NOT_FOUND', message: 'Tidak ditemukan' } };
    expect(apiErrorSchema.parse(galat)).toEqual(galat);
  });
});
