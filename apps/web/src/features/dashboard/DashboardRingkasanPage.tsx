import { STATUS_KEHADIRAN, type DashboardRingkasan } from '@sms/shared';
import {
  ClipboardCheck,
  GraduationCap,
  History,
  School,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { ChartCard, Legenda, WARNA } from '@/components/charts/ChartCard';
import { GrafikJamKosong, GrafikKehadiranKelas, GrafikTren } from '@/components/charts/grafik';
import { EmptyState } from '@/components/EmptyState';
import { ProgressBar } from '@/components/ProgressBar';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Skeleton } from '@/components/ui/card';
import { pesanGalat } from '@/lib/api';
import { angka, labelPekan, persen, tanggalPanjang, waktu } from '@/lib/format';
import { useDashboardRingkasan } from './api';

/** Dashboard utama untuk admin dan manajemen_guru (DESIGN §7). */
export function DashboardRingkasanPage() {
  const ringkasan = useDashboardRingkasan();
  const navigate = useNavigate();
  const d = ringkasan.data;

  if (ringkasan.isError) {
    return (
      <EmptyState
        icon={TriangleAlert}
        pesan={pesanGalat(ringkasan.error)}
        aksi={
          <Button variant="secondary" onClick={() => void ringkasan.refetch()}>
            Coba lagi
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BarisKpi d={d} />

      <div className="grid gap-4 lg:grid-cols-2">
        <KartuHariIni d={d} />
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
          {d && <GrafikTren data={d.tren} />}
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
                className="text-accent hover:underline"
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

function BarisKpi({ d }: { d: DashboardRingkasan | undefined }) {
  if (!d) {
    return (
      <div
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        role="status"
        aria-label="Memuat ringkasan"
      >
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Guru aktif" nilai={angka(d.kpi.guru_aktif)} icon={UserRound} />
      <StatCard label="Siswa aktif" nilai={angka(d.kpi.siswa_aktif)} icon={GraduationCap} />
      <StatCard label="Rombel" nilai={angka(d.kpi.rombel)} keterangan="kelas" icon={School} />
      <StatCard
        label="Catatan hari ini"
        nilai={angka(d.kpi.catatan_hari_ini)}
        keterangan="kehadiran guru"
        icon={ClipboardCheck}
      />
    </div>
  );
}

function KartuHariIni({ d }: { d: DashboardRingkasan | undefined }) {
  const warna = {
    Hadir: WARNA.hadir,
    Mendampingi: WARNA.mendampingi,
    'Tidak Hadir': WARNA.tidakHadir,
  };
  return (
    <ChartCard
      judul="Kehadiran guru hari ini"
      periode={d ? `${tanggalPanjang(d.tanggal)} · JP per kelas` : 'Hari ini'}
      memuat={!d}
      tabel={{
        kolom: ['Kelas', ...STATUS_KEHADIRAN],
        angka: [1, 2, 3],
        baris: (d?.hari_ini.per_kelas ?? []).map((k) => [
          k.nama_kelas,
          ...STATUS_KEHADIRAN.map((s) => `${angka(k[s])} JP`),
        ]),
      }}
      aksi={
        d && (
          <div className="w-44">
            <p className="mb-0.5 text-right text-2xs font-semibold tracking-wider text-ink-subtle uppercase">
              Jam terisi {angka(d.hari_ini.jp_tercatat)}/{angka(d.hari_ini.jp_terjadwal)} JP
            </p>
            <ProgressBar
              nilai={d.hari_ini.persentase_terisi}
              label="Persentase jam terisi hari ini"
            />
          </div>
        )
      }
    >
      {d && (
        <div className="flex h-full flex-col gap-2">
          <Legenda
            item={STATUS_KEHADIRAN.map((s) => ({
              label: `${s} · ${angka(d.hari_ini.per_status[s].catatan)} catatan`,
              warna: warna[s],
            }))}
          />
          <div className="min-h-0 flex-1">
            <GrafikKehadiranKelas data={d.hari_ini.per_kelas} />
          </div>
        </div>
      )}
    </ChartCard>
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
            <tr className="border-b border-line-soft">
              <th
                scope="col"
                className="px-4 py-2 text-left text-2xs font-semibold tracking-wider text-ink-subtle uppercase sm:px-5"
              >
                Guru
              </th>
              <th
                scope="col"
                className="px-4 py-2 text-right text-2xs font-semibold tracking-wider text-ink-subtle uppercase sm:px-5"
              >
                Kehadiran
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {gt.data.map((g) => (
              <tr key={g.guru_id}>
                <td className="px-4 py-2.5 sm:px-5">
                  <span className="text-ink">{g.nama_guru}</span>
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
              <History aria-hidden="true" />
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
              className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-5"
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
