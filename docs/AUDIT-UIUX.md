# AKSARA — UI/UX Audit (Phase 0)

Date: 24 Nov 2026 · Scope: `apps/web` (React app). Landing page is out of scope.
Status: decisions D1–D6 accepted as recommended (24 Nov 2026; D2: files removed, git history **not** rewritten).
**Phase 1 implemented**, see §9.

Method: read `AGENTS.md`, `PROJECT-CONTEXT.md`, `DESIGN.md`, `REDESIGN-DIRECTION.md`, then every file in
`apps/web/src/app`, `components`, and the dashboard, attendance, and settings features (rekap and penilaian skimmed).
Checked against Web Interface Guidelines (`web-design-guidelines` skill), `apple-design` rules in `AGENTS.md` §13,
and WCAG 2.1 AA contrast computed from `tokens.css`.

Baseline: web `typecheck` clean, web unit tests **68/68 passing** (24 Nov 2026).
Not yet verified in a browser: Docker/MySQL was not running, so nothing was rendered with seeded data.
Findings marked _(code)_ are from reading the code and need a browser check in Phase 1.

---

## 1. The brief compared with the product

The redesign brief assumes some roles and pages that the product doesn't have. This changes priorities, so it comes first.

| Brief assumes                                          | What the product actually has (`PROJECT-CONTEXT` §3–4, §7)                                                                                                                              |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Teachers" log in and mark attendance on their phones  | **No teacher role.** Roles: `admin`, `manajemen_guru`, `sekretaris_kelas`, `guru_penilai`.                                                                                              |
| "Secretary / administrative staff"                     | `sekretaris_kelas` is a **student** (class secretary) bound to one class. Admin staff = `admin`.                                                                                        |
| Teacher dashboard (assigned classes, attendance tasks) | `guru_penilai` dashboard: assessment window + teachers not yet assessed.                                                                                                                |
| Teacher list/detail, student list/detail pages         | Guru/Siswa exist only as **admin CRUD tabs** in Pengaturan (`TabSumber`). No detail pages, no detail routes.                                                                            |
| Attendance status Hadir/Izin/Sakit/Alpa                | Students: hadir/izin/sakit/alpa. **Teachers: Hadir / Mendampingi / Tidak Hadir** + Tugas Ada/Tidak Ada.                                                                                 |
| "Do not silently preselect statuses" (REDESIGN §8.2)   | `PROJECT-CONTEXT` §6.2 requires students to **default to `hadir`**. The business rule wins; we keep it.                                                                                 |
| Progress "recorded / not yet recorded" per student     | Because of the default, every student always has a status. Progress exists **per session** (saved or not) and, for teacher attendance, **per scheduled slot** (`jadwal.sudah_dicatat`). |

**Consequence:** the most frequent mobile user is a **teenage class secretary recording attendance from the classroom**,
not a teacher who is uncomfortable with technology. Design for speed, one-handed use, and resistance to mistakes.

## 2. Current UI architecture

- **Shell** (`app/layout`): sticky glass `Header` (page `h1` + user menu), collapsible desktop `Sidebar` (w-64/w-16, saved to localStorage),
  mobile `BottomNav` (4 role-based slots + "Lainnya/Akun" sheet with drag-to-dismiss), skip link, footer.
- **Routing** (`app/routes.tsx`): one source for menu and route roles (`nav.ts`), UI guard `PerluPeran` (server still enforces).
- **Data**: TanStack Query per module, filters in URL (`useFilterUrl`), server pagination (20/page), no client sorting.
- **Design system**: `tokens.css` (CSS variables, Tailwind palette disabled via `@theme inline`), custom shadcn-style
  primitives (`button`, `card`, `dialog`, `input`, `field`, `dropdown-menu`, `tooltip`), app components (`DataTable` with
  mobile card mode, `FilterBar` with mobile sheet, `SegmentedStatus`, `StatusBadge`, `StatCard`, `ProgressBar`, `ChartCard` with table alternative).
- **Motion**: CSS only (`index.css`): page fade-in, staggered KPI cards, `@starting-style` dialogs/sheets, press `scale(0.97)`, `scaleX` progress; reduced-motion handled.
- **Icons**: `lucide-react` in 33 files. `@phosphor-icons/react` is installed but **used in 0 files**.

## 3. Design system assessment

**Good foundation.** Tokens are centralized, the Tailwind palette is off (no raw palette classes), all text contrast passes AA:

| Pair                                                                      | Ratio       |
| ------------------------------------------------------------------------- | ----------- |
| `--text-subtle` on `--bg-app` / `--bg-subtle`                             | 5.00 / 4.72 |
| white on `--primary` / `--danger`                                         | 5.59 / 4.70 |
| status text on status soft (hadir, izin, sakit, mendampingi, tidak hadir) | 4.76 – 6.84 |

**Gaps:**

- **Brand and status collide.** `--status-mendampingi-*` (`tokens.css:39-41`) equals the brand `--primary`/`--accent`. "Mendampingi" looks like "selected", "link", and "active nav".
- **Non-text contrast fails** (WCAG 1.4.11, needs 3:1): input/select/segment borders `--border` vs white **1.29:1**; selected segment fill vs white **1.05:1**.
- **No warning/info tone.** Components borrow `izin` (amber) or `mendampingi` (blue) for "warning" and "info".
- **Off-scale values**: `rounded-[10px]` ×11, `size-[19px]`, `size-[22px]`, `top-[46px]`, `text-[1.625rem]`, and one raw colour `rgb(65_105_161/0.16)` (`Sidebar.tsx:66`). No radius or type-scale tokens.
- **`DESIGN.md` is out of date**: §2 still documents slate/indigo; `tokens.css` already uses the blue AKSARA palette.

## 4. Findings

Format: **ID — title** · evidence · impact · fix. "Approval" = needs a team decision before implementation.

### Critical

**C1 — Real school logo and building photo are committed and shipped as defaults**

- Evidence: `apps/web/src/images/logo.png` (the real school's crest, 1.5 MB) and `background.jpeg` (212 KB), added in commit `3baa6b4`.
  Used by `LoginPage.tsx:9-10,38,52`, `Sidebar.tsx:5,30`, `AppLayout.tsx:4,40-44` (fixed full-screen photo behind **every** page).
- Breaks: `AGENTS.md` §12, `PROJECT-CONTEXT.md` §9 gate (6), `DESIGN.md` §10 and §11.3 ("no full photo behind tables and charts").
  Also loads a 1.5 MB PNG on the login page to display it at 40 px.
- The pipeline already exists: the API serves `GET /api/v1/sekolah/logo` and `/sekolah/latar/masuk` publicly (resized WebP, EXIF stripped),
  and the dashboard already uses `dashboard_background_url`. The committed files bypass it. On the dashboard both backgrounds stack.
- Fix (frontend only): use settings URLs with a neutral built-in default; remove the global photo layer; delete both files.
  **Approval:** purging them from git history needs a force-push.
- Related: `REDESIGN-DIRECTION.md` (untracked) names the real school in its header. If committed, it puts that name in the repo.

**C2 — Unsaved student-attendance edits can be silently lost** _(code)_

- Evidence: `AbsensiSiswaPage.tsx:136` keys `FormSesi` by `sesi.dataUpdatedAt`. Any refetch remounts the form and resets every edit:
  - network reconnect after 30 s (`refetchOnReconnect` defaults on; `staleTime` is 30 s);
  - deleting another session in "Riwayat" on the **same page** invalidates `['kehadiran-siswa']` (`kehadiran-siswa/api.ts:54-60`).
- Also: changing Tanggal/Jam/Kelas (`:51-60`) or tapping the bottom nav discards edits with **no warning**. Only `beforeunload` is guarded (`:198-205`).
- Impact: a secretary on flaky school Wi-Fi marks 6 students, the network blinks, and the list snaps back to "all hadir" with no message.
- Fix: reset the form only after a server-confirmed save or an explicit context switch; confirm before switching context with unsaved changes; add a router guard (`useBlocker`).

### High

**H1 — Status colours no longer carry meaning**

- `Mendampingi`, predikat `Baik`/`Aktif`, account `Aktif` (`StatusBadge.tsx:31,35,38`), the role chip (`DashboardRingkasanPage.tsx:57`),
  and the warning "n belum dicatat" (`DashboardKelasPage.tsx:119`) all render in the brand blue.
  `Aktif` maps to blue but `aktif` maps to green.
  In charts, the Mendampingi and Sakit blues are 2.02:1 apart.
- Fix: give Mendampingi its own hue; add `peringatan` and `info` tones; map each label once. **Approval** (changes `DESIGN.md` status table).

**H2 — Attendance selection relies on colour alone** (core control)

- `SegmentedStatus.tsx:26-34,93-99`: the selected option changes only border hue, a 1.05:1 tint, and text colour. No icon, weight, or shape change.
  Unselected borders are 1.29:1. Fails WCAG 1.4.1/1.4.11 on the most-used control in the app.
- Fix: check icon plus semibold weight on the selected option, a solid status fill, and a 3:1 border for unselected options.

**H3 — Touch targets under 44 px on mobile actions**

- `button.tsx:22` `size="icon"` = 36 px. It is used for edit/delete inside **mobile cards** (Absensi Guru, Riwayat siswa, Pengaturan, Rekap: 8 call sites).
- "Belum dicatat" chips `min-h-10` (`DashboardKelasPage.tsx:194`); "Nilai" links are `text-xs` text only (`DashboardPenilaiPage.tsx:115`);
  dropdown items `min-h-9` (`dropdown-menu.tsx:34`) in the mobile header menu.
- Fix: add a touch icon size (44 px below `sm`) and make list actions full-height rows or buttons.

**H4 — The secretary's home screen buries the actionable list**

- `DashboardKelasPage.tsx:143-171`: three full-width StatCards stack on mobile (`grid-cols-1`, about 100 px each) under the greeting card.
  "Jadwal yang belum dicatat", the one thing to act on, starts around 500 px down. On 360×800 that is below the fold _(code)_.
- Fix: make today's schedule a checklist (time, teacher, recorded or not, a "Catat" button per row) at the top, with a compact one-line status strip under it.

**H5 — The management dashboard shows totals instead of what needs attention**

- `DashboardRingkasanPage.tsx`: four totals take the top row (guru aktif, siswa aktif, rombel, catatan; `:183-201`). The figure that needs action,
  **"jam terisi X/Y JP" today**, is buried in a subtitle (`:67-71`) and a chart header. The primary button is "Catat kehadiran" (`:74-79`),
  but this role mostly monitors.
- `grafik.tsx:65` `interval={0}` draws every class on the X axis, so labels collide on phones _(code)_.
- Fix: make today's coverage the main card, linking to classes with gaps; shrink the totals to a strip; give the chart a mobile variant (top-N horizontal bars plus table).
  Show only data the API already returns. Anything more (e.g. pekan belum disinkron) needs an API change → **approval**.

### Medium

- **M1 — Forms don't expose required fields to screen readers.** `field.tsx:31-42`: the asterisk is `aria-hidden` and the control gets no `required`/`aria-required`.
  When `Field` wraps `<Controller>` (`FormKehadiran.tsx:230-274`), the id and aria props go to `Controller`, not to the radiogroup. The label points nowhere and errors aren't linked.
- **M2 — Save button scrolls out of view in mobile forms.** `dialog.tsx:64,72-76`: actions sit at the end of the scroll area. Full-screen settings forms (guru: 7 fields) and the bottom-sheet FormKehadiran put Save below the fold once the keyboard opens.
  Fix: sticky dialog footer.
- **M3 — Dialog forms close and discard edits without warning.** Overlay tap, Esc, and Batal discard dirty FormKehadiran, FormSumber, and rekap-edit forms.
- **M4 — "Tandai semua hadir" is destructive and has no undo.** `AbsensiSiswaPage.tsx:216-220` overwrites every status and clears every keterangan. Fix: undo toast, or a confirm dialog when it would discard non-hadir entries.
- **M5 — Mobile filter sheet button says "Terapkan" but filters already applied.** `FilterBar.tsx:160-180`: each change applies immediately behind the sheet. Filter labels are 11 px uppercase (`:197-201`).
- **M6 — Absensi Guru mobile cards are too tall.** The generic `DataTable` card shows 7 label/value rows plus actions per record (about 250 px; a 20-item page is about 5,000 px).
  Fix: per-page mobile renderer: teacher + status on line 1; kelas · jam · tanggal on line 2; tugas only when "Tidak Ada".
- **M7 — Duplicate account menus on mobile.** The header avatar menu (`Header.tsx:43-96`) and the "Lainnya/Akun" sheet (`BottomNav.tsx:234-287`) both contain Profil/Bantuan/Tentang/Keluar.
- **M8 — Sidebar is a flat list of 9 items.** Only a hard-coded divider before "Log" (`Sidebar.tsx:52-53`). Group into Harian · Rekap & Penilaian · Administrasi.
- **M9 — EmptyState is too thin for what the brief asks.** `EmptyState.tsx` takes one sentence and an icon. It can't say what is missing, why, and what to do next. The access-denied page uses the same component.
- **M10 — Admin lists for guru and siswa are hard to scan.** No count in the header ("x–y dari z" appears only at the bottom), no sorting, no row → detail.
  Sorting depends on API support (not verified; if missing → **approval**). Detail pages → decision D1.
- **M11 — Field "Tugas" is always shown.** It appears even when status is Hadir (`FormKehadiran.tsx:261-274`). It is mainly relevant for Tidak Hadir (`PROJECT-CONTEXT` §6.1).
  Fix: progressive disclosure. The stored default stays `Ada`.
- **M12 — Documentation has drifted from the code.** `DESIGN.md` §2/§6 vs `tokens.css`; the `siswa.bk` column (uncommitted migration) is missing from `PROJECT-CONTEXT` §5.

### Low

- L1 — Off-scale values and one raw colour (see §3). Add radius and type tokens.
- L2 — `index.html:6` `theme-color` is brand blue while the header is white, so the browser bar doesn't match on Android Chrome.
- L3 — `@phosphor-icons/react` is installed but unused (`apps/web/package.json:16`). See D3.
- L4 — BottomNav sheet: overscroll factor 0.25 while its comment and `AGENTS` §13 say 0.55; release ignores velocity; the scroll area lacks `overscroll-behavior: contain` (`BottomNav.tsx:73,77,204`).
- L5 — `dialog.tsx:33` has a dead `aria-describedby` expression; the sr-only description repeats the title.
- L6 — `<Skeleton>` (a `div`) inside `<h2>` (`DashboardKelasPage.tsx:110`).
- L7 — No global `touch-action: manipulation`; `scrollTo({behavior:'smooth'})` ignores reduced motion (`AbsensiSiswaPage.tsx:157`).
- L8 — Logo `<img>`s have no `width`/`height` (`Sidebar.tsx:29`, `LoginPage.tsx:51`).
- L9 — `APP_BRAND = 'AKSARA'` is hard-coded (`config.ts:5`), while `PROJECT-CONTEXT` §1/§12.1 still treats the name as provisional.
- L10 — Sidebar collapse animates `width` (`AppLayout.tsx:56`), against `AGENTS` §13 (transform/opacity only).

## 5. Components worth keeping

Keep and refine; don't replace:

- `tokens.css` structure (variables + `@theme inline`, palette off).
- `Button` (cva, loading state), `Dialog` (bottom sheet on mobile, centred on desktop, `@starting-style`), `ConfirmDialog` (names what is affected).
- `DataTable` + `Pagination` (caption, keyboard-scrollable container, mobile cards, page jump). Add a per-page mobile renderer slot.
- `FilterBar` + `useFilterUrl` (filters live in the URL, sheet on mobile).
- `SegmentedStatus` (real radiogroup with arrow keys). Restyle only.
- `StatusBadge` (dot + text), `ProgressBar` (`scaleX`), `ChartCard` (table alternative for every chart; keep this).
- `BottomNav` (per-role slots, hides when the keyboard opens, focus returns to trigger), skip link, CSS motion with reduced-motion fallbacks.

## 6. What stays unchanged

No changes to database schema, API contracts, auth, role permissions, attendance/rekap/penilaian formulas, or the `hadir` default.
No fake numbers. No new routes without D1. No new large dependencies (see D5).

## 7. Decisions needed from the team

| #   | Decision                                                                                                                                        | Recommendation                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Brief Phases 3–4 ask for teacher/student **detail pages**. These would be new routes.                                                           | Phase 1–2: improve the existing admin lists and forms with no new routes. Detail pages (read-only, built from existing list endpoints filtered by `guru_id`/`kelas_id`) only if the team wants them. |
| D2  | Remove the real logo and photo (C1). Purge them from git history?                                                                               | Remove now (frontend only). History purge: the team decides (force-push).                                                                                                                            |
| D3  | Icons: `AGENTS` §13 says Phosphor for new code (mass migration needs approval). The brief says keep Lucide unless there is a documented reason. | Migrate to **Phosphor** in Phase 1 as one change. The redesign touches almost every UI file, and this avoids mixing libraries for months. Alternative: keep Lucide and uninstall Phosphor.           |
| D4  | New colour for Mendampingi plus warning/info tones (H1); changes `DESIGN.md` §2.                                                                | Violet for Mendampingi (distinct from brand blue and from sky Sakit), AA-checked.                                                                                                                    |
| D5  | Add Motion for React?                                                                                                                           | **No.** The CSS system already covers press, sheets, dialogs, progress, and reduced motion. A new dependency needs written justification (`AGENTS` §1).                                              |
| D6  | Confirm "AKSARA" as the product name in `PROJECT-CONTEXT` §12.1.                                                                                | Confirm, or make `APP_BRAND` configurable like `APP_NAME`.                                                                                                                                           |

## 8. Proposed implementation plan

Each phase is one branch. Before calling a phase done: `lint`, `typecheck`, `test` green; browser check at 360/375/390/430/768/1440;
`web-design-guidelines` re-run on changed files. **Docker Desktop must be running** for seeded browser checks and e2e.

**Phase 1 — Foundation and safety** (no new routes, no API change)

1. Fix C2 (attendance data loss) and add tests for it.
2. Fix C1 (settings-driven logo and backgrounds, neutral default, remove the global photo).
3. Tokens: Mendampingi hue, warning/info tones, a 3:1 control border, radius and type-scale tokens; remove off-scale values.
4. Primitives: `SegmentedStatus` selected state (H2), touch icon size (H3), `Field` required/Controller support (M1),
   `Dialog` sticky footer and dirty guard (M2, M3), `EmptyState` title/description/action (M9), FilterBar sheet wording (M5).
5. Shell: sidebar groups (M8), one account menu on mobile (M7), `theme-color`, icon library per D3.
6. Update `DESIGN.md` to match.

**Phase 2 — Daily workflows (secretary first)**

1. Absensi Siswa: sticky context bar (kelas · tanggal · jam · saved/unsaved), per-status counts, compact rows, undo for "Tandai semua hadir".
2. Secretary home (`DashboardKelasPage`): today's checklist first, one tap to record a slot (H4).
3. Absensi Guru: compact mobile cards (M6), FormKehadiran with schedule chips first and progressive Tugas (M11).

**Phase 3 — Dashboards**

1. Management (H5): today's coverage as the main card, totals demoted, mobile chart variant, clear empty and insufficient-data states.
2. Penilai: per-teacher rows with full-size targets; deep links only if the page supports them.

**Phase 4 — Admin data** (Guru, Siswa, Kelas, Jadwal, MGMP, Akun)
List headers with counts, mobile cards, grouped fields, sticky save. Detail pages only if D1 = yes.

**Phase 5 — Secondary pages**
Rekap, Penilaian Kinerja/MGMP, Laporan Siswa, Log Aktivitas, Login, Profil, Bantuan, Tentang.

**Phase 6 — Final QA**
Viewport matrix, keyboard and screen-reader pass, reduced motion and transparency, contrast re-check, update Playwright specs
(`e-navigasi-mobile`, `b-absensi-siswa`, `a-kehadiran-guru`), final report with changed files and remaining issues.

## 9. Phase 1 results (24 Nov 2026)

**Fixed:** C1, C2, H1, H2, H3, M1, M2, M3, M4, M5, M7, M8, M9 (base component), M12, L1, L2, L3, L4, L5, L6, L7, L8, L10.
**Deferred as planned:** H4 → Phase 2, H5 → Phase 3, M6/M11 → Phase 2, M10 → Phase 4, L9 → confirmed in docs (D6).

| Item  | What changed                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1    | Real logo/photo deleted (not purged from history). Login and sidebar use the settings API with a neutral fallback; no global photo layer.                  |
| C2    | Attendance form no longer remounts on refetch; three-way merge keeps edited rows; `PenjagaPerubahan` guards navigation, URL filter changes, and tab close. |
| H1    | Mendampingi is violet; new `info` and `peringatan` tones; role chip, "belum dicatat", Cukup/Baik, and account status no longer borrow status colours.      |
| H2    | Selected option: solid fill + white text + check (when it fits); unselected border 3.15:1.                                                                 |
| H3    | Sizes follow `pointer: coarse` (44 px) instead of width; Penilai "Nilai" is a button with the teacher's name in its label.                                 |
| M1–M3 | `Field` sets `aria-required` and labels custom groups; sticky dialog actions; "Buang perubahan?" guard on dirty forms.                                     |
| M4    | "Tandai semua hadir" has an Urungkan toast.                                                                                                                |
| M7/M8 | One account menu on mobile (bottom sheet); grouped sidebar.                                                                                                |
| D3    | All 33 files moved to Phosphor; `lucide-react` uninstalled.                                                                                                |

**Verification.** `typecheck`, `lint`, and `test` green (shared 130, API 179, web 76 including 8 new); e2e 32/32 at 360 and 1280 px.
Browser check on the fictitious e2e database at 360/375/390/430/768/1440 px for every admin and secretary route:
no horizontal overflow, and no touch target under 44 px at phone widths.

**Found and fixed during the browser check:**

- Page overflow at 768–1023 px on every table page (pre-existing): `sr-only` text inside tables escaped the scroll container; fixed with `relative`.
- Selected "Hadir" truncated to "Ha…" and "Mendampingi" truncated at 360 px; fixed with container queries.
- 16 px gap under the sticky dialog action bar; fixed by offsetting the scroll padding.
- Bottom-nav labels "Absensi Guru/Siswa" clipped at 360 px (pre-existing); labels now wrap to two lines.
- Pagination "Ke" 43 px; chart "Lihat tabel" 36 px on touch; unequal KPI card heights.

**Deliberately not followed (with reason):**

- Native `<dialog>` (modern-web-guidance `dialog`): Radix Dialog kept; replacing the primitive is outside Phase 1. The unsaved-changes guard follows the guide's intent (confirm, safe action first, no control under the pointer).
- Modal title as `h1`: kept `h2` so each page has a single `h1` (header).
- Title Case for buttons (Web Interface Guidelines): Indonesian sentence case per DESIGN §8.

**Open for later phases:** one JS chunk of 1.73 MB (488 KB gzip); route-level code splitting recommended (not compared against the pre-Phase-1 build).
The guru select in the attendance form has no search (Phase 2). The login page repeats the product name three times (Phase 5).

## 10. Phase 2 audit and plan (24 Nov 2026)

Branch: `fase-15-uiux-fondasi` (Phase 1 changes carried over, nothing committed).
Evidence: code reading, plus full-page captures of the secretary account on the fictitious e2e database at 360 and 1440 px.
**No API, database, auth, permission, or formula change is needed for anything below.**
Every new indicator uses data the existing endpoints already return:

- `GET /dashboard/kelas/:id`: `jadwal[]` (slot, guru, mapel, `sudah_dicatat`), `jurnal[]`, `hitungan`, `jam`.
- `GET /kehadiran-siswa/riwayat` with `tanggal_dari = tanggal_sampai`: the student sessions already saved that day (at most 13 jam; `pageSize` ≤ 100).
- `GET /kehadiran` is already sorted `tanggal desc, jam_ke asc`, so the client can group a page by date.

### 10.1 Findings

**Absensi Siswa** (`AbsensiSiswaPage.tsx`)

| ID  | Finding                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | At 360×800 only **2 students** are fully visible on the first screen. The filter card (~200 px), session header and badges (~250 px), and two-line save bar (~95 px) take the rest. At 1440 px: 8. |
| S2  | Jam ke- is a 13-option `<select>` with no hint of which jam has a lesson or is already saved. Today's saved sessions are only visible in "Riwayat", at the bottom of a 7,200 px page.              |
| S3  | Changing the day always opens the native date picker; there is no previous/next day or "Hari ini".                                                                                                 |
| S4  | The session header doesn't name the lesson (mapel/guru) for that jam, although `jadwal` has it.                                                                                                    |
| S5  | Exceptions are hard to scan: all 30 rows look the same except the coloured button. On desktop the keterangan input stacks under the control (uneven rows) and the right half of the card is empty. |
| S6  | Status text is a full sentence plus four badges that wrap to two lines at 360 px.                                                                                                                  |
| S7  | The save bar is two lines on mobile. After a successful save there is no next step (e.g. the next jam).                                                                                            |
| S8  | "Tandai semua hadir" is the most prominent action, but Hadir is already the default. It is a reset, not the main task.                                                                             |
| S9  | Riwayat on mobile uses generic cards (259 px each): 10 sessions ≈ 2,600 px.                                                                                                                        |

**Secretary home** (`DashboardKelasPage.tsx`, also `/kelas/:id` for admin/manajemen)

| ID  | Finding                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1  | Today's schedule is shown **only as chips of the slots not yet recorded**. When everything is recorded the schedule disappears completely; while partly done, recorded slots are invisible, so there is no sense of progress. |
| K2  | Three StatCards (~100 px each on mobile) come before any work item. JP totals rarely lead to an action for a student secretary.                                                                                               |
| K3  | The greeting card with stacked buttons takes ~230 px. "Absen siswa" does not carry a jam.                                                                                                                                     |
| K4  | Nothing on the home screen says whether student attendance has been taken today.                                                                                                                                              |
| K5  | Jurnal filters render inline on mobile (~270 px of inputs, unlike the filter sheet elsewhere); jurnal cards are 192 px each and repeat the schedule for the same day.                                                         |
| K6  | The date control sits in the jurnal filter at the bottom, yet it changes the whole page (header, counts, schedule).                                                                                                           |
| K7  | A recorded slot can't be corrected from the home screen; only "Catat" (create) exists.                                                                                                                                        |
| K8  | The load-error state has no title (Phase 1 EmptyState pattern not applied here).                                                                                                                                              |

**Absensi Guru mobile cards** (`AbsensiGuruPage.tsx` via generic `DataTable` cards)

| ID  | Finding                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | **283 px per card**; a 20-item page is 6,300 px. Seven label/value rows, including "Keterangan —" and "Tugas Ada" when empty or default, and the same Tanggal on every card although the list is sorted by date. |
| G2  | Edit/delete sit in a separate footer row with a divider (~60 px for two icons).                                                                                                                                  |
| G3  | The status badge is the 4th row, small and right-aligned: not the first thing read.                                                                                                                              |
| G4  | `FormKehadiran`: Tugas is always shown (M11). Guru select has no search (open item from Phase 1).                                                                                                                |

**Development environment (not UI, found during this audit)**

- E1: Starting Vite from a path with a lowercase drive letter (`d:\…`, as some terminals do) makes the dependency optimizer bundle React **twice**
  (two identical chunks). The app then crashes on load with "Invalid hook call" in `TooltipProvider`.
  Starting from `D:\…` produces one copy and works. Not an app bug; worth a `README` note or a guard in `vite.config.ts` (separate task, needs approval).

### 10.2 Target layouts (mobile 360 px)

```
Absensi Siswa                       Secretary home                      Absensi Guru card
┌────────────────────────────┐      ┌────────────────────────────┐      ── Selasa, 24 Nov 2026 · 6 ──
│ ‹  Selasa, 24 Nov 2026  ›  │      │ Kelas X-1 · Sel, 24 Nov ‹ ›│      ┌────────────────────────────┐
│ Jam [0][1•][2][3][4]… →    │      ├────────────────────────────┤      │ Guru Contoh 03   [● Hadir] │
├────────────────────────────┤      │ Jadwal hari ini   4/6 ▓▓▓░ │      │ Fisika · Jam 1–2 · 2 JP ✎ ✕│
│ Jam 1 · Fisika · Tersimpan │      │ Jam 1–2 Guru Contoh 03     │      └────────────────────────────┘
│ Hadir 26 · Izin 1 · Sakit 3│      │   Fisika  ● Hadir   [Ubah] │      ┌────────────────────────────┐
├────────────────────────────┤      │ Jam 3–4 Guru Contoh 04     │      │ Guru Contoh 07 [Tdk Hadir] │
│ 1 Siswa Contoh 01  9901001 │      │   Matematika Belum [Catat] │      │ Kimia · Jam 5 · 1 JP   ✎ ✕│
│ [✓Hadir][Izin][Sakit][Alpa]│      │ [+ Catat di luar jadwal]   │      │ Tugas: Tidak ada · "rapat" │
│▌2 Siswa Contoh 02  9901002 │      ├────────────────────────────┤      └────────────────────────────┘
│▌[Hadir][Izin][✓Sakit][Alpa]│      │ Absensi siswa: jam 1 ✓ 9 ✓ │
│▌[Keterangan…             ] │      │ [Isi absensi siswa]        │
├────────────────────────────┤      ├────────────────────────────┤
│ 3 perubahan    [Simpan]    │      │ Hadir 6 · Mendampingi 0 …  │
└────────────────────────────┘      │ Semua catatan (filter)     │
 ▌ = status-coloured edge for        └────────────────────────────┘
   non-Hadir rows
```

Desktop: Absensi Siswa rows become one line (name | status | keterangan inline). Home becomes two columns:
schedule checklist (⅔) beside student attendance and counts (⅓), with "Semua catatan" full width below.

### 10.3 Plan and order

Each step ends with typecheck, lint, and unit tests. The browser matrix (360/375/390/430/768/1440) and e2e run at the end.

| #   | Step                                                      | Covers   | Files (main)                                                                                                                                  |
| --- | --------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Shared pieces                                             | —        | `DataTable` (optional mobile card renderer + date group header), new `KartuKehadiran`, `NavigasiTanggal`, `PilihJam`, hook `useSesiSiswaHari` |
| 1   | Absensi Guru compact cards grouped by date                | G1–G3    | `AbsensiGuruPage.tsx`, `kolom.tsx`                                                                                                            |
| 2   | Absensi Siswa redesign                                    | S1–S9    | `AbsensiSiswaPage.tsx`                                                                                                                        |
| 3   | Secretary home redesign                                   | K1–K8    | `DashboardKelasPage.tsx`                                                                                                                      |
| 4   | Form: Tugas shown only when status ≠ Hadir or value ≠ Ada | G4 / M11 | `FormKehadiran.tsx` (stored default stays `Ada`; no rule change)                                                                              |
| 5   | Tests, e2e, browser matrix, `web-design-guidelines`, docs | —        | `*.test.tsx`, `apps/e2e/tests/{a,b}-*.spec.ts`, `DESIGN.md` §12.8                                                                             |

Details:

- **Absensi Siswa.** The session bar at the top holds the date with ‹ › and "Hari ini", plus a horizontally scrolling jam picker (a radiogroup).
  Each jam chip marks "tersimpan" (from riwayat for that day) and shows the scheduled mapel when there is one (display only).
  The session header is one line: jam · mapel · state (Belum diisi / Tersimpan / n perubahan). Counts become a single compact line.
  Rows are one line (name + NIS). Non-Hadir rows get a status-coloured edge and a tinted background. On ≥ 640 px the keterangan sits inline.
  "Tandai semua hadir" moves next to the counts as a quiet button (undo stays). The save bar is one line: state + Simpan.
  After saving, the bar offers "Lanjut ke jam ke-n+1". On mobile, Riwayat moves under a disclosure with compact rows.
  Phase 1 behaviour (merge on refetch, PenjagaPerubahan, undo toast) is kept and re-tested.
- **Secretary home.** The page starts with "Jadwal hari ini": every slot from `jadwal` merged with `jurnal`, with x/y progress.
  Recorded slots show the teacher status badge and "Ubah"; missing ones show "Belum dicatat" and "Catat".
  Records outside the schedule are listed as "Di luar jadwal". Date navigation moves to the page header.
  Student attendance gets its own small card (jam saved today + "Isi absensi siswa"); see **D7**.
  The three StatCards collapse into one counts line (the counts stay, per `PROJECT-CONTEXT` §7).
  The jurnal stays as "Semua catatan", with guru/status filters in the mobile filter sheet and the new compact card.
  Admin and manajemen keep the same page; manajemen still has no student-attendance actions.
- **Absensi Guru.** The mobile card shows guru + status first, then "mapel · (kelas) · Jam a–b · n JP".
  Tugas and Keterangan appear only when they say something. The 44 px edit/delete buttons sit on the card, with no footer row.
  Cards are grouped under sticky date headers. The desktop table is unchanged.

### 10.4 Decision

| #   | Decision                                                                                                                                                                                                                                                                                                                      | Recommendation                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D7  | How does student attendance relate to the teacher schedule? `PROJECT-CONTEXT` §6.2 only says "one record per student per date per jam_ke". It doesn't say whether the secretary takes it per lesson, per jam, or once a day. The fictitious seed has sessions at jam 1, 9, and 10, which don't match the slots (1–2, 3–4, …). | **(a) Keep them separate** (no new rule). Home shows which jam already have student attendance today; the jam picker shows lessons for orientation only. (b) Only if the school confirms "once per lesson, at the slot's first jam": each schedule row would also show and link that slot's student attendance. |

**D7 decided (24 Nov 2026): option (a).** Student attendance stays separate from the schedule. Lessons in the jam picker are hints only.

### 10.5 Progress

**Steps 0–1 done (24 Nov 2026).**

- Shared pieces:
  - `DataTable` has optional `kartuMobile` and `grupMobile` props. Mobile cards can be grouped under sticky headings that sit just below the header.
  - `Header` measures its own height into `--tinggi-header`. `html` has `scroll-padding-top` so focused items are not hidden under the sticky header and heading.
  - New components: `KartuKehadiran`, `NavigasiTanggal` (‹ date › + "Hari ini"), and `PilihJam` (scrollable jam radiogroup with fading edges).
  - New helpers: `petaInfoJam`, and `useJamTersimpan`, which reads the existing riwayat endpoint filtered to one day.
- Absensi Guru mobile:
  - Cards are 90 px (106 px when the admin detail line wraps), down from 283 px. The 360 px page went from 6,303 px to 2,559 px.
  - Cards are grouped under "Hari ini · Selasa, 24 Nov 2026"-style sticky headings.
  - Tugas shows only for Tidak Hadir or "Tidak Ada". Keterangan shows only when filled.
  - Edit/delete labels now name the date, because the card no longer shows it.
  - The desktop table is unchanged.
- Verification:
  - `typecheck`, `lint`, and `test` are green (web 90, including 14 new; API 179; shared 130).
  - e2e 32/32 (`a-kehadiran-guru` now matches the new button label).
  - Browser check at 360/375/390/430/768/1440 px for admin and secretary: no horizontal overflow and no touch target under 44 px. Sticky date headings sit exactly at the header's bottom edge (56 px).

**Steps 2–5 done (24 Nov 2026). Phase 2 complete.**

- Absensi Siswa (S1–S9):
  - A session bar holds kelas, date (‹ › / Hari ini), and the jam chips, which show "tersimpan" and the scheduled mapel.
  - The session header is three short lines. Non-Hadir rows get a tint and a status-coloured edge. Rows lay out by container width.
  - The save bar is one line and offers "Lanjut ke jam ke-n+1" after a save. Riwayat uses compact mobile cards.
  - At 360 px the list now starts at ~410 px instead of ~535 px.
- Secretary home (K1–K8):
  - "Jadwal hari ini" checklist comes first, with "Catat"/"Ubah" per slot and records outside the schedule listed too.
  - Then a student-attendance card (jam saved that day + link), one teacher-count card, and the jurnal behind a disclosure.
  - Date navigation is at the top. The error and invalid-id states have titles.
  - The dashboard now requests the class data without guru/status filters and filters the jurnal on screen, so the checklist is always complete. Same endpoint and contract.
  - Manajemen now sees "Lihat absensi siswa" (view access per `PROJECT-CONTEXT` §4).
- Form (G4/M11): Tugas shows when status ≠ Hadir or value ≠ Ada.
- Pre-existing bug fixed: the form showed "Pilih guru…" when its guru was prefilled from the dashboard before the guru list had loaded. The submitted value was correct, but the screen did not show it. The value is now re-applied once options load.
- Verification:
  - `lint`, `typecheck`, and `test` green (web 100, API 179, shared 130). e2e 32/32 after all changes.
  - Browser check of the secretary's three pages at 360/375/390/430/768/1440 px: no horizontal overflow, no touch target under 44 px.
- Not followed: Title Case (DESIGN §8 sentence case).

## 11. Phase 3: dashboards (24 Nov 2026)

No API, database, auth, permission, or formula change. Everything below uses fields the endpoints already return.

### 11.1 Findings

- **H5, management/admin.**
  - A decorative greeting card (role chip, "Selamat beraktivitas", ~250 px at 360 px) and four static totals (~210 px) came first.
  - The figure to act on, JP recorded today against JP scheduled, sat in a small uppercase label in a chart corner.
  - "Catat kehadiran" was the primary button, although this role mostly monitors.
- **Data limit.** `hari_ini.per_kelas` has JP per status for every class, but not JP _scheduled_ per class. "Classes with unrecorded hours" therefore cannot be shown without an API change.
  What can be shown honestly: classes with JP of teachers Tidak Hadir today, and classes with no record at all today (only when the school has scheduled hours today).
- **Charts.**
  - The per-class chart forced every X label (`interval={0}`), so labels crowd on phones as the number of classes grows.
  - The trend chart drew empty axes when no week has a rekap yet.
- **Penilai.**
  - Three cards (window, done, not done) repeated the same information.
  - Every "Nilai" button opened the same unfiltered page.
  - While the window is closed, filling is locked for penilai (`bolehIsi = admin || terbuka`), so "Nilai" promised an action that was not available.

### 11.2 Changes

- **Management/admin dashboard:**
  - Main card "Kehadiran guru hari ini": JP recorded out of JP scheduled with a bar, catatan and JP per status, and a "Perlu perhatian" list. The list shows classes with teachers absent first, then classes with no record, each linking to `/kelas/:id`.
  - Days without scheduled hours say so instead of showing 0 %.
  - The actions (Rekap pekan, Catat kehadiran, Impor Excel) are kept as secondary buttons.
  - The four totals became one compact "Data sekolah" card (kept per `PROJECT-CONTEXT` §7).
  - On phones the per-class chart is horizontal, with height following the number of classes.
  - The trend chart shows a message when no week has a rekap.
- **Penilai dashboard:**
  - One progress card: x/y teachers assessed with a fixed-tone bar (progress, not a grade), plus window state in words ("Dibuka …", "Terbuka sampai …", "Sudah ditutup …"), dates, and deadline.
  - Each teacher row links to `/penilaian-kinerja?bulan&tahun&q=<kode>`. The page already supports `q`, so no new route was needed.
  - The row label is "Nilai" when the window is open and "Lihat" when it is closed.
- **Shared:**
  - `ProgressBar` gains optional `nada` (fixed tone) and `penuh` (full width).
  - New `lib/media.ts` `useKueriMedia`, used only for Recharts orientation, which needs pixel geometry in JS.
  - Error states have titles.

### 11.3 Verification

- `lint`, `typecheck`, and `test` green (web 103, API 179, shared 130). e2e 32/32.
- Browser check at 360/375/390/430/768/1440 px for manajemen, admin, and penilai, plus `/kelas/:id` for admin and manajemen at 360/768/1440: no horizontal overflow and no touch target under 44 px.
- Page height at 360 px: penilai 1,829 → 1,393 px.
- The per-teacher deep link was checked in the browser: the assessment page shows only that teacher.
- Not followed: Title Case (DESIGN §8 sentence case).

### 11.4 Open for the team

- Showing "classes with unrecorded scheduled hours" needs JP scheduled per class in `GET /dashboard/ringkasan`. That is an API addition and **needs approval**.

## 12. Phase 4: admin data (24 Nov 2026)

Scope: Pengaturan tabs Guru, Kelas, Siswa, Jadwal, MGMP, Akun. All six use one generic list (`TabSumber`) and one generic form (`FormSumber`), so the fixes apply to every tab.
No API, database, auth, permission, or formula change. Decision D1 (no detail pages) still holds.

### 12.1 Findings

- **Mobile cards were too tall.** The generic card showed every column as a label/value row plus a separate action row (~275 px per record).
  At 360 px: guru 3,949 px, siswa 5,959 px, and jadwal 5,439 px for one page.
- **M10, no record count.** The list showed its count only in the pagination at the bottom.
- **Flat forms.** Guru, siswa, akun, and jadwal had 5–7 full-width fields with no grouping. Short fields (Kode, NIP, Jenis kelamin) took full rows.
  Jadwal asked for "Jam ke-" and "Jumlah JP" as free number inputs with helper text, although the choices are few and fixed.
- **Mobile section list.** The Pengaturan list on phones showed names only, with no hint of what each section holds.
- **Phase 1 regression.** On desktop the sticky dialog action bar (square corners) poked out past the dialog's rounded bottom-left corner.
- **Sorting.** The settings API orders lists server-side (by name, class, day/jam) and accepts no sort parameter. Column sorting would need an API change, so it was **not done** and needs approval.

### 12.2 Changes

- **Lists:**
  - "n guru / n siswa / …" (or "… cocok dengan filter") above the list.
  - Compact mobile cards (`ringkas`): title, one or two short lines, 44 px actions on the right. A badge appears only for inactive records.
  - Jadwal cards are grouped under sticky day headings (the API order is by day, then jam).
  - Mobile Pengaturan list has a one-line description per section.
- **Forms:**
  - Fields in named groups (`fieldset` + `legend`): Guru = Identitas / Mengajar / Status, Siswa = Identitas / Kelas / Status, Akun = Identitas / Akses, Jadwal = Guru & kelas / Waktu.
  - Short fields sit side by side from 640 px.
  - Status and Jenis kelamin are segmented choices. Jadwal "Mulai jam ke-" is a 0–12 list ("0 (pagi)"), and "Jumlah JP" is a 1–4 JP segmented choice, all bounded by the same shared constants as the schema.
- **Dialog:** `overflow-hidden` keeps the sticky action bar inside the rounded corners.

### 12.3 Verification

- `lint`, `typecheck`, and `test` green (web 108 including 5 new settings tests; API 179; shared 130). e2e 32/32.
- Browser check of every data tab at 360/375/390/430/768/1440 px: no horizontal overflow and no touch target under 44 px.
- Height at 360 px: guru 3,949 → 1,863, siswa 5,959 → 2,527, jadwal 5,439 → 2,239.
- Not followed: Title Case (DESIGN §8 sentence case).

### 12.4 Open for the team

- Column sorting needs a sort parameter on `/settings/*` (API change, **approval**).
- The guru `<select>` in the jadwal and attendance forms has no search; a searchable combobox would be a new component (proposed for a later phase).
- `TabSekolah` and `TabImporData` were not redesigned in this phase. They are single-purpose forms that already use the Phase 1 primitives; they are reviewed in Phase 5 together with the other secondary pages.

## 13. Phase 5: secondary pages (24 Nov 2026)

Scope: Rekap, Penilaian Kinerja, Penilaian MGMP, Laporan Rekap Siswa, Log Aktivitas, Masuk, Profil, Bantuan, Tentang, Pengaturan Sekolah, Impor & Data.
No API, database, auth, permission, or formula change.

### 13.1 Findings

- **Tall generic mobile cards.** Rekap, Penilaian Kinerja/MGMP, Laporan Siswa, and Log still used generic mobile cards (5–7 label/value rows each).
  Heights at 360 px: rekap 3,467 px, kinerja 4,600 px, laporan 4,923 px, log 4,063 px, MGMP 2,133 px.
- **Mobile toolbars stacked one button per row.** Filter / Sinkronkan / Ekspor took three rows on Rekap.
  On the penilaian pages, Bulan and Tahun (both short) each took a full row, so the list started below ~450 px.
- **Login said the product name three times.** Brand eyebrow, long `APP_NAME`, and a subtitle that repeated it (open item from Phase 1).
- **Pengaturan Sekolah:**
  - Eight short number inputs (weights) each took a full row.
  - Fieldset legends were uppercase (DESIGN §12.2 reserves uppercase for table headers).
  - The sticky save bar hard-coded `3.5rem + safe-area` instead of `--tinggi-bar-bawah`, so it did not drop when the keyboard opened.
  - That bar also used `backdrop-blur` without a reduced-transparency fallback.
- **Radius tokens.** 33 Tailwind radii (`rounded-lg/xl/2xl`) remained outside the radius tokens, mainly on secondary pages, BottomNav, dropdown, and skeleton.
- **Pointer sizing.** Two controls shrank by viewport width (`sm:min-h-9`) instead of by pointer type.
- Profil, Bantuan, and Tentang had no layout problems (no overflow, no small targets).

### 13.2 Changes

- **Shared `KartuRingkas`** (moved from Pengaturan to `components/`), with an optional `bawah` slot. Used for:
  - Rekap: hours present/required, a full-width bar, correction badges, and reason.
  - Penilaian Kinerja: one score line, predikat, "Nilai".
  - Penilaian MGMP: scores, predikat, "n dari m kelas", and the action buttons in a bottom row. The secretary variant shows only their class score.
  - Laporan Siswa: counts per status on one line.
  - Log: the description as the title, then time · user and module · code · IP.
    The desktop tables are unchanged.
- **Toolbars.**
  - `FilterBar`: on phones the actions fill the row next to "Filter" and are top-aligned.
  - Penilaian panel: Bulan and Tahun sit side by side on phones; actions share a row; the panel uses the card radius token.
- **Masuk.** One `h1` "AKSARA" plus one line underneath: the school's `VITE_APP_NAME` if set, otherwise the default subtitle.
- **Pengaturan Sekolah:**
  - Weights in a 3-column grid on every width.
  - Sentence-case legends.
  - The save bar sticks at `--tinggi-bar-bawah` with a solid background.
- **Tokens.** Every remaining `rounded-lg/xl/2xl` now maps to `rounded-kontrol`/`rounded-kartu`; the two viewport-based control heights are now pointer-based.

### 13.3 Verification

- `lint`, `typecheck`, and `test` green (web 111 including 3 new: rekap card, kinerja card, login heading; API 179; shared 130). e2e 32/32.
- Browser check of all pages in scope at 360/375/390/430/768/1440 px:
  - No horizontal overflow.
  - No touch target under 44 px. The script still flags the hidden file inputs (opened by their buttons) and the weekday checkboxes, but those labels are already 44 px tall.
- Height at 360 px: rekap 3,467 → 1,819, kinerja 4,600 → 2,554, MGMP 2,133 → 1,554, laporan 4,923 → 2,167, log 4,063 → 2,127, sekolah 2,686 → 2,268.
- Not followed: Title Case (DESIGN §8 sentence case).

### 13.4 Notes

- If the deployment's `VITE_APP_NAME` itself starts with "Aksara", the login still shows the brand twice (title + that name). Setting `VITE_APP_NAME` to the school-specific name, or leaving it empty, avoids this.

## 14. Phase 6: final QA (24 Nov 2026)

All checks ran against the fictitious e2e database. axe-core 4.10.3 was installed in a temporary folder outside the repo, so no project dependency was added.

### 14.1 Results

| Check                                                | Scope                                                                                              | Result                                                                                                                                                                                                      |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Viewport matrix                                      | 4 roles × every route they can open × 360/375/390/430/768/1440 px = 252 pages, plus the login page | No horizontal overflow; no touch target under 44 px at phone widths; no load errors                                                                                                                         |
| axe (WCAG 2.0/2.1/2.2 A–AA + best practice)          | 86 scans: every route per role at 360 and 1440 px, plus login                                      | **Fixed:** `aria-hidden-focus` on admin/manajemen dashboards. **False positive:** `color-contrast` on the login button, seen only mid fade-in (4.47:1 at partial opacity); 0 violations after the animation |
| Keyboard                                             | 6 key pages at 1440 and 768 px, 45 Tab stops each; skip link; dialog; radiogroup                   | **Fixed:** focus lost after closing dialogs; date input focus ring; focus hidden under the sticky save bar. Skip link, focus trap, and arrow keys pass                                                      |
| Reduced motion                                       | Page, buttons, dialog, sheet                                                                       | Spatial motion replaced by a 120–150 ms fade; press scale removed; `transform: none` on dialog/sheet                                                                                                        |
| Reduced transparency / more contrast                 | Header, bottom nav, dialog overlay                                                                 | Solid surfaces, no `backdrop-filter`                                                                                                                                                                        |
| Static scan (Web Interface Guidelines anti-patterns) | `apps/web/src`                                                                                     | No `transition-all`, zoom blocking, paste blocking, clickable `div`, or raw colours. Both `outline-none` uses have a replacement. All `<img>` have dimensions or size-locked containers                     |
| Tests                                                | —                                                                                                  | `lint`, `typecheck`, and `test` green (web 112, API 179, shared 130); e2e 32/32; build OK                                                                                                                   |

### 14.2 Fixes made in Phase 6

1. **Focus returns to the trigger when a dialog closes.**
   Radix only restores focus to a `Dialog.Trigger`, and every dialog here opens from a plain button, so focus fell to `<body>`. This was pre-existing and affected every form.
   `Dialog` now records the focused element when it opens and restores it in `onCloseAutoFocus`. Unit test added.
2. **Charts no longer focusable while hidden.** Recharts 3's accessibility layer made the charts focusable inside `aria-hidden` wrappers.
   The charts are hidden on purpose (each has a table alternative), so `accessibilityLayer={false}`.
3. **Date input focus ring.** Chrome's calendar icon inside `input[type=date]` takes focus separately, and then only `:focus-within` matches the input.
   Added `input[type='date']:focus-within` with the same ring.
4. **Focus not hidden by sticky save bars (WCAG 2.4.11).**
   `html:has(.bar-simpan-lekat)` adds bottom scroll padding the height of the bar (Absensi Siswa, Pengaturan Sekolah).
5. **School-settings image previews** have explicit size and `decoding="async"`.

### 14.3 Still open (needs a decision or a later phase)

| Item                                                                  | Why it is open                                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| JS bundle 1.76 MB (494 KB gzip), one chunk                            | Route-level code splitting (e.g. keeping Recharts out of the secretary's pages) is a performance change outside QA. Recommended as the next task |
| "Classes with unrecorded scheduled hours" on the management dashboard | Needs JP scheduled per class from `GET /dashboard/ringkasan` (API change, approval)                                                              |
| Column sorting in admin lists                                         | Needs a sort parameter on `/settings/*` (API change, approval)                                                                                   |
| Searchable guru picker (attendance and schedule forms)                | New combobox component                                                                                                                           |
| Dev server crash when started from `d:\` (E1)                         | README note or `vite.config.ts` guard (approval)                                                                                                 |
| `REDESIGN-DIRECTION.md` names the real school                         | Must not be committed as is                                                                                                                      |
| Real screen-reader pass (TalkBack/NVDA)                               | Automated checks cannot replace it; recommended before release                                                                                   |
