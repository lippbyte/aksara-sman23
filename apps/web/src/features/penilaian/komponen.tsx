import type { JendelaPenilaian, PekanSebagian, Periode, RentangPekan } from '@sms/shared';
import { CalendarClock, Info, TriangleAlert } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { FilterBar, FilterItem } from '@/components/FilterBar';
import { StatusBadge } from '@/components/StatusBadge';
import { Input, Select } from '@/components/ui/input';
import { hariIni, labelPekan, namaBulan, tanggalPanjang, tanggalRingkas } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Periode dari URL (`?bulan=&tahun=`); default bulan berjalan (zona Jakarta). */
export function usePeriodeUrl() {
  const [params, setParams] = useSearchParams();
  const sekarang = hariIni();
  const bulanUrl = Number(params.get('bulan'));
  const tahunUrl = Number(params.get('tahun'));
  const periode: Periode = {
    bulan:
      Number.isInteger(bulanUrl) && bulanUrl >= 1 && bulanUrl <= 12
        ? bulanUrl
        : Number(sekarang.slice(5, 7)),
    tahun:
      Number.isInteger(tahunUrl) && tahunUrl >= 2000 && tahunUrl <= 2100
        ? tahunUrl
        : Number(sekarang.slice(0, 4)),
  };
  const page = Math.max(1, Number(params.get('page')) || 1);

  function atur(kunci: string, nilai: string) {
    setParams(
      (lama) => {
        const baru = new URLSearchParams(lama);
        if (nilai) baru.set(kunci, nilai);
        else baru.delete(kunci);
        if (kunci !== 'page') baru.delete('page');
        return baru;
      },
      { replace: true },
    );
  }
  return { periode, page, atur, cari: params.get('q') ?? '' };
}

export function PilihPeriode({
  periode,
  onUbah,
  children,
}: {
  periode: Periode;
  onUbah: (kunci: 'bulan' | 'tahun', nilai: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <FilterBar>
      <FilterItem label="Bulan" className="sm:w-40">
        {(id) => (
          <Select id={id} value={periode.bulan} onChange={(e) => onUbah('bulan', e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {namaBulan(i + 1)}
              </option>
            ))}
          </Select>
        )}
      </FilterItem>
      <FilterItem label="Tahun" className="sm:w-28">
        {(id) => (
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={2000}
            max={2100}
            value={periode.tahun}
            onChange={(e) => onUbah('tahun', e.target.value)}
          />
        )}
      </FilterItem>
      {children}
    </FilterBar>
  );
}

interface InfoJendelaProps {
  jendela: (JendelaPenilaian & { hari: number }) | undefined;
  periode: Periode;
  admin: boolean;
}

/** Info jendela pengisian (§6.4) + teks penjelas wajib (Fase 6). */
export function InfoJendela({ jendela, periode, admin }: InfoJendelaProps) {
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 size-[18px] shrink-0 text-icon-muted" aria-hidden="true" />
        <div>
          <p className="font-medium text-ink">
            Jendela penilaian {namaBulan(periode.bulan)} {periode.tahun}
          </p>
          {jendela ? (
            <p className="text-xs text-ink-muted">
              Dibuka {tanggalRingkas(jendela.buka)} – {tanggalPanjang(jendela.tutup)} (
              {jendela.hari} hari terakhir bulan).
              {!jendela.terbuka &&
                (admin
                  ? ' Sebagai admin, Anda tetap dapat mengisi; tindakan itu tercatat di log aktivitas.'
                  : ' Pengisian nilai hanya dapat dilakukan saat jendela terbuka.')}
            </p>
          ) : (
            <p className="text-xs text-ink-subtle">Memuat…</p>
          )}
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-subtle">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            Aspek dan bobot mengikuti ketentuan sekolah.
          </p>
        </div>
      </div>
      {jendela && (
        <StatusBadge
          status={jendela.terbuka ? 'Terbuka' : 'Tertutup'}
          nada={jendela.terbuka ? 'hadir' : 'netral'}
          className={cn('self-start')}
        />
      )}
    </div>
  );
}

const labelP = (p: RentangPekan) => labelPekan(p.minggu_ke, p.tanggal_mulai, p.tanggal_selesai);

/** Judul gabungan peringatan pekan (satu kalimat, tidak ganda). */
export function judulPeringatanPekan(belum: number, sebagian: number): string {
  if (belum > 0 && sebagian > 0)
    return `${belum + sebagian} pekan bulan ini belum disinkron lengkap`;
  if (belum > 0) return `${belum} pekan bulan ini belum disinkron`;
  return `${sebagian} pekan bulan ini baru disinkron sebagian`;
}

/**
 * Peringatan rekap pekan bulan ini (pekan yang sudah selesai), satu kotak untuk dua kasus:
 * belum disinkron sama sekali, dan rekap sebagian (kurang dari guru aktif berjam wajib).
 * Rekap yang belum ada tidak ikut dihitung, bukan dihitung 0.
 */
export function PeringatanPekan({
  belum,
  sebagian,
  bolehRekap,
}: {
  belum: readonly RentangPekan[] | undefined;
  sebagian: readonly PekanSebagian[] | undefined;
  bolehRekap: boolean;
}) {
  const nBelum = belum?.length ?? 0;
  const nSebagian = sebagian?.length ?? 0;
  if (nBelum === 0 && nSebagian === 0) return null;
  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-3 rounded-xl border border-line bg-izin-soft p-4 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-[18px] shrink-0 text-izin" aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-ink">{judulPeringatanPekan(nBelum, nSebagian)}</p>
        <ul className="text-xs text-ink-muted">
          {nBelum > 0 && <li>Belum disinkron: {belum?.map(labelP).join(', ')}.</li>}
          {nSebagian > 0 && (
            <li>
              Baru sebagian:{' '}
              {sebagian
                ?.map((p) => `${labelP(p)}, ${p.terekap} dari ${p.jumlah_guru} guru`)
                .join('; ')}
              .
            </li>
          )}
        </ul>
        <p className="text-xs text-ink-muted">
          Skor kehadiran hanya dihitung dari rekap yang ada; rekap yang belum ada tidak dihitung
          sebagai 0.{' '}
          {bolehRekap ? (
            <Link to="/rekap-kehadiran" className="font-medium text-ink underline">
              Buka Rekap Kehadiran Guru
            </Link>
          ) : (
            'Minta admin atau manajemen menyinkronkan rekap.'
          )}
        </p>
      </div>
    </div>
  );
}

/** Skor dua desimal (id-ID) atau tanda pisah bila kosong. */
export function TeksSkor({ nilai }: { nilai: number | null }) {
  if (nilai === null) return <span className="text-ink-subtle">—</span>;
  return (
    <span className="tabular-nums">
      {nilai.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export function LencanaPredikat({ predikat }: { predikat: string | null }) {
  return predikat ? (
    <StatusBadge status={predikat} />
  ) : (
    <StatusBadge status="Belum dinilai" nada="netral" />
  );
}

/** Isian skor 0–100: string kosong menjadi null (bukan NaN). */
export const keSkor = (v: unknown): number | null =>
  v === '' || v === null || v === undefined ? null : Number(v);
