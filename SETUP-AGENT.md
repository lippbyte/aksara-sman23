# SETUP-AGENT — Apple Design (mobile) + Modern Web Guidance + Phosphor Icons

Panduan ini membuat agent (Claude Code atau Google Antigravity) memasang tiga referensi
dan menyesuaikannya dengan proyekmu secara otomatis.

| Referensi             | Fungsi                                                                                  | Sumber                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `apple-design`        | Prinsip antarmuka ala Apple: gestur, spring, motion, material, tipografi, aksesibilitas | https://openskills.app/skills/apple-design (repo: emilkowalski/skills) |
| `modern-web-guidance` | Agent memakai API/CSS/HTML native modern, bukan pola lama atau polyfill berat           | https://github.com/googlechrome/modern-web-guidance                    |
| Phosphor Icons        | Satu-satunya set ikon proyek                                                            | https://phosphoricons.com                                              |

## Cara pakai

1. Buka Claude Code atau Antigravity di **root proyek**.
2. Tempel **Prompt Master** di bawah (atau simpan file ini di proyek lalu ketik:
   `Baca SETUP-AGENT.md dan jalankan Prompt Master di dalamnya.`).
3. Setelah agent selesai, **mulai sesi baru** supaya skill terbaca (anjuran resmi halaman apple-design).

---

## Prompt Master (tempel ke agent)

````markdown
Kamu akan menyiapkan proyek ini agar semua agent AI (Claude Code dan Antigravity) mengikuti tiga referensi:
(1) skill `apple-design` untuk antarmuka mobile, (2) `modern-web-guidance` dari GoogleChrome untuk kode web modern,
(3) Phosphor Icons sebagai satu-satunya ikon. Kerjakan berurutan. Jangan menimpa file yang sudah ada,
jangan commit, dan tampilkan ringkasan perubahan di akhir.

## FASE 0 — Deteksi proyek (baca saja, belum mengubah apa pun)

Periksa package.json, lockfile, tsconfig, vite/next/astro/nuxt config, tailwind/postcss config, index.html,
folder src/app, browserslist, dan file aturan agent yang sudah ada (CLAUDE.md, AGENTS.md, GEMINI.md, .agents/, .claude/).
Laporkan dalam maksimal 10 baris:

- framework & bahasa (React/Next/Vue/Svelte/vanilla/React Native/Expo/Flutter/SwiftUI/Laravel Blade, dll.)
- pendekatan styling (Tailwind, CSS Modules, SCSS, CSS biasa, styled-components)
- library ikon yang sudah dipakai (lucide, heroicons, fontawesome, dll.)
- apakah proyek ini web, PWA, atau native mobile
- agent yang sedang menjalankan prompt ini (Claude Code atau Antigravity)
- file aturan agent yang sudah ada

## FASE 1 — Pasang referensi

Jalankan perintah yang bisa kamu jalankan sendiri. Jika sebuah perintah berupa slash command interaktif
yang tidak bisa kamu jalankan, jangan dilewati diam-diam: tulis perintahnya di ringkasan akhir sebagai
"perlu dijalankan user".

A. apple-design (semua agent)

```
npx skills add emilkowalski/skills --skill apple-design
npx skills add emilkowalski/skills --skill gestures
npx skills add emilkowalski/skills --skill mobile-native
npx skills add emilkowalski/skills --skill animation-performance
```

`apple-design` merujuk ke `animation-performance`, jadi keduanya perlu terpasang. Jika CLI menanyakan agent
tujuan, pilih agent yang dipakai di proyek ini. Jika proyek memakai React Native/Expo, tambahkan
`--skill animate-expo`.

B. modern-web-guidance

- Antigravity: `agy plugin install https://github.com/GoogleChrome/modern-web-guidance`
- Claude Code (user yang mengetik di prompt Claude Code, karena ini slash command):
  ```
  /plugin marketplace add GoogleChrome/modern-web-guidance
  /plugin install modern-web-guidance@googlechrome
  /reload-plugins
  ```
- Alternatif yang bisa kamu jalankan sendiri di agent mana pun: `npx skills add GoogleChrome/modern-web-guidance`
- Uji CLI: `npx modern-web-guidance@latest search "animate a dialog modal backdrop"`

C. Phosphor Icons — pilih paket sesuai hasil Fase 0

- React / Next.js: `npm i @phosphor-icons/react`
- HTML biasa / Blade / template server: `npm i @phosphor-icons/web`
- Vue, React Native, Flutter, SwiftUI, dll.: buka README repo resmi di https://github.com/phosphor-icons/<platform>
  (vue, swift, flutter, webcomponents, dst.), pastikan nama paket di sana, baru pasang.
  Jangan menebak nama paket.
  Gunakan package manager yang sesuai lockfile (npm/pnpm/yarn/bun).

## FASE 2 — Tulis aturan proyek (satu sumber kebenaran)

1. Buat atau perluas `AGENTS.md` di root dengan blok "Standar UI & Web" (lihat bagian BLOK ATURAN di SETUP-AGENT.md,
   sesuaikan dengan hasil Fase 0 — hapus bagian yang tidak relevan, tambahkan token/konvensi nyata proyek ini).
   Jika file sudah ada, TAMBAHKAN sebagai section baru, jangan menimpa isi lama.
2. Claude Code: pastikan `CLAUDE.md` ada dan berisi baris `@AGENTS.md` (buat jika belum ada; jika sudah ada isi lain, tambahkan baris itu di atas).
3. Antigravity: `AGENTS.md` di root sudah dibaca otomatis. Opsional: salin blok yang sama ke `.agents/rules/ui-web-standards.md`
   hanya jika proyek sudah memakai folder `.agents/rules/`.

## FASE 3 — Sesuaikan dengan proyek

- Styling: petakan aturan ke cara styling proyek (mis. Tailwind → gunakan token/theme yang ada; CSS → custom properties).
  Temukan nilai nyata (warna, spacing, font) dari kode dan tuliskan di bagian "Token proyek" di AGENTS.md.
- Ikon: jika sudah ada library ikon lain, JANGAN mengganti massal. Buat daftar pemakaian lama (file + jumlah),
  usulkan rencana migrasi bertahap, dan tunggu persetujuan. Kode baru langsung pakai Phosphor.
- Browser target: baca browserslist. Bila ada fitur modern yang belum didukung target, ikuti fallback ringan
  yang disarankan guide modern-web-guidance, bukan polyfill berat.
- Native mobile (React Native/Expo/Flutter/SwiftUI): `apple-design` ditulis untuk web. Pakai prinsipnya (spring, interruptibility,
  velocity handoff, reduced motion) tetapi implementasikan dengan API platform tersebut, dan catat ini di AGENTS.md.

## FASE 4 — Verifikasi

- Jalankan `npx modern-web-guidance@latest legacy-scan .` dan rangkum 5 temuan teratas (jangan memperbaiki otomatis).
- Jalankan lint/build/typecheck yang ada; pastikan tidak ada yang rusak oleh perubahanmu.
- Laporkan: file yang dibuat/diubah, perintah yang berhasil, perintah yang perlu dijalankan user, dan pertanyaan terbuka.
- Ingatkan user untuk memulai sesi baru agar skill terbaca.
````

---

## BLOK ATURAN (isi untuk AGENTS.md)

Agent menempelkan dan menyesuaikan blok ini di Fase 2. Kamu juga boleh menyalinnya manual.

```markdown
## Standar UI & Web

### Referensi wajib

- **UI/mobile**: aktifkan skill `apple-design` (dan `gestures`, `mobile-native` bila relevan) sebelum membuat atau meninjau komponen UI.
- **Kode web**: sebelum menulis atau mengubah HTML/CSS/JS/API browser, jalankan
  `npx modern-web-guidance@latest search "<deskripsi tugas>"`, ambil guide yang relevan dengan
  `npx modern-web-guidance@latest retrieve "<guide-id>"`, lalu ikuti pola, gotcha, dan fallback-nya.
  Untuk audit pola usang: `npx modern-web-guidance@latest legacy-scan .`
- **Ikon**: hanya Phosphor Icons (https://phosphoricons.com). Dilarang menambah library ikon lain atau menggambar SVG ikon sendiri
  bila Phosphor sudah punya padanannya.

### Prinsip apple-design (ringkasan dari skill)

- Feedback muncul saat pointer-down, bukan saat lepas. Objek mengikuti jari 1:1 (Pointer Events + `setPointerCapture`).
- Animasi harus bisa diinterupsi: mulai dari nilai live, bukan nilai target. Jangan pakai CSS transition/keyframes untuk gestur.
- Animasikan hanya `transform` dan `opacity`. `will-change` hanya setelah terukur perlu.
- Spring: damping 1.0 dan response 0.3–0.4 s sebagai default; damping ~0.8 hanya bila gestur membawa momentum.
  Kecepatan lepas jari menjadi kecepatan awal spring (velocity handoff).
- Tombol saat ditekan: `scale(0.97)`, 100 ms ease-out. Threshold arah gestur ~10 px. Rubber-banding di batas (konstanta 0.55).
- Material transparan lewat `backdrop-filter`; jangan menumpuk dua permukaan terang; scrim untuk modal; edge fade alih-alih border tebal.
- Wajib hormati `prefers-reduced-motion` (ganti slide/spring dengan cross-fade 200 ms),
  `prefers-reduced-transparency` (permukaan lebih solid), dan `prefers-contrast: more`.
- Tipografi: utamakan system font, satuan `rem`/`em`, judul besar tracking negatif (≈ -0.02em) dan line-height ≈ 1.05, body ≈ 1.5.

### Tambahan khusus mobile (BUKAN dari tiga sumber; praktik umum, hapus jika tidak diinginkan)

- Target sentuh minimal 44×44 px (pedoman Apple HIG).
- Hormati safe area: `viewport-fit=cover` dan `env(safe-area-inset-*)`. Gunakan `dvh`, bukan `vh`, untuk tinggi layar penuh.
- Font input minimal 16 px agar iOS tidak auto-zoom.
- Atur `touch-action` dan `overscroll-behavior` sesuai interaksi gestur.

### Phosphor Icons — aturan pakai

- React/Next: `import { HeartIcon } from "@phosphor-icons/react"` (nama berakhiran `Icon`).
  Di Server Component/SSR, impor dari `@phosphor-icons/react/ssr` (tidak mewarisi `IconContext`).
- Jangan `import * as Icons` dan hindari mengimpor barrel besar di dev; pakai impor spesifik atau `optimizePackageImports` di Next.js 13+.
- Weight: `regular` default, `fill` untuk status aktif/terpilih, `bold` untuk penekanan, `duotone` hanya dekoratif.
  Satu antarmuka memakai satu weight utama secara konsisten.
- Set `color="currentColor"`; atur `size` dan `weight` default lewat `IconContext.Provider`.
- Ikon tanpa teks (tombol ikon) wajib punya label aksesibel (`aria-label` atau `alt`); ikon dekoratif diberi `aria-hidden="true"`.
- HTML biasa: `@phosphor-icons/web` dengan class `ph`, `ph-bold`, `ph-fill`, `ph-duotone`, `ph-light`, `ph-thin`.
  Impor hanya weight yang dipakai; jangan memuat script CDN semua weight (±3 MB).

### Token proyek

(Agent mengisi dari kode nyata: warna, spacing, font, breakpoint, komponen dasar.)
```

---

## Ringkasan perintah manual (tanpa Prompt Master)

| Agent                            | Perintah                                                                                                                                  |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Semua agent: apple-design        | `npx skills add emilkowalski/skills --skill apple-design`                                                                                 |
| Semua agent: modern-web-guidance | `npx skills add GoogleChrome/modern-web-guidance`                                                                                         |
| Wizard modern-web-guidance       | `npx modern-web-guidance@latest install`                                                                                                  |
| Claude Code: plugin              | `/plugin marketplace add GoogleChrome/modern-web-guidance` lalu `/plugin install modern-web-guidance@googlechrome` lalu `/reload-plugins` |
| Antigravity: plugin              | `agy plugin install https://github.com/GoogleChrome/modern-web-guidance`                                                                  |
| Phosphor (React)                 | `npm i @phosphor-icons/react`                                                                                                             |
| Phosphor (HTML)                  | `npm i @phosphor-icons/web`                                                                                                               |

Untuk menonaktifkan telemetri modern-web-guidance: `export DISABLE_TELEMETRY=1` di `.bashrc`/`.zshrc`.

## Struktur file hasil akhir

```
proyek/
├── AGENTS.md          ← sumber aturan (dibaca Antigravity)
├── CLAUDE.md          ← berisi: @AGENTS.md (dibaca Claude Code)
├── .agents/           ← (Antigravity) skills/rules/workflows bila dipakai
└── .claude/           ← (Claude Code) skills terpasang
```

Lokasi aturan Antigravity: `AGENTS.md`, `GEMINI.md`, atau `.agents/rules/*.md` di workspace; aturan global di `~/.gemini/`.
Skill Antigravity: `.agents/skills/<nama>/SKILL.md`.

## Catatan penting

- **`apple-design` bukan dokumen resmi Apple.** Itu skill komunitas (Emil Kowalski, lisensi MIT) yang menerjemahkan prinsip
  interface dan motion Apple ke web. Isinya kuat di gestur, spring, material, tipografi, dan aksesibilitas, tetapi
  tidak memuat ukuran touch target atau safe area. Itu sebabnya ada blok "Tambahan khusus mobile" di atas.
- Skill hanya berisi instruksi (tanpa skrip). Tetap tinjau isi skill sebelum mempercayainya, seperti kode pihak ketiga lainnya.
- Nama paket Phosphor selain React dan web belum diverifikasi di sini; prompt menyuruh agent membaca README repo resminya.
