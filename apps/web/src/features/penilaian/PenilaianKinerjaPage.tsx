import { zodResolver } from '@hookform/resolvers/zod';
import {
  simpanPenilaianKinerjaSchema,
  type PenilaianKinerjaBaris,
  type Periode,
  type SimpanPenilaianKinerjaForm,
  type SimpanPenilaianKinerjaInput,
} from '@sms/shared';
import { Award, ClipboardPen, Download, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { DataTable, Pagination, type Kolom } from '@/components/DataTable';
import { FilterItem } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogAksi } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';
import { angka, namaBulan } from '@/lib/format';
import { urlEkspor, useDaftarKinerja, useSimpanKinerja, useSinkronPenilaian } from './api';
import {
  InfoJendela,
  PeringatanPekan,
  keSkor,
  LencanaPredikat,
  PilihPeriode,
  TeksSkor,
  usePeriodeUrl,
} from './komponen';

export function PenilaianKinerjaPage() {
  const user = usePengguna();
  const admin = user.role === 'admin';
  const { periode, page, atur, cari } = usePeriodeUrl();
  const [teksCari, setTeksCari] = useState(cari);
  useEffect(() => {
    if (teksCari === cari) return;
    const t = setTimeout(() => atur('q', teksCari.trim()), 300);
    return () => clearTimeout(t);
  }, [teksCari, cari, atur]);

  const daftar = useDaftarKinerja({ ...periode, page, q: cari });
  const sinkron = useSinkronPenilaian('kinerja');
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [dinilai, setDinilai] = useState<PenilaianKinerjaBaris | null>(null);

  const jendela = daftar.data?.jendela;
  const bolehIsi = admin || jendela?.terbuka === true;

  const kolom = useMemo<Kolom<PenilaianKinerjaBaris>[]>(
    () => [
      {
        id: 'guru',
        judul: 'Guru',
        utama: true,
        sel: (b) => (
          <span>
            {b.nama_guru}
            <span className="block text-xs font-normal text-ink-subtle">{b.mata_pelajaran}</span>
          </span>
        ),
      },
      {
        id: 'kehadiran',
        judul: 'Kehadiran',
        angka: true,
        sel: (b) => <TeksSkor nilai={b.skor_kehadiran} />,
      },
      {
        id: 'adm',
        judul: 'Administrasi',
        angka: true,
        sel: (b) => <TeksSkor nilai={b.skor_administrasi_avg} />,
      },
      {
        id: 'man',
        judul: 'Manajemen',
        angka: true,
        sel: (b) => <TeksSkor nilai={b.skor_manajemen_avg} />,
      },
      {
        id: 'akhir',
        judul: 'Skor akhir',
        angka: true,
        sel: (b) => (
          <strong className="font-semibold">
            <TeksSkor nilai={b.skor_akhir} />
          </strong>
        ),
      },
      { id: 'predikat', judul: 'Predikat', sel: (b) => <LencanaPredikat predikat={b.predikat} /> },
      {
        id: 'aksi',
        judul: 'Aksi',
        aksi: true,
        sel: (b) => (
          <Button
            variant="ghost"
            size="touch"
            disabled={!bolehIsi}
            aria-label={`Nilai ${b.nama_guru}`}
            onClick={() => setDinilai(b)}
          >
            <ClipboardPen aria-hidden="true" />
            Nilai
          </Button>
        ),
      },
    ],
    [bolehIsi],
  );

  const label = `${namaBulan(periode.bulan)} ${periode.tahun}`;

  return (
    <div>
      <PilihPeriode periode={periode} onUbah={atur}>
        <FilterItem label="Cari guru" className="sm:w-56">
          {(id) => (
            <Input
              id={id}
              type="search"
              value={teksCari}
              placeholder="Nama atau kode"
              onChange={(e) => setTeksCari(e.target.value)}
            />
          )}
        </FilterItem>
      </PilihPeriode>
      <InfoJendela jendela={jendela} periode={periode} admin={admin} />
      <PeringatanPekan
        pekan={daftar.data?.pekan_belum_disinkron}
        bolehRekap={user.role === 'admin' || user.role === 'manajemen_guru'}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-subtle">
          Skor kehadiran diisi otomatis dari rekap pekan yang beririsan dengan bulan ini. Pastikan
          rekap pekan sudah disinkronkan.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="touch" variant="secondary" onClick={() => setKonfirmasi(true)}>
            <RefreshCw aria-hidden="true" />
            Sinkronkan skor kehadiran
          </Button>
          <Button asChild size="touch" variant="secondary">
            <a href={urlEkspor('kinerja', periode)} download>
              <Download aria-hidden="true" />
              Ekspor CSV
            </a>
          </Button>
        </div>
      </div>

      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        idBaris={(b) => b.guru_id}
        memuat={daftar.isFetching}
        galat={daftar.isError ? pesanGalat(daftar.error) : null}
        onCobaLagi={() => void daftar.refetch()}
        keterangan={`Penilaian kinerja guru ${label}`}
        kosong={{
          icon: Award,
          pesan: cari ? 'Tidak ada guru yang cocok.' : 'Belum ada guru aktif.',
        }}
      />
      {daftar.data && (
        <Pagination
          page={daftar.data.meta.page}
          pageSize={daftar.data.meta.pageSize}
          total={daftar.data.meta.total}
          onUbah={(p) => atur('page', p > 1 ? String(p) : '')}
        />
      )}

      <ConfirmDialog
        open={konfirmasi}
        onOpenChange={setKonfirmasi}
        judul="Sinkronkan skor kehadiran?"
        pesan={
          <>
            Skor kehadiran <strong className="font-semibold text-ink">{label}</strong> dihitung
            ulang untuk semua guru aktif dari rekap pekan. Skor akhir yang sudah dinilai ikut
            diperbarui; nilai administrasi dan manajemen tidak berubah.
          </>
        }
        labelSetuju="Sinkronkan"
        memproses={sinkron.isPending}
        onSetuju={() =>
          sinkron.mutate(periode, {
            onSuccess: (res) => {
              toast.success(
                `Skor kehadiran ${label} disinkronkan untuk ${angka(res.data.disinkronkan)} guru.`,
              );
              setKonfirmasi(false);
            },
            onError: (err) => toast.error(pesanGalat(err)),
          })
        }
      />

      {dinilai && (
        <FormNilaiKinerja baris={dinilai} periode={periode} onTutup={() => setDinilai(null)} />
      )}
    </div>
  );
}

function FormNilaiKinerja({
  baris,
  periode,
  onTutup,
}: {
  baris: PenilaianKinerjaBaris;
  periode: Periode;
  onTutup: () => void;
}) {
  const simpan = useSimpanKinerja();
  const form = useForm<SimpanPenilaianKinerjaForm, unknown, SimpanPenilaianKinerjaInput>({
    resolver: zodResolver(simpanPenilaianKinerjaSchema),
    defaultValues: {
      guru_id: baris.guru_id,
      bulan: periode.bulan,
      tahun: periode.tahun,
      skor_administrasi_avg: baris.skor_administrasi_avg ?? undefined,
      skor_manajemen_avg: baris.skor_manajemen_avg,
      catatan: baris.catatan ?? '',
    },
  });
  const galat = form.formState.errors;

  return (
    <Dialog
      open
      onOpenChange={(buka) => !buka && onTutup()}
      judul={`Nilai ${baris.nama_guru}`}
      deskripsi={`${namaBulan(periode.bulan)} ${periode.tahun} · Skor 0–100, paling banyak dua desimal.`}
    >
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={form.handleSubmit((data) =>
          simpan.mutate(data, {
            onSuccess: (res) => {
              toast.success(
                `Penilaian ${baris.nama_guru} tersimpan: skor akhir ${res.data.skor_akhir?.toLocaleString('id-ID')} (${res.data.predikat}).`,
              );
              onTutup();
            },
            onError: (err) => toast.error(pesanGalat(err)),
          }),
        )}
      >
        <div className="rounded-lg bg-subtle px-3 py-2 text-sm">
          <span className="text-ink-muted">Skor kehadiran (otomatis): </span>
          <strong className="font-semibold text-ink">
            <TeksSkor nilai={baris.skor_kehadiran} />
          </strong>
        </div>
        <Field
          label="Skor administrasi (rata-rata)"
          wajib
          galat={galat.skor_administrasi_avg?.message}
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={100}
            {...form.register('skor_administrasi_avg', { setValueAs: keSkor })}
          />
        </Field>
        <Field
          label="Skor manajemen (rata-rata)"
          bantuan="Kosongkan bila tidak ada. Bobot skor akhir mengikuti pengaturan sekolah."
          galat={galat.skor_manajemen_avg?.message}
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={100}
            {...form.register('skor_manajemen_avg', { setValueAs: keSkor })}
          />
        </Field>
        <Field label="Catatan" galat={galat.catatan?.message}>
          <Textarea rows={3} maxLength={1000} {...form.register('catatan')} />
        </Field>
        <DialogAksi>
          <Button variant="secondary" size="touch" onClick={onTutup}>
            Batal
          </Button>
          <Button type="submit" size="touch" loading={simpan.isPending}>
            Simpan nilai
          </Button>
        </DialogAksi>
      </form>
    </Dialog>
  );
}
