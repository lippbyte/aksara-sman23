import { zodResolver } from '@hookform/resolvers/zod';
import {
  NAMA_HARI,
  sekolahSchema,
  type JenisLatar,
  type Respons,
  type Sekolah,
  type SekolahInput,
} from '@sms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChalkboardIcon,
  ImageIcon,
  ImageSquareIcon,
  TrashIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { useRef } from 'react';
import { useForm, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, Skeleton } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Checkbox, Input } from '@/components/ui/input';
import { api, ApiError, pesanGalat } from '@/lib/api';
import { KUNCI_SESI } from '@/lib/auth';

const KUNCI = ['pengaturan', 'sekolah'] as const;
const UKURAN_LOGO_MAKS = 250 * 1024;
const UKURAN_LATAR_MAKS = 5 * 1024 * 1024;
const TIPE_GAMBAR = ['image/png', 'image/jpeg', 'image/webp'];

type NilaiForm = SekolahInput;

function keForm(s: Sekolah): NilaiForm {
  const {
    id: _id,
    logo_url: _logo,
    login_background_url: _latarMasuk,
    dashboard_background_url: _latarDash,
    ...isi
  } = s;
  return isi;
}

export function TabSekolah() {
  const sekolah = useQuery({
    queryKey: KUNCI,
    queryFn: async () => (await api.get<Respons<Sekolah>>('/settings/sekolah')).data,
  });

  if (sekolah.isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Memuat pengaturan sekolah">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (sekolah.isError) {
    return (
      <EmptyState
        icon={WarningIcon}
        pesan={pesanGalat(sekolah.error)}
        aksi={
          <Button variant="secondary" onClick={() => void sekolah.refetch()}>
            Coba lagi
          </Button>
        }
      />
    );
  }
  return <FormSekolah key={sekolah.dataUpdatedAt} sekolah={sekolah.data} />;
}

function bacaDataUrl(
  berkas: File,
  maksByte: number,
  label: string,
  onSiap: (dataUrl: string) => void,
) {
  if (!TIPE_GAMBAR.includes(berkas.type)) {
    toast.error(`${label} harus berupa PNG, JPEG, atau WebP.`);
    return;
  }
  if (berkas.size > maksByte) {
    const maksLabel =
      maksByte >= 1024 * 1024
        ? `${Math.round(maksByte / (1024 * 1024))} MB`
        : `${Math.round(maksByte / 1024)} KB`;
    toast.error(`Ukuran ${label.toLowerCase()} maksimal ${maksLabel}.`);
    return;
  }
  const pembaca = new FileReader();
  pembaca.onload = () => {
    if (typeof pembaca.result === 'string') onSiap(pembaca.result);
  };
  pembaca.onerror = () => toast.error(`Berkas ${label.toLowerCase()} tidak dapat dibaca.`);
  pembaca.readAsDataURL(berkas);
}

function FormSekolah({ sekolah }: { sekolah: Sekolah }) {
  const queryClient = useQueryClient();
  const inputLogo = useRef<HTMLInputElement>(null);
  const inputLatarMasuk = useRef<HTMLInputElement>(null);
  const inputLatarDashboard = useRef<HTMLInputElement>(null);
  const form = useForm<NilaiForm>({
    resolver: zodResolver(sekolahSchema),
    defaultValues: keForm(sekolah),
  });
  const galat = form.formState.errors;
  const hariEfektif = form.watch('hari_efektif');

  const segarkan = (baru: Sekolah) => {
    queryClient.setQueryData(KUNCI, baru);
    // Nama, logo, dan latar dashboard sekolah tampil di layout & dashboard.
    void queryClient.invalidateQueries({ queryKey: KUNCI_SESI });
  };

  const simpan = useMutation({
    mutationFn: (data: SekolahInput) => api.put<Respons<Sekolah>>('/settings/sekolah', data),
    onSuccess: (res) => {
      toast.success('Pengaturan sekolah disimpan.');
      segarkan(res.data);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        for (const g of err.galatIsian) {
          form.setError(g.path as Path<NilaiForm>, { message: g.message });
        }
      }
      toast.error(pesanGalat(err));
    },
  });

  const unggahLogo = useMutation({
    mutationFn: (dataUrl: string) =>
      api.put<Respons<Sekolah>>('/settings/sekolah/logo', { data_url: dataUrl }),
    onSuccess: (res) => {
      toast.success('Logo sekolah diperbarui.');
      segarkan(res.data);
    },
    onError: (err) => toast.error(pesanGalat(err)),
  });

  const hapusLogo = useMutation({
    mutationFn: () => api.delete<Respons<Sekolah>>('/settings/sekolah/logo'),
    onSuccess: (res) => {
      toast.success('Logo sekolah dihapus.');
      segarkan(res.data);
    },
    onError: (err) => toast.error(pesanGalat(err)),
  });

  const unggahLatar = useMutation({
    mutationFn: ({ jenis, dataUrl }: { jenis: JenisLatar; dataUrl: string }) =>
      api.put<Respons<Sekolah>>(`/settings/sekolah/latar/${jenis}`, { data_url: dataUrl }),
    onSuccess: (res, { jenis }) => {
      toast.success(`Gambar latar halaman ${jenis} diperbarui.`);
      segarkan(res.data);
    },
    onError: (err) => toast.error(pesanGalat(err)),
  });

  const hapusLatar = useMutation({
    mutationFn: (jenis: JenisLatar) =>
      api.delete<Respons<Sekolah>>(`/settings/sekolah/latar/${jenis}`),
    onSuccess: (res, jenis) => {
      toast.success(`Gambar latar halaman ${jenis} dihapus.`);
      segarkan(res.data);
    },
    onError: (err) => toast.error(pesanGalat(err)),
  });

  function ubahHari(hari: number, dipilih: boolean) {
    const baru = dipilih ? [...hariEfektif, hari] : hariEfektif.filter((h) => h !== hari);
    form.setValue(
      'hari_efektif',
      [...new Set(baru)].sort((a, b) => a - b),
      { shouldDirty: true, shouldValidate: true },
    );
  }

  const bobot = (nama: Path<NilaiForm>, label: string) => (
    <Field label={label} galat={galat[nama as keyof NilaiForm]?.message}>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        min={0}
        max={100}
        {...form.register(nama, { valueAsNumber: true })}
      />
    </Field>
  );

  return (
    <div className="grid max-w-4xl gap-4">
      <Card>
        <CardHeader
          judul="Logo dan gambar latar sekolah"
          keterangan="PNG, JPEG, atau WebP. Metadata EXIF (termasuk lokasi) dihapus otomatis; gambar latar diubah ukurannya ke 640/1280/1920 px WebP."
        />
        <CardBody className="grid gap-4 md:grid-cols-3">
          {/* Slot 1: Logo sekolah */}
          <div className="flex flex-col justify-between gap-3 rounded-kontrol border border-line-soft bg-app/50 p-3">
            <div className="flex items-center gap-3">
              {sekolah.logo_url ? (
                <img
                  src={sekolah.logo_url}
                  alt="Logo sekolah saat ini"
                  width={56}
                  height={56}
                  decoding="async"
                  className="size-14 shrink-0 rounded-kontrol border border-line bg-surface object-contain p-1"
                />
              ) : (
                <span className="flex size-14 shrink-0 items-center justify-center rounded-kontrol bg-subtle">
                  <ChalkboardIcon className="size-6 text-icon-muted" aria-hidden="true" />
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">Logo sekolah</p>
                <p className="text-xs text-ink-subtle">Maks. 250 KB</p>
              </div>
            </div>
            <input
              ref={inputLogo}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Pilih berkas logo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) bacaDataUrl(f, UKURAN_LOGO_MAKS, 'Logo', (u) => unggahLogo.mutate(u));
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={unggahLogo.isPending}
                onClick={() => inputLogo.current?.click()}
              >
                <ImageSquareIcon aria-hidden="true" />
                Unggah logo
              </Button>
              {sekolah.logo_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={hapusLogo.isPending}
                  onClick={() => hapusLogo.mutate()}
                >
                  <TrashIcon aria-hidden="true" />
                  Hapus
                </Button>
              )}
            </div>
          </div>

          {/* Slot 2: Latar halaman masuk */}
          <div className="flex flex-col justify-between gap-3 rounded-kontrol border border-line-soft bg-app/50 p-3">
            <div>
              <div className="mb-2 flex h-20 w-full items-center justify-center overflow-hidden rounded-kontrol border border-line bg-subtle">
                {sekolah.login_background_url ? (
                  <img
                    src={`${sekolah.login_background_url}&w=640&fmt=webp`}
                    alt="Pratinjau latar halaman masuk"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="size-6 text-icon-muted" aria-hidden="true" />
                )}
              </div>
              <p className="text-sm font-medium text-ink">Latar halaman masuk</p>
              <p className="text-xs text-ink-subtle">Opsional · maks. 5 MB · tampil tanpa login</p>
            </div>
            <input
              ref={inputLatarMasuk}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Pilih gambar latar halaman masuk"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  bacaDataUrl(f, UKURAN_LATAR_MAKS, 'Gambar latar masuk', (dataUrl) =>
                    unggahLatar.mutate({ jenis: 'masuk', dataUrl }),
                  );
                }
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={unggahLatar.isPending && unggahLatar.variables?.jenis === 'masuk'}
                onClick={() => inputLatarMasuk.current?.click()}
              >
                <ImageSquareIcon aria-hidden="true" />
                {sekolah.login_background_url ? 'Ganti' : 'Unggah'}
              </Button>
              {sekolah.login_background_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={hapusLatar.isPending && hapusLatar.variables === 'masuk'}
                  onClick={() => hapusLatar.mutate('masuk')}
                >
                  <TrashIcon aria-hidden="true" />
                  Hapus
                </Button>
              )}
            </div>
          </div>

          {/* Slot 3: Latar dashboard */}
          <div className="flex flex-col justify-between gap-3 rounded-kontrol border border-line-soft bg-app/50 p-3">
            <div>
              <div className="mb-2 flex h-20 w-full items-center justify-center overflow-hidden rounded-kontrol border border-line bg-subtle">
                {sekolah.dashboard_background_url ? (
                  <img
                    src={`${sekolah.dashboard_background_url}&w=640&fmt=webp`}
                    alt="Pratinjau latar dashboard"
                    decoding="async"
                    className="h-full w-full object-cover grayscale"
                  />
                ) : (
                  <ImageIcon className="size-6 text-icon-muted" aria-hidden="true" />
                )}
              </div>
              <p className="text-sm font-medium text-ink">Latar dashboard</p>
              <p className="text-xs text-ink-subtle">Opsional · maks. 5 MB · khusus sesi masuk</p>
            </div>
            <input
              ref={inputLatarDashboard}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-label="Pilih gambar latar dashboard"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  bacaDataUrl(f, UKURAN_LATAR_MAKS, 'Gambar latar dashboard', (dataUrl) =>
                    unggahLatar.mutate({ jenis: 'dashboard', dataUrl }),
                  );
                }
                e.target.value = '';
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                loading={unggahLatar.isPending && unggahLatar.variables?.jenis === 'dashboard'}
                onClick={() => inputLatarDashboard.current?.click()}
              >
                <ImageSquareIcon aria-hidden="true" />
                {sekolah.dashboard_background_url ? 'Ganti' : 'Unggah'}
              </Button>
              {sekolah.dashboard_background_url && (
                <Button
                  variant="ghost"
                  size="sm"
                  loading={hapusLatar.isPending && hapusLatar.variables === 'dashboard'}
                  onClick={() => hapusLatar.mutate('dashboard')}
                >
                  <TrashIcon aria-hidden="true" />
                  Hapus
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <form
        noValidate
        onSubmit={form.handleSubmit((data) => simpan.mutate(data))}
        className="grid gap-4"
      >
        <Card>
          <CardHeader judul="Identitas dan kalender" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama sekolah" wajib galat={galat.nama_sekolah?.message}>
              <Input {...form.register('nama_sekolah')} />
            </Field>
            <Field
              label="Tahun ajaran"
              wajib
              bantuan="Contoh: 2026/2027"
              galat={galat.tahun_ajaran?.message}
            >
              <Input {...form.register('tahun_ajaran')} />
            </Field>
            <Field
              label="Tanggal awal pekan"
              wajib
              bantuan="Senin pekan pertama. Nomor pekan dihitung dari tanggal ini."
              galat={galat.tanggal_awal_pekan?.message}
            >
              <Input type="date" {...form.register('tanggal_awal_pekan')} />
            </Field>
            <Field
              label="Jendela penilaian (hari)"
              wajib
              bantuan="Pengisian penilaian dibuka pada N hari terakhir bulan."
              galat={galat.jendela_penilaian_hari?.message}
            >
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={28}
                {...form.register('jendela_penilaian_hari', { valueAsNumber: true })}
              />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm font-medium text-ink">Hari efektif</legend>
              <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
                {Object.entries(NAMA_HARI).map(([nomor, nama]) => (
                  <label
                    key={nomor}
                    className="flex min-h-11 items-center gap-2 text-sm pointer-fine:min-h-9"
                  >
                    <Checkbox
                      checked={hariEfektif.includes(Number(nomor))}
                      onChange={(e) => ubahHari(Number(nomor), e.target.checked)}
                    />
                    {nama}
                  </label>
                ))}
              </div>
              <p className="text-xs text-ink-subtle">
                Jam wajib dan rentang pekan pada rekap hanya menghitung hari efektif.
              </p>
              {galat.hari_efektif?.message && (
                <p role="alert" className="mt-1 text-xs text-tidak-hadir">
                  {galat.hari_efektif.message}
                </p>
              )}
            </fieldset>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            judul="Bobot penilaian (%)"
            keterangan="Aspek dan bobot mengikuti ketentuan sekolah. Jumlah tiap kelompok harus 100."
          />
          <CardBody className="grid gap-5">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">
                Kinerja guru, bila skor manajemen terisi
              </legend>
              <div className="grid grid-cols-3 gap-3">
                {bobot('bobot_kinerja_kehadiran', 'Kehadiran')}
                {bobot('bobot_kinerja_administrasi', 'Administrasi')}
                {bobot('bobot_kinerja_manajemen', 'Manajemen')}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">
                Kinerja guru, bila skor manajemen kosong
              </legend>
              <div className="grid grid-cols-3 gap-3">
                {bobot('bobot_kinerja_kehadiran_tanpa_manajemen', 'Kehadiran')}
                {bobot('bobot_kinerja_administrasi_tanpa_manajemen', 'Administrasi')}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-ink">MGMP</legend>
              <div className="grid grid-cols-3 gap-3">
                {bobot('bobot_mgmp_kehadiran', 'Kehadiran')}
                {bobot('bobot_mgmp_siswa', 'Siswa')}
                {bobot('bobot_mgmp_administrasi', 'Administrasi')}
              </div>
            </fieldset>
          </CardBody>
        </Card>

        <div className="bar-simpan-lekat sticky bottom-(--tinggi-bar-bawah) z-20 flex flex-wrap items-center justify-between gap-3 rounded-kartu border border-line bg-surface px-4 py-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <p className="text-xs text-ink-subtle">
            Setelah mengubah tanggal awal pekan atau hari efektif, sinkronkan ulang rekap kehadiran.
          </p>
          <Button
            type="submit"
            size="touch"
            className="w-full sm:w-auto"
            loading={simpan.isPending}
          >
            Simpan pengaturan
          </Button>
        </div>
      </form>
    </div>
  );
}
