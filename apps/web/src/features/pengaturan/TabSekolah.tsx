import { zodResolver } from '@hookform/resolvers/zod';
import {
  NAMA_HARI,
  sekolahSchema,
  type Respons,
  type Sekolah,
  type SekolahInput,
} from '@sms/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageUp, School, Trash2, TriangleAlert } from 'lucide-react';
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

type NilaiForm = SekolahInput;

function keForm(s: Sekolah): NilaiForm {
  const { id: _id, logo_url: _logo, ...isi } = s;
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
        icon={TriangleAlert}
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

function FormSekolah({ sekolah }: { sekolah: Sekolah }) {
  const queryClient = useQueryClient();
  const inputLogo = useRef<HTMLInputElement>(null);
  const form = useForm<NilaiForm>({
    resolver: zodResolver(sekolahSchema),
    defaultValues: keForm(sekolah),
  });
  const galat = form.formState.errors;
  const hariEfektif = form.watch('hari_efektif');

  const segarkan = (baru: Sekolah) => {
    queryClient.setQueryData(KUNCI, baru);
    // Nama dan logo sekolah tampil di sidebar.
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

  function pilihLogo(berkas: File | undefined) {
    if (!berkas) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(berkas.type)) {
      toast.error('Logo harus berupa PNG, JPEG, atau WebP.');
      return;
    }
    if (berkas.size > UKURAN_LOGO_MAKS) {
      toast.error('Ukuran logo maksimal 250 KB.');
      return;
    }
    const pembaca = new FileReader();
    pembaca.onload = () => {
      if (typeof pembaca.result === 'string') unggahLogo.mutate(pembaca.result);
    };
    pembaca.onerror = () => toast.error('Berkas logo tidak dapat dibaca.');
    pembaca.readAsDataURL(berkas);
  }

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
        <CardHeader judul="Logo sekolah" keterangan="PNG, JPEG, atau WebP, maksimal 250 KB." />
        <CardBody className="flex flex-wrap items-center gap-4">
          {sekolah.logo_url ? (
            <img
              src={sekolah.logo_url}
              alt="Logo sekolah saat ini"
              className="size-16 rounded-lg border border-line object-contain"
            />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-lg bg-subtle">
              <School className="size-7 text-icon-muted" aria-hidden="true" />
            </span>
          )}
          <input
            ref={inputLogo}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Pilih berkas logo"
            onChange={(e) => {
              pilihLogo(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="touch"
              loading={unggahLogo.isPending}
              onClick={() => inputLogo.current?.click()}
            >
              <ImageUp aria-hidden="true" />
              Unggah logo
            </Button>
            {sekolah.logo_url && (
              <Button
                variant="ghost"
                size="touch"
                loading={hapusLogo.isPending}
                onClick={() => hapusLogo.mutate()}
              >
                <Trash2 aria-hidden="true" />
                Hapus logo
              </Button>
            )}
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
                    className="flex min-h-11 items-center gap-2 text-sm sm:min-h-9"
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
              <legend className="mb-2 text-2xs font-semibold tracking-wider text-ink-subtle uppercase">
                Kinerja guru, bila skor manajemen terisi
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                {bobot('bobot_kinerja_kehadiran', 'Kehadiran')}
                {bobot('bobot_kinerja_administrasi', 'Administrasi')}
                {bobot('bobot_kinerja_manajemen', 'Manajemen')}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-2xs font-semibold tracking-wider text-ink-subtle uppercase">
                Kinerja guru, bila skor manajemen kosong
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                {bobot('bobot_kinerja_kehadiran_tanpa_manajemen', 'Kehadiran')}
                {bobot('bobot_kinerja_administrasi_tanpa_manajemen', 'Administrasi')}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-2xs font-semibold tracking-wider text-ink-subtle uppercase">
                MGMP
              </legend>
              <div className="grid gap-4 sm:grid-cols-3">
                {bobot('bobot_mgmp_kehadiran', 'Kehadiran')}
                {bobot('bobot_mgmp_siswa', 'Siswa')}
                {bobot('bobot_mgmp_administrasi', 'Administrasi')}
              </div>
            </fieldset>
          </CardBody>
        </Card>

        <p className="text-xs text-ink-subtle">
          Setelah mengubah tanggal awal pekan atau hari efektif, sinkronkan ulang rekap kehadiran
          agar angka rekap mengikuti pengaturan baru.
        </p>
        <div>
          <Button type="submit" size="touch" loading={simpan.isPending}>
            Simpan pengaturan
          </Button>
        </div>
      </form>
    </div>
  );
}
