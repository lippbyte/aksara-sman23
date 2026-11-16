# Daftar Periksa Audit Teknis

School Management System (nama kerja) · **In Development** · disusun 16 November 2026 (Fase 8),
diperbarui Fase 9–11

Dokumen ini mencatat hasil pemeriksaan internal tim pengembang sebelum audit teknis. Isinya
**bukan** pernyataan bahwa sistem aman atau sesuai regulasi. Audit teknis independen dan
verifikasi hukum tetap diperlukan sebelum sistem memakai data nyata (PROJECT-CONTEXT §9).

Status: **Sudah** = diterapkan dan ada test/bukti · **Belum** = belum dikerjakan ·
**Perlu keputusan** = menunggu keputusan tim atau sekolah.

## 1. Kontrol akses (OWASP A01)

| Butir                                                                            | Status | Bukti / catatan                                                                                                                                            |
| -------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setiap rute API melewati `requireAuth` → `requireRole` (→ `scopeKelas`)          | Sudah  | `apps/api/src/test/matriks-akses.test.ts` menguji **setiap rute × setiap peran** terhadap PROJECT-CONTEXT §4 (403 untuk yang tidak berhak, 401 tanpa sesi) |
| `sekretaris_kelas` dibatasi ke kelasnya, termasuk ubah/hapus berdasarkan ID      | Sudah  | Test 403 untuk ID milik kelas lain di modul kehadiran guru, kehadiran siswa, dashboard kelas, referensi siswa                                              |
| `kelas_id` sekretaris diambil dari sesi, bukan isian form                        | Sudah  | Test "kelas selalu dari akun" di kehadiran guru dan siswa                                                                                                  |
| `created_by` / `dinilai_oleh` selalu dari sesi                                   | Sudah  | Test `created_by: 999` diabaikan (perbaikan §8.5)                                                                                                          |
| Kehadiran siswa tidak terbuka untuk semua pengguna                               | Sudah  | `guru_penilai` → 403 (perbaikan §8.6)                                                                                                                      |
| Sekretaris hanya mengisi skor siswa MGMP untuk kelasnya (`penilaian_mgmp_siswa`) | Sudah  | Test: `kelas_id` dari form diabaikan; isian penilai → 403; rincian per kelas hanya kelasnya                                                                |
| Menimpa rekap yang dikoreksi manual hanya oleh admin                             | Sudah  | Test `timpa_koreksi` manajemen → 403; penimpaan tercatat `TIMPA_KOREKSI_REKAP`                                                                             |
| Menu UI hanya cermin; halaman di luar hak menampilkan pesan, tanpa memanggil API | Sudah  | Test web `PerluPeran`                                                                                                                                      |
| Admin tidak bisa menonaktifkan/menghapus/menurunkan peran akun sendiri           | Sudah  | Test 422                                                                                                                                                   |
| Pengisian penilaian di luar jendela oleh admin tercatat terpisah                 | Sudah  | Log `PENILAIAN_DI_LUAR_JENDELA`                                                                                                                            |

## 2. Kriptografi dan sesi (A02, A07)

| Butir                                                                              | Status          | Bukti / catatan                                                                           |
| ---------------------------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| Kata sandi di-hash dengan argon2id                                                 | Sudah           | Test seed + login                                                                         |
| Waktu respons login tidak membedakan "email tidak ada" dan "sandi salah"           | Sudah           | Hash pembanding untuk email tak terdaftar; pesan galat sama (test)                        |
| Sesi di cookie `httpOnly`, `SameSite=Lax`, `Secure` di produksi; disimpan di MySQL | Sudah           | Test atribut cookie; `lib/session.ts`                                                     |
| ID sesi diregenerasi saat login                                                    | Sudah           | Test regenerasi                                                                           |
| Sesi berakhir saat logout, akun dinonaktifkan, atau sandi direset admin            | Sudah           | Test                                                                                      |
| Batas percobaan login 5×/15 menit per IP+email (hanya yang gagal)                  | Sudah           | Test 429                                                                                  |
| Sesi berakhir 8 jam sejak masuk (tidak bergulir) atau 2 jam tanpa aktivitas        | Sudah           | Test dengan jam palsu (`auth.test.ts`); keputusan tim 16 Nov 2026                         |
| Semua sesi lain pengguna diakhiri saat sandi diganti sendiri atau direset admin    | Sudah           | Test dua perangkat; sesi yang sedang dipakai tetap berlaku                                |
| Kebijakan kata sandi (minimal 8 karakter)                                          | Perlu keputusan | Panjang/kompleksitas mengikuti keputusan sekolah                                          |
| HTTPS/TLS di server                                                                | Belum           | Bergantung target hosting (open item §12.5); `trust proxy` sudah disiapkan untuk produksi |
| Penguncian akun setelah banyak kegagalan (selain rate limit)                       | Perlu keputusan |                                                                                           |

## 3. Injeksi (A03)

| Butir                                                                                                | Status | Bukti / catatan                                                                        |
| ---------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Semua query lewat Prisma terparameter; query mentah hanya `$queryRaw`/`$executeRaw` bertemplat       | Sudah  | Tidak ada `$queryRawUnsafe`/`$executeRawUnsafe` di kode (diperiksa dengan pencarian)   |
| Semua body, query, dan param divalidasi zod dari `packages/shared`                                   | Sudah  | Pembungkus `validate`; test 400 per modul; isian tak dikenal dibuang (mass assignment) |
| Ekspor CSV menetralkan sel diawali `= + - @` (juga tab/CR)                                           | Sudah  | `lib/csv.test.ts` + test ekspor dengan nama siswa berisi rumus                         |
| Tidak ada `innerHTML`/`dangerouslySetInnerHTML` di web                                               | Sudah  | Diperiksa dengan pencarian; React meng-escape teks                                     |
| Unggah logo: jenis berkas diperiksa dari isi (PNG/JPEG/WebP), SVG ditolak, nama berkas dibuat server | Sudah  | Test unggah berkas palsu                                                               |

## 4. Desain dan konfigurasi (A04, A05)

| Butir                                                                                                    | Status          | Bukti / catatan                                                     |
| -------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------- |
| Perlindungan CSRF: perubahan data wajib `Origin` = `APP_ORIGIN` **dan** `Content-Type: application/json` | Sudah           | Test 403/415                                                        |
| Header keamanan (helmet), `x-powered-by` dimatikan                                                       | Sudah           | Test header                                                         |
| Batas ukuran body 100 KB (logo 500 KB)                                                                   | Sudah           | Galat 413                                                           |
| Galat tanpa stack trace / detail basis data                                                              | Sudah           | `errorHandler.test.ts` (500 generik, galat Prisma tanpa nama tabel) |
| Konfigurasi lingkungan divalidasi saat start; rahasia hanya di `.env`                                    | Sudah           | `env.ts`; `.env.example` tanpa nilai                                |
| Test berjalan di basis data terpisah berakhiran `_test`                                                  | Sudah           | `test/globalSetup.ts` menolak nama lain                             |
| Seeder data fiktif ditolak di produksi                                                                   | Sudah           | `seed-data.ts`                                                      |
| CSP untuk aplikasi web saat disajikan di produksi                                                        | Belum           | Bergantung cara hosting web statis                                  |
| Rate limit umum untuk seluruh API (selain login)                                                         | Perlu keputusan |                                                                     |

## 5. Komponen rentan (A06)

| Butir                                                    | Status          | Bukti / catatan                                                                                        |
| -------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| `npm audit --omit=dev`: 0 kerentanan                     | Sudah           | `mysql2` dipaksa ke 3.24.x lewat `overrides` (sebelumnya 3.10.2 lewat `express-mysql-session`, rentan) |
| Kerentanan _moderate_ `minimatch` di `typescript-eslint` | Perlu keputusan | Hanya perkakas lint (dev), tidak ikut ke runtime; perbaikan otomatis = turun versi major               |
| Versi dikunci di `package-lock.json`                     | Sudah           |                                                                                                        |

## 6. Pencatatan dan pemantauan (A09)

| Butir                                                                                       | Status          | Bukti / catatan            |
| ------------------------------------------------------------------------------------------- | --------------- | -------------------------- |
| Log aktivitas: login/gagal login/logout, semua perubahan data, sinkron, ekspor, reset sandi | Sudah           | Test per modul             |
| Log tidak memuat kata sandi, cookie, atau isi sesi                                          | Sudah           | Redaksi pino; test isi log |
| Log aktivitas hanya bisa dibaca admin, tanpa rute ubah/hapus                                | Sudah           | Test 404 untuk PUT/DELETE  |
| Retensi log aktivitas dan log aplikasi                                                      | Perlu keputusan |                            |
| Pemantauan/alert produksi                                                                   | Belum           | Bergantung hosting         |

## 7. Data dan privasi (PROJECT-CONTEXT §9)

| Butir                                                                                                  | Status          | Bukti / catatan    |
| ------------------------------------------------------------------------------------------------------ | --------------- | ------------------ |
| Seeder, test, demo, tangkapan layar hanya data fiktif ("Contoh", NIS/NIP berawalan 99, `@contoh.test`) | Sudah           | Test seed          |
| Tidak ada foto, alamat, atau kontak siswa                                                              | Sudah           | Model data §5      |
| Penyimpanan dan cadangan basis data                                                                    | Belum           | Bergantung hosting |
| Kebijakan retensi data siswa dan penilaian                                                             | Perlu keputusan |                    |
| Kesepakatan tertulis dengan sekolah sebelum data nyata                                                 | Perlu keputusan |                    |

## 8. Aksesibilitas (DESIGN §9)

| Butir                                                             | Status | Bukti / catatan                                                                                                                                                                |
| ----------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kontras teks token ≥ 4,5:1                                        | Sudah  | Dihitung untuk semua pasangan teks/latar status; `ink-subtle` di atas `subtle` (4,34:1) tidak dipakai untuk teks aktif                                                         |
| Fokus terlihat, skip link, label pada setiap input                | Sudah  | `:focus-visible` global; komponen `Field`                                                                                                                                      |
| Status tidak pernah hanya warna (lencana berteks, legenda grafik) | Sudah  |                                                                                                                                                                                |
| Grafik punya judul, periode, legenda teks, dan tabel alternatif   | Sudah  | `ChartCard` ("Lihat tabel"); palet grafik lolos validator CVD                                                                                                                  |
| `SegmentedStatus` berperilaku radio group (panah kiri/kanan)      | Sudah  | Test                                                                                                                                                                           |
| Area sentuh 44 px untuk aksi input di ponsel; tata letak 360 px   | Sudah  | Diperiksa lewat tangkapan layar                                                                                                                                                |
| Uji pembaca layar nyata (NVDA/VoiceOver)                          | Belum  |                                                                                                                                                                                |
| Uji alur utama end-to-end (Playwright)                            | Sudah  | `npm run e2e`: 4 alur (termasuk login/logout tiap peran) × viewport 360/1280 px, basis data `*_e2e` di-seed ulang tiap run; dijalankan juga di CI (`.github/workflows/ci.yml`) |

## 9. Kinerja (seed satu semester)

`npm run perf -w @sms/api`: 60 guru, 36 kelas, 1.080 siswa, 20 pekan
(13.824 catatan kehadiran guru, 103.680 catatan kehadiran siswa), MySQL lokal.

| Endpoint                                               | Waktu              |
| ------------------------------------------------------ | ------------------ |
| Dashboard ringkasan (dingin / cache)                   | 91 ms / 23 ms      |
| Sinkron rekap 1 pekan, 60 guru (query agregat)         | 83 ms              |
| Sinkron penilaian kinerja / MGMP 1 bulan               | 67 ms / 61 ms      |
| Ekspor rekap semua pekan                               | 97 ms              |
| Riwayat absensi siswa · laporan siswa · ekspor laporan | 170 · 169 · 188 ms |
| Lainnya (daftar, dashboard kelas, sesi absensi, log)   | < 45 ms            |

Angka ini hanya pembanding kasar di mesin pengembang, bukan jaminan kinerja produksi.
