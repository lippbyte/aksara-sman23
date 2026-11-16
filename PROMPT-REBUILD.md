# Instruksi dan Prompt — Pembangunan Ulang School Management System

Versi 1.0 · 15 November 2026
Untuk dipakai di agen pengode (Claude Code, Antigravity, Cursor, dll.). Kerjakan **per fase**: satu fase, satu sesi atau cabang, lalu tinjau hasilnya sebelum lanjut.

---

## A. Persiapan (dilakukan tim, sekali)

1. Buat repo baru, mis. `school-management-system`. Taruh di akar repo: `AGENTS.md`, `PROJECT-CONTEXT.md`, `DESIGN.md`, dan file ini.
2. (Opsional, disarankan) Salin prototype lama sebagai referensi **tanpa data sensitif**:
   ```bash
   mkdir -p reference
   rsync -a KehadiranGuru/ reference/prototype-laravel/ \
     --exclude '.env' --exclude '.env.*' --exclude 'vendor' --exclude 'node_modules' \
     --exclude 'storage' --exclude 'database/*.sqlite' --exclude '*.log' --exclude 'output.txt' \
     --exclude 'public/build' --exclude 'public/images'
   cp KehadiranGuru/.env.example reference/prototype-laravel/   # contoh saja, tanpa rahasia
   ```
   Pastikan tidak ada CSV berisi nama guru asli, `.env`, atau log di `reference/`.
3. Tambahkan `reference/` ke deskripsi README sebagai "read-only".
4. Pastikan Node LTS dan Docker terpasang.

> Kredensial yang pernah ada di `.env` prototype sebaiknya dianggap bocor bila zip pernah dibagikan. Jangan pakai ulang.

---

## B. Prompt pembuka (tempel di awal setiap sesi)

```
Kamu membantu tim EDILAKSO membangun ulang "School Management System" (nama kerja)
dengan React + Vite + TypeScript (web), Express + TypeScript (api), dan MySQL 8 (Prisma).

Sebelum menulis kode, baca berurutan: AGENTS.md, PROJECT-CONTEXT.md, DESIGN.md.
Prototype Laravel di reference/prototype-laravel/ hanya referensi read-only.
Bila dokumen dan prototype berbeda, ikuti dokumen.

Aturan tetap:
- Hanya data fiktif. Jangan membaca atau mengimpor data nyata dari prototype.
- Jangan menambah fitur di luar PROJECT-CONTEXT.md. Ragu → tulis "ASUMSI" atau tanya.
- Otorisasi selalu di server; sekretaris_kelas dibatasi ke kelasnya.
- Rumus bisnis hanya di packages/shared/src/domain dan wajib diuji.
- Tidak ada klaim "aman/terenkripsi/sesuai UU PDP" di UI, README, atau komentar.

Kerjakan HANYA fase yang saya minta. Di akhir, jalankan lint, typecheck, dan test,
lalu laporkan: (1) apa yang dibuat, (2) cara menjalankan/mencoba,
(3) asumsi yang diambil, (4) hal yang perlu dikonfirmasi tim.
```

---

## C. Prompt per fase

### Fase 0 — Kerangka proyek
```
Fase 0: siapkan kerangka monorepo sesuai AGENTS.md §1–3.
- npm workspaces: apps/web, apps/api, packages/shared.
- docker-compose.yml (MySQL 8, utf8mb4, TZ Asia/Jakarta), .env.example, README singkat.
- ESLint, Prettier, tsconfig strict, Vitest di semua workspace; skrip dev, build, lint, typecheck, test, db:*.
- apps/api: Express 5 dengan helmet, pino, errorHandler format AGENTS §4, GET /api/v1/health.
- apps/web: Vite + React Router + TanStack Query + Tailwind v4 + shadcn/ui.
  Buat styles/tokens.css dari DESIGN.md §2–3 (termasuk text-2xs) dan font Inter lokal.
- Layout aplikasi (DESIGN §5): sidebar lipat + tooltip, drawer di ponsel, header h-14,
  footer "Dikembangkan oleh EDILAKSO · In Development". Menu masih statis dan halaman kosong.
Selesai bila npm run dev menampilkan layout dan /api/v1/health menjawab, dan lint/typecheck/test hijau.
```

### Fase 1 — Domain dan basis data
```
Fase 1: model data dan aturan domain.
- packages/shared/src/constants.ts: peran, status, bobot default, ambang predikat (PROJECT-CONTEXT §5–6).
- packages/shared/src/domain: fungsi murni + unit test lengkap:
  hitungMingguKe(tanggal, tanggalAwalPekan), rentangPekan(mingguKe, tahun, settings),
  apakahJamBentrok(baru, daftarLama), persentaseKehadiran(hadir, wajib),
  rataRataBulanan(rekapPekan[], bulan, tahun) — pekan yang BERIRISAN dengan bulan,
  skorAkhirKinerja(...), skorAkhirMgmp(...), predikatKinerja(skor), predikatMgmp(skor).
  Sertakan kasus tepi: wajib=0, lintas bulan, lintas tahun, manajemen kosong/0, batas rentang jam.
- apps/api/prisma/schema.prisma sesuai PROJECT-CONTEXT §5 (tabel snake_case via @@map, indeks dan unik sama).
  Termasuk sekolah_settings dan tabel sessions. Jangan bawa tabel legacy di §5 "Tidak dibawa".
- Migrasi awal + seed FIKTIF: 1 sekolah contoh, 3 MGMP, 12 guru, 6 kelas, 30 siswa per kelas,
  jadwal mengajar, 4 pekan kehadiran acak yang masuk akal, dan 1 akun per peran.
  Nama dibuat jelas fiktif. Kata sandi akun contoh dari .env, bukan di-hardcode.
Laporkan perbaikan terhadap prototype (PROJECT-CONTEXT §8) yang sudah tertangani di fase ini.
```

### Fase 2 — Login, peran, log aktivitas, pengaturan
```
Fase 2: autentikasi, otorisasi, audit, dan modul Pengaturan.
- /auth/login, /auth/logout, /auth/me, /auth/password (ubah sendiri) + reset kata sandi oleh admin.
  Sesi express-session di MySQL, argon2, rate limit login, origin check (AGENTS §6).
- Middleware requireAuth, requireRole, scopeKelas; lib/audit.ts untuk mencatat aktivitas.
- CRUD Pengaturan (admin): sekolah (nama, logo, tahun ajaran, tanggal awal pekan, hari efektif,
  bobot, jendela penilaian), guru, kelas, siswa, jadwal mengajar, MGMP, akun.
  Validasi: sekretaris_kelas wajib punya kelas_id; jadwal unik (guru, hari, jam_ke).
- Web: halaman Login, menu sesuai peran (PROJECT-CONTEXT §4), halaman Pengaturan bertab,
  DataTable + form dialog, Profil (ubah kata sandi), halaman Log Aktivitas dengan filter.
- Test API: login benar/salah, rate limit, 401, 403 per peran untuk semua rute Pengaturan.
```

### Fase 3 — Absensi guru dan dashboard kelas
```
Fase 3: modul Absensi Guru (kehadiran) + Dashboard Kelas.
- API CRUD /kehadiran dengan filter (tanggal, kelas, guru, status) dan pagination 20.
- Tolak jam bentrok (409) memakai fungsi domain; sekretaris hanya kelasnya (paksa kelas_id dari sesi).
- Dalam satu transaksi: simpan, log aktivitas, hitung ulang rekap pekan lama & baru, batalkan cache.
- Hapus: admin, manajemen_guru, sekretaris (kelasnya); guru_penilai tidak boleh.
- Web: daftar + FilterBar; form cepat ramah ponsel (SegmentedStatus untuk status,
  pilihan jam ke + lama JP, guru disaring dari jadwal kelas pada hari itu bila ada).
- Dashboard kelas: jurnal hari ini, hitungan per status, tombol besar ke form.
- Test: bentrok jam di batas rentang, sekretaris kelas lain → 403, rekap ikut berubah.
```

### Fase 4 — Absensi siswa dan laporan siswa
```
Fase 4: Absensi Siswa + Laporan Rekap Siswa.
- API input massal per kelas & tanggal (upsert per siswa, tanggal, jam_ke) dalam satu transaksi.
- Akses sesuai matriks PROJECT-CONTEXT §4 (versi yang sudah diperketat).
- Web: pilih kelas/tanggal → daftar siswa aktif default "hadir" → ubah via SegmentedStatus → Simpan.
  Riwayat per tanggal.
- Laporan: filter kelas, siswa, rentang tanggal; ringkasan per siswa (hadir/izin/sakit/alpa);
  ekspor CSV (UTF-8 BOM, netralkan formula).
- Test: upsert, akses per peran, ekspor.
```

### Fase 5 — Rekap kehadiran guru
```
Fase 5: Rekap Kehadiran Guru per pekan.
- API daftar rekap dengan filter (pekan, tahun, guru, mapel, kelas, rentang tanggal),
  daftar pekan tersedia, POST /rekap-kehadiran/sync (agregat GROUP BY, bukan loop), ubah/hapus, ekspor CSV.
- Jam wajib hanya hari efektif; persentase dibatasi 100 (PROJECT-CONTEXT §6.3).
- Web: pemilih pekan "Pekan N (tgl–tgl)", tabel dengan ProgressBar berwarna ambang, tombol Sinkronkan
  (dialog konfirmasi), ekspor.
- Test integrasi: hasil sync sama dengan fungsi domain untuk data seed.
```

### Fase 6 — Penilaian kinerja dan MGMP
```
Fase 6: Penilaian Kinerja Bulanan + Penilaian MGMP.
- Sync skor kehadiran otomatis (pekan beririsan bulan), simpan nilai, hitung skor akhir dan
  predikat dengan fungsi domain dan bobot dari sekolah_settings.
- Jendela penilaian: N hari terakhir bulan; di luar jendela → 422, kecuali admin (tercatat di log).
- MGMP: sekretaris_kelas hanya boleh mengisi skor_siswa.
- Web: pilih bulan/tahun, tabel guru/MGMP + StatusBadge predikat, form nilai, info jendela penilaian,
  ekspor CSV. Teks penjelas: "Aspek dan bobot mengikuti ketentuan sekolah."
- Test: kedua rumus skor, predikat di ambang, jendela, batas field sekretaris.
```

### Fase 7 — Dashboard visual
```
Fase 7: dashboard sesuai DESIGN.md §7.
- API /dashboard/ringkasan (KPI, kehadiran hari ini per status, tren 8 pekan,
  5 kelas jam kosong terbanyak, 5 guru persentase terendah), /dashboard/kelas/:id, /dashboard/penilai.
  Satu query agregat per widget; cache singkat (60–300 detik) yang dibatalkan saat data berubah.
- Web: StatCard, grafik Recharts dengan warna status, judul + periode, alternatif teks untuk pembaca layar,
  skeleton saat memuat, klik kelas → dashboard kelas.
- Widget guru terendah hanya untuk admin dan manajemen_guru.
```

### Fase 8 — Pengerasan dan persiapan audit
```
Fase 8: pengerasan sebelum demo.
- Tinjau semua rute terhadap matriks akses; lengkapi test 401/403 yang belum ada.
- Periksa OWASP Top 10 dasar: injeksi, otorisasi, sesi, header keamanan, rate limit,
  galat tanpa stack trace, ekspor CSV aman. Tulis temuan di docs/AUDIT-CHECKLIST.md
  (status: sudah/belum/perlu keputusan). Jangan menulis klaim "aman".
- Aksesibilitas: kontras, fokus, label, navigasi papan ketik (DESIGN §9).
- Uji kinerja ringan dengan seed lebih besar (mis. 60 guru, 36 kelas, satu semester data).
- README: cara menjalankan, akun demo fiktif, status In Development.
- (Opsional, prioritas rendah) Impor kehadiran dari CSV dengan pratinjau (PROJECT-CONTEXT §7).
```

---

## D. Prompt tinjauan (setelah setiap fase)

```
Tinjau hasil fase ini terhadap AGENTS.md §8 (Definisi selesai) dan PROJECT-CONTEXT.md.
Cari: aturan bisnis yang menyimpang, rute tanpa pemeriksaan peran/kelas, rumus di luar
packages/shared/domain, warna mentah di komponen, teks UI non-Indonesia, data yang terlihat nyata,
dan klaim terlarang. Laporkan per temuan: file, masalah, usulan perbaikan. Jangan langsung mengubah kode.
```

## E. Catatan untuk tim

- Fase 1 adalah fondasi. Periksa unit test rumus bersama-sama sebelum lanjut.
- Fitur tambahan dari diskusi tim masuk lewat pembaruan `PROJECT-CONTEXT.md` lebih dulu, baru dibuatkan prompt fase baru.
- Setelah Fase 8, sistem siap untuk **audit teknis** dan demo dengan data contoh. Data nyata baru dipakai setelah audit dan ada kesepakatan tertulis dengan sekolah.
