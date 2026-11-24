# Aksara - Administrasi dan Sistem Informasi Sekolah

Aplikasi web untuk mencatat dan merekap kehadiran guru di kelas dan kehadiran siswa, mengelola
data master serta jadwal mengajar, dan mendokumentasikan penilaian kinerja guru.

**Status: In Development.** Belum pernah dipakai di sekolah nyata. Pengembangan dan demo hanya
memakai data contoh (fiktif). Dikembangkan oleh EDILAKSO.

## Dokumen

| Berkas                    | Isi                                                                |
| ------------------------- | ------------------------------------------------------------------ |
| `PROJECT-CONTEXT.md`      | Produk, peran, model data, aturan bisnis (sumber kebenaran domain) |
| `DESIGN.md`               | Token visual, tata letak, komponen, dashboard                      |
| `AGENTS.md`               | Stack, struktur repo, konvensi, batasan                            |
| `PROMPT-REBUILD.md`       | Urutan fase pembangunan ulang                                      |
| `docs/AUDIT-CHECKLIST.md` | Daftar periksa sebelum audit teknis (sudah/belum/perlu keputusan)  |

`reference/prototype-laravel/` (bila ada) adalah prototype lama dan bersifat **read-only**.

## Fitur

- **Absensi Guru**: catat kehadiran guru per kelas, jam ke-, dan lama JP; tolak jam bentrok;
  rekap pekan dihitung ulang otomatis.
- **Absensi Siswa**: input massal per kelas, tanggal, dan jam ke-; riwayat per sesi.
- **Rekap Kehadiran Guru**: per pekan, sinkron massal, koreksi manual dengan alasan (dilewati
  sinkron kecuali admin memilih menimpa), ekspor CSV.
- **Penilaian Kinerja** dan **Penilaian MGMP** bulanan dengan jendela penilaian dan bobot dari
  pengaturan sekolah. Skor siswa MGMP diisi per kelas oleh sekretaris kelas itu.
- **Laporan Rekap Siswa** dengan ekspor CSV.
- **Dashboard** sesuai peran: ringkasan pimpinan, dashboard kelas, dashboard penilai.
- **Pengaturan** data master (termasuk impor massal Excel `.xlsx` / CSV untuk guru, siswa X/XI/XII
  beserta Wali Kelas & BK, serta jadwal mengajar), akun, dan **Log Aktivitas**.

Hak akses per peran mengikuti PROJECT-CONTEXT §4 dan diperiksa di server.

## Prasyarat

- Node.js LTS (≥ 22) dan npm
- Docker (untuk MySQL lokal)

## Menjalankan

```bash
cp .env.example .env          # lalu isi nilainya (lihat tabel di bawah)
docker compose up -d          # MySQL lokal
npm install                   # juga membuat Prisma Client
npm run db:migrate            # prisma migrate dev
npm run db:seed               # data fiktif
npm run dev                   # api :3001 + web :5173 (Vite proxy /api → api)
```

Buka <http://localhost:5173>. Pemeriksaan API: <http://localhost:3001/api/v1/health>.

Port 5173 harus kosong (Vite memakai `strictPort`). Bila dipakai aplikasi lain, jalankan web di
port lain dan samakan `APP_ORIGIN`, mis. `APP_ORIGIN=http://localhost:5174` lalu
`npx vite --port 5174` di `apps/web`.

### Akun demo (fiktif)

Seeder membuat satu akun per peran. Kata sandinya adalah nilai `SEED_PASSWORD` di `.env`.

| Peran            | Email                       |
| ---------------- | --------------------------- |
| Admin            | `admin@contoh.test`         |
| Manajemen Guru   | `manajemen@contoh.test`     |
| Sekretaris Kelas | `sekretaris.x1@contoh.test` |
| Guru Penilai     | `penilai@contoh.test`       |

Data seed: 1 sekolah contoh, 3 MGMP, 12 guru, 6 kelas, 30 siswa per kelas, jadwal mengajar,
dan 4 pekan kehadiran sampai hari seed dijalankan. Semua nama memakai kata "Contoh".

### Variabel `.env`

| Variabel                                         | Keterangan                                        |
| ------------------------------------------------ | ------------------------------------------------- |
| `NODE_ENV`                                       | `development`, `test`, atau `production`          |
| `API_PORT`                                       | Port API, mis. `3001`                             |
| `APP_ORIGIN`                                     | Asal aplikasi web, mis. `http://localhost:5173`   |
| `SESSION_SECRET`                                 | String acak minimal 32 karakter untuk cookie sesi |
| `VITE_APP_NAME`                                  | Nama produk yang tampil di UI                     |
| `MYSQL_PORT`                                     | Port MySQL di mesin lokal, mis. `3308`            |
| `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD` | Basis data dan akun aplikasi                      |
| `MYSQL_ROOT_PASSWORD`                            | Kata sandi root MySQL lokal                       |
| `DATABASE_URL`                                   | `mysql://USER:PASSWORD@127.0.0.1:PORT/DATABASE`   |
| `TEST_DATABASE_URL`                              | Basis data test, nama wajib berakhiran `_test`    |
| `E2E_DATABASE_URL`                               | Basis data e2e, nama wajib berakhiran `_e2e`      |
| `SEED_PASSWORD`                                  | Kata sandi akun contoh (minimal 8 karakter)       |
| `LOG_LEVEL`                                      | Opsional: `fatal` … `debug`, `silent`             |

## Perintah

```bash
npm run dev                  # api + web
npm run test                 # vitest semua workspace (API memakai TEST_DATABASE_URL)
npm run lint                 # eslint + prettier --check
npm run typecheck            # tsc --noEmit semua workspace
npm run build
npm run format               # prettier --write
npm run db:reset             # hapus dan buat ulang basis data dev
npm run perf -w @sms/api     # uji kinerja dengan seed besar di basis data *_perf
npm run e2e                  # Playwright, basis data *_e2e (lihat di bawah)
```

## Uji end-to-end (Playwright)

Empat alur utama dengan data seed fiktif, masing-masing di viewport 360 px dan 1280 px:

- sekretaris mencatat kehadiran guru (termasuk ditolak karena jam bentrok), rekap ikut berubah;
- sekretaris mengabsen siswa kelasnya secara massal, riwayat tampil, kelas lain tidak terlihat;
- manajemen membuka dashboard (grafik dan tabel alternatif), rekap, lalu ekspor CSV.
- login salah menampilkan pesan galat; login tiap peran mendarat di dashboard yang sesuai;
  logout kembali ke `/masuk` dan halaman terlindung tidak bisa dibuka.

Persiapan sekali:

```bash
docker compose up -d                 # MySQL harus berjalan
npx playwright install chromium      # unduh browser uji (sekali per mesin)
```

Isi `E2E_DATABASE_URL` di `.env` dengan basis data terpisah yang namanya **berakhiran `_e2e`**,
mis. `mysql://USER:PASSWORD@127.0.0.1:3308/sms_e2e`. Basis data dibuat bila belum ada.

```bash
npm run e2e
```

Setiap run: migrasi diterapkan dan basis data e2e **diisi ulang** dengan data fiktif, lalu API
(port 3101) dan web (port 5183) dijalankan khusus untuk uji, jadi tidak mengganggu `npm run dev`.
Laporan kegagalan (tangkapan layar, trace) ada di `apps/e2e/test-results/`; buka trace dengan
`npx playwright show-trace <berkas trace.zip>`.

## CI

`.github/workflows/ci.yml` menjalankan lint, typecheck, test, dan e2e pada setiap push dan pull
request, dengan layanan MySQL 8 di runner. Tidak memakai rahasia: `.env` disusun dari nama
variabel di `.env.example` dengan nilai khusus CI, dan `SESSION_SECRET` dibuat acak tiap run.

## Struktur

```
packages/shared   konstanta, skema zod, dan fungsi domain murni (dipakai web dan api)
apps/api          Express 5 + Prisma (MySQL)
apps/web          React + Vite + Tailwind CSS v4 + Recharts
apps/e2e          uji alur utama Playwright
docs/             daftar periksa audit
```
