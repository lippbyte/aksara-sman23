import type { RequestHandler } from 'express';
import mysqlSession from 'express-mysql-session';
import session from 'express-session';
import { env, isProduction, isTest, uraiDatabaseUrl } from '../env';
import type { Db } from './prisma';

export const NAMA_COOKIE_SESI = 'sms.sid';
/** Umur maksimum sesi sejak masuk (tidak diperpanjang oleh aktivitas). */
export const UMUR_SESI_MS = 8 * 60 * 60 * 1000; // 8 jam
/** Sesi berakhir bila tidak ada permintaan selama ini. */
export const BATAS_DIAM_MS = 2 * 60 * 60 * 1000; // 2 jam
/** `aktif_pada` hanya ditulis ulang bila sudah lewat selang ini, agar sesi tidak disimpan tiap permintaan. */
const SELANG_SEGAR_MS = 60 * 1000;

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
  // Cookie berlaku 8 jam sejak masuk; batas diam diperiksa di `batasSesi`.
  rolling: false,
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

/** Menandai sesi yang baru dibuat saat login. */
export function mulaiSesi(s: session.Session & Partial<session.SessionData>, userId: number): void {
  const sekarang = Date.now();
  s.userId = userId;
  s.masuk_pada = sekarang;
  s.aktif_pada = sekarang;
}

/**
 * Batas sesi: berakhir 8 jam sejak masuk ATAU setelah 2 jam tanpa permintaan.
 * Sesi yang berakhir diganti sesi kosong, sehingga `requireAuth` menjawab 401.
 * Sesi tanpa cap waktu (dibuat sebelum aturan ini) juga dianggap berakhir.
 */
export const batasSesi: RequestHandler = (req, res, next) => {
  const s = req.session;
  if (!s.userId) {
    next();
    return;
  }
  const sekarang = Date.now();
  const masuk = s.masuk_pada ?? 0;
  const aktif = s.aktif_pada ?? 0;
  const berakhir = sekarang - masuk >= UMUR_SESI_MS || sekarang - aktif >= BATAS_DIAM_MS;

  if (berakhir) {
    s.regenerate((err) => {
      if (err) {
        next(err);
        return;
      }
      res.clearCookie(NAMA_COOKIE_SESI, OPSI_HAPUS_COOKIE);
      res.locals.sesiBerakhir = true;
      next();
    });
    return;
  }
  if (sekarang - aktif >= SELANG_SEGAR_MS) s.aktif_pada = sekarang;
  next();
};

/**
 * Mengakhiri sesi milik pengguna (mis. setelah kata sandi diganti atau direset).
 * Isi sesi berbentuk JSON dengan `"userId":<id>`; sesi `kecuali` (sesi yang sedang
 * dipakai) dibiarkan.
 *
 * @returns jumlah sesi yang diakhiri.
 */
export async function akhiriSesiPengguna(
  db: Db,
  userId: number,
  kecuali?: string,
): Promise<number> {
  const hasil = await db.session.deleteMany({
    where: {
      OR: [
        { data: { contains: `"userId":${userId},` } },
        { data: { contains: `"userId":${userId}}` } },
      ],
      ...(kecuali ? { NOT: { session_id: kecuali } } : {}),
    },
  });
  return hasil.count;
}

export async function tutupSessionStore(): Promise<void> {
  await store.close();
}
