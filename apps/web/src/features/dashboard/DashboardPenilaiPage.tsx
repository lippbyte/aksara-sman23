import type { DashboardPenilai } from '@sms/shared';
import { CaretRightIcon, CheckCircleIcon, MedalIcon, WarningIcon } from '@phosphor-icons/react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { ProgressBar } from '@/components/ProgressBar';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Skeleton } from '@/components/ui/card';
import { pesanGalat } from '@/lib/api';
import { angka, hariIni, namaBulan, tanggalPanjang, tanggalRingkas } from '@/lib/format';
import { useDashboardPenilai } from './api';

/**
 * Kalimat keadaan jendela penilaian. `terbuka` dari server adalah sumber kebenaran (admin bisa
 * membuka di luar jendela, PROJECT-CONTEXT §6.4); tanggal hanya untuk menjelaskannya.
 */
function kalimatJendela(j: DashboardPenilai['jendela'], hari: string): string {
  const sisa = (tanggal: string) => differenceInCalendarDays(parseISO(tanggal), parseISO(hari));
  if (j.terbuka) {
    const n = sisa(j.tutup);
    return n <= 0
      ? `Terbuka, hari terakhir ${tanggalPanjang(j.tutup)}`
      : `Terbuka sampai ${tanggalPanjang(j.tutup)} (${angka(n)} hari lagi)`;
  }
  if (hari < j.buka) {
    const n = sisa(j.buka);
    return `Dibuka ${tanggalPanjang(j.buka)} (${angka(n)} hari lagi)`;
  }
  return `Sudah ditutup ${tanggalPanjang(j.tutup)}`;
}

/** Dashboard guru_penilai: kemajuan penilaian periode aktif + guru yang belum dinilai. */
export function DashboardPenilaiPage() {
  const q = useDashboardPenilai();
  const d = q.data;

  if (q.isError) {
    return (
      <EmptyState
        icon={WarningIcon}
        nada="galat"
        judul="Dashboard gagal dimuat"
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
        <Skeleton className="h-40 rounded-kartu" />
        <Skeleton className="h-64 rounded-kartu" />
      </div>
    );
  }

  const periode = `${namaBulan(d.periode.bulan)} ${d.periode.tahun}`;
  const tautan = `/penilaian-kinerja?bulan=${d.periode.bulan}&tahun=${d.periode.tahun}`;
  const terbuka = d.jendela.terbuka;
  const persenDinilai = d.jumlah_guru_aktif > 0 ? (d.sudah_dinilai / d.jumlah_guru_aktif) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Satu kartu kemajuan menggantikan tiga kartu yang mengulang info yang sama. */}
      <section
        aria-labelledby="judul-penilaian"
        className="rounded-kartu border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id="judul-penilaian" className="text-base font-semibold text-ink">
              Penilaian kinerja · {periode}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
              <StatusBadge
                status={terbuka ? 'Terbuka' : 'Tertutup'}
                nada={terbuka ? 'hadir' : 'netral'}
              />
              <span>{kalimatJendela(d.jendela, hariIni())}</span>
            </p>
          </div>
          <Button asChild variant={terbuka ? 'primary' : 'secondary'} className="shrink-0">
            <Link to={tautan}>
              <MedalIcon aria-hidden="true" />
              Buka penilaian
            </Link>
          </Button>
        </div>

        <p className="mt-4 flex flex-wrap items-baseline gap-x-2">
          <span className="text-3xl font-bold tracking-tight text-ink tabular-nums">
            {`${angka(d.sudah_dinilai)}/${angka(d.jumlah_guru_aktif)}`}
          </span>
          <span className="text-sm text-ink-muted">guru aktif sudah dinilai</span>
        </p>
        {/* Kemajuan pekerjaan, bukan tingkat: nada tetap agar awal periode tidak tampil merah. */}
        <ProgressBar
          nilai={persenDinilai}
          label={`Guru yang sudah dinilai, ${periode}`}
          nada="info"
          penuh
          className="mt-2"
        />
        <p className="mt-2 flex flex-wrap gap-x-1.5 text-xs text-ink-subtle">
          <span>{`Jendela ${tanggalRingkas(d.jendela.buka)} – ${tanggalRingkas(d.jendela.tutup)}`}</span>
          <span aria-hidden="true">·</span>
          <span>{`Tenggat ${tanggalPanjang(d.jendela.tutup)}`}</span>
        </p>
      </section>

      <Card>
        <CardHeader
          judul="Guru yang belum dinilai"
          keterangan={`${angka(d.belum_dinilai.length)} guru · ${periode}`}
        />
        {d.belum_dinilai.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-4 py-8 text-center text-sm text-ink-muted">
            <CheckCircleIcon weight="fill" className="size-4 text-hadir" aria-hidden="true" />
            Semua guru aktif sudah dinilai untuk {periode}.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {d.belum_dinilai.map((g) => {
              // Tautan langsung ke guru ini: halaman penilaian sudah mendukung pencarian `q`
              // (nama/kode guru), jadi tanpa rute baru. Saat jendela tertutup pengisian dikunci
              // untuk penilai, maka tombolnya "Lihat", bukan "Nilai".
              const aksi = terbuka ? 'Nilai' : 'Lihat';
              return (
                <li key={g.guru_id}>
                  <Link
                    to={`${tautan}&q=${encodeURIComponent(g.kode_guru)}`}
                    aria-label={`${aksi} ${g.nama_guru}`}
                    className="group flex min-h-14 items-center gap-3 px-4 py-2.5 hover:bg-subtle/60 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{g.nama_guru}</span>
                      <span className="block text-xs text-ink-subtle">
                        {g.kode_guru} · {g.mata_pelajaran}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-accent">
                      {aksi}
                      <CaretRightIcon className="size-4" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="text-xs text-ink-subtle">Aspek dan bobot mengikuti ketentuan sekolah.</p>
    </div>
  );
}
