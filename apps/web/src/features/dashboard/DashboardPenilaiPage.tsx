import { Award, CalendarClock, CircleCheck, TriangleAlert, UserRoundX } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Skeleton } from '@/components/ui/card';
import { pesanGalat } from '@/lib/api';
import { angka, namaBulan, tanggalPanjang, tanggalRingkas } from '@/lib/format';
import { useDashboardPenilai } from './api';

/** Dashboard ringkas guru_penilai (DESIGN §7): jendela penilaian + guru belum dinilai. */
export function DashboardPenilaiPage() {
  const q = useDashboardPenilai();
  const d = q.data;

  if (q.isError) {
    return (
      <EmptyState
        icon={TriangleAlert}
        pesan={pesanGalat(q.error)}
        aksi={
          <Button variant="secondary" onClick={() => void q.refetch()}>
            Coba lagi
          </Button>
        }
      />
    );
  }
  if (!d) {
    return (
      <div className="grid gap-3" role="status" aria-label="Memuat dashboard">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const periode = `${namaBulan(d.periode.bulan)} ${d.periode.tahun}`;
  const tautan = `/penilaian-kinerja?bulan=${d.periode.bulan}&tahun=${d.periode.tahun}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-2xs font-semibold tracking-wider text-ink-subtle uppercase">
              Jendela penilaian
            </p>
            <StatusBadge
              status={d.jendela.terbuka ? 'Terbuka' : 'Tertutup'}
              nada={d.jendela.terbuka ? 'hadir' : 'netral'}
            />
          </div>
          <p className="flex items-center gap-2 text-sm text-ink">
            <CalendarClock className="size-4 text-icon-muted" aria-hidden="true" />
            {tanggalRingkas(d.jendela.buka)} – {tanggalRingkas(d.jendela.tutup)}
          </p>
          <p className="text-xs text-ink-muted">Tenggat {tanggalPanjang(d.jendela.tutup)}</p>
        </div>
        <StatCard
          label={`Sudah dinilai · ${periode}`}
          nilai={`${angka(d.sudah_dinilai)}/${angka(d.jumlah_guru_aktif)}`}
          keterangan="guru aktif"
          icon={CircleCheck}
          nada="hadir"
        />
        <StatCard
          label="Belum dinilai"
          nilai={angka(d.belum_dinilai.length)}
          keterangan="guru aktif"
          icon={UserRoundX}
          nada={d.belum_dinilai.length > 0 ? 'izin' : 'netral'}
        />
      </div>

      <Card>
        <CardHeader
          judul="Guru yang belum dinilai"
          keterangan={periode}
          aksi={
            <Button asChild size="touch">
              <Link to={tautan}>
                <Award aria-hidden="true" />
                Buka penilaian
              </Link>
            </Button>
          }
        />
        {d.belum_dinilai.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            Semua guru aktif sudah dinilai untuk {periode}.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {d.belum_dinilai.map((g) => (
              <li
                key={g.guru_id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5"
              >
                <span>
                  <span className="text-sm text-ink">{g.nama_guru}</span>
                  <span className="block text-xs text-ink-subtle">
                    {g.kode_guru} · {g.mata_pelajaran}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-xs text-ink-subtle">Aspek dan bobot mengikuti ketentuan sekolah.</p>
    </div>
  );
}
