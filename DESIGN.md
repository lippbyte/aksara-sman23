# DESIGN — School Management System (nama kerja)

Versi 1.0 · 15 November 2026
Dasar: gaya visual prototype Laravel "KehadiranGuru" v2.3 (Tailwind, Blade + Alpine). Gaya itu **dipertahankan**, lalu dirapikan untuk React dan diperbaiki sisi aksesibilitasnya.

> Identitas visual produk belum ditetapkan `[PERLU DIKONFIRMASI]`. Semua warna disimpan sebagai token (CSS variable) agar bisa diganti tanpa menyentuh komponen. **Jangan** memakai logo, warna, atau maskot EDILAKSO maupun produk EDILAKSO lain (LANJUT, SUSI, dll.) di dalam UI aplikasi. EDILAKSO hanya muncul sebagai teks "Dikembangkan oleh EDILAKSO" di footer dan halaman Tentang.

---

## 1. Karakter

Alat kerja harian sekolah: **tenang, padat, mudah dipindai**. Netral abu-batu (slate) dengan satu aksen. Warna status hanya untuk makna (hadir, mendampingi, tidak hadir), bukan hiasan. Input harus cepat di ponsel, karena sekretaris kelas mencatat dari kelas.

## 2. Token warna

Diturunkan dari kelas Tailwind yang paling banyak dipakai prototype.

| Token | Nilai | Pakai untuk |
|---|---|---|
| `--bg-app` | slate-50 `#F8FAFC` | Latar halaman |
| `--bg-surface` | white `#FFFFFF` | Kartu, sidebar, header, tabel |
| `--bg-subtle` | slate-100 `#F1F5F9` | Latar input, baris hover, chip |
| `--border` | slate-200 `#E2E8F0` | Garis kartu, tabel, input |
| `--border-soft` | slate-100 `#F1F5F9` | Pemisah di dalam kartu |
| `--text` | slate-900 `#0F172A` | Teks utama, judul |
| `--text-muted` | slate-600 `#475569` | Teks sekunder, label |
| `--text-subtle` | slate-500 `#64748B` | Keterangan kecil, header tabel |
| `--icon-muted` | slate-400 `#94A3B8` | **Hanya ikon dan dekorasi**, bukan teks |
| `--primary` | slate-900 `#0F172A` | Tombol utama, menu aktif |
| `--primary-hover` | black `#020617` | Hover tombol utama |
| `--accent` | indigo-600 `#4F46E5` | Tautan, fokus, grafik utama, seleksi |
| `--accent-soft` | indigo-50 `#EEF2FF` | Latar chip/tab aktif |

### Warna status (semantik, wajib konsisten di semua halaman dan grafik)

| Status | Teks | Latar | Grafik |
|---|---|---|---|
| Hadir / hadir | emerald-700 `#047857` | emerald-50 | emerald-500 |
| Mendampingi | indigo-700 `#4338CA` | indigo-50 | indigo-500 |
| Tidak Hadir / alpa | rose-700 `#BE123C` | rose-50 | rose-500 |
| Izin | amber-700 `#B45309` | amber-50 | amber-500 |
| Sakit | sky-700 `#0369A1` | sky-50 | sky-500 |
| Tugas: Ada | slate-700 | slate-100 | — |
| Tugas: Tidak Ada | rose-700 | rose-50 | — |

Predikat penilaian: Sangat Baik/Sangat Aktif → emerald · Baik/Aktif → indigo · Cukup/Cukup Aktif → amber · Kurang/Kurang Aktif → rose.

### Perbaikan aksesibilitas dari prototype
- Prototype memakai `text-slate-400` untuk banyak teks (kontras ±2,6:1). **Ganti** ke `--text-subtle` (slate-500, ±4,8:1) atau lebih gelap. Kontras teks minimal **4,5:1**.
- Lencana `text-[9px] font-black` **tidak dipakai lagi**. Ukuran teks minimal 11 px (`text-2xs`).
- Warna status selalu disertai **teks atau ikon**, tidak pernah hanya warna.

## 3. Tipografi

- Font: **Inter** (400, 500, 600, 700), dimuat lokal via `@fontsource/inter`, tidak dari CDN. Cadangan: `ui-sans-serif, system-ui`.
- Ukuran dasar UI **14 px** (`text-sm`), sama dengan prototype.

| Peran | Kelas | Catatan |
|---|---|---|
| Judul halaman | `text-xl font-bold tracking-tight` | Satu per halaman |
| Judul kartu | `text-sm font-semibold` | |
| Isi | `text-sm` | |
| Keterangan, sel tabel padat | `text-xs` | |
| Label kecil / header tabel | `text-2xs font-semibold uppercase tracking-wider text-[--text-subtle]` | `2xs` = 11 px / 16 px |
| Angka KPI | `text-2xl font-bold tabular-nums` | |
| Angka di tabel | `tabular-nums` | Rata kanan |

Definisikan di Tailwind v4: `--text-2xs: 0.6875rem; --text-2xs--line-height: 1rem;`.

## 4. Ruang, sudut, bayangan

- Skala jarak Tailwind standar. Padding kartu `p-4` (ponsel) / `p-5` (desktop). Jarak antar-kartu `gap-4`.
- Sudut: kartu `rounded-xl`, input dan tombol `rounded-lg`, lencana `rounded-md`, avatar/titik `rounded-full`.
- Bayangan minim: kartu memakai **garis** `border` tanpa bayangan; menu aktif dan dropdown memakai `shadow-sm`/`shadow-md`.
- Animasi 150–300 ms (`transition-all duration-200`). Hormati `prefers-reduced-motion`.

## 5. Tata letak (dari prototype)

```
┌──────────────┬───────────────────────────────────────────────┐
│ Sidebar      │ Header h-14 (sticky): judul halaman · pengguna │
│ w-60         ├───────────────────────────────────────────────┤
│ (lipat: w-16)│ Konten: max-w-7xl, px-4 sm:px-6, py-6         │
│ logo sekolah │                                               │
│ menu         │                                               │
│ ...          │                                               │
│ [Keluar]     │ Footer kecil: "Dikembangkan oleh EDILAKSO ·   │
│              │ In Development"                               │
└──────────────┴───────────────────────────────────────────────┘
```

- **Sidebar** putih, `border-r`. Bagian atas setinggi `h-14`: logo sekolah (dari pengaturan) + nama aplikasi + nama sekolah kecil `text-2xs uppercase`.
- **Menu**: ikon 18 px + label. Aktif: `bg-slate-900 text-white shadow-md`. Tidak aktif: `text-slate-600 hover:bg-slate-50 hover:text-slate-900`.
- **Lipat sidebar** (desktop): tombol bulat kecil di tepi kanan; saat terlipat hanya ikon dan **tooltip** label di kanan. Status lipat disimpan di `localStorage`.
- **Ponsel** (<1024 px): sidebar menjadi laci (drawer) dengan latar `bg-slate-900/50 backdrop-blur-sm`; tombol menu di header.
- **Tombol Keluar** di bawah sidebar: `bg-slate-50 hover:bg-rose-50 hover:text-rose-700`.
- Menu ditampilkan sesuai peran (urutan dari prototype): Dashboard Utama · Absensi Guru · Absensi Siswa · Rekap Kehadiran Guru · Penilaian Kinerja · Penilaian MGMP · Laporan Rekap Siswa · Log Aktivitas · Pengaturan. Bantuan dan Tentang di menu pengguna.

## 6. Komponen

Pakai **shadcn/ui** (Radix) sebagai dasar, disesuaikan dengan token di atas. Ikon: **lucide-react**, 16–18 px, `stroke-width 2`.

| Komponen | Spesifikasi |
|---|---|
| **Button** | `primary` (slate-900), `secondary` (putih + border), `ghost`, `danger` (rose-600). Tinggi 36 px; di ponsel 44 px untuk aksi utama form. Ada state loading (spinner + teks tetap). |
| **Card** | `bg-white rounded-xl border border-slate-200`; header berisi judul + aksi kanan. |
| **StatCard** (KPI) | Label `text-2xs uppercase`, angka `text-2xl tabular-nums`, keterangan perubahan/konteks kecil, ikon dalam kotak `rounded-lg bg-slate-100`. |
| **StatusBadge** | `rounded-md px-2 py-0.5 text-2xs font-semibold` + titik warna; teks status selalu tampil. |
| **DataTable** | TanStack Table. Header `text-2xs uppercase`, baris `text-sm`, `hover:bg-slate-50`, garis `divide-slate-100`. Pagination 20 baris (sama dengan prototype). Kolom angka rata kanan. Di ponsel, tabel berubah menjadi daftar kartu. |
| **FilterBar** | Baris filter di atas tabel (tanggal, kelas, guru, status) + tombol Reset. Nilai filter tersimpan di URL query. |
| **Form** | Label di atas input, teks bantuan di bawah, galat `text-rose-700` dengan ikon. Validasi zod yang sama dengan server. |
| **SegmentedStatus** | Pilihan status dengan tombol bersebelahan (Hadir / Mendampingi / Tidak Hadir; hadir / izin / sakit / alpa) — lebih cepat dari dropdown di ponsel. |
| **Dialog konfirmasi** | Untuk hapus dan sinkron massal; sebutkan apa yang terkena. |
| **Toast** | Sonner, kanan atas (desktop) / bawah (ponsel). |
| **EmptyState** | Ikon + satu kalimat + aksi utama ("Belum ada catatan hari ini. Catat kehadiran"). |
| **Skeleton** | Untuk tabel dan grafik saat memuat. |
| **ProgressBar** | Persentase kehadiran di rekap (warna sesuai ambang: ≥90 emerald, ≥75 indigo, ≥60 amber, <60 rose). |

## 7. Dashboard visual (baru)

Grafik dengan **Recharts**. Warna dari token status. Setiap grafik punya judul, keterangan periode, dan tabel/angka alternatif untuk pembaca layar.

**Dashboard utama (admin, manajemen_guru):**
1. Baris KPI: Guru aktif · Siswa aktif · Rombel · Catatan kehadiran hari ini.
2. **Kehadiran guru hari ini**: bar bertumpuk per status (Hadir/Mendampingi/Tidak Hadir) + persentase jam terisi.
3. **Tren persentase kehadiran guru per pekan** (garis, 8 pekan terakhir).
4. **Kelas dengan jam kosong terbanyak** pekan ini (bar horizontal, 5 teratas; klik → dashboard kelas).
5. **Guru dengan persentase terendah** pekan ini (tabel kecil, 5 teratas). Tampilkan hanya untuk `manajemen_guru` dan `admin`.
6. Log aktivitas terbaru (admin saja).

**Dashboard kelas (sekretaris_kelas):** tombol besar "Catat kehadiran guru" dan "Absen siswa", jurnal mengajar hari ini, hitungan per status.

**Dashboard guru_penilai:** jendela penilaian (buka/tutup + tenggat), daftar guru yang belum dinilai bulan ini.

Ketentuan: tidak ada grafik 3D, tidak ada pie untuk lebih dari 4 kategori, sumbu Y persentase 0–100, angka diformat `id-ID`.

## 8. Bahasa dan format

- Bahasa Indonesia, kalimat pendek, kata kerja di tombol ("Simpan", "Catat kehadiran", "Sinkronkan rekap").
- Tanggal: `Senin, 16 Nov 2026` (panjang) dan `16/11/2026` (tabel). Pekan: "Pekan 45 (10–14 Nov)".
- Angka desimal pakai koma: `87,50%`.
- Istilah tetap: **Absensi Guru**, **Absensi Siswa**, **JP** (jam pelajaran), **Jam ke-**, **MGMP**, **Rekap**.

## 9. Aksesibilitas dan responsif

- Target WCAG 2.1 AA: kontras, fokus terlihat (`ring-2 ring-indigo-500 ring-offset-2`), semua aksi bisa dengan papan ketik, label pada setiap input, `aria-live` untuk toast.
- Titik henti: ponsel 360 px (wajib nyaman untuk form absensi), tablet 768 px, desktop 1024 px+.
- Area sentuh minimal 44 × 44 px untuk aksi input di ponsel.

## 10. Yang tidak dilakukan

- Tidak memakai logo atau nama sekolah tertentu di kode; semuanya dari pengaturan.
- Tidak menampilkan data nyata di tangkapan layar, demo, atau dokumentasi.
- Tidak menulis klaim keamanan atau kepatuhan di UI.
- Tidak memakai identitas visual EDILAKSO atau produk EDILAKSO lain di UI aplikasi.

---

## 11. Peningkatan UI/UX, navigasi mobile, latar, dan gerak halus

### 11.1 Sistem desain v1 (Laravel) dipertahankan, dengan empat penyesuaian
Ringkasan sistem v1: Inter, slate netral, aksen indigo, border tipis alih-alih bayangan tebal, `rounded-xl` untuk kartu dan `rounded-lg` untuk input, tombol utama slate-900, kaca pada halaman masuk. Semua itu sudah ada di §2–6 dan tetap berlaku. Penyesuaian dari v1:

1. **`text-2xs` = 11 px / 16 px** (v1: 10 px). Tidak ada ukuran di bawah itu.
2. **Tanpa `font-black` dan `uppercase` pada lencana status.** Bobot maksimum 700. `uppercase` hanya untuk label kecil dan header tabel.
3. **`slate-400` hanya untuk ikon dan dekorasi**, bukan teks.
4. **Mode gelap ditunda.** Token tetap dibuat sebagai variabel CSS sehingga mudah ditambahkan nanti. `[PERLU DIKONFIRMASI]` apakah perlu di versi pertama.

### 11.2 Navigasi mobile (<1024 px): bar bawah ala aplikasi

- Di bawah 1024 px, sidebar diganti **bar navigasi bawah** tetap. Di 1024 px ke atas sidebar tetap.
- **Maksimal lima slot**: empat tujuan utama + "Lainnya" (lembar dari bawah berisi menu sisanya). Isi per peran (usulan):

| Peran | Slot 1–4 | Slot 5 |
|---|---|---|
| `sekretaris_kelas` | Beranda · Absensi Guru · Absensi Siswa · Penilaian MGMP | Akun |
| `guru_penilai` | Beranda · Absensi Guru · Penilaian Kinerja · Penilaian MGMP | Akun |
| `manajemen_guru` | Beranda · Rekap · Penilaian · Laporan | Lainnya |
| `admin` | Beranda · Absensi Guru · Rekap · Penilaian | Lainnya |

- Tinggi 56 px **ditambah** `env(safe-area-inset-bottom)`. Area sentuh tiap slot minimal 48 × 48 px. Ikon 22 px dengan **label selalu tampil** (11 px). Slot aktif: ikon dan label berwarna indigo-600 dengan penanda pil di belakang ikon, jadi tidak mengandalkan warna saja.
- Semantik: `<nav aria-label="Navigasi utama">`, `aria-current="page"`, urutan fokus papan ketik logis.
- Konten halaman diberi `padding-bottom` setinggi bar + safe area. Tombol aksi utama form (mis. "Simpan") berupa bar lekat **di atas** bar navigasi.
- Bar disembunyikan saat papan ketik virtual terbuka, supaya tidak menutupi isian.
- Header mobile: `h-12`, judul halaman + menu akun. **Tanpa hamburger.** Menu sisa ada di "Lainnya".
- Lembar "Lainnya": muncul dari bawah, bisa ditutup dengan tombol, geser ke bawah, dan Esc, fokus terkunci di dalamnya dan kembali ke pemicu saat ditutup.
- Perpindahan halaman memakai penanda aktif yang bergeser halus (lihat 11.4).

### 11.3 Gambar latar

**Halaman masuk**
- Foto tampak depan sekolah sebagai lapisan latar penuh layar, ditumpuk dengan lapisan putih/slate sehingga foto hanya terlihat samar (setara opasitas 8–15 %). **Jangan** menurunkan opasitas elemen yang berisi teks; pakai lapisan terpisah (pseudo-element atau `<img>` dekoratif) agar teks tetap tajam.
- Kartu masuk: putih 90 %+ dengan `backdrop-filter: blur(12px)` (cadangan: putih solid). Kontras teks tetap ≥ 4,5:1.
- Bila foto belum diunggah: pola/gradasi bawaan dari token, bukan area kosong.

**Dashboard**
- Jangan menaruh foto penuh di belakang tabel dan grafik. Pendekatan yang disarankan: **lapisan foto di bagian atas halaman** (±280 px, opasitas 6–10 %, abu-abu, sedikit blur) yang memudar ke `--bg-app` dengan `mask-image: linear-gradient`. Kartu tetap putih solid.
- Area kosong di bawah konten diisi lewat tata letak (kartu yang lebih tinggi, ringkasan tambahan, state kosong yang informatif), bukan hanya gambar.

**Ketentuan gambar**
- Diunggah admin lewat **Pengaturan → Sekolah** (dua slot: latar masuk, latar dashboard; opsional). Disimpan di luar git.
- Server mengubah ukuran menjadi 640/1280/1920 px dalam WebP (cadangan JPEG), membuang EXIF, anggaran ≤ 150 KB untuk varian terbesar. Pakai `srcset`/`image-set`, `decoding="async"`, tanpa menunda LCP form masuk.
- Gambar dekoratif: `alt=""`. Foto tidak boleh memuat wajah orang yang dapat dikenali, dan sekolah harus mengizinkan pemakaiannya.

### 11.4 Gerak halus

- Token: `--dur-fast: 150ms`, `--dur-base: 220ms`, `--dur-slow: 320ms`, `--ease-out: cubic-bezier(.2,.8,.2,1)`.
- Yang dianimasikan: masuk halaman (fade + geser 6 px, sekali), kartu dashboard muncul berurutan (jeda 40 ms, maksimal 8 kartu), penanda aktif bar bawah, lembar dan dialog (masuk/keluar), toast, tekan tombol (`scale(.98)`), isi ProgressBar, grafik tergambar sekali saat pertama muncul, skeleton.
- Aturan: hanya `transform` dan `opacity`; tidak menggeser tata letak (CLS 0); tidak ada animasi pada baris tabel, ketikan, atau angka yang sedang diedit; tidak ada animasi berulang selain indikator memuat.
- `@media (prefers-reduced-motion: reduce)`: hilangkan gerak spasial, sisakan fade ≤ 100 ms, matikan animasi grafik.
- Utamakan fitur platform (transisi CSS, `@starting-style`, View Transitions untuk perpindahan halaman, animasi bergulir) **dengan cadangan** tanpa animasi. Cek dukungan browser lewat panduan sebelum memakai.
- Uji di Chrome DevTools dengan CPU 4× lebih lambat; tidak boleh patah-patah.

### 11.5 Responsif per halaman

| Halaman | Mobile (360–1023 px) |
|---|---|
| Masuk | Satu kolom, kartu di tengah, latar foto, tombol penuh lebar 48 px |
| Dashboard | Satu kolom; KPI 2 × 2; grafik penuh lebar dengan tabel alternatif ringkas; "Catat" sebagai aksi utama untuk sekretaris |
| Absensi Guru / Siswa | Daftar kartu (bukan tabel); filter di lembar bawah; form status memakai SegmentedStatus; bar simpan lekat |
| Rekap, Penilaian, Laporan | Kartu per guru/MGMP dengan ProgressBar; tabel penuh hanya di ≥ 768 px; ekspor di menu aksi |
| Pengaturan | Tab menjadi daftar yang dibuka satu per satu; form di layar penuh |
| Semua | Tidak ada gulir horizontal pada 360 px; teks dasar ≥ 14 px; fokus terlihat |
