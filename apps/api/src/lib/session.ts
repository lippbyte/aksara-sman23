import mysqlSession from 'express-mysql-session';
import session from 'express-session';
import { env, isProduction, isTest, uraiDatabaseUrl } from '../env';

export const NAMA_COOKIE_SESI = 'sms.sid';
const UMUR_SESI_MS = 8 * 60 * 60 * 1000; // 8 jam

const MySQLStore = mysqlSession(session);

/** Sesi disimpan di tabel `sessions` MySQL (dibuat oleh migrasi Prisma). */
const store = new MySQLStore({
  ...uraiDatabaseUrl(env.DATABASE_URL),
  createDatabaseTable: false,
  clearExpired: !isTest,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: UMUR_SESI_MS,
});

export const sessionMiddleware = session({
  name: NAMA_COOKIE_SESI,
  secret: env.SESSION_SECRET,
  store,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: UMUR_SESI_MS,
    path: '/',
  },
});

export const OPSI_HAPUS_COOKIE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: isProduction,
  path: '/',
};

export async function tutupSessionStore(): Promise<void> {
  await store.close();
}
