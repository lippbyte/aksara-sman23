import { zodResolver } from '@hookform/resolvers/zod';
import { skorSchema, teksOpsional, type PenilaianMgmpBaris, type Periode } from '@sms/shared';
import { ClipboardPen, Download, RefreshCw, School, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { DataTable, type Kolom } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogAksi } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';
import { angka, namaBulan } from '@/lib/format';
import {
  urlEkspor,
  useDaftarMgmp,
  useSimpanMgmp,
  useSimpanSkorSiswa,
  useSinkronPenilaian,
  useSkorSiswaKelas,
} from './api';
import {
  PanelPeriodePenilaian,
  PeringatanPekan,
  keSkor,
  LencanaPredikat,
  TeksSkor,
  usePeriodeUrl,
} from './komponen';

/** "n dari m kelas" untuk skor siswa MGMP. */
function KelasMengisi({ b }: { b: PenilaianMgmpBaris }) {
  if (b.jumlah_kelas === 0) {
    return <span className="text-xs text-ink-muted">Tidak ada kelas berjadwal</span>;
  }
  return (
    <span className="text-xs text-ink-muted tabular-nums">
      {angka(b.kelas_terisi)} dari {angka(b.jumlah_kelas)} kelas
    </span>
  );
}

export function PenilaianMgmpPage() {
  const user = usePengguna();
  const admin = user.role === 'admin';
  // Sekretaris kelas hanya mengisi skor siswa kelasnya (PROJECT-CONTEXT §4).
  const sekretaris = user.role === 'sekretaris_kelas';
  const { periode, atur } = usePeriodeUrl();

  const daftar = useDaftarMgmp(periode);
  const sinkron = useSinkronPenilaian('mgmp');
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [dinilai, setDinilai] = useState<PenilaianMgmpBaris | null>(null);
  const [skorKelas, setSkorKelas] = useState<PenilaianMgmpBaris | null>(null);

  const jendela = daftar.data?.jendela;
  const bolehIsi = admin || jendela?.terbuka === true;
  const label = `${namaBulan(periode.bulan)} ${periode.tahun}`;

  const kolom = useMemo<Kolom<PenilaianMgmpBaris>[]>(() => {
    const mgmp: Kolom<PenilaianMgmpBaris> = {
      id: 'mgmp',
      judul: 'MGMP',
      utama: true,
      sel: (b) => b.nama_mapel,
    };
    if (sekretaris) {
      return [
        mgmp,
        {
          id: 'skor-kelas',
          judul: `Skor siswa ${user.nama_kelas ?? 'kelas Anda'}`,
          angka: true,
          sel: (b) => <TeksSkor nilai={b.skor_kelas_saya} />,
        },
        { id: 'terisi', judul: 'Sudah mengisi', sel: (b) => <KelasMengisi b={b} /> },
        {
          id: 'aksi',
          judul: 'Aksi',
          aksi: true,
          sel: (b) => (
            <Button
              variant="ghost"
              size="touch"
              disabled={!bolehIsi}
              aria-label={`Isi skor siswa MGMP ${b.nama_mapel}`}
              onClick={() => setSkorKelas(b)}
            >
              <ClipboardPen aria-hidden="true" />
              Isi skor siswa
            </Button>
          ),
        },
      ];
    }
    return [
      mgmp,
      { id: 'guru', judul: 'Guru aktif', angka: true, sel: (b) => angka(b.jumlah_guru_aktif) },
      {
        id: 'kehadiran',
        judul: 'Kehadiran',
        angka: true,
        sel: (b) => <TeksSkor nilai={b.skor_kehadiran} />,
      },
      {
        id: 'siswa',
        judul: 'Skor siswa',
        angka: true,
        sel: (b) => (
          <span className="flex flex-col items-end">
            <TeksSkor nilai={b.skor_siswa} />
            <KelasMengisi b={b} />
          </span>
        ),
      },
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
      {
        id: 'aksi',
        judul: 'Aksi',
        aksi: true,
        sel: (b) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 md:min-h-0"
              aria-label={`Skor siswa per kelas MGMP ${b.nama_mapel}`}
              onClick={() => setSkorKelas(b)}
            >
              <School aria-hidden="true" />
              Per kelas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="min-h-11 md:min-h-0"
              disabled={!bolehIsi}
              aria-label={`Nilai MGMP ${b.nama_mapel}`}
              onClick={() => setDinilai(b)}
            >
              <ClipboardPen aria-hidden="true" />
              Nilai
            </Button>
          </div>
        ),
      },
    ];
  }, [bolehIsi, sekretaris, user.nama_kelas]);

  const aksiPanel = !sekretaris ? (
    <>
      <Button size="touch" variant="secondary" onClick={() => setKonfirmasi(true)}>
        <RefreshCw aria-hidden="true" />
        Sinkronkan skor otomatis
      </Button>
      <Button asChild size="touch" variant="secondary">
        <a href={urlEkspor('mgmp', periode)} download>
          <Download aria-hidden="true" />
          Ekspor CSV
        </a>
      </Button>
    </>
  ) : undefined;

  return (
    <div>
      <PanelPeriodePenilaian
        periode={periode}
        onUbah={atur}
        jendela={jendela}
        admin={admin}
        aksi={aksiPanel}
      />
      {!sekretaris && (
        <PeringatanPekan
          belum={daftar.data?.pekan_belum_disinkron}
          sebagian={daftar.data?.pekan_rekap_sebagian}
          bolehRekap={user.role === 'admin' || user.role === 'manajemen_guru'}
        />
      )}

      <p className="mb-3 text-xs text-ink-subtle">
        {sekretaris
          ? `Isi skor siswa untuk kelas ${user.nama_kelas ?? 'Anda'}. Skor siswa MGMP adalah rata-rata kelas yang sudah mengisi.`
          : 'Skor kehadiran diisi otomatis dari rekap pekan guru anggota MGMP; skor siswa adalah rata-rata skor yang diisi tiap kelas.'}
      </p>

      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        idBaris={(b) => b.mgmp_id}
        memuat={daftar.isFetching}
        galat={daftar.isError ? pesanGalat(daftar.error) : null}
        onCobaLagi={() => void daftar.refetch()}
        keterangan={`Penilaian MGMP ${label}`}
        barisSkeleton={3}
        kosong={{
          icon: UsersRound,
          pesan: sekretaris
            ? `Belum ada MGMP yang gurunya mengajar di kelas ${user.nama_kelas ?? 'Anda'}.`
            : 'Belum ada MGMP.',
        }}
      />

      <ConfirmDialog
        open={konfirmasi}
        onOpenChange={setKonfirmasi}
        judul="Sinkronkan skor otomatis MGMP?"
        pesan={
          <>
            Skor kehadiran dan rata-rata skor siswa semua MGMP untuk{' '}
            <strong className="font-semibold text-ink">{label}</strong> dihitung ulang. Skor
            administrasi dan catatan tidak berubah.
          </>
        }
        labelSetuju="Sinkronkan"
        memproses={sinkron.isPending}
        onSetuju={() =>
          sinkron.mutate(periode, {
            onSuccess: (res) => {
              toast.success(`Skor otomatis ${angka(res.data.disinkronkan)} MGMP disinkronkan.`);
              setKonfirmasi(false);
            },
            onError: (err) => toast.error(pesanGalat(err)),
          })
        }
      />

      {dinilai && (
        <FormNilaiMgmp baris={dinilai} periode={periode} onTutup={() => setDinilai(null)} />
      )}
      {skorKelas && (
        <DialogSkorSiswa
          baris={skorKelas}
          periode={periode}
          sekretaris={sekretaris}
          bolehIsi={bolehIsi}
          onTutup={() => setSkorKelas(null)}
        />
      )}
    </div>
  );
}

// Form klien: skor boleh kosong (tidak dikirim). Skema per isian sama dengan server.
const formMgmpSchema = z.object({
  skor_administrasi: skorSchema.nullable(),
  catatan: teksOpsional(1000),
});
type FormMgmp = z.input<typeof formMgmpSchema>;
type FormMgmpKeluar = z.output<typeof formMgmpSchema>;

function FormNilaiMgmp({
  baris,
  periode,
  onTutup,
}: {
  baris: PenilaianMgmpBaris;
  periode: Periode;
  onTutup: () => void;
}) {
  const simpan = useSimpanMgmp();
  const form = useForm<FormMgmp, unknown, FormMgmpKeluar>({
    resolver: zodResolver(formMgmpSchema),
    defaultValues: {
      skor_administrasi: baris.skor_administrasi,
      catatan: baris.catatan ?? '',
    },
  });
  const galat = form.formState.errors;

  function kirim(data: FormMgmpKeluar) {
    simpan.mutate(
      {
        mgmp_id: baris.mgmp_id,
        bulan: periode.bulan,
        tahun: periode.tahun,
        // Isian kosong tidak dikirim (tidak diubah).
        skor_administrasi: data.skor_administrasi ?? undefined,
        catatan: data.catatan,
      },
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
        <dl className="grid grid-cols-2 gap-2 rounded-lg bg-subtle px-3 py-2 text-sm">
          <div>
            <dt className="text-ink-muted">Skor kehadiran (otomatis)</dt>
            <dd className="font-semibold text-ink">
              <TeksSkor nilai={baris.skor_kehadiran} />
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Skor siswa (rata-rata kelas)</dt>
            <dd className="font-semibold text-ink">
              <TeksSkor nilai={baris.skor_siswa} />{' '}
              <span className="font-normal">
                <KelasMengisi b={baris} />
              </span>
            </dd>
          </div>
        </dl>
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

// Sekretaris: kelas dari akun (tidak dipilih). Peran lain: wajib memilih kelas.
const buatSkemaSkorSiswa = (wajibKelas: boolean) =>
  z
    .object({ kelas_id: z.number().int().positive().nullable(), skor: skorSchema.nullable() })
    .refine((v) => !wajibKelas || v.kelas_id !== null, {
      message: 'Kelas wajib dipilih.',
      path: ['kelas_id'],
    })
    .refine((v) => v.skor !== null, { message: 'Skor wajib diisi.', path: ['skor'] });
type FormSkorSiswa = { kelas_id: number | null; skor: number | null };
type FormSkorSiswaKeluar = z.output<ReturnType<typeof buatSkemaSkorSiswa>>;

function DialogSkorSiswa({
  baris,
  periode,
  sekretaris,
  bolehIsi,
  onTutup,
}: {
  baris: PenilaianMgmpBaris;
  periode: Periode;
  sekretaris: boolean;
  bolehIsi: boolean;
  onTutup: () => void;
}) {
  const rincian = useSkorSiswaKelas({ mgmp_id: baris.mgmp_id, ...periode });
  const simpan = useSimpanSkorSiswa();
  const form = useForm<FormSkorSiswa, unknown, FormSkorSiswaKeluar>({
    resolver: zodResolver(buatSkemaSkorSiswa(!sekretaris)),
    defaultValues: { kelas_id: null, skor: sekretaris ? baris.skor_kelas_saya : null },
  });
  const galat = form.formState.errors;
  const kelas = rincian.data ?? [];

  function pilihKelas(nilai: string) {
    const id = nilai ? Number(nilai) : null;
    form.setValue('kelas_id', id, { shouldValidate: form.formState.isSubmitted });
    const ada = kelas.find((k) => k.kelas_id === id);
    form.setValue('skor', ada?.skor ?? null);
  }

  function kirim(data: FormSkorSiswaKeluar) {
    if (data.skor === null) return;
    simpan.mutate(
      {
        mgmp_id: baris.mgmp_id,
        bulan: periode.bulan,
        tahun: periode.tahun,
        skor: data.skor,
        ...(sekretaris || data.kelas_id === null ? {} : { kelas_id: data.kelas_id }),
      },
      {
        onSuccess: () => {
          toast.success(`Skor siswa MGMP ${baris.nama_mapel} tersimpan.`);
          if (sekretaris) onTutup();
          else form.reset({ kelas_id: null, skor: null });
        },
        onError: (err) => toast.error(pesanGalat(err)),
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(buka) => !buka && onTutup()}
      judul={`Skor siswa MGMP ${baris.nama_mapel}`}
      deskripsi={`${namaBulan(periode.bulan)} ${periode.tahun} · Skor 0–100, paling banyak dua desimal.`}
    >
      {!sekretaris && (
        <div className="mb-4">
          <p className="mb-2 text-sm text-ink-muted">
            Rata-rata: <TeksSkor nilai={baris.skor_siswa} /> · <KelasMengisi b={baris} />
          </p>
          {rincian.isError ? (
            <p role="alert" className="text-sm text-tidak-hadir">
              {pesanGalat(rincian.error)}
            </p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
              <table className="w-full text-sm">
                <caption className="sr-only">Skor siswa per kelas</caption>
                <thead className="bg-subtle text-left text-xs text-ink-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Kelas
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      Skor
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Diisi oleh
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rincian.isPending ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-ink-subtle">
                        Memuat…
                      </td>
                    </tr>
                  ) : (
                    kelas.map((k) => (
                      <tr key={k.kelas_id} className="border-t border-line">
                        <td className="px-3 py-2">{k.nama_kelas}</td>
                        <td className="px-3 py-2 text-right">
                          <TeksSkor nilai={k.skor} />
                        </td>
                        <td className="px-3 py-2 text-ink-muted">
                          {k.nama_pengisi ?? 'Belum mengisi'}
                          {!k.berjadwal && (
                            <span className="block text-xs">
                              Tanpa jadwal MGMP ini, tidak dihitung
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {bolehIsi ? (
        <form noValidate className="flex flex-col gap-4" onSubmit={form.handleSubmit(kirim)}>
          {!sekretaris && (
            <Field label="Kelas" wajib galat={galat.kelas_id?.message}>
              <Select
                value={form.watch('kelas_id') ?? ''}
                onChange={(e) => pilihKelas(e.target.value)}
              >
                <option value="">Pilih kelas</option>
                {kelas
                  .filter((k) => k.berjadwal)
                  .map((k) => (
                    <option key={k.kelas_id} value={k.kelas_id}>
                      {k.nama_kelas}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          <Field
            label={sekretaris ? 'Skor siswa kelas Anda' : 'Skor siswa kelas ini'}
            wajib
            bantuan={
              sekretaris ? 'Penilaian siswa kelas Anda terhadap kegiatan MGMP ini.' : undefined
            }
            galat={galat.skor?.message}
          >
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              max={100}
              {...form.register('skor', { setValueAs: keSkor })}
            />
          </Field>
          <DialogAksi>
            <Button variant="secondary" size="touch" onClick={onTutup}>
              {sekretaris ? 'Batal' : 'Tutup'}
            </Button>
            <Button type="submit" size="touch" loading={simpan.isPending}>
              Simpan
            </Button>
          </DialogAksi>
        </form>
      ) : (
        <DialogAksi>
          <Button variant="secondary" size="touch" onClick={onTutup}>
            Tutup
          </Button>
        </DialogAksi>
      )}
    </Dialog>
  );
}
