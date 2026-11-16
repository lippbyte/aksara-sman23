import { zodResolver } from '@hookform/resolvers/zod';
import {
  persentaseKehadiran,
  ubahRekapSchema,
  type PekanTersedia,
  type Rekap,
  type UbahRekapInput,
} from '@sms/shared';
import { CalendarCheck, Download, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { DataTable, Pagination, type Kolom } from '@/components/DataTable';
import { FilterBar, FilterItem, useFilterUrl } from '@/components/FilterBar';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogAksi } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { angka, labelPekan, persen } from '@/lib/format';
import { useRefGuru, useRefKelas } from '@/lib/referensi';
import {
  urlEksporRekap,
  useDaftarRekap,
  useHapusRekap,
  useMapelRekap,
  usePekanRekap,
  useSinkronRekap,
  useUbahRekap,
} from './api';

const KUNCI_FILTER = [
  'pekan',
  'guru_id',
  'mapel',
  'kelas_id',
  'tanggal_dari',
  'tanggal_sampai',
] as const;
const SEMUA_PEKAN = 'semua';

const kunciPekan = (p: { tahun: number; minggu_ke: number }) => `${p.tahun}-${p.minggu_ke}`;
const label = (p: { minggu_ke: number; tanggal_mulai: string; tanggal_selesai: string }) =>
  labelPekan(p.minggu_ke, p.tanggal_mulai, p.tanggal_selesai);

export function RekapPage() {
  const f = useFilterUrl(KUNCI_FILTER);
  const pekanList = usePekanRekap();
  const mapel = useMapelRekap();
  const guru = useRefGuru();
  const kelas = useRefKelas();

  // Default: pekan berjalan (baris pertama daftar pekan).
  const pilihanPekan = f.nilai.pekan || (pekanList.data?.[0] ? kunciPekan(pekanList.data[0]) : '');
  const pekan: PekanTersedia | undefined = pekanList.data?.find(
    (p) => kunciPekan(p) === pilihanPekan,
  );
  const semuaPekan = pilihanPekan === SEMUA_PEKAN;

  const filter = {
    ...(pekan ? { minggu_ke: pekan.minggu_ke, tahun: pekan.tahun } : {}),
    guru_id: f.nilai.guru_id,
    mapel: f.nilai.mapel,
    kelas_id: f.nilai.kelas_id,
    tanggal_dari: f.nilai.tanggal_dari,
    tanggal_sampai: f.nilai.tanggal_sampai,
  };
  const siap = semuaPekan || pekan !== undefined;
  const daftar = useDaftarRekap({ ...filter, page: f.page, pageSize: 20 }, siap);

  const sinkron = useSinkronRekap();
  const hapus = useHapusRekap();
  const [konfirmasiSinkron, setKonfirmasiSinkron] = useState(false);
  const [ubah, setUbah] = useState<Rekap | null>(null);
  const [akanDihapus, setAkanDihapus] = useState<Rekap | null>(null);

  const kolom = useMemo<Kolom<Rekap>[]>(
    () => [
      {
        id: 'guru',
        judul: 'Guru',
        utama: true,
        sel: (r) => (
          <span>
            {r.nama_guru}
            <span className="block text-xs font-normal text-ink-subtle">{r.kode_guru}</span>
          </span>
        ),
      },
      { id: 'mapel', judul: 'Mata pelajaran', sel: (r) => r.mata_pelajaran },
      ...(semuaPekan
        ? [
            {
              id: 'pekan',
              judul: 'Pekan',
              sel: (r: Rekap) => <span className="whitespace-nowrap">{label(r)}</span>,
            },
          ]
        : []),
      { id: 'wajib', judul: 'Jam wajib', angka: true, sel: (r) => angka(r.total_jam_wajib) },
      { id: 'hadir', judul: 'Jam hadir', angka: true, sel: (r) => angka(r.total_jam_hadir) },
      {
        id: 'persen',
        judul: 'Kehadiran',
        angka: true,
        className: 'w-48',
        sel: (r) => (
          <ProgressBar nilai={r.persentase_kehadiran} label={`Kehadiran ${r.nama_guru}`} />
        ),
      },
      {
        id: 'aksi',
        judul: 'Aksi',
        aksi: true,
        sel: (r) => (
          <span className="inline-flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Koreksi rekap ${r.nama_guru}`}
              onClick={() => setUbah(r)}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Hapus rekap ${r.nama_guru}`}
              onClick={() => setAkanDihapus(r)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </span>
        ),
      },
    ],
    [semuaPekan],
  );

  const rentangSalah =
    f.nilai.tanggal_dari !== '' &&
    f.nilai.tanggal_sampai !== '' &&
    f.nilai.tanggal_dari > f.nilai.tanggal_sampai;

  return (
    <div>
      <FilterBar onReset={f.reset} adaFilter={f.adaFilter}>
        <FilterItem label="Pekan" className="sm:w-64">
          {(id) => (
            <Select id={id} value={pilihanPekan} onChange={(e) => f.atur('pekan', e.target.value)}>
              {pekanList.isPending && <option value="">Memuat…</option>}
              <option value={SEMUA_PEKAN}>Semua pekan</option>
              {pekanList.data?.map((p) => (
                <option key={kunciPekan(p)} value={kunciPekan(p)}>
                  {label(p)}
                  {p.berjalan ? ' · berjalan' : ''}
                  {p.jumlah_rekap === 0 ? ' · belum disinkron' : ''}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
        <FilterItem label="Guru">
          {(id) => (
            <Select
              id={id}
              value={f.nilai.guru_id}
              onChange={(e) => f.atur('guru_id', e.target.value)}
            >
              <option value="">Semua</option>
              {guru.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama_guru}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
        <FilterItem label="Mapel">
          {(id) => (
            <Select id={id} value={f.nilai.mapel} onChange={(e) => f.atur('mapel', e.target.value)}>
              <option value="">Semua</option>
              {mapel.data?.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
        <FilterItem label="Kelas" className="sm:w-28">
          {(id) => (
            <Select
              id={id}
              value={f.nilai.kelas_id}
              onChange={(e) => f.atur('kelas_id', e.target.value)}
            >
              <option value="">Semua</option>
              {kelas.data?.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
        <FilterItem label="Dari tanggal">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={f.nilai.tanggal_dari}
              max={f.nilai.tanggal_sampai || undefined}
              onChange={(e) => f.atur('tanggal_dari', e.target.value)}
            />
          )}
        </FilterItem>
        <FilterItem label="Sampai tanggal">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={f.nilai.tanggal_sampai}
              min={f.nilai.tanggal_dari || undefined}
              onChange={(e) => f.atur('tanggal_sampai', e.target.value)}
            />
          )}
        </FilterItem>
      </FilterBar>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-subtle">
          {pekan
            ? `${label(pekan)} · ${angka(pekan.jumlah_rekap)} guru terekap. Jam wajib hanya menghitung hari efektif; persentase paling tinggi 100%.`
            : 'Jam wajib hanya menghitung hari efektif; persentase paling tinggi 100%.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="touch"
            disabled={!pekan || sinkron.isPending}
            loading={sinkron.isPending}
            onClick={() => setKonfirmasiSinkron(true)}
          >
            <RefreshCw aria-hidden="true" />
            Sinkronkan rekap
          </Button>
          {rentangSalah ? (
            <Button size="touch" variant="secondary" disabled>
              <Download aria-hidden="true" />
              Ekspor CSV
            </Button>
          ) : (
            <Button asChild size="touch" variant="secondary">
              <a href={urlEksporRekap(filter)} download>
                <Download aria-hidden="true" />
                Ekspor CSV
              </a>
            </Button>
          )}
        </div>
      </div>

      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        idBaris={(r) => r.id}
        memuat={daftar.isFetching || pekanList.isPending}
        galat={
          rentangSalah
            ? 'Tanggal akhir tidak boleh sebelum tanggal awal.'
            : daftar.isError
              ? pesanGalat(daftar.error)
              : pekanList.isError
                ? pesanGalat(pekanList.error)
                : null
        }
        onCobaLagi={() => void (pekanList.isError ? pekanList.refetch() : daftar.refetch())}
        keterangan="Rekap kehadiran guru per pekan"
        kosong={{
          icon: CalendarCheck,
          pesan:
            pekan && pekan.jumlah_rekap === 0
              ? 'Rekap pekan ini belum dihitung. Sinkronkan untuk menghitungnya.'
              : 'Tidak ada rekap yang cocok dengan filter.',
          aksi: pekan && pekan.jumlah_rekap === 0 && (
            <Button onClick={() => setKonfirmasiSinkron(true)}>Sinkronkan rekap</Button>
          ),
        }}
      />
      {daftar.data && !rentangSalah && (
        <Pagination
          page={daftar.data.meta.page}
          pageSize={daftar.data.meta.pageSize}
          total={daftar.data.meta.total}
          onUbah={f.aturPage}
        />
      )}

      <ConfirmDialog
        open={konfirmasiSinkron}
        onOpenChange={setKonfirmasiSinkron}
        judul="Sinkronkan rekap?"
        pesan={
          pekan && (
            <>
              Rekap <strong className="font-semibold text-ink">{label(pekan)}</strong> dihitung
              ulang untuk semua guru aktif dari jadwal dan catatan kehadiran. Koreksi manual pada
              pekan ini akan ditimpa.
            </>
          )
        }
        labelSetuju="Sinkronkan"
        memproses={sinkron.isPending}
        onSetuju={() =>
          pekan &&
          sinkron.mutate(
            { minggu_ke: pekan.minggu_ke, tahun: pekan.tahun },
            {
              onSuccess: (res) => {
                toast.success(
                  `Rekap ${label(res.data.pekan)} disinkronkan untuk ${angka(res.data.disinkronkan)} guru.`,
                );
                setKonfirmasiSinkron(false);
              },
              onError: (err) => toast.error(pesanGalat(err)),
            },
          )
        }
      />

      <ConfirmDialog
        open={akanDihapus !== null}
        onOpenChange={(buka) => !buka && setAkanDihapus(null)}
        judul="Hapus rekap?"
        pesan={
          akanDihapus && (
            <>
              Rekap <strong className="font-semibold text-ink">{akanDihapus.nama_guru}</strong>{' '}
              untuk {label(akanDihapus)} akan dihapus. Sinkron berikutnya akan membuatnya lagi.
            </>
          )
        }
        labelSetuju="Hapus"
        berbahaya
        memproses={hapus.isPending}
        onSetuju={() =>
          akanDihapus &&
          hapus.mutate(akanDihapus.id, {
            onSuccess: () => {
              toast.success('Rekap dihapus.');
              setAkanDihapus(null);
            },
            onError: (err) => toast.error(pesanGalat(err)),
          })
        }
      />

      {ubah && <DialogKoreksi rekap={ubah} onTutup={() => setUbah(null)} />}
    </div>
  );
}

function DialogKoreksi({ rekap, onTutup }: { rekap: Rekap; onTutup: () => void }) {
  const ubah = useUbahRekap();
  const form = useForm<UbahRekapInput>({
    resolver: zodResolver(ubahRekapSchema),
    defaultValues: {
      total_jam_wajib: rekap.total_jam_wajib,
      total_jam_hadir: rekap.total_jam_hadir,
    },
  });
  const wajib = form.watch('total_jam_wajib');
  const hadir = form.watch('total_jam_hadir');
  // Pratinjau memakai fungsi domain yang sama dengan server.
  const pratinjau = persentaseKehadiran(Number(hadir) || 0, Number(wajib) || 0);
  const galat = form.formState.errors;

  return (
    <Dialog
      open
      onOpenChange={(buka) => !buka && onTutup()}
      judul="Koreksi rekap"
      deskripsi={`${rekap.nama_guru} · ${label(rekap)}. Sinkron berikutnya untuk pekan ini akan menimpa koreksi ini.`}
    >
      <form
        noValidate
        onSubmit={form.handleSubmit((data) =>
          ubah.mutate(
            { id: rekap.id, data },
            {
              onSuccess: () => {
                toast.success('Rekap dikoreksi.');
                onTutup();
              },
              onError: (err) => toast.error(pesanGalat(err)),
            },
          ),
        )}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jam wajib (JP)" galat={galat.total_jam_wajib?.message}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              {...form.register('total_jam_wajib', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Jam hadir (JP)" galat={galat.total_jam_hadir?.message}>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              {...form.register('total_jam_hadir', { valueAsNumber: true })}
            />
          </Field>
        </div>
        <p className="text-sm text-ink-muted" aria-live="polite">
          Persentase menjadi <strong className="font-semibold text-ink">{persen(pratinjau)}</strong>
        </p>
        <DialogAksi>
          <Button variant="secondary" size="touch" onClick={onTutup}>
            Batal
          </Button>
          <Button type="submit" size="touch" loading={ubah.isPending}>
            Simpan koreksi
          </Button>
        </DialogAksi>
      </form>
    </Dialog>
  );
}
