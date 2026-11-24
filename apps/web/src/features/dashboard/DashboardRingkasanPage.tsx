import { STATUS_KEHADIRAN, type DashboardRingkasan, type StatusKehadiran } from '@sms/shared';
import {
  CalendarCheckIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClipboardTextIcon,
  ClockCounterClockwiseIcon,
  FileXlsIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router';
import { ChartCard, Legenda, WARNA } from '@/components/charts/ChartCard';
import { GrafikJamKosong, GrafikKehadiranKelas, GrafikTren } from '@/components/charts/grafik';
import { EmptyState } from '@/components/EmptyState';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Skeleton } from '@/components/ui/card';
import { pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';
import { angka, labelPekan, persen, tanggalPanjang, waktu } from '@/lib/format';
import { useKueriMedia } from '@/lib/media';
import { cn } from '@/lib/utils';
import { useDashboardRingkasan } from './api';

const TITIK_STATUS: Record<StatusKehadiran, string> = {
  Hadir: 'bg-hadir-chart',
  Mendampingi: 'bg-mendampingi-chart',
  'Tidak Hadir': 'bg-tidak-hadir-chart',
};

/**
 * Dashboard utama admin dan manajemen_guru (audit H5): yang perlu ditindaklanjuti hari ini
 * lebih dulu, angka total sekolah diringkas, lalu grafik pemantauan.
 */
export function DashboardRingkasanPage() {
  const user = usePengguna();
  const ringkasan = useDashboardRingkasan();
  const navigate = useNavigate();
  const sempit = useKueriMedia('(max-width: 639px)');
  const d = ringkasan.data;

  if (ringkasan.isError) {
    return (
      <EmptyState
        icon={WarningIcon}
        nada="galat"
        judul="Dashboard gagal dimuat"
        pesan={pesanGalat(ringkasan.error)}
        aksi={
          <Button variant="secondary" onClick={() => void ringkasan.refetch()}>
            Coba lagi
          </Button>
        }
      />
    );
  }

  const jumlahKelas = d?.hari_ini.per_kelas.length ?? 0;
  const trenKosong = d !== undefined && d.tren.every((t) => t.persentase === null);

  return (
    <div className="flex flex-col gap-4">
      <KartuHariIni d={d} admin={user.role === 'admin'} />

      <BarisDataSekolah d={d} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          judul="Kehadiran per kelas"
          periode={d ? `${tanggalPanjang(d.tanggal)} · JP per kelas` : 'Hari ini'}
          memuat={!d}
          // Ponsel: batang horizontal, tinggi mengikuti jumlah kelas agar nama kelas terbaca.
          tinggi={sempit ? Math.max(160, jumlahKelas * 28 + 32) : 240}
          tabel={{
            kolom: ['Kelas', ...STATUS_KEHADIRAN],
            angka: [1, 2, 3],
            baris: (d?.hari_ini.per_kelas ?? []).map((k) => [
              k.nama_kelas,
              ...STATUS_KEHADIRAN.map((s) => `${angka(k[s])} JP`),
            ]),
          }}
        >
          {d && (
            <div className="flex h-full flex-col gap-2">
              <Legenda
                item={[
                  { label: 'Hadir', warna: WARNA.hadir },
                  { label: 'Mendampingi', warna: WARNA.mendampingi },
                  { label: 'Tidak Hadir', warna: WARNA.tidakHadir },
                ]}
              />
              <div className="min-h-0 flex-1">
                <GrafikKehadiranKelas data={d.hari_ini.per_kelas} horizontal={sempit} />
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          judul="Tren kehadiran guru per pekan"
          periode={
            d && d.tren.length > 0
              ? `${labelPekan(d.tren[0]!.minggu_ke, d.tren[0]!.tanggal_mulai, d.tren[0]!.tanggal_selesai)} s.d. Pekan ${d.tren.at(-1)!.minggu_ke}`
              : '8 pekan terakhir yang sudah selesai'
          }
          memuat={!d}
          tabel={{
            kolom: ['Pekan', 'Guru terekap', 'Kehadiran'],
            angka: [1, 2],
            baris: (d?.tren ?? []).map((t) => [
              labelPekan(t.minggu_ke, t.tanggal_mulai, t.tanggal_selesai),
              angka(t.jumlah_guru),
              t.persentase === null ? 'Belum ada rekap' : persen(t.persentase),
            ]),
          }}
        >
          {d &&
            (trenKosong ? (
              // Data belum cukup: jangan gambar sumbu kosong seolah-olah 0 %.
              <p className="flex h-full items-center justify-center px-4 text-center text-sm text-ink-muted">
                Belum ada rekap pekan yang selesai. Sinkronkan rekap di menu Rekap Kehadiran Guru.
              </p>
            ) : (
              <GrafikTren data={d.tren} />
            ))}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          judul="Kelas dengan jam kosong terbanyak"
          periode={
            d
              ? `${labelPekan(d.jam_kosong.pekan.minggu_ke, d.jam_kosong.pekan.tanggal_mulai, d.jam_kosong.pekan.tanggal_selesai)} · JP guru tidak hadir`
              : 'Pekan ini'
          }
          memuat={!d}
          tinggi={200}
          tabel={{
            kolom: ['Kelas', 'Jam kosong'],
            angka: [1],
            baris: (d?.jam_kosong.data ?? []).map((k) => [
              <Link
                key={k.kelas_id}
                to={`/kelas/${k.kelas_id}`}
                className="font-medium text-accent hover:underline"
              >
                {k.nama_kelas}
              </Link>,
              `${angka(k.jp_kosong)} JP`,
            ]),
          }}
        >
          {d &&
            (d.jam_kosong.data.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-ink-muted">
                Belum ada jam kosong pekan ini.
              </p>
            ) : (
              <GrafikJamKosong
                data={d.jam_kosong.data}
                onPilih={(id) => void navigate(`/kelas/${id}`)}
              />
            ))}
        </ChartCard>
        <KartuGuruTerendah d={d} />
      </div>

      {d?.log_terbaru && <KartuLog log={d.log_terbaru} />}
    </div>
  );
}

/**
 * Kartu utama: berapa JP terjadwal hari ini yang sudah dicatat, rincian status, dan kelas yang
 * perlu dilihat. Hanya dari data yang sudah dikirim API (tanpa JP terjadwal per kelas).
 */
function KartuHariIni({ d, admin }: { d: DashboardRingkasan | undefined; admin: boolean }) {
  if (!d) {
    return (
      <div role="status" aria-label="Memuat ringkasan hari ini">
        <Skeleton className="h-64 w-full rounded-kartu" />
      </div>
    );
  }
  const h = d.hari_ini;
  const adaJadwal = h.jp_terjadwal > 0;
  const tidakHadir = h.per_kelas
    .filter((k) => k['Tidak Hadir'] > 0)
    .sort((a, b) => b['Tidak Hadir'] - a['Tidak Hadir']);
  // Kelas tanpa satu pun catatan hari ini. Hanya bermakna bila hari ini ada jadwal.
  const tanpaCatatan = adaJadwal
    ? h.per_kelas.filter((k) => STATUS_KEHADIRAN.every((s) => k[s] === 0))
    : [];

  return (
    <section
      aria-labelledby="judul-hari-ini"
      className="grid gap-5 rounded-kartu border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5 lg:grid-cols-2 lg:gap-8"
    >
      <div className="min-w-0">
        <h2 id="judul-hari-ini" className="text-base font-semibold text-ink">
          Kehadiran guru hari ini
        </h2>
        <p className="text-xs text-ink-muted">{tanggalPanjang(d.tanggal)}</p>

        {adaJadwal ? (
          <>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <span className="text-3xl font-bold tracking-tight text-ink tabular-nums">
                {angka(h.jp_tercatat)}
              </span>
              <span className="text-sm text-ink-muted">
                dari {angka(h.jp_terjadwal)} JP terjadwal sudah dicatat
              </span>
            </p>
            <ProgressBar
              nilai={h.persentase_terisi}
              label="Persentase jam terisi hari ini"
              penuh
              className="mt-2"
            />
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            Tidak ada jam terjadwal hari ini (di luar hari efektif atau jadwal belum diisi).
          </p>
        )}

        <ul className="mt-4 flex flex-col gap-1.5 text-sm" aria-label="Catatan per status">
          {STATUS_KEHADIRAN.map((s) => (
            <li key={s} className="flex items-center gap-2 tabular-nums">
              <span aria-hidden="true" className={cn('size-2 rounded-full', TITIK_STATUS[s])} />
              <span className="flex-1 text-ink-muted">{s}</span>
              <span className="font-semibold text-ink">{`${angka(h.per_status[s].catatan)} catatan`}</span>
              <span className="w-14 text-right text-xs text-ink-subtle">{`${angka(h.per_status[s].jp)} JP`}</span>
            </li>
          ))}
        </ul>

        {/* Aksi tetap tersedia, tetapi bukan tombol utama: peran ini terutama memantau. */}
        <div className="mt-4 flex flex-wrap gap-2 *:flex-1 sm:*:flex-none">
          <Button asChild variant="secondary">
            <Link to="/rekap-kehadiran">
              <CalendarCheckIcon aria-hidden="true" />
              Rekap pekan
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/absensi-guru">
              <ClipboardTextIcon aria-hidden="true" />
              Catat kehadiran
            </Link>
          </Button>
          {admin && (
            <Button asChild variant="secondary">
              <Link to="/pengaturan/impor">
                <FileXlsIcon aria-hidden="true" />
                Impor Excel
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="min-w-0 border-t border-line-soft pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
        <h3 className="text-sm font-semibold text-ink">Perlu perhatian</h3>
        {tidakHadir.length === 0 && tanpaCatatan.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
            <CheckCircleIcon weight="fill" className="size-4 text-hadir" aria-hidden="true" />
            Tidak ada kelas dengan guru tidak hadir atau tanpa catatan hari ini.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-line-soft" aria-label="Kelas yang perlu perhatian">
            {tidakHadir.map((k) => (
              <BarisPerhatian
                key={`th-${k.kelas_id}`}
                kelasId={k.kelas_id}
                kelas={k.nama_kelas}
                keterangan={`${angka(k['Tidak Hadir'])} JP guru tidak hadir`}
                nada="tidak-hadir"
              />
            ))}
            {tanpaCatatan.map((k) => (
              <BarisPerhatian
                key={`tc-${k.kelas_id}`}
                kelasId={k.kelas_id}
                kelas={k.nama_kelas}
                keterangan="Belum ada catatan hari ini"
                nada="peringatan"
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BarisPerhatian({
  kelasId,
  kelas,
  keterangan,
  nada,
}: {
  kelasId: number;
  kelas: string;
  keterangan: string;
  nada: 'tidak-hadir' | 'peringatan';
}) {
  return (
    <li>
      <Link
        to={`/kelas/${kelasId}`}
        className="group flex min-h-11 items-center gap-3 py-2 text-sm hover:bg-subtle/60"
      >
        <span className="min-w-14 shrink-0 font-semibold text-ink">{kelas}</span>
        <span className="min-w-0 flex-1">
          <StatusBadge status={keterangan} nada={nada} />
        </span>
        <CaretRightIcon
          className="size-4 shrink-0 text-icon-muted group-hover:text-ink"
          aria-hidden="true"
        />
      </Link>
    </li>
  );
}

/** Angka total sekolah (PROJECT-CONTEXT §7), diringkas menjadi satu kartu kecil. */
function BarisDataSekolah({ d }: { d: DashboardRingkasan | undefined }) {
  const item = d
    ? [
        { label: 'Guru aktif', nilai: d.kpi.guru_aktif },
        { label: 'Siswa aktif', nilai: d.kpi.siswa_aktif },
        { label: 'Rombel', nilai: d.kpi.rombel },
        { label: 'Catatan hari ini', nilai: d.kpi.catatan_hari_ini },
      ]
    : null;
  return (
    <section
      aria-label="Data sekolah"
      className="rounded-kartu border border-line bg-surface px-4 py-3 shadow-[var(--shadow-card)] sm:px-5"
    >
      {item ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {item.map((i) => (
            <div key={i.label} className="min-w-0">
              <dt className="text-xs text-ink-muted">{i.label}</dt>
              <dd className="text-xl font-bold text-ink tabular-nums">{angka(i.nilai)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Skeleton className="h-12 w-full" />
      )}
    </section>
  );
}

function KartuGuruTerendah({ d }: { d: DashboardRingkasan | undefined }) {
  const gt = d?.guru_terendah;
  return (
    <Card>
      <CardHeader
        judul="Guru dengan persentase terendah"
        keterangan={
          gt?.pekan
            ? labelPekan(gt.pekan.minggu_ke, gt.pekan.tanggal_mulai, gt.pekan.tanggal_selesai)
            : 'Pekan selesai terakhir yang sudah direkap'
        }
        aksi={
          <Button asChild variant="ghost" size="touch">
            <Link
              to={
                gt?.pekan
                  ? `/rekap-kehadiran?pekan=${gt.pekan.tahun}-${gt.pekan.minggu_ke}`
                  : '/rekap-kehadiran'
              }
            >
              Lihat rekap
            </Link>
          </Button>
        }
      />
      {!d ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : gt && gt.data.length > 0 ? (
        <table className="w-full text-sm">
          <caption className="sr-only">Lima guru dengan persentase kehadiran terendah</caption>
          <thead>
            <tr className="border-b border-line-soft bg-subtle/40">
              <th
                scope="col"
                className="px-4 py-2.5 text-left text-2xs font-semibold tracking-wider text-ink-subtle uppercase sm:px-5"
              >
                Guru
              </th>
              <th
                scope="col"
                className="px-4 py-2.5 text-right text-2xs font-semibold tracking-wider text-ink-subtle uppercase sm:px-5"
              >
                Kehadiran
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {gt.data.map((g) => (
              <tr key={g.guru_id} className="transition-colors hover:bg-accent-soft/35">
                <td className="px-4 py-2.5 sm:px-5">
                  <span className="font-medium text-ink">{g.nama_guru}</span>
                  <span className="block text-xs text-ink-subtle">
                    {g.mata_pelajaran} · {angka(g.jam_hadir)}/{angka(g.jam_wajib)} JP
                  </span>
                </td>
                <td className="w-40 px-4 py-2.5 sm:px-5">
                  <ProgressBar nilai={g.persentase} label={`Kehadiran ${g.nama_guru}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="px-4 py-8 text-center text-sm text-ink-muted sm:px-5">
          Belum ada rekap. Sinkronkan rekap pekan di menu Rekap Kehadiran Guru.
        </p>
      )}
    </Card>
  );
}

function KartuLog({ log }: { log: NonNullable<DashboardRingkasan['log_terbaru']> }) {
  return (
    <Card>
      <CardHeader
        judul="Log aktivitas terbaru"
        aksi={
          <Button asChild variant="ghost" size="touch">
            <Link to="/log-aktivitas">
              <ClockCounterClockwiseIcon aria-hidden="true" />
              Semua log
            </Link>
          </Button>
        }
      />
      {log.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted">Belum ada aktivitas.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {log.map((l) => (
            <li
              key={l.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5"
            >
              <span className="w-32 shrink-0 text-xs text-ink-subtle tabular-nums">
                {waktu(l.created_at)}
              </span>
              <StatusBadge status={l.module} nada="netral" className="self-start sm:self-auto" />
              <span className="min-w-0 flex-1 text-sm text-ink">{l.description}</span>
              <span className="text-xs text-ink-subtle">{l.nama_pengguna ?? '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
