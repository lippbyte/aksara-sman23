import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { isiDataContoh } from '../../prisma/seed-data';
import { env } from '../env';
import { buatPrisma } from '../lib/prisma';

/** Tanggal "hari ini" untuk data uji: Jumat, pekan ke-4 sejak 2026-10-19. */
export const HARI_INI_UJI = '2026-11-13';
export const PASSWORD_UJI = 'kata-sandi-uji-123';

/**
 * Dijalankan sekali sebelum semua test: terapkan migrasi ke basis data uji
 * (TEST_DATABASE_URL, terpisah dari basis data pengembangan) lalu isi data fiktif.
 */
export default async function setup() {
  if (!/_test$/.test(new URL(env.DATABASE_URL).pathname)) {
    throw new Error('Nama basis data uji harus berakhiran "_test" agar data lain tidak terhapus.');
  }

  const apiDir = resolve(import.meta.dirname, '../..');
  execFileSync(
    process.execPath,
    [resolve(apiDir, '../../node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    {
      cwd: apiDir,
      env: { ...process.env, DATABASE_URL: env.DATABASE_URL },
      stdio: 'pipe',
    },
  );

  const prisma = buatPrisma();
  try {
    await isiDataContoh(prisma, { hariIni: HARI_INI_UJI, password: PASSWORD_UJI });
  } finally {
    await prisma.$disconnect();
  }
}
