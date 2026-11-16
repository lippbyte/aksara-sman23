/**
 * Menyiapkan basis data uji end-to-end (dipanggil Playwright sebelum API e2e start):
 * terapkan migrasi lalu isi ulang DATA FIKTIF dengan "hari ini" = tanggal sekarang (WIB).
 *
 * Pemakaian: DATABASE_URL=<url basis data *_e2e> SEED_PASSWORD=<sandi> tsx scripts/siapkan-e2e.ts
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tanggalDiZona } from '@sms/shared';

const url = process.env.DATABASE_URL ?? '';
if (!/_e2e$/.test(new URL(url).pathname)) {
  throw new Error('Basis data e2e harus berakhiran "_e2e" agar data lain tidak terhapus.');
}
const password = process.env.SEED_PASSWORD ?? '';

const apiDir = resolve(import.meta.dirname, '..');
execFileSync(
  process.execPath,
  [resolve(apiDir, '../../node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
  { cwd: apiDir, env: process.env, stdio: 'pipe' },
);

// Diimpor setelah DATABASE_URL dipastikan, karena env.ts membacanya saat dimuat.
const { buatPrisma } = await import('../src/lib/prisma');
const { isiDataContoh } = await import('../prisma/seed-data');
const prisma = buatPrisma();
try {
  const hasil = await isiDataContoh(prisma, { hariIni: tanggalDiZona(new Date()), password });
  console.log(`Basis data e2e siap (data fiktif, awal pekan ${hasil.tanggalAwalPekan}).`);
} finally {
  await prisma.$disconnect();
}
