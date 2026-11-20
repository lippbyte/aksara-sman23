import { zodResolver } from '@hookform/resolvers/zod';
import type { Halaman } from '@sms/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useForm, type FieldValues } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { DataTable, Pagination, type Kolom } from '@/components/DataTable';
import { FilterBar, FilterItem, useFilterUrl } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog, DialogAksi } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Checkbox, Input, Select, Textarea } from '@/components/ui/input';
import { api, ApiError, pesanGalat, qs } from '@/lib/api';

export interface Opsi {
  nilai: string | number;
  label: string;
}

export interface Isian {
  nama: string;
  label: string;
  jenis: 'teks' | 'email' | 'sandi' | 'angka' | 'pilih' | 'centang' | 'textarea';
  opsi?: Opsi[];
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

  const kolomLengkap = useMemo<Kolom<T>[]>(
    () => [
      ...kolom,
      {
        id: 'aksi',
        judul: 'Aksi',
        aksi: true,
        sel: (baris) => (
          <span className="inline-flex flex-wrap justify-end gap-1">
            {aksiTambahan?.(baris)}
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Ubah ${labelBaris(baris)}`}
              onClick={() => setForm({ mode: 'ubah', baris })}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Hapus ${labelBaris(baris)}`}
              onClick={() => setHapus(baris)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </span>
        ),
      },
    ],
    [kolom, aksiTambahan, labelBaris],
  );

  const tombolTambah = (
    <Button size="touch" onClick={() => setForm({ mode: 'buat' })}>
      <Plus aria-hidden="true" />
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

      <DataTable
        kolom={kolomLengkap}
        data={daftar.data?.data}
        idBaris={(b) => b.id}
        memuat={daftar.isFetching}
        galat={daftar.isError ? pesanGalat(daftar.error) : null}
        onCobaLagi={() => void daftar.refetch()}
        keterangan={`Daftar ${nama}`}
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

  return (
    <Dialog
      open
      layarPenuhMobile
      onOpenChange={(buka) => !buka && onTutup()}
      judul={id === null ? `Tambah ${nama}` : `Ubah ${nama}`}
    >
      <form
        noValidate
        onSubmit={form.handleSubmit((data) => simpan.mutate(data))}
        className="flex flex-col gap-4"
      >
        {tampil.map((i) => {
          const galat = form.formState.errors[i.nama]?.message;
          const pesan = typeof galat === 'string' ? galat : undefined;

          if (i.jenis === 'centang') {
            return (
              <label
                key={i.nama}
                className="flex min-h-11 items-center gap-2.5 text-sm text-ink sm:min-h-9"
              >
                <Checkbox {...form.register(i.nama)} />
                {i.label}
              </label>
            );
          }

          return (
            <Field key={i.nama} label={i.label} wajib={i.wajib} bantuan={i.bantuan} galat={pesan}>
              {i.jenis === 'pilih' ? (
                <Select
                  {...form.register(i.nama, {
                    setValueAs: i.nilaiAngka
                      ? (v: unknown) =>
                          v === '' || v === null || v === undefined ? null : Number(v)
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
                  {...form.register(i.nama)}
                />
              )}
            </Field>
          );
        })}
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
