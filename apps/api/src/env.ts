import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// .env berada di akar repo; src/ dan dist/ sama-sama tiga tingkat di bawahnya.
const envPath = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

// Test integrasi selalu memakai basis data terpisah.
if (process.env.NODE_ENV === 'test') {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL wajib diisi untuk menjalankan test.');
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  DATABASE_URL: z.string().regex(/^mysql:\/\//, 'harus diawali mysql://'),
  SESSION_SECRET: z.string().min(32, 'minimal 32 karakter'),
  LOG_LEVEL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).optional(),
  ),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Hanya nama variabel dan pesan; nilai tidak dicetak.
  const masalah = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Konfigurasi lingkungan tidak valid: ${masalah}`);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Folder berkas unggahan (logo sekolah): apps/api/uploads, tidak di-commit. */
export const DIR_UNGGAH = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  isTest ? '../uploads-test' : '../uploads',
);

export interface KoneksiDb {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export function uraiDatabaseUrl(url: string): KoneksiDb {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}
