import { zodResolver } from '@hookform/resolvers/zod';
import { skorSchema, teksOpsional, type PenilaianMgmpBaris, type Periode } from '@sms/shared';
import { ClipboardPen, Download, RefreshCw, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { DataTable, type Kolom } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogAksi } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';
import { angka, namaBulan } from '@/lib/format';
import { urlEkspor, useDaftarMgmp, useSimpanMgmp, useSinkronPenilaian } from './api';
import {
  InfoJendela,
  keSkor,
  LencanaPredikat,
  PilihPeriode,
  TeksSkor,
  usePeriodeUrl,
} from './komponen';

export function PenilaianMgmpPage() {
  const user = usePengguna();
  const admin = user.role === 'admin';
  // Sekretaris kelas hanya mengisi skor siswa (PROJECT-CONTEXT §4).
  const sekretaris = user.role === 'sekretaris_kelas';
  const { periode, atur } = usePeriodeUrl();

  const daftar = useDaftarMgmp(periode);
  const sinkron = useSinkronPenilaian('mgmp');
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [dinilai, setDinilai] = useState<PenilaianMgmpBaris | null>(null);

  const jendela = daftar.data?.jendela;
  const bolehIsi = admin || jendela?.terbuka === true;
  const label = `${namaBulan(periode.bulan)} ${periode.tahun}`;

  const kolom = useMemo<Kolom<PenilaianMgmpBaris>[]>(() => {
    const aksi: Kolom<PenilaianMgmpBaris> = {
      id: 'aksi',
      judul: 'Aksi',
      aksi: true,
      sel: (b) => (
        <Button
          variant="ghost"
          size="touch"
          disabled={!bolehIsi}
          aria-label={`Nilai MGMP ${b.nama_mapel}`}
          onClick={() => setDinilai(b)}
        >
          <ClipboardPen aria-hidden="true" />
          {sekretaris ? 'Isi skor siswa' : 'Nilai'}
        </Button>
      ),
    };
    const mgmp: Kolom<PenilaianMgmpBaris> = {
      id: 'mgmp',
      judul: 'MGMP',
      utama: true,
      sel: (b) => b.nama_mapel,
    };
    const siswa: Kolom<PenilaianMgmpBaris> = {
      id: 'siswa',
      judul: 'Skor siswa',
      angka: true,
      sel: (b) => <TeksSkor nilai={b.skor_siswa} />,
    };
    if (sekretaris) return [mgmp, siswa, aksi];
    return [
      mgmp,
      { id: 'guru', judul: 'Guru aktif', angka: true, sel: (b) => angka(b.jumlah_guru_aktif) },
      {
        id: 'kehadiran',
        judul: 'Kehadiran',
        angka: true,
        sel: (b) => <TeksSkor nilai={b.skor_kehadiran} />,
      },
      siswa,
      {
        id: 'adm',
        judul: 'Administrasi',
        angka: true,
        sel: (b) => <TeksSkor nilai={b.skor_administrasi} />,
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
      aksi,
    ];
  }, [bolehIsi, sekretaris]);

  return (
    <div>
      <PilihPeriode periode={periode} onUbah={atur} />
      <InfoJendela jendela={jendela} periode={periode} admin={admin} />

      {!sekretaris && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-subtle">
            Skor kehadiran MGMP diisi otomatis dari rekap pekan guru aktif anggotanya.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="touch" variant="secondary" onClick={() => setKonfirmasi(true)}>
              <RefreshCw aria-hidden="true" />
              Sinkronkan skor kehadiran
            </Button>
            <Button asChild size="touch" variant="secondary">
              <a href={urlEkspor('mgmp', periode)} download>
                <Download aria-hidden="true" />
                Ekspor CSV
              </a>
            </Button>
          </div>
        </div>
      )}

      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        idBaris={(b) => b.mgmp_id}
        memuat={daftar.isFetching}
        galat={daftar.isError ? pesanGalat(daftar.error) : null}
        onCobaLagi={() => void daftar.refetch()}
        keterangan={`Penilaian MGMP ${label}`}
        barisSkeleton={3}
        kosong={{ icon: UsersRound, pesan: 'Belum ada MGMP.' }}
      />

      <ConfirmDialog
        open={konfirmasi}
        onOpenChange={setKonfirmasi}
        judul="Sinkronkan skor kehadiran MGMP?"
        pesan={
          <>
            Skor kehadiran semua MGMP untuk{' '}
            <strong className="font-semibold text-ink">{label}</strong> dihitung ulang dari rekap
            pekan. Skor siswa dan administrasi tidak berubah.
          </>
        }
        labelSetuju="Sinkronkan"
        memproses={sinkron.isPending}
        onSetuju={() =>
          sinkron.mutate(periode, {
            onSuccess: (res) => {
              toast.success(`Skor kehadiran ${angka(res.data.disinkronkan)} MGMP disinkronkan.`);
              setKonfirmasi(false);
            },
            onError: (err) => toast.error(pesanGalat(err)),
          })
        }
      />

      {dinilai && (
        <FormNilaiMgmp
          baris={dinilai}
          periode={periode}
          sekretaris={sekretaris}
          onTutup={() => setDinilai(null)}
        />
      )}
    </div>
  );
}

// Form klien: skor boleh kosong (tidak dikirim). Skema per isian sama dengan server.
const formMgmpSchema = z.object({
  skor_siswa: skorSchema.nullable(),
  skor_administrasi: skorSchema.nullable(),
  catatan: teksOpsional(1000),
});
type FormMgmp = z.input<typeof formMgmpSchema>;
type FormMgmpKeluar = z.output<typeof formMgmpSchema>;

function FormNilaiMgmp({
  baris,
  periode,
  sekretaris,
  onTutup,
}: {
  baris: PenilaianMgmpBaris;
  periode: Periode;
  sekretaris: boolean;
  onTutup: () => void;
}) {
  const simpan = useSimpanMgmp();
  const form = useForm<FormMgmp, unknown, FormMgmpKeluar>({
    resolver: zodResolver(
      sekretaris ? formMgmpSchema.extend({ skor_siswa: skorSchema }) : formMgmpSchema,
    ),
    defaultValues: {
      skor_siswa: baris.skor_siswa,
      skor_administrasi: baris.skor_administrasi,
      catatan: baris.catatan ?? '',
    },
  });
  const galat = form.formState.errors;

  function kirim(data: FormMgmpKeluar) {
    // Sekretaris hanya mengirim skor_siswa; isian kosong tidak dikirim (tidak diubah).
    const isi = sekretaris
      ? { skor_siswa: data.skor_siswa ?? undefined }
      : {
          skor_siswa: data.skor_siswa ?? undefined,
          skor_administrasi: data.skor_administrasi ?? undefined,
          catatan: data.catatan,
        };
    simpan.mutate(
      { mgmp_id: baris.mgmp_id, bulan: periode.bulan, tahun: periode.tahun, ...isi },
      {
        onSuccess: () => {
          toast.success(`Penilaian MGMP ${baris.nama_mapel} tersimpan.`);
          onTutup();
        },
        onError: (err) => toast.error(pesanGalat(err)),
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(buka) => !buka && onTutup()}
      judul={`Penilaian MGMP ${baris.nama_mapel}`}
      deskripsi={`${namaBulan(periode.bulan)} ${periode.tahun} · Skor 0–100, paling banyak dua desimal.`}
    >
      <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit(kirim)}>
        {!sekretaris && (
          <div className="rounded-lg bg-subtle px-3 py-2 text-sm">
            <span className="text-ink-muted">Skor kehadiran (otomatis): </span>
            <strong className="font-semibold text-ink">
              <TeksSkor nilai={baris.skor_kehadiran} />
            </strong>
          </div>
        )}
        <Field
          label="Skor siswa"
          wajib={sekretaris}
          bantuan={sekretaris ? 'Penilaian siswa terhadap kegiatan MGMP ini.' : undefined}
          galat={galat.skor_siswa?.message}
        >
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            max={100}
            {...form.register('skor_siswa', { setValueAs: keSkor })}
          />
        </Field>
        {!sekretaris && (
          <>
            <Field label="Skor administrasi" galat={galat.skor_administrasi?.message}>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                max={100}
                {...form.register('skor_administrasi', { setValueAs: keSkor })}
              />
            </Field>
            <Field label="Catatan" galat={galat.catatan?.message}>
              <Textarea rows={3} maxLength={1000} {...form.register('catatan')} />
            </Field>
          </>
        )}
        <DialogAksi>
          <Button variant="secondary" size="touch" onClick={onTutup}>
            Batal
          </Button>
          <Button type="submit" size="touch" loading={simpan.isPending}>
            Simpan
          </Button>
        </DialogAksi>
      </form>
    </Dialog>
  );
}
