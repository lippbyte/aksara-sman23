import { STATUS_KEHADIRAN, type Kehadiran } from '@sms/shared';
import {
  ArrowLeft,
  BookOpenCheck,
  ClipboardCheck,
  TriangleAlert,
  UserCheck,
  UserRoundCheck,
  UserX,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { DataTable, type Kolom } from '@/components/DataTable';
import { EmptyState } from '@/components/EmptyState';
import { FilterBar, FilterItem, useFilterUrl } from '@/components/FilterBar';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader, Skeleton } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';
import { angka, hariIni, tanggalPanjang } from '@/lib/format';
import { useDashboardKelas } from '../kehadiran/api';
import { FormKehadiran } from '../kehadiran/FormKehadiran';
import {
  kolomGuru,
  kolomJam,
  kolomJp,
  kolomKeterangan,
  kolomStatus,
  kolomTugas,
} from '../kehadiran/kolom';

const KUNCI_FILTER = ['tanggal', 'guru_id', 'status'] as const;
const kolomJurnal: Kolom<Kehadiran>[] = [
  kolomJam,
  kolomJp,
  kolomGuru,
  kolomStatus,
  kolomTugas,
  kolomKeterangan,
];

/** Rute /kelas/:id (admin, manajemen) dan Dashboard Utama untuk sekretaris. */
export function DashboardKelasPage({ kelasId: kelasIdProp }: { kelasId?: number }) {
  const { id } = useParams();
  const kelasId = kelasIdProp ?? Number(id);

  if (!Number.isInteger(kelasId) || kelasId <= 0) {
    return <EmptyState icon={TriangleAlert} pesan="Kelas tidak ditemukan." />;
  }
  return <IsiDashboardKelas kelasId={kelasId} dariDaftar={kelasIdProp === undefined} />;
}

function IsiDashboardKelas({ kelasId, dariDaftar }: { kelasId: number; dariDaftar: boolean }) {
  const user = usePengguna();
  const f = useFilterUrl(KUNCI_FILTER);
  const tanggal = f.nilai.tanggal || hariIni();
  const dashboard = useDashboardKelas(kelasId, { ...f.nilai, tanggal });
  const [catat, setCatat] = useState(false);

  const data = dashboard.data;
  // Pilihan guru pada filter: guru yang terjadwal atau tercatat hari itu.
  const opsiGuru = useMemo(() => {
    const peta = new Map<number, string>();
    for (const j of data?.jadwal ?? []) peta.set(j.guru_id, j.nama_guru);
    for (const k of data?.jurnal ?? []) peta.set(k.guru_id, k.nama_guru);
    return [...peta].sort((a, b) => a[1].localeCompare(b[1], 'id'));
  }, [data]);
  const belumDicatat = (data?.jadwal ?? []).filter((j) => !j.sudah_dicatat);

  if (dashboard.isError) {
    return (
      <EmptyState
        icon={TriangleAlert}
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {dariDaftar && (
            <Link
              to="/"
              className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Dashboard Utama
            </Link>
          )}
          <h2 className="text-sm font-semibold text-ink">
            {data ? `Kelas ${data.kelas.nama_kelas}` : <Skeleton className="h-5 w-24" />}
          </h2>
          <p className="text-xs text-ink-subtle">{tanggalPanjang(tanggal)}</p>
        </div>
      </div>

      {/* Tombol besar: aksi utama sekretaris dari kelas. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button className="h-14 justify-start px-4 text-base" onClick={() => setCatat(true)}>
          <ClipboardCheck className="size-5!" aria-hidden="true" />
          Catat kehadiran guru
        </Button>
        {user.role !== 'manajemen_guru' && (
          <Button asChild variant="secondary" className="h-14 justify-start px-4 text-base">
            <Link to={`/absensi-siswa?kelas_id=${kelasId}&tanggal=${tanggal}`}>
              <Users className="size-5!" aria-hidden="true" />
              Absen siswa
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {!data ? (
          STATUS_KEHADIRAN.map((s) => <Skeleton key={s} className="h-24 w-full rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Hadir"
              nilai={angka(data.hitungan.Hadir)}
              keterangan={`${angka(data.jam.Hadir)} JP`}
              icon={UserCheck}
              nada="hadir"
            />
            <StatCard
              label="Mendampingi"
              nilai={angka(data.hitungan.Mendampingi)}
              keterangan={`${angka(data.jam.Mendampingi)} JP`}
              icon={UserRoundCheck}
              nada="mendampingi"
            />
            <StatCard
              label="Tidak Hadir"
              nilai={angka(data.hitungan['Tidak Hadir'])}
              keterangan={`${angka(data.jam['Tidak Hadir'])} JP`}
              icon={UserX}
              nada="tidak-hadir"
            />
          </>
        )}
      </div>

      {belumDicatat.length > 0 && (
        <Card>
          <CardHeader
            judul="Jadwal yang belum dicatat"
            keterangan={`${angka(belumDicatat.length)} dari ${angka(data?.jadwal.length ?? 0)} jadwal hari ini`}
          />
          <CardBody>
            <ul className="flex flex-wrap gap-2">
              {belumDicatat.map((j) => {
                const akhir = j.jam_ke + j.total_jam_mengajar - 1;
                return (
                  <li
                    key={`${j.guru_id}-${j.jam_ke}`}
                    className="rounded-lg bg-subtle px-2.5 py-1.5 text-xs text-ink-muted"
                  >
                    <span className="font-semibold text-ink tabular-nums">
                      Jam {akhir > j.jam_ke ? `${j.jam_ke}–${akhir}` : j.jam_ke}
                    </span>{' '}
                    · {j.nama_guru}
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}

      <section aria-labelledby="judul-jurnal">
        <h2 id="judul-jurnal" className="mb-2 text-sm font-semibold text-ink">
          Jurnal mengajar
        </h2>
        <FilterBar onReset={f.reset} adaFilter={f.adaFilter}>
          <FilterItem label="Tanggal">
            {(idInput) => (
              <Input
                id={idInput}
                type="date"
                value={tanggal}
                onChange={(e) => f.atur('tanggal', e.target.value)}
              />
            )}
          </FilterItem>
          <FilterItem label="Guru">
            {(idInput) => (
              <Select
                id={idInput}
                value={f.nilai.guru_id}
                onChange={(e) => f.atur('guru_id', e.target.value)}
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
                value={f.nilai.status}
                onChange={(e) => f.atur('status', e.target.value)}
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
          data={data?.jurnal}
          idBaris={(k) => k.id}
          memuat={dashboard.isFetching}
          keterangan="Jurnal mengajar"
          barisSkeleton={4}
          kosong={{
            icon: BookOpenCheck,
            pesan:
              f.nilai.guru_id || f.nilai.status
                ? 'Tidak ada catatan yang cocok dengan filter.'
                : 'Belum ada catatan pada tanggal ini.',
            aksi: <Button onClick={() => setCatat(true)}>Catat kehadiran</Button>,
          }}
        />
      </section>

      {catat && (
        <FormKehadiran awal={{ kelas_id: kelasId, tanggal }} onTutup={() => setCatat(false)} />
      )}
    </div>
  );
}
