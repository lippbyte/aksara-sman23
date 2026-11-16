/**
 * Uji kinerja ringan (Fase 8): seed besar FIKTIF di basis data terpisah, lalu mengukur
 * waktu respons endpoint utama.
 *
 *   npm run perf -w @sms/api
 *
 * Basis data: nama dari DATABASE_URL dengan akhiran `_perf` (mis. sms_dev → sms_dev_perf).
 * Isi basis data itu DIHAPUS dan diisi ulang setiap kali skrip dijalankan.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const akar = resolve(import.meta.dirname, '../../..');
if (existsSync(resolve(akar, '.env'))) process.loadEnvFile(resolve(akar, '.env'));

const asal = process.env.DATABASE_URL;
if (!asal) throw new Error('DATABASE_URL belum diisi.');
const url = new URL(asal);
url.pathname = `${url.pathname.replace(/_perf$/, '')}_perf`;
process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = 'silent';

const SKALA = { jumlahGuru: 60, jumlahKelas: 36, siswaPerKelas: 30, jumlahPekan: 20 };
const PASSWORD = 'kata-sandi-uji-kinerja';

async function ukur<T>(label: string, fn: () => Promise<T>, hasil: [string, number][]): Promise<T> {
  const mulai = performance.now();
  const nilai = await fn();
  hasil.push([label, Math.round(performance.now() - mulai)]);
  return nilai;
}

async function main() {
  const apiDir = resolve(import.meta.dirname, '..');
  console.log(`Basis data uji kinerja: ${url.pathname.slice(1)}`);
  execFileSync(
    process.execPath,
    [resolve(akar, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'],
    { cwd: apiDir, env: process.env, stdio: 'pipe' },
  );

  // Diimpor setelah DATABASE_URL diganti, karena env dibaca saat modul dimuat.
  const { tahunPekan, tanggalDiZona } = await import('@sms/shared');
  const { buatPrisma } = await import('../src/lib/prisma');
  const { isiDataContoh } = await import('../prisma/seed-data');
  const { createApp, tutupSumberDaya } = await import('../src/app');
  const { default: request } = await import('supertest');

  const waktu: [string, number][] = [];
  const prisma = buatPrisma();
  const seed = await ukur(
    'Seed satu semester',
    () =>
      isiDataContoh(prisma, { hariIni: tanggalDiZona(new Date()), password: PASSWORD, ...SKALA }),
    waktu,
  );
  await prisma.$disconnect();
  console.table(seed.jumlah);

  const app = createApp();
  const agen = request.agent(app);
  const origin = process.env.APP_ORIGIN ?? 'http://localhost:5173';
  await agen
    .post('/api/v1/auth/login')
    .set('Origin', origin)
    .send({ email: 'admin@contoh.test', password: PASSWORD })
    .expect(200);

  const get = (path: string) => agen.get(`/api/v1${path}`).expect(200);
  const post = (path: string, body: object) =>
    agen.post(`/api/v1${path}`).set('Origin', origin).send(body).expect(200);
  const hariIni = tanggalDiZona(new Date());
  const bulan = Number(hariIni.slice(5, 7));
  const tahun = Number(hariIni.slice(0, 4));

  await ukur('Dashboard ringkasan (dingin)', () => get('/dashboard/ringkasan'), waktu);
  await ukur('Dashboard ringkasan (cache)', () => get('/dashboard/ringkasan'), waktu);
  await ukur('Daftar kehadiran guru (20 baris)', () => get('/kehadiran'), waktu);
  await ukur('Dashboard kelas', () => get('/dashboard/kelas/1'), waktu);
  await ukur(
    'Sinkron rekap 1 pekan (60 guru)',
    () =>
      post('/rekap-kehadiran/sync', {
        minggu_ke: 10,
        tahun: tahunPekan(10, seed.tanggalAwalPekan),
      }),
    waktu,
  );
  await ukur('Daftar rekap semua pekan', () => get('/rekap-kehadiran?pageSize=100'), waktu);
  await ukur('Ekspor rekap (semua baris)', () => get('/rekap-kehadiran/export'), waktu);
  await ukur(
    'Sinkron penilaian kinerja 1 bulan',
    () => post('/penilaian-kinerja/sync', { bulan, tahun }),
    waktu,
  );
  await ukur(
    'Sinkron penilaian MGMP 1 bulan',
    () => post('/penilaian-mgmp/sync', { bulan, tahun }),
    waktu,
  );
  await ukur('Riwayat absensi siswa', () => get('/kehadiran-siswa/riwayat'), waktu);
  await ukur(
    'Sesi absensi siswa (1 kelas)',
    () => get(`/kehadiran-siswa/sesi?kelas_id=1&tanggal=${hariIni}`),
    waktu,
  );
  await ukur('Laporan siswa (semua, 20 baris)', () => get('/laporan/siswa'), waktu);
  await ukur('Ekspor laporan siswa (semua siswa)', () => get('/laporan/siswa/export'), waktu);
  await ukur('Log aktivitas', () => get('/audit-logs'), waktu);

  await tutupSumberDaya();
  console.log('\nWaktu (ms):');
  console.table(Object.fromEntries(waktu));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
