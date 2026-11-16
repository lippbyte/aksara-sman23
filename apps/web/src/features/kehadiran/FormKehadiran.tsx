import { zodResolver } from '@hookform/resolvers/zod';
import {
  JAM_KE_MAX,
  JAM_KE_MIN,
  kehadiranSchema,
  kehadiranWajibKelasSchema,
  LAMA_JAM_MAX,
  LAMA_JAM_MIN,
  STATUS_KEHADIRAN,
  STATUS_TUGAS,
  type Kehadiran,
  type KehadiranFormValues,
  type KehadiranInput,
} from '@sms/shared';
import { Check, CircleAlert } from 'lucide-react';
import { Controller, useForm, type Path } from 'react-hook-form';
import { toast } from 'sonner';
import { SegmentedStatus } from '@/components/SegmentedStatus';
import { Button } from '@/components/ui/button';
import { Dialog, DialogAksi } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { ApiError, pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';
import { hariIni } from '@/lib/format';
import { useRefGuru, useRefKelas } from '@/lib/referensi';
import { cn } from '@/lib/utils';
import { useJadwalHari, useSimpanKehadiran } from './api';

interface FormKehadiranProps {
  /** Catatan yang diubah; kosong berarti menambah. */
  catatan?: Kehadiran | null;
  /** Nilai awal saat menambah (mis. dari filter atau dashboard kelas). */
  awal?: { kelas_id?: number | null; tanggal?: string };
  onTutup: () => void;
}

const OPSI_JAM = Array.from({ length: JAM_KE_MAX - JAM_KE_MIN + 1 }, (_, i) => JAM_KE_MIN + i);
const OPSI_LAMA = Array.from({ length: LAMA_JAM_MAX - LAMA_JAM_MIN + 1 }, (_, i) => ({
  nilai: LAMA_JAM_MIN + i,
  label: `${LAMA_JAM_MIN + i} JP`,
  nada: 'netral' as const,
}));
const OPSI_STATUS = STATUS_KEHADIRAN.map((s) => ({ nilai: s, label: s }));
const OPSI_TUGAS = STATUS_TUGAS.map((s) => ({
  nilai: s,
  label: s === 'Ada' ? 'Ada tugas' : 'Tidak ada tugas',
  nada: s === 'Ada' ? ('netral' as const) : ('tidak-hadir' as const),
}));

/** Form cepat catat kehadiran guru, nyaman di ponsel 360 px. */
export function FormKehadiran({ catatan, awal, onTutup }: FormKehadiranProps) {
  const user = usePengguna();
  const sekretaris = user.role === 'sekretaris_kelas';
  const kelas = useRefKelas();
  const guru = useRefGuru();
  const simpan = useSimpanKehadiran(catatan?.id ?? null);

  const form = useForm<KehadiranFormValues, unknown, KehadiranInput>({
    // Sekretaris: kelas dari akunnya. Peran lain: kelas wajib dipilih.
    resolver: zodResolver(sekretaris ? kehadiranSchema : kehadiranWajibKelasSchema),
    defaultValues: catatan
      ? {
          tanggal: catatan.tanggal,
          guru_id: catatan.guru_id,
          kelas_id: catatan.kelas_id,
          jam_ke: catatan.jam_ke,
          lama_jam: catatan.lama_jam,
          status_kehadiran: catatan.status_kehadiran,
          status_tugas: catatan.status_tugas,
          keterangan: catatan.keterangan ?? '',
        }
      : {
          tanggal: awal?.tanggal || hariIni(),
          guru_id: '',
          kelas_id: sekretaris ? user.kelas_id : (awal?.kelas_id ?? null),
          jam_ke: 1,
          lama_jam: 1,
          status_kehadiran: 'Hadir',
          status_tugas: 'Ada',
          keterangan: '',
        },
  });
  const galat = form.formState.errors;
  const tanggal = form.watch('tanggal');
  const kelasId = form.watch('kelas_id');
  const guruId = Number(form.watch('guru_id')) || null;
  const jamKe = form.watch('jam_ke');

  const kelasDipilih = typeof kelasId === 'number' ? kelasId : null;
  const jadwal = useJadwalHari(
    kelasDipilih,
    typeof tanggal === 'string' ? tanggal : '',
    sekretaris || kelasDipilih !== null,
  );

  const kirim = form.handleSubmit((data) => {
    simpan.mutate(data, {
      onSuccess: () => {
        toast.success(catatan ? 'Catatan kehadiran diperbarui.' : 'Kehadiran dicatat.');
        onTutup();
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          for (const g of err.galatIsian) {
            form.setError(g.path as Path<KehadiranFormValues>, { message: g.message });
          }
        }
      },
    });
  });

  return (
    <Dialog
      open
      onOpenChange={(buka) => !buka && onTutup()}
      judul={catatan ? 'Ubah catatan kehadiran' : 'Catat kehadiran guru'}
    >
      <form noValidate onSubmit={kirim} className="flex flex-col gap-4">
        {simpan.isError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-tidak-hadir-soft px-3 py-2 text-sm text-tidak-hadir"
          >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {pesanGalat(simpan.error)}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {sekretaris ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink">Kelas</span>
              <span className="flex h-11 items-center rounded-lg bg-subtle px-3 text-sm text-ink sm:h-9">
                {user.nama_kelas}
              </span>
            </div>
          ) : (
            <Field label="Kelas" wajib galat={galat.kelas_id?.message}>
              <Select
                {...form.register('kelas_id', {
                  setValueAs: (v: unknown) =>
                    v === '' || v === null || v === undefined ? null : Number(v),
                })}
              >
                <option value="">Pilih…</option>
                {kelas.data?.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama_kelas}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Tanggal" wajib galat={galat.tanggal?.message}>
            <Input type="date" {...form.register('tanggal')} />
          </Field>
        </div>

        {jadwal.data && jadwal.data.length > 0 && (
          <div>
            <p className="text-2xs font-semibold tracking-wider text-ink-subtle uppercase">
              Isi dari jadwal hari ini
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {jadwal.data.map((j) => {
                const aktif = guruId === j.guru_id && jamKe === j.jam_ke;
                const akhir = j.jam_ke + j.total_jam_mengajar - 1;
                return (
                  <button
                    key={`${j.guru_id}-${j.jam_ke}`}
                    type="button"
                    aria-pressed={aktif}
                    onClick={() => {
                      form.setValue('guru_id', j.guru_id, { shouldValidate: true });
                      form.setValue('jam_ke', j.jam_ke);
                      form.setValue('lama_jam', j.total_jam_mengajar);
                    }}
                    className={cn(
                      'flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-left text-xs transition-colors duration-200',
                      aktif
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-surface text-ink-muted hover:bg-app',
                    )}
                  >
                    {j.sudah_dicatat && (
                      <Check className="size-3.5 shrink-0 text-hadir" aria-hidden="true" />
                    )}
                    <span>
                      <span className="font-semibold tabular-nums">
                        Jam {akhir > j.jam_ke ? `${j.jam_ke}–${akhir}` : j.jam_ke}
                      </span>{' '}
                      · {j.nama_guru}
                      {j.sudah_dicatat && <span className="sr-only"> (sudah dicatat)</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Field label="Guru" wajib galat={galat.guru_id?.message}>
          <Select {...form.register('guru_id')}>
            <option value="">Pilih guru…</option>
            {guru.data?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nama_guru} ({g.mata_pelajaran})
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
          <Field label="Jam ke-" wajib galat={galat.jam_ke?.message}>
            <Select {...form.register('jam_ke', { valueAsNumber: true })}>
              {OPSI_JAM.map((j) => (
                <option key={j} value={j}>
                  {j === 0 ? '0 (pagi)' : j}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lama" wajib galat={galat.lama_jam?.message}>
            <Controller
              control={form.control}
              name="lama_jam"
              render={({ field }) => (
                <SegmentedStatus
                  label="Lama jam pelajaran"
                  opsi={OPSI_LAMA}
                  nilai={typeof field.value === 'number' ? field.value : null}
                  onUbah={field.onChange}
                />
              )}
            />
          </Field>
        </div>

        <Field label="Status kehadiran" wajib galat={galat.status_kehadiran?.message}>
          <Controller
            control={form.control}
            name="status_kehadiran"
            render={({ field }) => (
              <SegmentedStatus
                label="Status kehadiran"
                opsi={OPSI_STATUS}
                nilai={field.value ?? null}
                onUbah={field.onChange}
              />
            )}
          />
        </Field>

        <Field label="Tugas" wajib galat={galat.status_tugas?.message}>
          <Controller
            control={form.control}
            name="status_tugas"
            render={({ field }) => (
              <SegmentedStatus
                label="Status tugas"
                opsi={OPSI_TUGAS}
                nilai={field.value ?? null}
                onUbah={field.onChange}
              />
            )}
          />
        </Field>

        <Field label="Keterangan" galat={galat.keterangan?.message}>
          <Textarea rows={2} maxLength={500} {...form.register('keterangan')} />
        </Field>

        <DialogAksi>
          <Button variant="secondary" size="touch" onClick={onTutup}>
            Batal
          </Button>
          <Button type="submit" size="touch" loading={simpan.isPending}>
            {catatan ? 'Simpan perubahan' : 'Catat kehadiran'}
          </Button>
        </DialogAksi>
      </form>
    </Dialog>
  );
}
