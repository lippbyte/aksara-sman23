import { zodResolver } from '@hookform/resolvers/zod';
import {
  JAM_KE_MAX,
  JAM_KE_MIN,
  LAMA_JAM_MAX,
  LAMA_JAM_MIN,
  akunBuatSchema,
  akunUbahSchema,
  guruSchema,
  jadwalSchema,
  kelasSchema,
  mgmpSchema,
  NAMA_HARI,
  resetPasswordSchema,
  ROLE_LABEL,
  ROLES,
  siswaSchema,
  type Akun,
  type Guru,
  type Jadwal,
  type Kelas,
  type Mgmp,
  type ResetPasswordInput,
  type Siswa,
} from '@sms/shared';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeftIcon, CaretRightIcon, KeyIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { useForm, type FieldValues } from 'react-hook-form';
import { Link, Navigate, NavLink, useParams } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import type { GrupMobile, Kolom } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogAksi, DialogBatal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { InputSandi } from '@/components/ui/input';
import { api, pesanGalat } from '@/lib/api';
import { useRefGuru, useRefKelas, useRefMgmp } from '@/lib/referensi';
import { cn } from '@/lib/utils';
import { TabImporData } from './TabImporData';
import { TabSekolah } from './TabSekolah';
import { TabSumber, type Opsi } from './TabSumber';

const TAB = [
  { id: 'sekolah', label: 'Sekolah', keterangan: 'Nama, tahun ajaran, pekan, bobot, logo & latar' },
  { id: 'guru', label: 'Guru', keterangan: 'Data guru, mapel, dan MGMP' },
  { id: 'kelas', label: 'Kelas', keterangan: 'Daftar rombel' },
  { id: 'siswa', label: 'Siswa', keterangan: 'Data siswa per kelas' },
  { id: 'jadwal', label: 'Jadwal', keterangan: 'Jadwal mengajar per hari' },
  { id: 'mgmp', label: 'MGMP', keterangan: 'Kelompok mata pelajaran' },
  { id: 'akun', label: 'Akun', keterangan: 'Pengguna, peran, dan kata sandi' },
  { id: 'impor', label: 'Impor & Data', keterangan: 'Impor CSV dan hapus data pilot' },
] as const;
type IdTab = (typeof TAB)[number]['id'];

// Skema dari @sms/shared dipakai apa adanya; form generik hanya butuh bentuk umumnya.
const skemaForm = (s: z.ZodType) => s as z.ZodType<FieldValues, FieldValues>;

const OPSI_STATUS: Opsi[] = [
  { nilai: 'aktif', label: 'Aktif', nada: 'hadir' },
  { nilai: 'tidak_aktif', label: 'Tidak aktif', nada: 'netral' },
];
const OPSI_JAM: Opsi[] = Array.from({ length: JAM_KE_MAX - JAM_KE_MIN + 1 }, (_, i) => {
  const jam = JAM_KE_MIN + i;
  return { nilai: jam, label: jam === 0 ? '0 (pagi)' : String(jam) };
});
const OPSI_LAMA: Opsi[] = Array.from({ length: LAMA_JAM_MAX - LAMA_JAM_MIN + 1 }, (_, i) => ({
  nilai: LAMA_JAM_MIN + i,
  label: `${LAMA_JAM_MIN + i} JP`,
}));

/** Lencana hanya untuk yang menyimpang dari biasanya (tidak aktif), agar kartu tidak ramai. */
function lencanaNonaktif(aktif: boolean, label = 'Tidak aktif') {
  return aktif ? undefined : <StatusBadge status="tidak_aktif" label={label} />;
}
const OPSI_HARI: Opsi[] = Object.entries(NAMA_HARI).map(([n, label]) => ({
  nilai: Number(n),
  label,
}));
const OPSI_PERAN: Opsi[] = ROLES.map((r) => ({ nilai: r, label: ROLE_LABEL[r] }));

export function PengaturanPage() {
  const { tab } = useParams();
  if (tab && !TAB.some((t) => t.id === tab)) return <Navigate to="/pengaturan/sekolah" replace />;
  const aktif: IdTab | null = TAB.find((t) => t.id === tab)?.id ?? null;
  const infoAktif = TAB.find((t) => t.id === aktif);

  return (
    <div>
      {/* Desktop & tablet (>=768 px): bar tab horizontal */}
      <nav
        aria-label="Bagian pengaturan"
        className="mb-4 hidden gap-1 overflow-x-auto border-b border-line md:flex"
      >
        {TAB.map((t) => {
          const dipilih = (aktif ?? 'sekolah') === t.id;
          return (
            <NavLink
              key={t.id}
              to={`/pengaturan/${t.id}`}
              className={cn(
                '-mb-px flex h-10 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors duration-200',
                dipilih
                  ? 'border-accent text-accent'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )}
            >
              {t.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Mobile (<768 px): daftar bagian pengaturan satu per satu (DESIGN §11.5) */}
      {!aktif ? (
        <>
          <ul
            aria-label="Daftar bagian pengaturan"
            className="divide-y divide-line-soft overflow-hidden rounded-kartu border border-line bg-surface shadow-[var(--shadow-card)] md:hidden"
          >
            {TAB.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/pengaturan/${t.id}`}
                  className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 hover:bg-app"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">{t.label}</span>
                    <span className="block text-xs text-ink-muted">{t.keterangan}</span>
                  </span>
                  <CaretRightIcon className="size-4 text-icon-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <IsiTab tab="sekolah" />
          </div>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 md:hidden">
            <Link
              to="/pengaturan"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-kontrol px-2 text-sm font-medium text-accent hover:bg-accent-soft"
            >
              <ArrowLeftIcon className="size-4" aria-hidden="true" />
              Semua pengaturan
            </Link>
            {infoAktif && (
              <span className="text-sm font-semibold text-ink">· {infoAktif.label}</span>
            )}
          </div>
          <IsiTab tab={aktif} />
        </>
      )}
    </div>
  );
}

function IsiTab({ tab }: { tab: IdTab }) {
  switch (tab) {
    case 'sekolah':
      return <TabSekolah />;
    case 'guru':
      return <TabGuru />;
    case 'kelas':
      return <TabKelas />;
    case 'siswa':
      return <TabSiswa />;
    case 'jadwal':
      return <TabJadwal />;
    case 'mgmp':
      return <TabMgmp />;
    case 'akun':
      return <TabAkun />;
    case 'impor':
      return <TabImporData />;
  }
}

function useOpsiKelas(): Opsi[] {
  const { data } = useRefKelas();
  return useMemo(() => (data ?? []).map((k) => ({ nilai: k.id, label: k.nama_kelas })), [data]);
}
function useOpsiMgmp(): Opsi[] {
  const { data } = useRefMgmp();
  return useMemo(() => (data ?? []).map((m) => ({ nilai: m.id, label: m.nama_mapel })), [data]);
}
function useOpsiGuru(): Opsi[] {
  const { data } = useRefGuru();
  return useMemo(
    () => (data ?? []).map((g) => ({ nilai: g.id, label: `${g.nama_guru} (${g.mata_pelajaran})` })),
    [data],
  );
}

const kolomKelas: Kolom<Kelas>[] = [
  { id: 'nama', judul: 'Nama kelas', utama: true, sel: (k) => k.nama_kelas },
  { id: 'siswa', judul: 'Jumlah siswa', angka: true, sel: (k) => k.jumlah_siswa ?? 0 },
];

function TabKelas() {
  return (
    <TabSumber<Kelas>
      sumber="kelas"
      nama="kelas"
      kolom={kolomKelas}
      cari="Nama kelas"
      skema={skemaForm(kelasSchema)}
      nilaiAwal={{ nama_kelas: '' }}
      keForm={(k) => ({ nama_kelas: k.nama_kelas })}
      labelBaris={(k) => `kelas ${k.nama_kelas}`}
      ringkas={(k) => ({ judul: k.nama_kelas, sub: `${k.jumlah_siswa ?? 0} siswa` })}
      isian={[
        {
          nama: 'nama_kelas',
          label: 'Nama kelas',
          jenis: 'teks',
          wajib: true,
          bantuan: 'Contoh: X-1',
        },
      ]}
    />
  );
}

const kolomMgmp: Kolom<Mgmp>[] = [
  { id: 'nama', judul: 'Nama mapel', utama: true, sel: (m) => m.nama_mapel },
  { id: 'deskripsi', judul: 'Deskripsi', sel: (m) => m.deskripsi ?? '—' },
  { id: 'guru', judul: 'Jumlah guru', angka: true, sel: (m) => m.jumlah_guru ?? 0 },
];

function TabMgmp() {
  return (
    <TabSumber<Mgmp>
      sumber="mgmp"
      nama="MGMP"
      kolom={kolomMgmp}
      cari="Nama mapel"
      skema={skemaForm(mgmpSchema)}
      nilaiAwal={{ nama_mapel: '', deskripsi: '' }}
      keForm={(m) => ({ nama_mapel: m.nama_mapel, deskripsi: m.deskripsi ?? '' })}
      labelBaris={(m) => `MGMP ${m.nama_mapel}`}
      ringkas={(m) => ({
        judul: m.nama_mapel,
        sub: `${m.jumlah_guru ?? 0} guru`,
        detail: [m.deskripsi],
      })}
      isian={[
        { nama: 'nama_mapel', label: 'Nama mapel', jenis: 'teks', wajib: true },
        { nama: 'deskripsi', label: 'Deskripsi', jenis: 'textarea' },
      ]}
    />
  );
}

const kolomGuru: Kolom<Guru>[] = [
  { id: 'kode', judul: 'Kode', sel: (g) => g.kode_guru },
  { id: 'nama', judul: 'Nama guru', utama: true, sel: (g) => g.nama_guru },
  { id: 'mapel', judul: 'Mata pelajaran', sel: (g) => g.mata_pelajaran },
  { id: 'mgmp', judul: 'MGMP', sel: (g) => g.nama_mgmp ?? '—' },
  { id: 'jabatan', judul: 'Jabatan', sel: (g) => g.jabatan ?? '—' },
  { id: 'status', judul: 'Status', sel: (g) => <StatusBadge status={g.status} /> },
];

function TabGuru() {
  const opsiMgmp = useOpsiMgmp();
  return (
    <TabSumber<Guru>
      sumber="guru"
      nama="guru"
      kolom={kolomGuru}
      cari="Nama, kode, atau mapel"
      filter={[
        { kunci: 'mgmp_id', label: 'MGMP', opsi: opsiMgmp },
        { kunci: 'status', label: 'Status', opsi: OPSI_STATUS },
      ]}
      skema={skemaForm(guruSchema)}
      nilaiAwal={{
        kode_guru: '',
        nip: '',
        nama_guru: '',
        mata_pelajaran: '',
        jabatan: '',
        mgmp_id: null,
        status: 'aktif',
      }}
      keForm={(g) => ({
        kode_guru: g.kode_guru,
        nip: g.nip ?? '',
        nama_guru: g.nama_guru,
        mata_pelajaran: g.mata_pelajaran,
        jabatan: g.jabatan ?? '',
        mgmp_id: g.mgmp_id,
        status: g.status,
      })}
      labelBaris={(g) => g.nama_guru}
      ringkas={(g) => ({
        judul: g.nama_guru,
        sub: `${g.kode_guru} · ${g.mata_pelajaran}`,
        detail: [g.nama_mgmp ? `MGMP ${g.nama_mgmp}` : null, g.jabatan],
        lencana: lencanaNonaktif(g.status === 'aktif'),
      })}
      isian={[
        {
          nama: 'kode_guru',
          label: 'Kode guru',
          jenis: 'teks',
          wajib: true,
          grup: 'Identitas',
          setengah: true,
        },
        {
          nama: 'nip',
          label: 'NIP',
          jenis: 'teks',
          bantuan: 'Boleh dikosongkan.',
          grup: 'Identitas',
          setengah: true,
        },
        { nama: 'nama_guru', label: 'Nama guru', jenis: 'teks', wajib: true, grup: 'Identitas' },
        {
          nama: 'mata_pelajaran',
          label: 'Mata pelajaran',
          jenis: 'teks',
          wajib: true,
          grup: 'Mengajar',
          setengah: true,
        },
        {
          nama: 'mgmp_id',
          label: 'MGMP',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: opsiMgmp,
          labelKosong: 'Tanpa MGMP',
          grup: 'Mengajar',
          setengah: true,
        },
        { nama: 'jabatan', label: 'Jabatan', jenis: 'teks', grup: 'Mengajar' },
        {
          nama: 'status',
          label: 'Status',
          jenis: 'segmen',
          opsi: OPSI_STATUS,
          wajib: true,
          grup: 'Status',
        },
      ]}
    />
  );
}

const kolomSiswa: Kolom<Siswa>[] = [
  { id: 'nis', judul: 'NIS', sel: (s) => s.nis },
  { id: 'nama', judul: 'Nama siswa', utama: true, sel: (s) => s.nama_siswa },
  { id: 'jk', judul: 'L/P', sel: (s) => s.jenis_kelamin },
  { id: 'kelas', judul: 'Kelas', sel: (s) => s.nama_kelas },
  { id: 'wali', judul: 'Wali kelas', sel: (s) => s.wali_kelas ?? '—' },
  { id: 'bk', judul: 'BK', sel: (s) => s.bk ?? '—' },
  { id: 'status', judul: 'Status', sel: (s) => <StatusBadge status={s.status} /> },
];

function TabSiswa() {
  const opsiKelas = useOpsiKelas();
  return (
    <TabSumber<Siswa>
      sumber="siswa"
      nama="siswa"
      kolom={kolomSiswa}
      cari="Nama atau NIS"
      filter={[
        { kunci: 'kelas_id', label: 'Kelas', opsi: opsiKelas },
        { kunci: 'status', label: 'Status', opsi: OPSI_STATUS },
      ]}
      skema={skemaForm(siswaSchema)}
      nilaiAwal={{
        nis: '',
        nama_siswa: '',
        jenis_kelamin: '',
        kelas_id: null,
        wali_kelas: '',
        bk: '',
        status: 'aktif',
      }}
      keForm={(s) => ({
        nis: s.nis,
        nama_siswa: s.nama_siswa,
        jenis_kelamin: s.jenis_kelamin,
        kelas_id: s.kelas_id,
        wali_kelas: s.wali_kelas ?? '',
        bk: s.bk ?? '',
        status: s.status,
      })}
      labelBaris={(s) => s.nama_siswa}
      ringkas={(s) => ({
        judul: s.nama_siswa,
        sub: `NIS ${s.nis} · ${s.jenis_kelamin} · Kelas ${s.nama_kelas}`,
        detail: [s.wali_kelas ? `Wali ${s.wali_kelas}` : null, s.bk ? `BK ${s.bk}` : null],
        lencana: lencanaNonaktif(s.status === 'aktif'),
      })}
      isian={[
        {
          nama: 'nis',
          label: 'NIS',
          jenis: 'teks',
          wajib: true,
          grup: 'Identitas',
          setengah: true,
        },
        {
          nama: 'jenis_kelamin',
          label: 'Jenis kelamin',
          jenis: 'segmen',
          wajib: true,
          opsi: [
            { nilai: 'L', label: 'Laki-laki' },
            { nilai: 'P', label: 'Perempuan' },
          ],
          grup: 'Identitas',
          setengah: true,
        },
        { nama: 'nama_siswa', label: 'Nama siswa', jenis: 'teks', wajib: true, grup: 'Identitas' },
        {
          nama: 'kelas_id',
          label: 'Kelas',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: opsiKelas,
          wajib: true,
          grup: 'Kelas',
        },
        { nama: 'wali_kelas', label: 'Wali kelas', jenis: 'teks', grup: 'Kelas', setengah: true },
        { nama: 'bk', label: 'Guru BK', jenis: 'teks', grup: 'Kelas', setengah: true },
        {
          nama: 'status',
          label: 'Status',
          jenis: 'segmen',
          opsi: OPSI_STATUS,
          wajib: true,
          grup: 'Status',
        },
      ]}
    />
  );
}

function rentangJadwal(j: Pick<Jadwal, 'jam_ke' | 'total_jam_mengajar'>): string {
  const akhir = j.jam_ke + j.total_jam_mengajar - 1;
  return akhir > j.jam_ke ? `${j.jam_ke}–${akhir}` : String(j.jam_ke);
}

const GRUP_HARI: GrupMobile<Jadwal> = {
  kunci: (j) => String(j.hari),
  judul: (k) => NAMA_HARI[Number(k)] ?? k,
};

const kolomJadwal: Kolom<Jadwal>[] = [
  { id: 'hari', judul: 'Hari', sel: (j) => NAMA_HARI[j.hari] ?? j.hari },
  { id: 'jam', judul: 'Jam ke-', angka: true, sel: (j) => j.jam_ke },
  { id: 'jp', judul: 'JP', angka: true, sel: (j) => j.total_jam_mengajar },
  { id: 'guru', judul: 'Guru', utama: true, sel: (j) => j.nama_guru },
  { id: 'mapel', judul: 'Mata pelajaran', sel: (j) => j.mata_pelajaran },
  { id: 'kelas', judul: 'Kelas', sel: (j) => j.nama_kelas },
];

function TabJadwal() {
  const opsiKelas = useOpsiKelas();
  const opsiGuru = useOpsiGuru();
  return (
    <TabSumber<Jadwal>
      sumber="jadwal"
      nama="jadwal"
      kolom={kolomJadwal}
      filter={[
        { kunci: 'hari', label: 'Hari', opsi: OPSI_HARI },
        { kunci: 'kelas_id', label: 'Kelas', opsi: opsiKelas },
        { kunci: 'guru_id', label: 'Guru', opsi: opsiGuru },
      ]}
      skema={skemaForm(jadwalSchema)}
      nilaiAwal={{ guru_id: null, kelas_id: null, hari: null, jam_ke: 1, total_jam_mengajar: 1 }}
      keForm={(j) => ({
        guru_id: j.guru_id,
        kelas_id: j.kelas_id,
        hari: j.hari,
        jam_ke: j.jam_ke,
        total_jam_mengajar: j.total_jam_mengajar,
      })}
      labelBaris={(j) =>
        `jadwal ${j.nama_guru}, ${NAMA_HARI[j.hari] ?? j.hari} jam ke-${j.jam_ke}, ${j.nama_kelas}`
      }
      ringkas={(j) => ({
        judul: j.nama_guru,
        sub: `Jam ke-${rentangJadwal(j)} · ${j.total_jam_mengajar} JP · Kelas ${j.nama_kelas}`,
        detail: [j.mata_pelajaran],
      })}
      // Daftar dari API urut hari lalu jam: kartu ponsel dikelompokkan per hari.
      grupMobile={GRUP_HARI}
      isian={[
        {
          nama: 'guru_id',
          label: 'Guru',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: opsiGuru,
          wajib: true,
          grup: 'Guru & kelas',
        },
        {
          nama: 'kelas_id',
          label: 'Kelas',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: opsiKelas,
          wajib: true,
          grup: 'Guru & kelas',
        },
        {
          nama: 'hari',
          label: 'Hari',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: OPSI_HARI,
          wajib: true,
          grup: 'Waktu',
          setengah: true,
        },
        {
          nama: 'jam_ke',
          label: 'Mulai jam ke-',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: OPSI_JAM,
          wajib: true,
          bantuan: 'Jam ke-0 adalah pembiasaan pagi.',
          grup: 'Waktu',
          setengah: true,
        },
        {
          nama: 'total_jam_mengajar',
          label: 'Jumlah JP',
          jenis: 'segmen',
          opsi: OPSI_LAMA,
          wajib: true,
          grup: 'Waktu',
        },
      ]}
    />
  );
}

const kolomAkun: Kolom<Akun>[] = [
  { id: 'nama', judul: 'Nama', utama: true, sel: (a) => a.name },
  { id: 'email', judul: 'Email', sel: (a) => <span className="break-all">{a.email}</span> },
  { id: 'peran', judul: 'Peran', sel: (a) => ROLE_LABEL[a.role] },
  { id: 'kelas', judul: 'Kelas', sel: (a) => a.nama_kelas ?? '—' },
  {
    id: 'status',
    judul: 'Status',
    sel: (a) => (
      <StatusBadge
        status={a.is_active ? 'aktif' : 'tidak_aktif'}
        label={a.is_active ? 'Aktif' : 'Nonaktif'}
      />
    ),
  },
];

function TabAkun() {
  const opsiKelas = useOpsiKelas();
  const [reset, setReset] = useState<Akun | null>(null);
  const isianDasar = [
    { nama: 'name', label: 'Nama', jenis: 'teks' as const, wajib: true, grup: 'Identitas' },
    { nama: 'email', label: 'Email', jenis: 'email' as const, wajib: true, grup: 'Identitas' },
    {
      nama: 'password',
      label: 'Kata sandi awal',
      jenis: 'sandi' as const,
      wajib: true,
      hanyaBuat: true,
      bantuan: 'Minimal 8 karakter. Minta pengguna menggantinya setelah masuk.',
      grup: 'Identitas',
    },
    {
      nama: 'role',
      label: 'Peran',
      jenis: 'pilih' as const,
      opsi: OPSI_PERAN,
      wajib: true,
      grup: 'Akses',
    },
    {
      nama: 'kelas_id',
      label: 'Kelas',
      jenis: 'pilih' as const,
      nilaiAngka: true,
      opsi: opsiKelas,
      wajib: true,
      bantuan: 'Sekretaris kelas hanya dapat mengelola data kelas ini.',
      tampil: (v: FieldValues) => v.role === 'sekretaris_kelas',
      grup: 'Akses',
    },
    { nama: 'is_active', label: 'Akun aktif', jenis: 'centang' as const, grup: 'Akses' },
  ];

  return (
    <>
      <TabSumber<Akun>
        sumber="users"
        nama="akun"
        kolom={kolomAkun}
        cari="Nama atau email"
        filter={[{ kunci: 'role', label: 'Peran', opsi: OPSI_PERAN }]}
        skema={skemaForm(akunUbahSchema)}
        skemaBuat={skemaForm(akunBuatSchema)}
        nilaiAwal={{ name: '', email: '', password: '', role: '', kelas_id: null, is_active: true }}
        keForm={(a) => ({
          name: a.name,
          email: a.email,
          role: a.role,
          kelas_id: a.kelas_id,
          is_active: a.is_active,
        })}
        labelBaris={(a) => `akun ${a.email}`}
        ringkas={(a) => ({
          judul: a.name,
          sub: a.email,
          detail: [ROLE_LABEL[a.role], a.nama_kelas ? `Kelas ${a.nama_kelas}` : null],
          lencana: lencanaNonaktif(a.is_active, 'Nonaktif'),
        })}
        isian={isianDasar}
        aksiTambahan={(a) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Reset kata sandi ${a.email}`}
            onClick={() => setReset(a)}
          >
            <KeyIcon aria-hidden="true" />
          </Button>
        )}
      />
      {reset && <DialogResetSandi akun={reset} onTutup={() => setReset(null)} />}
    </>
  );
}

function DialogResetSandi({ akun, onTutup }: { akun: Akun; onTutup: () => void }) {
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password_baru: '' },
  });
  const reset = useMutation({
    mutationFn: (data: ResetPasswordInput) =>
      api.post<void>(`/settings/users/${akun.id}/reset-password`, data),
    onSuccess: () => {
      toast.success(`Kata sandi ${akun.email} direset.`);
      onTutup();
    },
    onError: (err) => toast.error(pesanGalat(err)),
  });

  return (
    <Dialog
      open
      onOpenChange={(buka) => !buka && onTutup()}
      judul="Reset kata sandi"
      deskripsi={`Akun ${akun.email}. Sesi pengguna ini akan diakhiri dan tindakan ini tercatat di log.`}
      kotor={form.formState.isDirty && !reset.isSuccess}
    >
      <form noValidate onSubmit={form.handleSubmit((d) => reset.mutate(d))}>
        <Field
          label="Kata sandi baru"
          wajib
          bantuan="Minimal 8 karakter."
          galat={form.formState.errors.password_baru?.message}
        >
          <InputSandi autoComplete="new-password" {...form.register('password_baru')} />
        </Field>
        <DialogAksi>
          <DialogBatal />
          <Button type="submit" loading={reset.isPending}>
            Reset kata sandi
          </Button>
        </DialogAksi>
      </form>
    </Dialog>
  );
}
