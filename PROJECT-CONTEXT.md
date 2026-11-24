# PROJECT-CONTEXT — School Management System (nama kerja)

Versi 1.0 · 15 November 2026 · Pemilik: tim EDILAKSO
Sumber: Product Brief School Management System v0.1, `konteks/00` dan `konteks/03` (Project EDILAKSO), dan prototype Laravel "KehadiranGuru" (v2.3) sebagai model awal.

> Dokumen ini adalah **sumber kebenaran produk dan domain** untuk pembangunan ulang. Aturan kerja agen ada di `AGENTS.md`; aturan tampilan ada di `DESIGN.md`.
> Urutan kebenaran bila berbeda: (1) keputusan tim terbaru, (2) dokumen ini, (3) perilaku prototype, (4) asumsi agen. Agen tidak boleh mengganti keputusan tim karena menemukan alternatif yang lebih menarik.

---

## 1. Ringkasan produk

Aplikasi web untuk **mencatat dan merekap kehadiran guru di kelas dan kehadiran siswa**, serta **mendokumentasikan penilaian kinerja guru**, dalam satu tempat yang bisa dibaca pimpinan sekolah.

- **Status: In Development.** Implementasi awal (prototype Laravel) sudah ada. Proyek ini adalah **pembangunan ulang** dengan tech stack baru, UI/UX baru, dan dashboard visual.
- **Belum pernah dicoba di sekolah nyata.** Demo dan pengembangan **hanya memakai data contoh (fiktif)**.
- Produk di bawah **EDILAKSO**, startup produk digital dan inovasi yang dikembangkan tim empat founder. Bukan "studio", bukan "perusahaan".
- Nama produk: **AKSARA** (Administrasi & Sistem Informasi Sekolah) `[TIM: 24 Nov 2026]`. Nama lengkap tetap dari konfigurasi (`VITE_APP_NAME`) agar mudah diganti.

## 2. Tujuan pembangunan ulang

1. Mempertahankan **model domain dan aturan bisnis** prototype (bagian 5–7). Prototype dijadikan spesifikasi, bukan diterjemahkan baris per baris.
2. Mengganti stack ke **React + Express + MySQL (TypeScript)** supaya sesuai keahlian tim.
3. Memperbarui **UI/UX** dan menambah **dashboard visual** untuk pimpinan.
4. Memperbaiki kelemahan prototype (bagian 8).
5. Menyiapkan sistem untuk **audit teknis** sebelum dipakai dengan data nyata.

### Bukan tujuan fase ini
- Absensi dengan **ID card siswa** (masih dalam pengembangan; hanya disiapkan titik perluasannya).
- Multi-sekolah dalam satu instalasi (satu instalasi = satu sekolah).
- Aplikasi mobile native, notifikasi WhatsApp, integrasi dengan sistem pemerintah.
- Landing page publik **terpisah** dari aplikasi (di-host terpisah, tidak berbagi sesi atau basis data).
- Fitur tambahan yang masih didiskusikan tim. Jangan menambah fitur yang tidak ada di dokumen ini.

## 3. Pengguna dan peran

| Peran (kode) | Siapa | Tugas utama |
|---|---|---|
| `admin` | Tata usaha / operator | Mengelola data master dan akun, melihat semua, membaca log aktivitas |
| `manajemen_guru` | Kepala sekolah, wakasek | Memantau dashboard, rekap, laporan; mengisi penilaian |
| `sekretaris_kelas` | Siswa sekretaris kelas (terikat ke **satu kelas**) | Mencatat kehadiran guru di kelasnya dan kehadiran siswa kelasnya |
| `guru_penilai` | Guru yang ditugasi menilai | Mengisi penilaian kinerja bulanan dan MGMP; mencatat kehadiran guru |

Peran `viewer` ada di prototype tetapi tidak dipakai. **Tidak dibawa.**

**Pengguna ≠ pembeli.** Pembeli dan pengambil keputusan adalah kepala sekolah/wakasek.

## 4. Matriks akses

✅ penuh · 🔒 hanya data kelasnya sendiri · 👁 lihat saja · — tidak ada akses

| Modul / aksi | admin | manajemen_guru | sekretaris_kelas | guru_penilai |
|---|---|---|---|---|
| Dashboard | ✅ semua | ✅ semua | 🔒 dashboard kelas | ✅ ringkas |
| Kehadiran guru: lihat, tambah, ubah | ✅ | ✅ | 🔒 | ✅ |
| Kehadiran guru: hapus | ✅ | ✅ | 🔒 | — |
| Kehadiran siswa: lihat | ✅ | 👁 | 🔒 | — **(diperketat, lihat 8.6)** |
| Kehadiran siswa: tambah, ubah, hapus | ✅ | — | 🔒 | — |
| Rekap kehadiran guru (lihat, sinkron, ubah, hapus, ekspor) | ✅ | ✅ | — | — |
| Penilaian kinerja bulanan | ✅ | ✅ | — | ✅ |
| Penilaian MGMP | ✅ | ✅ | 🔒 hanya skor siswa kelasnya (`penilaian_mgmp_siswa`), dan hanya untuk MGMP yang gurunya punya jadwal di kelasnya (selain itu 403 dan tidak tampil) | ✅ |
| Laporan rekap siswa + ekspor | ✅ | ✅ | — | — |
| Log aktivitas | ✅ | — | — | — |
| Pengaturan (guru, kelas, siswa, jadwal, MGMP, akun, sekolah) | ✅ | — | — | — |

Aturan:
- Pemeriksaan akses dilakukan **di server** (middleware + pengecekan kepemilikan data). Menu UI hanya cermin, bukan pengaman.
- `sekretaris_kelas` dibatasi ke `users.kelas_id` di **semua** query, termasuk ubah dan hapus berdasarkan ID.
- Admin boleh mengakses semua modul (sama seperti prototype), tetapi tetap tercatat di log aktivitas.

## 5. Model data (dipertahankan dari prototype)

Nama tabel dan kolom tetap bahasa Indonesia, `snake_case`, seperti prototype. MySQL 8, InnoDB, `utf8mb4`. Semua tabel punya `id` (BIGINT unsigned auto increment), `created_at`, dan `updated_at`.

### Inti
- **users**: `name`, `email` (unik), `password` (hash), `role` enum(`admin`,`manajemen_guru`,`sekretaris_kelas`,`guru_penilai`), `kelas_id` (nullable FK → kelas; wajib bila role `sekretaris_kelas`), `is_active` (baru).
- **sekolah_settings** *(baru, satu baris)*: `nama_sekolah`, `logo_path`, `login_background_path` (nullable), `dashboard_background_path` (nullable), `tahun_ajaran`, `tanggal_awal_pekan` (pengganti konstanta `2026-01-12`), `hari_efektif` (default Senin–Jumat), bobot penilaian (bagian 6.4), `jendela_penilaian_hari` (default 3). Berkas gambar berada di `UPLOAD_DIR` (di luar git).
- **kelas**: `nama_kelas` (unik, mis. "X-1").
- **mgmp**: `nama_mapel` (unik), `deskripsi`.
- **guru**: `kode_guru` (unik), `nip` (nullable, unik), `nama_guru`, `mata_pelajaran` *(perbaiki: prototype tidak konsisten antara `nama_pelajaran` dan `mata_pelajaran`)*, `jabatan`, `mgmp_id` (nullable FK), `status` enum(`aktif`,`tidak_aktif`).
- **siswa**: `nis` (unik), `nama_siswa`, `jenis_kelamin` enum(`L`,`P`), `kelas_id` FK, `wali_kelas`, `status` enum(`aktif`,`tidak_aktif`).
- **jadwal_mengajar**: `guru_id`, `kelas_id`, `hari` (1=Senin … 6=Sabtu), `jam_ke`, `total_jam_mengajar` (default 1). Unik (`guru_id`,`hari`,`jam_ke`).

### Kehadiran
- **kehadiran** (kehadiran guru di kelas): `tanggal`, `guru_id`, `kelas_id`, `jam_ke` (0–12; 0 = pembiasaan pagi), `lama_jam` (1–4 JP), `status_kehadiran` enum(`Hadir`,`Mendampingi`,`Tidak Hadir`), `status_tugas` enum(`Ada`,`Tidak Ada`), `keterangan`, `created_by` FK users. Indeks (`tanggal`,`guru_id`,`kelas_id`,`jam_ke`), (`tanggal`), (`status_kehadiran`).
- **kehadiran_siswa**: `siswa_id`, `kelas_id`, `tanggal`, `jam_ke` (default 1), `status` enum(`hadir`,`izin`,`sakit`,`alpa`), `keterangan`, `created_by`. Unik (`siswa_id`,`tanggal`,`jam_ke`).

### Rekap dan penilaian
- **rekap_kehadiran_guru**: `guru_id`, `tahun`, `minggu_ke`, `tanggal_mulai` (Senin), `tanggal_selesai` (hari efektif terakhir), `total_jam_wajib`, `total_jam_hadir`, `persentase_kehadiran` DECIMAL(5,2), `dikoreksi_manual` (boolean, default false), `alasan_koreksi` (teks, nullable), `dikoreksi_oleh` (nullable FK users), `dikoreksi_pada` (nullable), `jumlah_catatan_saat_koreksi` (nullable; snapshot jumlah catatan kehadiran guru itu pada pekan tersebut saat dikoreksi, Fase 11). Unik (`guru_id`,`tahun`,`minggu_ke`). *(Kolom koreksi baru, Fase 9; lihat 6.3.)*
- **penilaian_kinerja_bulanan**: `guru_id`, `bulan`, `tahun`, `skor_kehadiran`, `skor_administrasi_avg`, `skor_manajemen_avg` (nullable), `skor_akhir`, `catatan`, `dinilai_oleh`. Unik (`guru_id`,`bulan`,`tahun`).
- **penilaian_mgmp**: `mgmp_id`, `bulan`, `tahun`, `skor_kehadiran`, `skor_siswa` (rata-rata `penilaian_mgmp_siswa` periode itu; tidak diisi langsung), `skor_administrasi`, `skor_akhir`, `catatan`, `dinilai_oleh` (penilai yang mengisi skor administrasi/catatan; pengisian skor siswa tidak mengubahnya). Unik (`mgmp_id`,`bulan`,`tahun`).
- **penilaian_mgmp_siswa** *(baru, Fase 9)*: `mgmp_id` FK, `kelas_id` FK, `bulan`, `tahun`, `skor` DECIMAL(5,2), `diisi_oleh` FK users. Unik (`mgmp_id`,`kelas_id`,`bulan`,`tahun`). Satu baris per kelas per bulan; sekretaris hanya mengisi baris kelasnya. Nilai `penilaian_mgmp.skor_siswa` lama (satu skor per MGMP, tanpa kelas) tidak dipindahkan saat migrasi, melainkan dihapus menjadi 0 `[TIM: 16 Nov 2026]`.

### Jejak
- **audit_logs**: `user_id`, `module` (mis. `Piket`, `Siswa`, `Rekap`, `Penilaian`, `Settings`, `Auth`), `aktivitas` (kode, mis. `CREATE_KEHADIRAN`), `entity_type`, `entity_id`, `description`, `ip_address`, `user_agent`.
- **sessions**: penyimpanan sesi login di MySQL. Sesi berakhir **8 jam sejak masuk** (tidak diperpanjang aktivitas) atau setelah **2 jam tanpa aktivitas**, mana yang lebih dulu. Saat kata sandi diganti sendiri atau direset admin, **semua sesi lain** pengguna itu diakhiri (sesi yang sedang dipakai untuk mengganti tetap berlaku) `[TIM: 16 Nov 2026]`.

### Tidak dibawa dari prototype
- `rekap_kinerja_guru` dan `penilaian_kinerja_guru` (modul "Performance" lama) tumpang tindih dengan `rekap_kehadiran_guru` dan `penilaian_kinerja_bulanan`. **Dikonsolidasi.** `[PERLU DIKONFIRMASI]` bila tim ingin mempertahankan skor observasi.
- Tabel `cache`, `jobs`, dan `password_reset_tokens` bawaan Laravel.

## 6. Aturan bisnis (dipertahankan, dengan perbaikan)

### 6.1 Pencatatan kehadiran guru
- Satu catatan = satu guru, satu kelas, satu tanggal, mulai `jam_ke`, berlangsung `lama_jam` JP.
- **Cegah jam bentrok:** guru yang sama, tanggal sama, rentang `[jam_ke, jam_ke + lama_jam − 1]` tidak boleh beririsan dengan catatan lain (abaikan catatan itu sendiri saat ubah).
- `status_tugas` relevan terutama bila `Tidak Hadir`. Tetap disimpan untuk semua status, seperti prototype.
- Setiap tambah/ubah/hapus: (1) tulis log aktivitas, (2) **hitung ulang rekap pekan** untuk guru dan pekan terkait (pekan lama dan pekan baru bila tanggal berubah), (3) batalkan cache dashboard terkait. Semua dalam satu transaksi.

### 6.2 Kehadiran siswa
- Satu catatan per siswa per tanggal per `jam_ke`. Input massal per kelas: sekretaris memilih tanggal, semua siswa aktif tampil dengan default `hadir`, lalu diubah seperlunya.
- `kelas_id` untuk sekretaris selalu diambil dari akunnya, **bukan** dari isian form.

### 6.3 Rekap kehadiran guru per pekan
- Pekan dimulai **Senin**. `minggu_ke` dihitung dari `sekolah_settings.tanggal_awal_pekan`; tanggal sebelum itu masuk pekan 1.
- Rentang pekan: Senin sampai hari efektif terakhir (default Jumat).
- `total_jam_wajib` = jumlah `total_jam_mengajar` dari jadwal guru **pada hari efektif saja**. *(Perbaikan: prototype menjumlahkan semua hari termasuk Sabtu.)*
- `total_jam_hadir` = jumlah `lama_jam` untuk status `Hadir` atau `Mendampingi` dalam rentang pekan.
- `persentase_kehadiran` = `min(100, round(hadir / wajib × 100, 2))`; 0 bila jam wajib 0.
- Sinkron massal: hitung ulang semua guru aktif untuk satu pekan.
- **Koreksi manual** `[TIM: 16 Nov 2026]`: admin/manajemen boleh mengubah jam wajib dan jam hadir satu baris rekap dengan **alasan wajib**. Persentase tetap dihitung dengan rumus di atas. Baris ditandai `dikoreksi_manual` beserta alasan, pengoreksi, dan waktunya, lalu dicatat di log.
- Sinkron **melewati** baris yang dikoreksi manual. Hanya **admin** yang boleh memilih `timpa_koreksi`; sebelum itu dialog konfirmasi menyebut jumlah baris yang akan ditimpa. Baris yang ditimpa kembali ke hasil hitung dan tanda koreksinya dihapus; penimpaan dicatat di log (`TIMPA_KOREKSI_REKAP`).
- Hitung ulang otomatis karena perubahan kehadiran (6.1) juga melewati baris yang dikoreksi manual. `[ASUMSI, perlu dikonfirmasi]`
- Baris terkoreksi diberi lencana **"Data berubah sejak dikoreksi"** bila (a) jumlah catatan kehadiran guru itu pada pekan tersebut sekarang **berbeda** dari snapshot `jumlah_catatan_saat_koreksi` (menangkap catatan yang ditambah maupun **dihapus**), atau (b) ada catatan pekan itu yang dibuat/diubah setelah `dikoreksi_pada`. Rekap **tidak** dihitung ulang otomatis; lencana hilang setelah dikoreksi ulang atau ditimpa sinkron (snapshot ikut dihapus). Baris yang dikoreksi sebelum ada snapshot hanya memakai pemeriksaan (b). `[TIM: 16 Nov 2026]`

### 6.4 Penilaian kinerja guru bulanan
- `skor_kehadiran` diisi otomatis = rata-rata `persentase_kehadiran` pekan-pekan yang **beririsan** dengan bulan itu. *(Perbaikan: prototype hanya menghitung pekan yang seluruhnya berada di dalam bulan.)*
- `skor_akhir` (bobot default dari prototype, dapat diatur sekolah):
  - bila `skor_manajemen_avg` kosong atau 0 → kehadiran 50% + administrasi 50%;
  - bila ada → kehadiran 50% + administrasi 30% + manajemen 20%.
- Predikat: ≥91 Sangat Baik · ≥76 Baik · ≥61 Cukup · selain itu Kurang.
- **Jendela penilaian:** pengisian dibuka pada 3 hari terakhir bulan berjalan (dapat diatur). Admin dapat membuka di luar jendela; tindakan itu tercatat di log.
- **Pekan belum disinkron** `[TIM: 16 Nov 2026]`: halaman Penilaian Kinerja dan MGMP menampilkan peringatan "n pekan bulan ini belum disinkron" untuk pekan yang beririsan dengan bulan, sudah selesai (hari efektif terakhirnya sebelum hari ini), dan belum punya satu pun baris rekap. Pekan itu **tidak dihitung sebagai 0**; skor kehadiran hanya dari pekan yang punya rekap. Pekan dengan minimal satu baris rekap dianggap sudah disinkron `[ASUMSI]`.
- **Pekan rekap sebagian** `[TIM: 16 Nov 2026]`: pekan yang sudah selesai dan punya baris rekap, tetapi jumlah guru aktif berjam wajib > 0 yang punya baris < jumlah guru aktif berjam wajib > 0 (jam wajib = jadwal hari efektif saat ini). Peringatannya digabung dengan "belum disinkron" dalam satu kotak dan satu judul ("n pekan bulan ini belum disinkron lengkap"); pekan tanpa baris sama sekali hanya tercantum sebagai "belum disinkron". Baris rekap guru nonaktif atau tanpa jam wajib tidak menutupi kekurangan.
- `skor_administrasi_avg` di prototype disebut "rata-rata dari 5 atasan", tetapi hanya rata-ratanya yang disimpan. `[PERLU DIKONFIRMASI]` apakah perlu tabel nilai per penilai.
- Aspek dan bobot penilaian **mengikuti ketentuan sekolah**. Sistem hanya mendokumentasikan, tidak memutuskan.

### 6.5 Penilaian MGMP bulanan
- `skor_kehadiran` otomatis = rata-rata `persentase_kehadiran` guru aktif di MGMP itu, untuk pekan yang beririsan dengan bulan. *(Perbaikan: query prototype memakai kolom `bulan` yang tidak ada dan `orWhere` yang bocor.)* Rinciannya `[TIM: 16 Nov 2026]`:
  - skor tiap guru = rata-rata persentase pekan yang beririsan dengan bulan **dan** punya jam wajib > 0; skor MGMP = rata-rata skor guru;
  - **hanya guru tanpa jam wajib yang dikeluarkan**: guru yang semua rekap pekannya berjam wajib 0, atau yang tidak punya rekap dan tidak punya jadwal pada hari efektif;
  - guru **berjadwal** (jam wajib jadwal > 0) yang belum punya catatan/rekap pada bulan itu **dihitung 0**;
  - pekan berjam wajib 0 milik guru yang punya pekan berjadwal lain dilewati, bukan dihitung 0%. `[ASUMSI, perlu dikonfirmasi]`
- **Kelas berjadwal** MGMP = kelas yang punya jadwal mengajar (hari apa pun) dari guru **aktif** anggota MGMP itu. `[TIM: 16 Nov 2026]`
- `skor_siswa` = rata-rata skor kelas **berjadwal** di `penilaian_mgmp_siswa` yang sudah diisi; 0 bila belum ada. Halaman dan CSV menampilkan "n dari m kelas": m = jumlah kelas berjadwal, n = kelas berjadwal yang sudah mengisi. MGMP tanpa jadwal sama sekali → "0 dari 0 kelas" (tampil "Tidak ada kelas berjadwal"), skor siswa 0.
- Sekretaris mengisi skor **kelasnya sendiri** (kelas dari akun, bukan dari form) dan hanya untuk MGMP yang kelasnya berjadwal; di luar itu 403 dan MGMP itu tidak tampil di daftarnya. Admin/manajemen/penilai memilih kelas; kelas tanpa jadwal MGMP itu ditolak 422 dengan pesan yang menyebut kelas dan MGMP-nya `[ASUMSI, perlu dikonfirmasi]`.
- Isian dari kelas yang kemudian tidak lagi berjadwal tetap tersimpan, tampil di rincian per kelas dengan tanda "tidak dihitung", dan tidak ikut rata-rata. `[ASUMSI]`
- `skor_administrasi` dan `catatan` diisi admin/pimpinan/penilai.
- Sinkron MGMP menghitung ulang `skor_kehadiran` dan `skor_siswa` lalu `skor_akhir`; isian penilai tidak berubah.
- `skor_akhir` = kehadiran 40% + siswa 30% + administrasi 30% (default, dapat diatur).
- Predikat: ≥90 Sangat Aktif · ≥75 Aktif · ≥60 Cukup Aktif · selain itu Kurang Aktif.

### 6.6 Skor
Semua skor 0–100, dua desimal. Pembulatan hanya pada nilai akhir yang disimpan.

## 7. Halaman dan alur (dari prototype)

| Halaman | Isi utama |
|---|---|
| Login | Email + kata sandi |
| Dashboard utama | Kartu ringkasan (guru aktif, siswa, kelas, catatan hari ini), **kehadiran guru hari ini per status**, tren mingguan, kelas dengan jam kosong terbanyak, log aktivitas terbaru (admin) |
| Dashboard kelas | Untuk sekretaris dan dari klik kelas: jurnal mengajar hari ini, hitungan Hadir/Mendampingi/Tidak Hadir, filter tanggal, guru, dan status |
| Absensi guru | Daftar + filter (tanggal, kelas, guru, status); form catat (kelas, tanggal, jam ke, lama JP, guru, status, tugas, keterangan) |
| Absensi siswa | Pilih kelas dan tanggal → daftar siswa dengan pilihan status; riwayat |
| Rekap kehadiran guru | Pilih pekan/tahun + filter guru, mapel, kelas, rentang tanggal; tombol sinkron; ekspor |
| Penilaian kinerja | Pilih bulan/tahun; tabel guru dengan skor dan predikat; sinkron skor kehadiran; form nilai; ekspor |
| Penilaian MGMP | Pilih bulan/tahun; tabel MGMP; sinkron; form nilai; ekspor |
| Laporan rekap siswa | Filter kelas, siswa, rentang tanggal; ekspor |
| Log aktivitas | Filter modul, pengguna, tanggal |
| Pengaturan | Tab: Sekolah, Guru, Kelas, Siswa, Jadwal, MGMP, Akun |
| Profil | Ubah kata sandi; admin bisa reset kata sandi pengguna |
| Bantuan, Tentang | Panduan singkat; "Dikembangkan oleh EDILAKSO" dan status produk |

**Ekspor:** prototype mengekspor CSV. Pertahankan CSV (UTF-8 dengan BOM agar terbaca Excel); XLSX boleh ditambahkan nanti.

**Impor data master oleh admin (wajib sebelum data nyata, Fase 14):** impor guru, siswa, dan jadwal mengajar (CSV UTF-8) oleh admin dengan templat kosong, pratinjau validasi, laporan galat per baris, simpan atomik dalam satu transaksi, dan fitur hapus data pilot dengan konfirmasi berlapis.

**Impor kehadiran dari spreadsheet** (fitur prototype `import:kehadiran`): format kolom `Tanggal, Kelas, Hari, Jam, Waktu, Mata Pelajaran, Nama Guru, Status Kehadiran, Status Tugas`; pemetaan `Sudah Ada→Hadir`, `Belum Ada→Tidak Hadir`. Jadikan fitur admin dengan pratinjau sebelum simpan. **Prioritas rendah.**

## 8. Kelemahan prototype yang wajib diperbaiki

1. Konstanta `REFERENCE_DATE = 2026-01-12` dan parameter `tahun` yang diabaikan saat menghitung pekan → pindah ke `sekolah_settings` dan hitung dengan benar lintas tahun.
2. Jam wajib menghitung hari Sabtu padahal rekap Senin–Jumat (6.3).
3. Rata-rata bulanan mengabaikan pekan lintas bulan (6.4).
4. Query MGMP rusak (6.5).
5. `created_by` jatuh ke ID 1 bila tidak ada pengguna → wajib dari sesi.
6. Daftar kehadiran siswa bisa dilihat semua pengguna login → dibatasi sesuai matriks.
7. Nama dan logo sekolah tertanam di kode → dari `sekolah_settings`.
8. Kolom `nama_pelajaran`/`mata_pelajaran` tidak konsisten → satu nama: `mata_pelajaran`.
9. Rekap dihitung per guru dalam loop → gunakan query agregat agar sinkron massal cepat.
10. Tidak ada uji otomatis → aturan 6.x wajib punya unit test.

## 9. Data dan privasi

- Data siswa adalah **data anak**; penilaian guru **sensitif secara organisasi**.
- Pengembangan dan demo **hanya dengan seeder data fiktif**. Jangan memakai atau mengimpor CSV dan data dari prototype yang berisi nama asli.
- **Gerbang sebelum data nyata masuk:** (1) izin tertulis dari sekolah, (2) tinjauan independen dan pengerasan minimal (HTTPS, rahasia baru, cadangan harian + uji pemulihan), (3) data nyata tidak lewat repo, CI, seeder, agen, maupun obrolan AI (masuk hanya lewat fitur impor admin di server tujuan), (4) data seperlunya tanpa alamat/kontak/foto siswa, (5) peluncuran bertahap, (6) gambar spesifik sekolah (foto gedung, logo) tidak masuk repo dan hanya muncul di instalasi sekolah itu dengan izin sekolah.
- Simpan data seperlunya. Tidak ada foto, alamat, atau kontak siswa pada fase ini.
- Kata sandi di-hash; sesi lewat cookie httpOnly; validasi semua input; batasi percobaan login.
- **Dilarang** menulis klaim "aman", "terenkripsi", atau "sesuai UU PDP" di UI, README, atau materi sebelum ada audit dan verifikasi hukum.
- Daftar audit teknis sebelum data nyata: kontrol akses dan peran, penyimpanan dan cadangan data, keamanan dasar (OWASP Top 10), kebijakan retensi.

## 10. Aturan klaim di dalam aplikasi

- Halaman Tentang dan footer: "Dikembangkan oleh EDILAKSO" + status "In Development".
- Tanpa jumlah pengguna, testimoni, harga, atau klaim AI.
- Kata yang dihindari: "terbaik", "nomor 1", "revolusioner", "terjamin", "100%".

## 11. Keputusan teknis `[TIM: 15 Nov 2026]`

- Frontend: **React + Vite + TypeScript**.
- Backend: **Express + TypeScript**.
- Database: **MySQL 8**.
- Rincian pustaka di `AGENTS.md` adalah usulan pelaksanaan; boleh diubah tim.

## 12. Open items `[PERLU DIKONFIRMASI]`

1. ~~Nama final produk~~ AKSARA dan palet biru sudah ditetapkan `[TIM: 24 Nov 2026]` (DESIGN §12). Masih terbuka: tagline publik dan logo produk.
2. Kebutuhan mode gelap pada versi pertama atau ditunda.
3. Fitur tambahan dari diskusi tim.
4. Skor observasi dari modul Performance lama: dibuang atau dipertahankan?
5. Perlu nilai per penilai (5 atasan) atau cukup rata-rata?
6. Target hosting (VPS/PaaS untuk Node) dan siapa pemilik/pengelola server selama pilot.
7. Rencana ID card: teknologi pemindai dan perangkat.
