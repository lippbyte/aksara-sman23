/** Port khusus e2e agar tidak bentrok dengan `npm run dev` (3001/5173). */
export const API_PORT_E2E = 3101;
export const WEB_PORT_E2E = 5183;

/** Kata sandi akun contoh di basis data e2e (fiktif, hanya untuk uji lokal). */
export const PASSWORD_E2E = 'kata-sandi-e2e-123';

/** Akun contoh dari seeder (`apps/api/prisma/seed-data.ts`). */
export const AKUN = {
  sekretaris: 'sekretaris.x1@contoh.test',
  manajemen: 'manajemen@contoh.test',
} as const;
