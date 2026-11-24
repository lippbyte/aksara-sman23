import { STATUS_KEHADIRAN, type Kehadiran, type StatusKehadiran } from '@sms/shared';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenTextIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CheckCircleIcon,
  PlusIcon,
  StudentIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { DataTable, type Kolom } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar, FilterItem, useFilterUrl } from '@/components/FilterBar';
import { NavigasiTanggal } from '@/components/NavigasiTanggal';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';
import { angka, hariIni, tanggalPanjang } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDashboardKelas } from '../kehadiran/api';
import { FormKehadiran } from '../kehadiran/FormKehadiran';
import { KartuKehadiran } from '../kehadiran/KartuKehadiran';
import {
  kolomGuru,
  kolomJam,
  kolomJp,
  kolomKeterangan,
  kolomStatus,
  kolomTugas,
} from '../kehadiran/kolom';
import { useJamTersimpan } from '../kehadiran-siswa/api';
import { labelRentang, susunJadwalHari, type BarisJadwalHari } from './jadwalHari';

const kolomJurnal: Kolom<Kehadiran>[] = [
  kolomJam,
  kolomJp,
  kolomGuru,
  kolomStatus,
  kolomTugas,
  kolomKeterangan,
];

const TITIK_STATUS: Record<StatusKehadiran, string> = {
  Hadir: 'bg-hadir-chart',
  Mendampingi: 'bg-mendampingi-chart',
  'Tidak Hadir': 'bg-tidak-hadir-chart',
};

/** Form yang dibuka: menambah (dengan nilai awal dari slot jadwal) atau mengubah catatan. */
type FormTerbuka =
  { catatan: Kehadiran } | { awal: { guru_id?: number; jam_ke?: number; lama_jam?: number } };

/** Rute /kelas/:id (admin, manajemen) dan Dashboard Utama untuk sekretaris (DESIGN §7). */
export function DashboardKelasPage({ kelasId: kelasIdProp }: { kelasId?: number }) {
  const { id } = useParams();
  const kelasId = kelasIdProp ?? Number(id);

  if (!Number.isInteger(kelasId) || kelasId <= 0) {
    return (
      <EmptyState
        icon={WarningIcon}
        nada="peringatan"
        judul="Kelas tidak ditemukan"
        pesan="Periksa tautan, atau buka kelas dari Dashboard Utama."
      />
    );
  }
  return <IsiDashboardKelas kelasId={kelasId} dariDaftar={kelasIdProp === undefined} />;
}

/**
 * Urutan mengikuti pekerjaan sekretaris (audit Fase 2 K1–K8): jadwal hari ini sebagai daftar
 * periksa paling atas, lalu absensi siswa, ringkasan, dan jurnal lengkap di balik pengungkap.
 */
function IsiDashboardKelas({ kelasId, dariDaftar }: { kelasId: number; dariDaftar: boolean }) {
  const user = usePengguna();
  const fTanggal = useFilterUrl(['tanggal'] as const);
  const fJurnal = useFilterUrl(['guru_id', 'status'] as const);
  const tanggal = fTanggal.nilai.tanggal || hariIni();
  // Tanpa filter guru/status ke API: daftar jadwal butuh semua catatan hari itu. Jurnal disaring
  // di layar dengan aturan yang sama seperti server (kelas.service.ts). Endpoint tidak berubah.
  const dashboard = useDashboardKelas(kelasId, { tanggal });
  const [form, setForm] = useState<FormTerbuka | null>(null);
  const [bukaJurnal, setBukaJurnal] = useState(fJurnal.adaFilter);

  const data = dashboard.data;
  const baris = useMemo(() => (data ? susunJadwalHari(data.jadwal, data.jurnal) : []), [data]);
  const jurnal = useMemo(
    () =>
      (data?.jurnal ?? []).filter(
        (k) =>
          (!fJurnal.nilai.guru_id || k.guru_id === Number(fJurnal.nilai.guru_id)) &&
          (!fJurnal.nilai.status || k.status_kehadiran === fJurnal.nilai.status),
      ),
    [data, fJurnal.nilai],
  );
  // Pilihan guru pada filter: guru yang terjadwal atau tercatat hari itu.
  const opsiGuru = useMemo(() => {
    const peta = new Map<number, string>();
    for (const b of baris) peta.set(b.guru_id, b.nama_guru);
    return [...peta].sort((a, b) => a[1].localeCompare(b[1], 'id'));
  }, [baris]);

  const terjadwal = baris.filter((b) => b.terjadwal);
  const belum = terjadwal.filter((b) => !b.tercatat).length;
  const hariIniDipilih = tanggal === hariIni();

  if (dashboard.isError) {
    return (
      <EmptyState
        icon={WarningIcon}
        nada="galat"
        judul="Dashboard kelas gagal dimuat"
        pesan={pesanGalat(dashboard.error)}
        aksi={
          <Button variant="secondary" onClick={() => void dashboard.refetch()}>
            Coba lagi
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Konteks: kelas + tanggal. Tanggal di atas karena mengubah isi seluruh halaman (K6). */}
      <section
        aria-labelledby="judul-kelas"
        className="flex flex-col gap-3 rounded-kartu border border-line bg-surface p-3 shadow-[var(--shadow-card)] sm:flex-row sm:items-end sm:justify-between sm:p-4"
      >
        <div className="min-w-0">
          {dariDaftar && (
            <Link
              to="/"
              className="-mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-accent hover:underline pointer-fine:min-h-0"
            >
              <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
              Dashboard Utama
            </Link>
          )}
          {data ? (
            <h2 id="judul-kelas" className="text-lg font-bold tracking-tight text-ink">
              Kelas {data.kelas.nama_kelas}
            </h2>
          ) : (
            <>
              <h2 id="judul-kelas" className="sr-only">
                Memuat kelas
              </h2>
              <Skeleton className="h-7 w-28" />
            </>
          )}
          <p className="text-xs text-ink-muted">
            {hariIniDipilih ? 'Hari ini · ' : ''}
            {tanggalPanjang(tanggal)}
          </p>
        </div>
        <NavigasiTanggal
          nilai={tanggal}
          onUbah={(t) => fTanggal.atur('tanggal', t)}
          className="sm:w-88"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <JadwalHariIni
          baris={baris}
          memuat={!data}
          judul={hariIniDipilih ? 'Jadwal hari ini' : `Jadwal ${tanggalPanjang(tanggal)}`}
          jumlahTerjadwal={terjadwal.length}
          belum={belum}
          onCatat={(b) =>
            setForm({
              awal: { guru_id: b.guru_id, jam_ke: b.jam_ke, lama_jam: b.akhir - b.jam_ke + 1 },
            })
          }
          onUbah={(k) => setForm({ catatan: k })}
          onCatatLain={() => setForm({ awal: {} })}
        />

        <div className="flex flex-col gap-4">
          <AbsensiSiswaHari
            kelasId={kelasId}
            tanggal={tanggal}
            bolehIsi={user.role !== 'manajemen_guru'}
          />

          <section
            aria-labelledby="judul-ringkasan"
            className="rounded-kartu border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <h2 id="judul-ringkasan" className="text-sm font-semibold text-ink">
              Kehadiran guru
            </h2>
            {data ? (
              <ul className="mt-2 flex flex-col gap-1.5 text-sm">
                {STATUS_KEHADIRAN.map((s) => (
                  <li key={s} className="flex items-center gap-2 tabular-nums">
                    <span
                      aria-hidden="true"
                      className={cn('size-2 rounded-full', TITIK_STATUS[s])}
                    />
                    <span className="flex-1 text-ink-muted">{s}</span>
                    <span className="font-semibold text-ink">{angka(data.hitungan[s])}</span>
                    <span className="w-12 text-right text-xs text-ink-subtle">
                      {angka(data.jam[s])} JP
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Skeleton className="mt-2 h-16 w-full" />
            )}
          </section>
        </div>
      </div>

      {/* Jurnal lengkap tetap ada (PROJECT-CONTEXT §7) tetapi di balik pengungkap: isinya sudah
          terangkum di daftar jadwal; terbuka otomatis bila filter jurnal aktif dari URL. */}
      <details
        open={bukaJurnal}
        onToggle={(e) => setBukaJurnal(e.currentTarget.open)}
        className="group rounded-kartu border border-line bg-surface shadow-[var(--shadow-card)]"
      >
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-kartu px-4 py-3 text-sm font-semibold text-ink hover:bg-subtle [&::-webkit-details-marker]:hidden">
          <BookOpenTextIcon className="size-4 text-icon-muted" aria-hidden="true" />
          <span className="flex-1">
            Jurnal mengajar
            <span className="ml-1.5 font-normal text-ink-muted">
              · {angka(data?.jurnal.length ?? 0)} catatan
            </span>
          </span>
          <CaretDownIcon
            className="size-4 text-icon-muted transition-transform duration-(--dur-fast) group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-line-soft p-3 sm:p-4">
          <FilterBar
            lembarMobile
            onReset={fJurnal.reset}
            adaFilter={fJurnal.adaFilter}
            jumlahAktif={fJurnal.jumlahAktif}
            className="shadow-none"
          >
            <FilterItem label="Guru">
              {(idInput) => (
                <Select
                  id={idInput}
                  value={fJurnal.nilai.guru_id}
                  onChange={(e) => fJurnal.atur('guru_id', e.target.value)}
                >
                  <option value="">Semua</option>
                  {opsiGuru.map(([idGuru, nama]) => (
                    <option key={idGuru} value={idGuru}>
                      {nama}
                    </option>
                  ))}
                </Select>
              )}
            </FilterItem>
            <FilterItem label="Status" className="sm:w-36">
              {(idInput) => (
                <Select
                  id={idInput}
                  value={fJurnal.nilai.status}
                  onChange={(e) => fJurnal.atur('status', e.target.value)}
                >
                  <option value="">Semua</option>
                  {STATUS_KEHADIRAN.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              )}
            </FilterItem>
          </FilterBar>
          <DataTable
            kolom={kolomJurnal}
            data={data ? jurnal : undefined}
            idBaris={(k) => k.id}
            memuat={dashboard.isFetching}
            keterangan="Jurnal mengajar"
            barisSkeleton={4}
            kartuMobile={(k) => <KartuKehadiran k={k} />}
            kosong={{
              icon: BookOpenTextIcon,
              pesan: fJurnal.adaFilter
                ? 'Tidak ada catatan yang cocok dengan filter.'
                : 'Belum ada catatan pada tanggal ini.',
            }}
          />
        </div>
      </details>

      {form !== null && (
        <FormKehadiran
          catatan={'catatan' in form ? form.catatan : null}
          awal={{ kelas_id: kelasId, tanggal, ...('awal' in form ? form.awal : {}) }}
          onTutup={() => setForm(null)}
        />
      )}
    </div>
  );
}

/** Daftar periksa jadwal: setiap slot dengan status dan satu tombol aksi (K1, K7). */
function JadwalHariIni({
  baris,
  memuat,
  judul,
  jumlahTerjadwal,
  belum,
  onCatat,
  onUbah,
  onCatatLain,
}: {
  baris: BarisJadwalHari[];
  memuat: boolean;
  judul: string;
  jumlahTerjadwal: number;
  belum: number;
  onCatat: (b: BarisJadwalHari) => void;
  onUbah: (k: Kehadiran) => void;
  onCatatLain: () => void;
}) {
  return (
    <section
      aria-labelledby="judul-jadwal"
      className="rounded-kartu border border-line bg-surface shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line-soft px-4 py-3">
        <h2 id="judul-jadwal" className="text-base font-semibold text-ink">
          {judul}
        </h2>
        {!memuat && jumlahTerjadwal > 0 && (
          <p className="flex items-center gap-2 text-xs text-ink-muted tabular-nums">
            {`${angka(jumlahTerjadwal - belum)}/${angka(jumlahTerjadwal)} tercatat`}
            <StatusBadge
              status={belum === 0 ? 'Semua tercatat' : `${angka(belum)} belum dicatat`}
              nada={belum === 0 ? 'hadir' : 'peringatan'}
            />
          </p>
        )}
      </div>

      {memuat ? (
        <div className="flex flex-col gap-2 p-4" role="status" aria-label="Memuat jadwal">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : baris.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 text-sm text-ink-muted">
          <CalendarBlankIcon className="size-6 shrink-0 text-icon-muted" aria-hidden="true" />
          <p>Tidak ada jadwal dan belum ada catatan pada tanggal ini.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line-soft" aria-label={judul}>
          {baris.map((b) => {
            const rentang = labelRentang(b);
            return (
              <li key={b.kunci} className="flex items-center gap-3 px-4 py-2.5">
                <p className="flex w-12 shrink-0 flex-col items-center self-start rounded-kontrol bg-subtle px-1 py-1.5 text-center leading-tight">
                  <span className="text-2xs text-ink-subtle">Jam</span>
                  <span className="text-sm font-bold text-ink tabular-nums">{rentang}</span>
                </p>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{b.nama_guru}</p>
                  <p className="text-xs text-ink-muted">
                    {b.mata_pelajaran}
                    {!b.terjadwal && ' · di luar jadwal'}
                  </p>
                  <div className="mt-1">
                    {b.catatan ? (
                      <StatusBadge status={b.catatan.status_kehadiran} />
                    ) : b.tercatat ? (
                      <StatusBadge status="Tercatat" nada="netral" />
                    ) : (
                      <StatusBadge status="Belum dicatat" nada="peringatan" />
                    )}
                  </div>
                </div>
                {b.catatan ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    aria-label={`Ubah catatan ${b.nama_guru}, jam ke-${rentang}`}
                    onClick={() => b.catatan && onUbah(b.catatan)}
                  >
                    Ubah
                  </Button>
                ) : (
                  !b.tercatat && (
                    <Button
                      size="sm"
                      className="shrink-0"
                      aria-label={`Catat kehadiran ${b.nama_guru}, jam ke-${rentang}`}
                      onClick={() => onCatat(b)}
                    >
                      Catat
                    </Button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-line-soft p-3">
        {/* Untuk guru pengganti atau jam di luar jadwal. */}
        <Button variant="secondary" className="w-full sm:w-auto" onClick={onCatatLain}>
          <PlusIcon aria-hidden="true" />
          Catat kehadiran guru
        </Button>
      </div>
    </section>
  );
}

/** Jam yang absensi siswanya sudah tersimpan pada tanggal itu (K4; D7 opsi a: tanpa kaitan ke jadwal). */
function AbsensiSiswaHari({
  kelasId,
  tanggal,
  bolehIsi,
}: {
  kelasId: number;
  tanggal: string;
  bolehIsi: boolean;
}) {
  const tersimpan = useJamTersimpan(kelasId, tanggal);
  const jam = [...tersimpan.jam].sort((a, b) => a - b);
  const tautan = (j?: number) =>
    `/absensi-siswa?kelas_id=${kelasId}&tanggal=${tanggal}${j !== undefined && j !== 1 ? `&jam_ke=${j}` : ''}`;

  return (
    <section
      aria-labelledby="judul-absensi-siswa"
      className="rounded-kartu border border-line bg-surface p-4 shadow-[var(--shadow-card)]"
    >
      <h2
        id="judul-absensi-siswa"
        className="flex items-center gap-2 text-sm font-semibold text-ink"
      >
        <StudentIcon className="size-4 text-icon-muted" aria-hidden="true" />
        Absensi siswa
      </h2>
      {tersimpan.isPending ? (
        <Skeleton className="mt-2 h-5 w-40" />
      ) : tersimpan.isError ? (
        <p className="mt-1 text-xs text-ink-muted">Status absensi siswa tidak dapat dimuat.</p>
      ) : jam.length === 0 ? (
        <p className="mt-1 text-xs text-ink-muted">Belum ada yang tersimpan pada tanggal ini.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-ink-muted">Tersimpan untuk jam ke-</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Jam yang sudah tersimpan">
            {jam.map((j) => (
              <li key={j}>
                <Link
                  to={tautan(j)}
                  aria-label={`Buka absensi siswa jam ke-${j}`}
                  className="tombol-tekan flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-kontrol border border-line-kontrol bg-surface px-2 text-sm font-semibold text-ink tabular-nums hover:border-accent pointer-fine:min-h-9 pointer-fine:min-w-9"
                >
                  <CheckCircleIcon
                    weight="fill"
                    className="size-3.5 text-hadir"
                    aria-hidden="true"
                  />
                  {j}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <Button asChild variant={bolehIsi ? 'primary' : 'secondary'} className="mt-3 w-full">
        <Link to={tautan()}>
          {bolehIsi ? 'Isi absensi siswa' : 'Lihat absensi siswa'}
          <ArrowRightIcon aria-hidden="true" />
        </Link>
      </Button>
    </section>
  );
}
