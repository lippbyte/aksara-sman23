import {
  JAM_KE_MAX,
  JAM_KE_MIN,
  STATUS_SISWA,
  type RiwayatSesiSiswa,
  type SesiAbsenSiswa,
  type StatusSiswa,
} from '@sms/shared';
import {
  ArrowRightIcon,
  ChalkboardIcon,
  CheckCircleIcon,
  ChecksIcon,
  ClockCounterClockwiseIcon,
  FloppyDiskIcon,
  TrashIcon,
  UsersIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { useId, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { DataTable, Pagination, type Kolom } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { FilterItem } from '@/components/FilterBar';
import { NavigasiTanggal } from '@/components/NavigasiTanggal';
import { PenjagaPerubahan } from '@/components/PenjagaPerubahan';
import { PilihJam } from '@/components/PilihJam';
import { SegmentedStatus } from '@/components/SegmentedStatus';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';
import { angka, hariIni, tanggalPanjang, tanggalPendek } from '@/lib/format';
import { useRefKelas } from '@/lib/referensi';
import { cn, gulirKeAtas } from '@/lib/utils';
import { useJadwalHari } from '../kehadiran/api';
import {
  useHapusSesiSiswa,
  useJamTersimpan,
  useRiwayatSiswa,
  useSesiSiswa,
  useSimpanSesiSiswa,
} from './api';
import { gabungIsian, hitungBerubah, type PetaIsian, type IsianSiswa } from './isian';
import { petaInfoJam } from './jam';

const LABEL_STATUS: Record<StatusSiswa, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  alpa: 'Alpa',
};
const OPSI_STATUS = STATUS_SISWA.map((s) => ({ nilai: s, label: LABEL_STATUS[s] }));
const OPSI_JAM = Array.from({ length: JAM_KE_MAX - JAM_KE_MIN + 1 }, (_, i) => JAM_KE_MIN + i);

/**
 * Baris siswa yang tidak hadir diberi latar lembut + garis tepi warna statusnya agar
 * pengecualian langsung terlihat saat memindai 30+ baris (audit Fase 2 S5). Status tetap
 * tertulis di tombol terpilih, jadi warna bukan satu-satunya penanda.
 */
const TITIK: Record<StatusSiswa, string> = {
  hadir: 'bg-hadir-chart',
  izin: 'bg-izin-chart',
  sakit: 'bg-sakit-chart',
  alpa: 'bg-tidak-hadir-chart',
};

const TANDA_BARIS: Record<Exclude<StatusSiswa, 'hadir'>, { latar: string; garis: string }> = {
  izin: { latar: 'bg-izin-soft', garis: 'bg-izin-chart' },
  sakit: { latar: 'bg-sakit-soft', garis: 'bg-sakit-chart' },
  alpa: { latar: 'bg-tidak-hadir-soft', garis: 'bg-tidak-hadir-chart' },
};

export function AbsensiSiswaPage() {
  const user = usePengguna();
  const sekretaris = user.role === 'sekretaris_kelas';
  // Matriks akses: manajemen_guru hanya melihat; admin dan sekretaris boleh mengisi.
  const bolehUbah = user.role === 'admin' || sekretaris;
  const idLabelJam = useId();

  const [params, setParams] = useSearchParams();
  const kelasId = sekretaris ? user.kelas_id : Number(params.get('kelas_id')) || null;
  const tanggal = params.get('tanggal') || hariIni();
  const jamKe = Number(params.get('jam_ke') ?? 1);
  const jamKeSah =
    Number.isInteger(jamKe) && jamKe >= JAM_KE_MIN && jamKe <= JAM_KE_MAX ? jamKe : 1;

  const atur = (perubahan: Record<string, string>) =>
    setParams(
      (lama) => {
        const baru = new URLSearchParams(lama);
        for (const [kunci, nilai] of Object.entries(perubahan)) {
          if (nilai) baru.set(kunci, nilai);
          else baru.delete(kunci);
        }
        return baru;
      },
      { replace: true },
    );
  // Jam ke-1 adalah bawaan, jadi tidak ditulis di URL.
  const aturJam = (jam: number) => atur({ jam_ke: jam === 1 ? '' : String(jam) });

  const kelas = useRefKelas();
  const sesi = useSesiSiswa(
    { kelas_id: kelasId, tanggal, jam_ke: jamKeSah },
    kelasId !== null && tanggal !== '',
  );
  // Petunjuk di pemilih jam: mapel terjadwal (hanya tampilan, D7 opsi a) + jam yang tersimpan.
  const jadwal = useJadwalHari(kelasId, tanggal, kelasId !== null);
  const tersimpan = useJamTersimpan(kelasId, tanggal);
  const infoJam = useMemo(
    () => petaInfoJam(jadwal.data ?? [], tersimpan.jam),
    [jadwal.data, tersimpan.jam],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Bar sesi: kelas (bukan sekretaris), tanggal, dan jam di satu tempat (audit Fase 2 S1–S3). */}
      <section
        aria-label="Pilih sesi absensi"
        className="flex flex-col gap-3 rounded-kartu border border-line bg-surface p-3 shadow-[var(--shadow-card)] sm:p-4 lg:flex-row lg:items-end lg:gap-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end lg:shrink-0">
          {!sekretaris && (
            <FilterItem label="Kelas" className="sm:w-32">
              {(id) => (
                <Select
                  id={id}
                  value={kelasId ?? ''}
                  onChange={(e) => atur({ kelas_id: e.target.value })}
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
          <NavigasiTanggal
            nilai={tanggal}
            onUbah={(t) => atur({ tanggal: t })}
            className="sm:w-88"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span id={idLabelJam} className="text-xs font-medium text-ink-muted">
              Jam ke-
            </span>
            <span aria-hidden="true" className="flex items-center gap-1 text-2xs text-ink-subtle">
              <CheckCircleIcon weight="fill" className="size-3 text-hadir" />
              sudah tersimpan
            </span>
          </div>
          <PilihJam
            label="Jam ke-"
            aria-labelledby={idLabelJam}
            opsi={OPSI_JAM}
            nilai={jamKeSah}
            onUbah={aturJam}
            info={kelasId !== null ? infoJam : undefined}
          />
        </div>
      </section>

      {kelasId === null ? (
        <EmptyState
          icon={ChalkboardIcon}
          judul="Pilih kelas dulu"
          pesan="Pilih kelas di atas untuk menampilkan daftar siswa."
        />
      ) : sesi.isError ? (
        <EmptyState
          icon={WarningIcon}
          nada="galat"
          judul="Daftar siswa gagal dimuat"
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
            <Skeleton key={i} className="h-16 w-full rounded-kartu" />
          ))}
        </div>
      ) : (
        // Kunci hanya identitas sesi. Muat ulang data (sambung ulang jaringan, riwayat dihapus,
        // simpan) TIDAK me-remount form, sehingga isian yang belum disimpan tidak hilang.
        <FormSesi
          key={`${sesi.data.kelas.id}-${sesi.data.tanggal}-${sesi.data.jam_ke}`}
          sesi={sesi.data}
          mapel={infoJam.get(sesi.data.jam_ke)?.mapel}
          bolehUbah={bolehUbah}
          onLanjut={
            sesi.data.jam_ke < JAM_KE_MAX
              ? () => {
                  aturJam(sesi.data.jam_ke + 1);
                  gulirKeAtas();
                }
              : undefined
          }
        />
      )}

      {kelasId !== null && (
        <RiwayatSesi
          kelasId={kelasId}
          bolehHapus={bolehUbah}
          onBuka={(r) => {
            atur({ tanggal: r.tanggal, jam_ke: r.jam_ke === 1 ? '' : String(r.jam_ke) });
            gulirKeAtas();
          }}
        />
      )}
    </div>
  );
}

function FormSesi({
  sesi,
  mapel,
  bolehUbah,
  onLanjut,
}: {
  sesi: SesiAbsenSiswa;
  mapel?: string;
  bolehUbah: boolean;
  /** Pindah ke jam berikutnya setelah tersimpan (undefined di jam terakhir). */
  onLanjut?: () => void;
}) {
  const simpan = useSimpanSesiSiswa();
  const awal = useMemo<PetaIsian>(
    () =>
      new Map(
        sesi.siswa.map((s) => [s.siswa_id, { status: s.status, keterangan: s.keterangan ?? '' }]),
      ),
    [sesi],
  );
  // `dasar` = data server yang menjadi pembanding isian; `isian` = pilihan di layar.
  const [dasar, setDasar] = useState(awal);
  const [isian, setIsian] = useState(awal);

  // Data server berubah tanpa ganti sesi: gabungkan, jangan timpa (pola "sesuaikan state saat
  // props berubah" dari dokumentasi React, tanpa effect).
  if (awal !== dasar) {
    setDasar(awal);
    setIsian((lokal) => gabungIsian(lokal, dasar, awal));
  }

  const hitungan = useMemo(() => {
    const h: Record<StatusSiswa, number> = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
    for (const v of isian.values()) h[v.status] += 1;
    return h;
  }, [isian]);

  const berubah = useMemo(() => hitungBerubah(isian, dasar), [isian, dasar]);
  // Sesi baru belum tersimpan sama sekali, walau semua masih "hadir".
  const perluDisimpan = !sesi.sudah_diisi || berubah > 0;
  // Setelah simpan berhasil dan tidak ada perubahan baru: tawarkan langkah berikutnya (S7).
  const tawarkanLanjut = simpan.isSuccess && !perluDisimpan && onLanjut !== undefined;

  function ubah(siswaId: number, data: Partial<IsianSiswa>) {
    setIsian((lama) => {
      const baru = new Map(lama);
      const sekarang = baru.get(siswaId) ?? { status: 'hadir' as const, keterangan: '' };
      baru.set(siswaId, { ...sekarang, ...data });
      return baru;
    });
  }

  /** Tandai semua hadir dengan opsi urungkan, bukan konfirmasi (apple-design: undo untuk slip). */
  function semuaHadir() {
    const sebelum = isian;
    const jumlahBukanHadir = [...sebelum.values()].filter((v) => v.status !== 'hadir').length;
    setIsian(
      new Map([...sebelum.keys()].map((id) => [id, { status: 'hadir' as const, keterangan: '' }])),
    );
    if (jumlahBukanHadir > 0) {
      toast(`${angka(jumlahBukanHadir)} siswa diubah menjadi Hadir.`, {
        action: { label: 'Urungkan', onClick: () => setIsian(sebelum) },
      });
    }
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
      <EmptyState
        icon={UsersIcon}
        judul={`Belum ada siswa aktif di kelas ${sesi.kelas.nama_kelas}`}
        pesan="Absensi baru bisa diisi setelah admin menambahkan siswa di Pengaturan → Siswa atau lewat Impor data."
      />
    );
  }

  return (
    <section
      aria-labelledby="judul-sesi"
      className="@container rounded-kartu border border-line bg-surface shadow-[var(--shadow-card)]"
    >
      {/* Kepala sesi ringkas: konteks, keadaan, dan jumlah per status dalam ±84 px (S4, S6),
          agar daftar siswa mulai setinggi mungkin di ponsel (S1). */}
      <div className="border-b border-line-soft px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="judul-sesi" className="min-w-0 text-base font-semibold text-ink">
            Kelas {sesi.kelas.nama_kelas} · Jam ke-{sesi.jam_ke}
          </h2>
          {/* Aksi pemulih, bukan tugas utama: Hadir sudah bawaan (S8). Teks pendek "Semua hadir";
              nama aksesibel lengkap tetap memuat teks yang terlihat (WCAG 2.5.3). -my-2.5: area
              sentuh 44 px tanpa menambah tinggi baris judul. */}
          {bolehUbah && (
            <Button
              variant="ghost"
              size="sm"
              className="-my-2.5 -mr-2 shrink-0"
              aria-label="Tandai semua hadir"
              onClick={semuaHadir}
            >
              <ChecksIcon aria-hidden="true" />
              Semua hadir
            </Button>
          )}
        </div>
        <div className="min-w-0">
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-muted">
            <span>
              {tanggalPanjang(sesi.tanggal)}
              {mapel && ` · ${mapel}`}
            </span>
            <StatusBadge
              status={sesi.sudah_diisi ? 'Tersimpan' : 'Belum diisi'}
              nada={sesi.sudah_diisi ? 'hadir' : 'peringatan'}
            />
          </p>
          <ul
            className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink"
            aria-label="Ringkasan status"
          >
            {STATUS_SISWA.map((s) => (
              <li key={s} className="flex items-center gap-1.5 tabular-nums">
                <span aria-hidden="true" className={cn('size-2 rounded-full', TITIK[s])} />
                {`${LABEL_STATUS[s]} ${angka(hitungan[s])}`}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="divide-y divide-line-soft" aria-label="Daftar siswa">
        {sesi.siswa.map((s, i) => {
          const v = isian.get(s.siswa_id) ?? { status: 'hadir' as const, keterangan: '' };
          const tanda = v.status === 'hadir' ? null : TANDA_BARIS[v.status];
          return (
            <li
              key={s.siswa_id}
              // Tata letak mengikuti lebar kartu (container query), bukan layar: di 640–1279 px
              // konten hanya ±700 px karena sidebar. ≥ 36rem: nama | status, keterangan di
              // bawah; ≥ 48rem: nama | status | keterangan dalam satu baris (S5).
              className={cn(
                'relative grid gap-2 px-4 py-2.5 @xl:grid-cols-[minmax(0,1fr)_20rem] @xl:items-center @xl:gap-x-4 @3xl:grid-cols-[minmax(0,20rem)_20rem_minmax(0,1fr)] sm:px-5',
                tanda?.latar,
              )}
            >
              {tanda && (
                <span
                  aria-hidden="true"
                  className={cn('absolute inset-y-0 left-0 w-1', tanda.garis)}
                />
              )}
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="w-6 shrink-0 text-right text-xs text-ink-subtle tabular-nums">
                  {i + 1}.
                </span>
                <p className="min-w-0 flex-1 text-sm font-medium text-ink">{s.nama_siswa}</p>
                <span className="shrink-0 text-2xs text-ink-subtle tabular-nums">
                  <span className="sr-only">NIS </span>
                  {s.nis} · {s.jenis_kelamin}
                </span>
              </div>
              <SegmentedStatus
                label={`Status ${s.nama_siswa}`}
                opsi={OPSI_STATUS}
                nilai={v.status}
                onUbah={(status) => ubah(s.siswa_id, { status })}
                disabled={!bolehUbah}
                ringkas
              />
              {v.status !== 'hadir' &&
                (bolehUbah ? (
                  <Input
                    className="@xl:col-span-2 @3xl:col-span-1"
                    name={`keterangan-${s.siswa_id}`}
                    autoComplete="off"
                    aria-label={`Keterangan ${s.nama_siswa}`}
                    placeholder="Keterangan (opsional), mis. surat dari orang tua…"
                    maxLength={255}
                    value={v.keterangan}
                    onChange={(e) => ubah(s.siswa_id, { keterangan: e.target.value })}
                  />
                ) : (
                  v.keterangan && (
                    <p className="text-xs text-ink-muted @xl:col-span-2 @3xl:col-span-1">
                      {v.keterangan}
                    </p>
                  )
                ))}
            </li>
          );
        })}
      </ul>

      {bolehUbah && (
        // Satu baris: keadaan + aksi (S7). Lekat tepat di atas bar navigasi bawah; turun ke tepi
        // layar saat papan ketik terbuka.
        <div className="bar-kaca bar-simpan-lekat sticky bottom-(--tinggi-bar-bawah) z-20 flex items-center justify-between gap-3 rounded-b-kartu border-t border-line px-4 py-2.5 sm:px-5 lg:bottom-0">
          <PenjagaPerubahan
            aktif={berubah > 0}
            judul="Tinggalkan absensi yang belum disimpan?"
            pesan={`${angka(berubah)} perubahan absensi ${sesi.kelas.nama_kelas} belum disimpan dan akan hilang.`}
          />
          <p className="min-w-0 text-xs text-ink-muted" aria-live="polite">
            {berubah > 0
              ? `${angka(berubah)} perubahan belum disimpan.`
              : tawarkanLanjut
                ? 'Absensi jam ini tersimpan.'
                : sesi.sudah_diisi
                  ? 'Tidak ada perubahan.'
                  : 'Belum disimpan. Semua siswa bawaan Hadir.'}
          </p>
          {tawarkanLanjut ? (
            <Button variant="secondary" className="shrink-0" onClick={onLanjut}>
              Lanjut ke jam ke-{sesi.jam_ke + 1}
              <ArrowRightIcon aria-hidden="true" />
            </Button>
          ) : (
            <Button
              className="shrink-0"
              loading={simpan.isPending}
              disabled={!perluDisimpan}
              onClick={kirim}
            >
              <FloppyDiskIcon aria-hidden="true" />
              Simpan absensi
            </Button>
          )}
        </div>
      )}
    </section>
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

  const tombolAksi = (r: RiwayatSesiSiswa) => (
    <span className="inline-flex gap-1">
      <Button
        variant="ghost"
        size="touch"
        aria-label={`Buka absensi ${tanggalPendek(r.tanggal)} jam ke-${r.jam_ke}`}
        onClick={() => onBuka(r)}
      >
        Buka
      </Button>
      {bolehHapus && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Hapus absensi ${tanggalPendek(r.tanggal)} jam ke-${r.jam_ke}`}
          onClick={() => setAkanDihapus(r)}
        >
          <TrashIcon aria-hidden="true" />
        </Button>
      )}
    </span>
  );

  const kolom: Kolom<RiwayatSesiSiswa>[] = [
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
    { id: 'aksi', judul: 'Aksi', aksi: true, sel: tombolAksi },
  ];

  return (
    <section aria-labelledby="judul-riwayat">
      <h2
        id="judul-riwayat"
        className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink"
      >
        <ClockCounterClockwiseIcon className="size-4 text-icon-muted" aria-hidden="true" />
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
        // Ponsel: satu kartu ringkas per sesi (S9), bukan tujuh baris label/nilai.
        kartuMobile={(r) => (
          <article className="flex items-center gap-3 rounded-kartu border border-line bg-surface py-2 pr-2 pl-3 shadow-[var(--shadow-card)]">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink tabular-nums">
                {tanggalPendek(r.tanggal)} · Jam ke-{r.jam_ke}
              </p>
              <p className="text-xs text-ink-muted tabular-nums">
                {STATUS_SISWA.map((s) => `${LABEL_STATUS[s]} ${angka(r[s])}`).join(' · ')}
              </p>
            </div>
            {tombolAksi(r)}
          </article>
        )}
        kosong={{
          icon: ClockCounterClockwiseIcon,
          pesan: 'Belum ada absensi siswa yang tersimpan untuk kelas ini.',
        }}
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
