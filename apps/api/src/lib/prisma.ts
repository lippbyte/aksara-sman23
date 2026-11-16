import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { env, uraiDatabaseUrl } from '../env';
import { PrismaClient } from '../generated/prisma/client';

export function buatPrisma(databaseUrl: string = env.DATABASE_URL): PrismaClient {
  const adapter = new PrismaMariaDb({
    ...uraiDatabaseUrl(databaseUrl),
    connectionLimit: 10,
    // Izinkan autentikasi caching_sha2_password MySQL 8 tanpa TLS di jaringan lokal.
    allowPublicKeyRetrieval: true,
  });
  return new PrismaClient({ adapter });
}

export const prisma = buatPrisma();

export type { PrismaClient };
/** Klien di dalam `prisma.$transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
/** Klien biasa atau klien transaksi. */
export type Db = PrismaClient | Tx;
