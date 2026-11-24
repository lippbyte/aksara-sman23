import { zodResolver } from '@hookform/resolvers/zod';
import type { Halaman } from '@sms/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Controller, useForm, type FieldValues } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import {
  DataTable,
  kelompokkanBerurutan,
  Pagination,
  type GrupMobile,
  type Kolom,
} from '@/components/DataTable';
import { FilterBar, FilterItem, useFilterUrl } from '@/components/FilterBar';
import { KartuRingkas, type Ringkasan } from '@/components/KartuRingkas';
import { SegmentedStatus } from '@/components/SegmentedStatus';
import type { NadaStatus } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogAksi, DialogBatal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import { api, ApiError, pesanGalat, qs } from '@/lib/api';
import { angka } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface Opsi {
  nilai: string | number;
  label: string;
  /** Untuk `segmen`: warna pilihan terpilih (bawaan netral). */
  nada?: NadaStatus;
}

export interface Isian {
  nama: string;
  label: string;
  /** `segmen`: pilihan bersebelahan (SegmentedStatus) untuk 2–4 opsi pendek. */
  jenis: 'teks' | 'email' | 'sandi' | 'angka' | 'pilih' | 'segmen' | 'centang' | 'textarea';
  opsi?: Opsi[];
  /** Judul kelompok (fieldset). Isian berurutan dengan grup sama dikelompokkan. */
  grup?: string;
  /** Isian pendek: setengah lebar mulai 640 px (mis. Kode, NIP, Jenis kelamin). */
  setengah?: boolean;
  /** Untuk `pilih`: nilai dikirim sebagai angka (ID); pilihan kosong menjadi null. */
  nilaiAngka?: boolean;
  /** Label pilihan kosong, mis. "Tanpa MGMP". Tanpa ini pilihan kosong berbunyi "Pilih…". */
  labelKosong?: string;
  wajib?: boolean;
  bantuan?: string;
  /** Hanya tampil saat menambah (mis. kata sandi awal). */
  hanyaBuat?: boolean;
  tampil?: (nilai: FieldValues) => boolean;
}

export interface FilterDef {
  kunci: string;
  label: string;
  opsi: Opsi[];
}

type SkemaForm = z.ZodType<FieldValues, FieldValues>;

interface TabSumberProps<T extends { id: number }> {
  /** Nama sumber daya di API: /settings/<sumber>. */
  sumber: string;
  /** Kata benda untuk teks UI, mis. "guru". */
  nama: string;
  kolom: Kolom<T>[];
  isian: Isian[];
  skema: SkemaForm;
  /** Skema saat menambah bila berbeda (mis. akun dengan kata sandi). */
  skemaBuat?: SkemaForm;
  nilaiAwal: FieldValues;
  keForm: (baris: T) => FieldValues;
  labelBaris: (baris: T) => string;
  cari?: string;
  filter?: FilterDef[];
  aksiTambahan?: (baris: T) => ReactNode;
  /** Isi kartu ringkas di ponsel (audit Fase 4): judul, baris kedua, detail, lencana. */
  ringkas?: (baris: T) => Ringkasan;
  /** Kelompokkan kartu ponsel dengan judul lekat (mis. jadwal per hari). */
  grupMobile?: GrupMobile<T>;
}

/** Kotak cari dengan jeda, supaya tidak meminta data pada setiap ketukan. */
function KotakCari({
  id,
  nilai,
  onUbah,
  placeholder,
}: {
  id: string;
  nilai: string;
  onUbah: (v: string) => void;
  placeholder: string;
}) {
  const [teks, setTeks] = useState(nilai);
  useEffect(() => setTeks(nilai), [nilai]);
  useEffect(() => {
    if (teks === nilai) return;
    const t = setTimeout(() => onUbah(teks.trim()), 300);
    return () => clearTimeout(t);
  }, [teks, nilai, onUbah]);
  return (
    <Input
      id={id}
      type="search"
      value={teks}
      placeholder={placeholder}
      onChange={(e) => setTeks(e.target.value)}
    />
  );
}

export function TabSumber<T extends { id: number }>({
  sumber,
  nama,
  kolom,
  isian,
  skema,
  skemaBuat,
  nilaiAwal,
  keForm,
  labelBaris,
  cari,
  filter = [],
  aksiTambahan,
  ringkas,
  grupMobile,
}: TabSumberProps<T>) {
  const kunciFilter = useMemo(() => ['q', ...filter.map((f) => f.kunci)], [filter]);
  const f = useFilterUrl(kunciFilter);
  const queryClient = useQueryClient();

  const [form, setForm] = useState<{ mode: 'buat' } | { mode: 'ubah'; baris: T } | null>(null);
  const [hapus, setHapus] = useState<T | null>(null);

  const params = { ...f.nilai, page: f.page, pageSize: 20 };
  const daftar = useQuery({
    queryKey: ['pengaturan', sumber, params],
    queryFn: () => api.get<Halaman<T>>(`/settings/${sumber}${qs(params)}`),
    placeholderData: keepPreviousData,
  });

  const segarkan = () => {
    // Nama kelas, guru, dan MGMP tampil di tab lain dan di dropdown.
    void queryClient.invalidateQueries({ queryKey: ['pengaturan'] });
    void queryClient.invalidateQueries({ queryKey: ['referensi'] });
  };

  const hapusMutasi = useMutation({
    mutationFn: (id: number) => api.delete(`/settings/${sumber}/${id}`),
    onSuccess: () => {
      toast.success(`Data ${nama} dihapus.`);
      setHapus(null);
      segarkan();
    },
    onError: (err) => toast.error(pesanGalat(err)),
  });

  const tombolAksi = useCallback(
    (baris: T) => (
      <span className="inline-flex flex-wrap justify-end gap-1">
        {aksiTambahan?.(baris)}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Ubah ${labelBaris(baris)}`}
          onClick={() => setForm({ mode: 'ubah', baris })}
        >
          <PencilSimpleIcon aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Hapus ${labelBaris(baris)}`}
          onClick={() => setHapus(baris)}
        >
          <TrashIcon aria-hidden="true" />
        </Button>
      </span>
    ),
    [aksiTambahan, labelBaris],
  );

  const kolomLengkap = useMemo<Kolom<T>[]>(
    () => [...kolom, { id: 'aksi', judul: 'Aksi', aksi: true, sel: tombolAksi }],
    [kolom, tombolAksi],
  );
  const total = daftar.data?.meta.total;

  const tombolTambah = (
    <Button size="touch" onClick={() => setForm({ mode: 'buat' })}>
      <PlusIcon aria-hidden="true" />
      Tambah {nama}
    </Button>
  );

  return (
    <div>
      <FilterBar
        lembarMobile
        onReset={cari || filter.length > 0 ? f.reset : undefined}
        adaFilter={f.adaFilter}
        jumlahAktif={f.jumlahAktif}
        aksi={tombolTambah}
      >
        {cari && (
          <FilterItem label="Cari" className="sm:w-52">
            {(id) => (
              <KotakCari
                id={id}
                nilai={f.nilai.q ?? ''}
                onUbah={(v) => f.atur('q', v)}
                placeholder={cari}
              />
            )}
          </FilterItem>
        )}
        {filter.map((def) => (
          <FilterItem key={def.kunci} label={def.label}>
            {(id) => (
              <Select
                id={id}
                value={f.nilai[def.kunci] ?? ''}
                onChange={(e) => f.atur(def.kunci, e.target.value)}
              >
                <option value="">Semua</option>
                {def.opsi.map((o) => (
                  <option key={o.nilai} value={o.nilai}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </FilterItem>
        ))}
      </FilterBar>

      {/* Jumlah data langsung di atas daftar (audit M10), bukan hanya di paginasi bawah. */}
      {total !== undefined && total > 0 && (
        <p className="mb-2 text-xs text-ink-muted tabular-nums" aria-live="polite">
          {`${angka(total)} ${nama}${f.adaFilter ? ' cocok dengan filter' : ''}`}
        </p>
      )}
      <DataTable
        kolom={kolomLengkap}
        data={daftar.data?.data}
        idBaris={(b) => b.id}
        memuat={daftar.isFetching}
        galat={daftar.isError ? pesanGalat(daftar.error) : null}
        onCobaLagi={() => void daftar.refetch()}
        keterangan={`Daftar ${nama}`}
        kartuMobile={
          ringkas ? (b) => <KartuRingkas {...ringkas(b)} aksi={tombolAksi(b)} /> : undefined
        }
        grupMobile={grupMobile}
        kosong={{
          pesan: f.adaFilter
            ? `Tidak ada ${nama} yang cocok dengan filter.`
            : `Belum ada data ${nama}.`,
          aksi: f.adaFilter ? (
            <Button variant="secondary" onClick={f.reset}>
              Reset filter
            </Button>
          ) : (
            <Button onClick={() => setForm({ mode: 'buat' })}>Tambah {nama}</Button>
          ),
        }}
      />
      {daftar.data && (
        <Pagination
          page={daftar.data.meta.page}
          pageSize={daftar.data.meta.pageSize}
          total={daftar.data.meta.total}
          onUbah={f.aturPage}
        />
      )}

      {form && (
        <FormSumber
          key={form.mode === 'ubah' ? form.baris.id : 'baru'}
          sumber={sumber}
          nama={nama}
          isian={isian}
          skema={form.mode === 'buat' ? (skemaBuat ?? skema) : skema}
          nilai={form.mode === 'ubah' ? keForm(form.baris) : nilaiAwal}
          id={form.mode === 'ubah' ? form.baris.id : null}
          onTutup={() => setForm(null)}
          onTersimpan={segarkan}
        />
      )}

      <ConfirmDialog
        open={hapus !== null}
        onOpenChange={(buka) => !buka && setHapus(null)}
        judul={`Hapus ${nama}?`}
        pesan={
          hapus && (
            <>
              <strong className="font-semibold text-ink">{labelBaris(hapus)}</strong> akan dihapus.
              Tindakan ini tidak bisa dibatalkan.
            </>
          )
        }
        labelSetuju="Hapus"
        berbahaya
        memproses={hapusMutasi.isPending}
        onSetuju={() => hapus && hapusMutasi.mutate(hapus.id)}
      />
    </div>
  );
}

interface FormSumberProps {
  sumber: string;
  nama: string;
  isian: Isian[];
  skema: SkemaForm;
  nilai: FieldValues;
  id: number | null;
  onTutup: () => void;
  onTersimpan: () => void;
}

function FormSumber({
  sumber,
  nama,
  isian,
  skema,
  nilai,
  id,
  onTutup,
  onTersimpan,
}: FormSumberProps) {
  const form = useForm<FieldValues>({ resolver: zodResolver(skema), defaultValues: nilai });
  const isi = form.watch();

  const simpan = useMutation({
    mutationFn: (data: FieldValues) =>
      id === null
        ? api.post(`/settings/${sumber}`, data)
        : api.put(`/settings/${sumber}/${id}`, data),
    onSuccess: () => {
      toast.success(id === null ? `Data ${nama} ditambahkan.` : `Data ${nama} diperbarui.`);
      onTersimpan();
      onTutup();
    },
    onError: (err) => {
      // Galat validasi server ditempel ke isian yang bersangkutan.
      if (err instanceof ApiError) {
        for (const g of err.galatIsian) form.setError(g.path, { message: g.message });
      }
      toast.error(pesanGalat(err));
    },
  });

  const tampil = isian.filter(
    (i) => !(i.hanyaBuat && id !== null) && (i.tampil ? i.tampil(isi) : true),
  );
  // Kelompok kosong (semua isiannya tersembunyi) otomatis hilang karena dibentuk dari `tampil`.
  const kelompok = kelompokkanBerurutan(tampil, (i) => i.grup ?? '');

  function renderIsian(i: Isian) {
    const galat = form.formState.errors[i.nama]?.message;
    const pesan = typeof galat === 'string' ? galat : undefined;
    // Isian pendek setengah lebar mulai 640 px; selain itu selebar form.
    const lebar = i.setengah ? undefined : 'sm:col-span-2';

    if (i.jenis === 'centang') {
      return (
        <label
          key={i.nama}
          className={cn(
            'flex min-h-11 items-center gap-2.5 text-sm text-ink pointer-fine:min-h-9',
            lebar,
          )}
        >
          <Checkbox {...form.register(i.nama)} />
          {i.label}
        </label>
      );
    }

    if (i.jenis === 'segmen') {
      return (
        <div key={i.nama} className={lebar}>
          <Field label={i.label} wajib={i.wajib} bantuan={i.bantuan} galat={pesan}>
            {(atribut) => (
              <Controller
                control={form.control}
                name={i.nama}
                render={({ field }) => (
                  <SegmentedStatus
                    {...atribut}
                    label={i.label}
                    opsi={(i.opsi ?? []).map((o) => ({
                      nilai: o.nilai,
                      label: o.label,
                      nada: o.nada ?? 'netral',
                    }))}
                    nilai={(field.value as string | number | null | undefined) ?? null}
                    onUbah={field.onChange}
                  />
                )}
              />
            )}
          </Field>
        </div>
      );
    }

    return (
      <div key={i.nama} className={lebar}>
        <Field label={i.label} wajib={i.wajib} bantuan={i.bantuan} galat={pesan}>
          {i.jenis === 'pilih' ? (
            <Select
              {...form.register(i.nama, {
                setValueAs: i.nilaiAngka
                  ? (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))
                  : undefined,
              })}
            >
              <option value="">{i.labelKosong ?? 'Pilih…'}</option>
              {i.opsi?.map((o) => (
                <option key={o.nilai} value={o.nilai}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : i.jenis === 'textarea' ? (
            <Textarea {...form.register(i.nama)} />
          ) : i.jenis === 'angka' ? (
            <Input
              type="number"
              inputMode="numeric"
              {...form.register(i.nama, { valueAsNumber: true })}
            />
          ) : (
            <Input
              type={i.jenis === 'sandi' ? 'password' : i.jenis === 'email' ? 'email' : 'text'}
              autoComplete={i.jenis === 'sandi' ? 'new-password' : 'off'}
              {...(i.jenis === 'email'
                ? { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false }
                : {})}
              {...form.register(i.nama)}
            />
          )}
        </Field>
      </div>
    );
  }

  return (
    <Dialog
      open
      layarPenuhMobile
      onOpenChange={(buka) => !buka && onTutup()}
      judul={id === null ? `Tambah ${nama}` : `Ubah ${nama}`}
      kotor={form.formState.isDirty && !simpan.isSuccess}
    >
      <form
        noValidate
        onSubmit={form.handleSubmit((data) => simpan.mutate(data))}
        className="flex flex-col gap-5"
      >
        {kelompok.map((g, gi) =>
          g.kunci ? (
            // Kelompok bernama (fieldset + legend): form panjang lebih mudah dipindai dan
            // pembaca layar mengumumkan konteks isian (audit Fase 4).
            <fieldset
              key={g.kunci}
              className={cn('min-w-0', gi > 0 && 'border-t border-line-soft pt-4')}
            >
              <legend className="float-left mb-3 w-full text-sm font-semibold text-ink">
                {g.kunci}
              </legend>
              <div className="clear-left grid gap-4 sm:grid-cols-2">{g.isi.map(renderIsian)}</div>
            </fieldset>
          ) : (
            <div key={`kelompok-${gi}`} className="grid gap-4 sm:grid-cols-2">
              {g.isi.map(renderIsian)}
            </div>
          ),
        )}
        <DialogAksi>
          <DialogBatal />
          <Button type="submit" loading={simpan.isPending}>
            {id === null ? `Tambah ${nama}` : 'Simpan perubahan'}
          </Button>
        </DialogAksi>
      </form>
    </Dialog>
  );
}
