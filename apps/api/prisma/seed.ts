import { tanggalDiZona } from '@sms/shared';
import { prisma } from '../src/lib/prisma';
import { AKUN_CONTOH, isiDataContoh } from './seed-data';

async function main() {
  const password = process.env.SEED_PASSWORD ?? '';
  const hasil = await isiDataContoh(prisma, {
    hariIni: tanggalDiZona(new Date()),
    password,
  });

  console.log('Seed data fiktif selesai.');
  console.log(`  Tanggal awal pekan : ${hasil.tanggalAwalPekan}`);
  console.table(hasil.jumlah);
  console.log('Akun contoh (kata sandi = SEED_PASSWORD di .env):');
  console.table(AKUN_CONTOH.map(({ role, email }) => ({ role, email })));
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
