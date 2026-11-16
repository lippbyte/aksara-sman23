import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { API_PORT_E2E, PASSWORD_E2E, WEB_PORT_E2E } from './tests/konstanta';

// .env di akar repo: E2E_DATABASE_URL dan SESSION_SECRET.
const envPath = resolve(import.meta.dirname, '../../.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);

const dbE2e = process.env.E2E_DATABASE_URL;
if (!dbE2e || !/_e2e$/.test(new URL(dbE2e).pathname)) {
  throw new Error('E2E_DATABASE_URL wajib diisi dan nama basis datanya berakhiran "_e2e".');
}

const WEB = `http://localhost:${WEB_PORT_E2E}`;

/**
 * Uji alur utama: API dan web dijalankan khusus untuk e2e (port sendiri, basis data
 * `*_e2e` yang di-seed ulang dengan data fiktif setiap kali dijalankan).
 */
export default defineConfig({
  testDir: './tests',
  // Satu basis data bersama: berurutan, tanpa paralel.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB,
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'ponsel-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 }, hasTouch: true },
    },
    {
      name: 'desktop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: [
    {
      // Seed ulang basis data e2e, lalu jalankan API.
      command: 'npx tsx scripts/siapkan-e2e.ts && node --import tsx src/server.ts',
      cwd: resolve(import.meta.dirname, '../api'),
      url: `http://localhost:${API_PORT_E2E}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NODE_ENV: 'development',
        DATABASE_URL: dbE2e,
        API_PORT: String(API_PORT_E2E),
        APP_ORIGIN: WEB,
        SEED_PASSWORD: PASSWORD_E2E,
        LOG_LEVEL: 'warn',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT_E2E} --strictPort`,
      cwd: resolve(import.meta.dirname, '../web'),
      url: WEB,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { API_PORT: String(API_PORT_E2E) },
    },
  ],
});
