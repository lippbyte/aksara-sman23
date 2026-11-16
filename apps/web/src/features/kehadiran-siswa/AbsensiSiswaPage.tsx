import {
  JAM_KE_MAX,
  JAM_KE_MIN,
  STATUS_SISWA,
  type RiwayatSesiSiswa,
  type SesiAbsenSiswa,
  type StatusSiswa,
} from '@sms/shared';
import { CheckCheck, History, Save, School, Trash2, TriangleAlert, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { DataTable, Pagination, type Kolom } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar, FilterItem } from '@/components/FilterBar';
import { SegmentedStatus } from '@/components/SegmentedStatus';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Skeleton } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';
import { angka, hariIni, tanggalPanjang, tanggalPendek } from '@/lib/format';
import { useRefKelas } from '@/lib/referensi';
import { cn } from '@/lib/utils';
import { useHapusSesiSiswa, useRiwayatSiswa, useSesiSiswa, useSimpanSesiSiswa } from './api';

const LABEL_STATUS: Record<StatusSiswa, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  alpa: 'Alpa',
};
const OPSI_STATUS = STATUS_SISWA.map((s) => ({ nilai: s, label: LABEL_STATUS[s] }));
const OPSI_JAM = Array.from({ length: JAM_KE_MAX - JAM_KE_MIN + 1 }, (_, i) => JAM_KE_MIN + i);

export function AbsensiSiswaPage() {
  const user = usePengguna();
  const sekretaris = user.role === 'sekretaris_kelas';
  // Matriks akses: manajemen_guru hanya melihat; admin dan sekretaris boleh mengisi.
  const bolehUbah = user.role === 'admin' || sekretaris;

  const [params, setParams] = useSearchParams();
  const kelasId = sekretaris ? user.kelas_id : Number(params.get('kelas_id')) || null;
  const tanggal = params.get('tanggal') || hariIni();
  const jamKe = Number(params.get('jam_ke') ?? 1);
  const jamKeSah =
    Number.isInteger(jamKe) && jamKe >= JAM_KE_MIN && jamKe <= JAM_KE_MAX ? jamKe : 1;

  const atur = (kunci: string, nilai: string) =>
    setParams(
      (lama) => {
        const baru = new URLSearchParams(lama);
        if (nilai) baru.set(kunci, nilai);
        else baru.delete(kunci);
        return baru;
      },
      { replace: true },
    );

  const kelas = useRefKelas();
  const sesi = useSesiSiswa(
    { kelas_id: kelasId, tanggal, jam_ke: jamKeSah },
    kelasId !== null && tanggal !== '',
  );

  return (
    <div className="flex flex-col gap-4">
      <FilterBar>
        {!sekretaris && (
          <FilterItem label="Kelas" className="sm:w-32">
            {(id) => (
              <Select
                id={id}
                value={kelasId ?? ''}
                onChange={(e) => atur('kelas_id', e.target.value)}
              >
                <option value="">Pilih…</option>
                {kelas.data?.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama_kelas}
                  </option>
                ))}
              </Select>
            )}
          </FilterItem>
        )}
        <FilterItem label="Tanggal">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={tanggal}
              onChange={(e) => atur('tanggal', e.target.value)}
            />
          )}
        </FilterItem>
        <FilterItem label="Jam ke-" className="sm:w-28">
          {(id) => (
            <Select
              id={id}
              value={jamKeSah}
              onChange={(e) => atur('jam_ke', e.target.value === '1' ? '' : e.target.value)}
            >
              {OPSI_JAM.map((j) => (
                <option key={j} value={j}>
                  {j === 0 ? '0 (pagi)' : j}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
      </FilterBar>

      {kelasId === null ? (
        <EmptyState icon={School} pesan="Pilih kelas untuk menampilkan daftar siswa." />
      ) : sesi.isError ? (
        <EmptyState
          icon={TriangleAlert}
          pesan={pesanGalat(sesi.error)}
          aksi={
            <Button variant="secondary" onClick={() => void sesi.refetch()}>
              Coba lagi
            </Button>
          }
        />
      ) : !sesi.data ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Memuat daftar siswa">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <FormSesi
          key={`${sesi.data.kelas.id}-${sesi.data.tanggal}-${sesi.data.jam_ke}-${sesi.dataUpdatedAt}`}
          sesi={sesi.data}
          bolehUbah={bolehUbah}
        />
      )}

      {kelasId !== null && (
        <RiwayatSesi
          kelasId={kelasId}
          bolehHapus={bolehUbah}
          onBuka={(r) => {
            setParams(
              (lama) => {
                const baru = new URLSearchParams(lama);
                baru.set('tanggal', r.tanggal);
                if (r.jam_ke === 1) baru.delete('jam_ke');
                else baru.set('jam_ke', String(r.jam_ke));
                return baru;
              },
              { replace: true },
            );
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}

interface IsianSiswa {
  status: StatusSiswa;
  keterangan: string;
}

function FormSesi({ sesi, bolehUbah }: { sesi: SesiAbsenSiswa; bolehUbah: boolean }) {
  const simpan = useSimpanSesiSiswa();
  const awal = useMemo(
    () =>
      new Map<number, IsianSiswa>(
        sesi.siswa.map((s) => [s.siswa_id, { status: s.status, keterangan: s.keterangan ?? '' }]),
      ),
    [sesi],
  );
  const [isian, setIsian] = useState(awal);

  const hitungan = useMemo(() => {
    const h: Record<StatusSiswa, number> = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
    for (const v of isian.values()) h[v.status] += 1;
    return h;
  }, [isian]);

  const berubah = useMemo(() => {
    let n = 0;
    for (const [id, v] of isian) {
      const a = awal.get(id);
      if (!a || a.status !== v.status || a.keterangan !== v.keterangan) n += 1;
    }
    return n;
  }, [isian, awal]);
  // Sesi baru belum tersimpan sama sekali, walau semua masih "hadir".
  const perluDisimpan = !sesi.sudah_diisi || berubah > 0;

  function ubah(siswaId: number, data: Partial<IsianSiswa>) {
    setIsian((lama) => {
      const baru = new Map(lama);
      const sekarang = baru.get(siswaId) ?? { status: 'hadir' as const, keterangan: '' };
      baru.set(siswaId, { ...sekarang, ...data });
      return baru;
    });
  }

  function semuaHadir() {
    setIsian(
      new Map([...isian.keys()].map((id) => [id, { status: 'hadir' as const, keterangan: '' }])),
    );
  }

  function kirim() {
    simpan.mutate(
      {
        kelas_id: sesi.kelas.id,
        tanggal: sesi.tanggal,
        jam_ke: sesi.jam_ke,
        items: [...isian].map(([siswa_id, v]) => ({
          siswa_id,
          status: v.status,
          keterangan: v.status === 'hadir' ? null : v.keterangan.trim() || null,
        })),
      },
      {
        onSuccess: (res) =>
          toast.success(
            `Absensi ${sesi.kelas.nama_kelas} tersimpan: ${angka(res.data.hitungan.hadir)} hadir, ${angka(res.data.hitungan.izin)} izin, ${angka(res.data.hitungan.sakit)} sakit, ${angka(res.data.hitungan.alpa)} alpa.`,
          ),
        onError: (err) => toast.error(pesanGalat(err)),
      },
    );
  }

  if (sesi.siswa.length === 0) {
    return (
      <EmptyState icon={Users} pesan={`Belum ada siswa aktif di kelas ${sesi.kelas.nama_kelas}.`} />
    );
  }

  return (
    <Card>
      <CardHeader
        judul={`Kelas ${sesi.kelas.nama_kelas} · Jam ke-${sesi.jam_ke}`}
        keterangan={tanggalPanjang(sesi.tanggal)}
        aksi={
          bolehUbah && (
            <Button variant="secondary" size="touch" onClick={semuaHadir}>
              <CheckCheck aria-hidden="true" />
              Tandai semua hadir
            </Button>
          )
        }
      />

      <div className="flex flex-col gap-3 border-b border-line-soft px-4 py-3 sm:px-5">
        <p className="text-xs text-ink-muted">
          {sesi.sudah_diisi
            ? 'Absensi sesi ini sudah tersimpan. Perubahan akan memperbarui catatan.'
            : bolehUbah
              ? 'Sesi ini belum diisi. Semua siswa ditandai Hadir; ubah seperlunya lalu simpan.'
              : 'Sesi ini belum diisi.'}
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Ringkasan status">
          {STATUS_SISWA.map((s) => (
            <li key={s}>
              <StatusBadge status={s} label={`${LABEL_STATUS[s]}: ${angka(hitungan[s])}`} />
            </li>
          ))}
        </ul>
      </div>

      <ul className="divide-y divide-line-soft">
        {sesi.siswa.map((s, i) => {
          const v = isian.get(s.siswa_id) ?? { status: 'hadir' as const, keterangan: '' };
          return (
            <li
              key={s.siswa_id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
            >
              <div className="flex min-w-0 items-baseline gap-2 sm:w-64 sm:shrink-0">
                <span className="w-6 shrink-0 text-right text-xs text-ink-subtle tabular-nums">
                  {i + 1}.
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{s.nama_siswa}</p>
                  <p className="text-xs text-ink-subtle">
                    NIS {s.nis} · {s.jenis_kelamin}
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 pl-8 sm:pl-0">
                <SegmentedStatus
                  label={`Status ${s.nama_siswa}`}
                  opsi={OPSI_STATUS}
                  nilai={v.status}
                  onUbah={(status) => ubah(s.siswa_id, { status })}
                  disabled={!bolehUbah}
                  ringkas
                  className="sm:max-w-sm"
                />
                {v.status !== 'hadir' &&
                  (bolehUbah ? (
                    <Input
                      aria-label={`Keterangan ${s.nama_siswa}`}
                      placeholder="Keterangan (opsional)"
                      maxLength={255}
                      value={v.keterangan}
                      onChange={(e) => ubah(s.siswa_id, { keterangan: e.target.value })}
                      className="sm:max-w-sm"
                    />
                  ) : (
                    v.keterangan && <p className="text-xs text-ink-muted">{v.keterangan}</p>
                  ))}
              </div>
            </li>
          );
        })}
      </ul>

      {bolehUbah && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-xl border-t border-line bg-surface px-4 py-3 sm:px-5">
          <p className="text-xs text-ink-muted" aria-live="polite">
            {berubah > 0
              ? `${angka(berubah)} perubahan belum disimpan.`
              : sesi.sudah_diisi
                ? 'Tidak ada perubahan.'
                : 'Belum disimpan.'}
          </p>
          <Button
            size="touch"
            className="flex-1 sm:flex-none"
            loading={simpan.isPending}
            disabled={!perluDisimpan}
            onClick={kirim}
          >
            <Save aria-hidden="true" />
            Simpan absensi
          </Button>
        </div>
      )}
    </Card>
  );
}

function RiwayatSesi({
  kelasId,
  bolehHapus,
  onBuka,
}: {
  kelasId: number;
  bolehHapus: boolean;
  onBuka: (r: RiwayatSesiSiswa) => void;
}) {
  const [page, setPage] = useState(1);
  const riwayat = useRiwayatSiswa({ kelas_id: kelasId, page, pageSize: 10 }, true);
  const hapus = useHapusSesiSiswa();
  const [akanDihapus, setAkanDihapus] = useState<RiwayatSesiSiswa | null>(null);

  const kolom = useMemo<Kolom<RiwayatSesiSiswa>[]>(
    () => [
      {
        id: 'tanggal',
        judul: 'Tanggal',
        utama: true,
        sel: (r) => <span className="tabular-nums">{tanggalPendek(r.tanggal)}</span>,
      },
      { id: 'jam', judul: 'Jam ke-', angka: true, sel: (r) => r.jam_ke },
      ...STATUS_SISWA.map((s) => ({
        id: s,
        judul: LABEL_STATUS[s],
        angka: true,
        sel: (r: RiwayatSesiSiswa) => (
          <span className={cn(r[s] > 0 && s !== 'hadir' && 'font-semibold')}>{angka(r[s])}</span>
        ),
      })),
      { id: 'total', judul: 'Total', angka: true, sel: (r) => angka(r.total) },
      {
        id: 'aksi',
        judul: 'Aksi',
        aksi: true,
        sel: (r) => (
          <span className="inline-flex gap-1">
            <Button variant="ghost" size="touch" onClick={() => onBuka(r)}>
              Buka
            </Button>
            {bolehHapus && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Hapus absensi ${tanggalPendek(r.tanggal)} jam ke-${r.jam_ke}`}
                onClick={() => setAkanDihapus(r)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            )}
          </span>
        ),
      },
    ],
    [bolehHapus, onBuka],
  );

  return (
    <section aria-labelledby="judul-riwayat">
      <h2
        id="judul-riwayat"
        className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"
      >
        <History className="size-4 text-icon-muted" aria-hidden="true" />
        Riwayat absensi
      </h2>
      <DataTable
        kolom={kolom}
        data={riwayat.data?.data}
        idBaris={(r) => `${r.tanggal}-${r.jam_ke}`}
        memuat={riwayat.isFetching}
        galat={riwayat.isError ? pesanGalat(riwayat.error) : null}
        onCobaLagi={() => void riwayat.refetch()}
        keterangan="Riwayat absensi siswa per tanggal"
        barisSkeleton={4}
        kosong={{ icon: History, pesan: 'Belum ada absensi siswa yang tersimpan untuk kelas ini.' }}
      />
      {riwayat.data && (
        <Pagination
          page={riwayat.data.meta.page}
          pageSize={riwayat.data.meta.pageSize}
          total={riwayat.data.meta.total}
          onUbah={setPage}
        />
      )}

      <ConfirmDialog
        open={akanDihapus !== null}
        onOpenChange={(buka) => !buka && setAkanDihapus(null)}
        judul="Hapus absensi sesi ini?"
        pesan={
          akanDihapus && (
            <>
              Semua catatan absensi{' '}
              <strong className="font-semibold text-ink">
                {akanDihapus.nama_kelas}, {tanggalPanjang(akanDihapus.tanggal)}, jam ke-
                {akanDihapus.jam_ke}
              </strong>{' '}
              ({angka(akanDihapus.total)} siswa) akan dihapus.
            </>
          )
        }
        labelSetuju="Hapus"
        berbahaya
        memproses={hapus.isPending}
        onSetuju={() =>
          akanDihapus &&
          hapus.mutate(
            {
              kelas_id: akanDihapus.kelas_id,
              tanggal: akanDihapus.tanggal,
              jam_ke: akanDihapus.jam_ke,
            },
            {
              onSuccess: (res) => {
                toast.success(`${angka(res.data.dihapus)} catatan absensi dihapus.`);
                setAkanDihapus(null);
              },
              onError: (err) => toast.error(pesanGalat(err)),
            },
          )
        }
      />
    </section>
  );
}
