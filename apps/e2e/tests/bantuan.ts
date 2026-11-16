import {
  expect,
  request,
  type APIRequestContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { PASSWORD_E2E, WEB_PORT_E2E } from './konstanta';

const WEB = `http://localhost:${WEB_PORT_E2E}`;

/** Masuk lewat halaman login. */
export async function masuk(page: Page, email: string): Promise<void> {
  await page.goto('/masuk');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi').fill(PASSWORD_E2E);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).not.toHaveURL(/\/masuk/);
}

/** Klien API yang sudah masuk (untuk memeriksa data di luar UI pengguna yang diuji). */
export async function klienApi(email: string): Promise<APIRequestContext> {
  const klien = await request.newContext({
    baseURL: WEB,
    extraHTTPHeaders: { Origin: WEB },
  });
  const res = await klien.post('/api/v1/auth/login', {
    data: { email, password: PASSWORD_E2E },
  });
  expect(res.status()).toBe(200);
  return klien;
}

/** Tanggal WIB `YYYY-MM-DD`. */
function tanggalWib(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
}

/**
 * Hari kerja (Senin–Jumat) terakhir sampai hari ini, zona Jakarta. Data seed fiktif
 * mencakup tanggal ini, dan catatannya masuk rentang rekap pekan (Senin–Jumat).
 */
export function hariKerjaTerakhir(): string {
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    const t = tanggalWib(new Date(d.getTime() - i * 86_400_000));
    const hari = new Date(`${t}T00:00:00Z`).getUTCDay();
    if (hari >= 1 && hari <= 5) return t;
  }
  throw new Error('Tidak menemukan hari kerja.');
}

/** `YYYY-MM-DD` → `dd/MM/yyyy` (format tanggal pendek di UI). */
export function tanggalPendek(t: string): string {
  const [y, m, d] = t.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Kedua viewport memakai basis data yang sama dalam satu run; tiap proyek memakai slot
 * berbeda (jam ke- dan guru) supaya tidak saling bentrok. Seed memakai jam 1–8.
 */
export function slot(info: TestInfo): { jamGuru: number; jamSiswa: number; indeksGuru: number } {
  return info.project.name === 'ponsel-360'
    ? { jamGuru: 11, jamSiswa: 9, indeksGuru: 1 }
    : { jamGuru: 12, jamSiswa: 10, indeksGuru: 2 };
}

/** Tabel (desktop) atau daftar kartu (ponsel) dari komponen DataTable. */
export function dataTable(page: Page, keterangan: string) {
  return page
    .getByRole('table', { name: keterangan })
    .or(page.getByRole('list', { name: keterangan }));
}
