import { zodResolver } from '@hookform/resolvers/zod';
import {
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
import { KeyRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, type FieldValues } from 'react-hook-form';
import { Navigate, NavLink, useParams } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import type { Kolom } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogAksi } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, pesanGalat } from '@/lib/api';
import { useRefGuru, useRefKelas, useRefMgmp } from '@/lib/referensi';
import { cn } from '@/lib/utils';
import { TabSekolah } from './TabSekolah';
import { TabSumber, type Opsi } from './TabSumber';

const TAB = [
  { id: 'sekolah', label: 'Sekolah' },
  { id: 'guru', label: 'Guru' },
  { id: 'kelas', label: 'Kelas' },
  { id: 'siswa', label: 'Siswa' },
  { id: 'jadwal', label: 'Jadwal' },
  { id: 'mgmp', label: 'MGMP' },
  { id: 'akun', label: 'Akun' },
] as const;
type IdTab = (typeof TAB)[number]['id'];

// Skema dari @sms/shared dipakai apa adanya; form generik hanya butuh bentuk umumnya.
const skemaForm = (s: z.ZodType) => s as z.ZodType<FieldValues, FieldValues>;

const OPSI_STATUS: Opsi[] = [
  { nilai: 'aktif', label: 'Aktif' },
  { nilai: 'tidak_aktif', label: 'Tidak aktif' },
];
const OPSI_HARI: Opsi[] = Object.entries(NAMA_HARI).map(([n, label]) => ({
  nilai: Number(n),
  label,
}));
const OPSI_PERAN: Opsi[] = ROLES.map((r) => ({ nilai: r, label: ROLE_LABEL[r] }));

export function PengaturanPage() {
  const { tab } = useParams();
  if (!tab) return <Navigate to="/pengaturan/sekolah" replace />;
  const aktif = TAB.find((t) => t.id === tab)?.id;
  if (!aktif) return <Navigate to="/pengaturan/sekolah" replace />;

  return (
    <div>
      <nav
        aria-label="Bagian pengaturan"
        className="mb-4 flex gap-1 overflow-x-auto border-b border-line"
      >
        {TAB.map((t) => (
          <NavLink
            key={t.id}
            to={`/pengaturan/${t.id}`}
            className={({ isActive }) =>
              cn(
                '-mb-px flex h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium transition-colors duration-200 sm:h-10',
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-ink-muted hover:text-ink',
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <IsiTab tab={aktif} />
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
      isian={[
        { nama: 'kode_guru', label: 'Kode guru', jenis: 'teks', wajib: true },
        { nama: 'nama_guru', label: 'Nama guru', jenis: 'teks', wajib: true },
        { nama: 'nip', label: 'NIP', jenis: 'teks', bantuan: 'Boleh dikosongkan.' },
        { nama: 'mata_pelajaran', label: 'Mata pelajaran', jenis: 'teks', wajib: true },
        { nama: 'jabatan', label: 'Jabatan', jenis: 'teks' },
        {
          nama: 'mgmp_id',
          label: 'MGMP',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: opsiMgmp,
          labelKosong: 'Tanpa MGMP',
        },
        { nama: 'status', label: 'Status', jenis: 'pilih', opsi: OPSI_STATUS, wajib: true },
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
        status: 'aktif',
      }}
      keForm={(s) => ({
        nis: s.nis,
        nama_siswa: s.nama_siswa,
        jenis_kelamin: s.jenis_kelamin,
        kelas_id: s.kelas_id,
        wali_kelas: s.wali_kelas ?? '',
        status: s.status,
      })}
      labelBaris={(s) => s.nama_siswa}
      isian={[
        { nama: 'nis', label: 'NIS', jenis: 'teks', wajib: true },
        { nama: 'nama_siswa', label: 'Nama siswa', jenis: 'teks', wajib: true },
        {
          nama: 'jenis_kelamin',
          label: 'Jenis kelamin',
          jenis: 'pilih',
          wajib: true,
          opsi: [
            { nilai: 'L', label: 'Laki-laki' },
            { nilai: 'P', label: 'Perempuan' },
          ],
        },
        {
          nama: 'kelas_id',
          label: 'Kelas',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: opsiKelas,
          wajib: true,
        },
        { nama: 'wali_kelas', label: 'Wali kelas', jenis: 'teks' },
        { nama: 'status', label: 'Status', jenis: 'pilih', opsi: OPSI_STATUS, wajib: true },
      ]}
    />
  );
}

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
      isian={[
        {
          nama: 'guru_id',
          label: 'Guru',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: opsiGuru,
          wajib: true,
        },
        {
          nama: 'kelas_id',
          label: 'Kelas',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: opsiKelas,
          wajib: true,
        },
        {
          nama: 'hari',
          label: 'Hari',
          jenis: 'pilih',
          nilaiAngka: true,
          opsi: OPSI_HARI,
          wajib: true,
        },
        {
          nama: 'jam_ke',
          label: 'Jam ke-',
          jenis: 'angka',
          wajib: true,
          bantuan: '0–12. Jam ke 0 adalah pembiasaan pagi.',
        },
        {
          nama: 'total_jam_mengajar',
          label: 'Jumlah JP',
          jenis: 'angka',
          wajib: true,
          bantuan: '1–4 JP.',
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
    sel: (a) => <StatusBadge status={a.is_active ? 'Aktif' : 'Nonaktif'} />,
  },
];

function TabAkun() {
  const opsiKelas = useOpsiKelas();
  const [reset, setReset] = useState<Akun | null>(null);
  const isianDasar = [
    { nama: 'name', label: 'Nama', jenis: 'teks' as const, wajib: true },
    { nama: 'email', label: 'Email', jenis: 'email' as const, wajib: true },
    {
      nama: 'password',
      label: 'Kata sandi awal',
      jenis: 'sandi' as const,
      wajib: true,
      hanyaBuat: true,
      bantuan: 'Minimal 8 karakter. Minta pengguna menggantinya setelah masuk.',
    },
    { nama: 'role', label: 'Peran', jenis: 'pilih' as const, opsi: OPSI_PERAN, wajib: true },
    {
      nama: 'kelas_id',
      label: 'Kelas',
      jenis: 'pilih' as const,
      nilaiAngka: true,
      opsi: opsiKelas,
      wajib: true,
      bantuan: 'Sekretaris kelas hanya dapat mengelola data kelas ini.',
      tampil: (v: FieldValues) => v.role === 'sekretaris_kelas',
    },
    { nama: 'is_active', label: 'Akun aktif', jenis: 'centang' as const },
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
        isian={isianDasar}
        aksiTambahan={(a) => (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Reset kata sandi ${a.email}`}
            onClick={() => setReset(a)}
          >
            <KeyRound aria-hidden="true" />
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
    >
      <form noValidate onSubmit={form.handleSubmit((d) => reset.mutate(d))}>
        <Field
          label="Kata sandi baru"
          bantuan="Minimal 8 karakter."
          galat={form.formState.errors.password_baru?.message}
        >
          <Input type="password" autoComplete="new-password" {...form.register('password_baru')} />
        </Field>
        <DialogAksi>
          <Button variant="secondary" size="touch" onClick={onTutup}>
            Batal
          </Button>
          <Button type="submit" size="touch" loading={reset.isPending}>
            Reset kata sandi
          </Button>
        </DialogAksi>
      </form>
    </Dialog>
  );
}
