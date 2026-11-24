import { TableIcon } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { Card, CardBody, CardHeader, Skeleton } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface TabelAlternatif {
  kolom: string[];
  baris: ReactNode[][];
  /** Indeks kolom angka (rata kanan, tabular). */
  angka?: number[];
}

interface ChartCardProps {
  judul: string;
  /** Keterangan periode, mis. "Senin, 16 Nov 2026". */
  periode: string;
  aksi?: ReactNode;
  memuat?: boolean;
  tinggi?: number;
  /**
   * Tabel nilai yang sama dengan grafik (DESIGN §7): dibuka lewat "Lihat tabel" dan
   * selalu terbaca pembaca layar. Grafik sendiri disembunyikan dari pembaca layar.
   */
  tabel: TabelAlternatif;
  children: ReactNode;
  className?: string;
}

export function ChartCard({
  judul,
  periode,
  aksi,
  memuat = false,
  tinggi = 240,
  tabel,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader judul={judul} keterangan={periode} aksi={aksi} />
      <CardBody className="flex flex-1 flex-col gap-3">
        {memuat ? (
          <Skeleton className="w-full" style={{ height: tinggi }} />
        ) : (
          <div aria-hidden="true" style={{ height: tinggi }} className="w-full min-w-0">
            {children}
          </div>
        )}
        {!memuat && (
          <details className="group text-xs">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-medium text-ink-muted hover:text-ink pointer-fine:min-h-9">
              <TableIcon className="size-3.5" aria-hidden="true" />
              <span className="group-open:hidden">Lihat tabel</span>
              <span className="hidden group-open:inline">Sembunyikan tabel</span>
            </summary>
            {/* `relative` mengurung caption sr-only (absolute) di dalam wadah gulir. */}
            <div className="relative mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  {judul}, {periode}
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    {tabel.kolom.map((k, i) => (
                      <th
                        key={k}
                        scope="col"
                        className={cn(
                          'px-2 py-1.5 text-2xs font-semibold tracking-wider text-ink-subtle uppercase',
                          tabel.angka?.includes(i) && 'text-right',
                        )}
                      >
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {tabel.baris.map((b, bi) => (
                    <tr key={bi}>
                      {b.map((sel, i) => (
                        <td
                          key={i}
                          className={cn(
                            'px-2 py-1.5 text-ink',
                            tabel.angka?.includes(i) && 'text-right tabular-nums',
                          )}
                        >
                          {sel}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </CardBody>
    </Card>
  );
}

export interface ItemLegenda {
  label: string;
  warna: string;
  bentuk?: 'kotak' | 'garis';
}

/** Legenda HTML: teks memakai token teks, identitas dari penanda warna di sampingnya. */
export function Legenda({ item }: { item: ItemLegenda[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted" aria-hidden="true">
      {item.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className={i.bentuk === 'garis' ? 'h-0.5 w-3 rounded-full' : 'size-2.5 rounded-sm'}
            style={{ background: i.warna }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

interface BarisTooltip {
  label: string;
  nilai: string;
  warna: string;
}

/** Isi tooltip: nilai menonjol, nama seri sekunder, penanda garis berwarna. */
export function KotakTooltip({ judul, baris }: { judul: string; baris: BarisTooltip[] }) {
  return (
    <div className="min-w-36 rounded-kontrol border border-line bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-ink-muted">{judul}</p>
      <ul className="flex flex-col gap-0.5">
        {baris.map((b) => (
          <li key={b.label} className="flex items-center gap-2">
            <span className="h-0.5 w-3 rounded-full" style={{ background: b.warna }} />
            <strong className="font-semibold text-ink tabular-nums">{b.nilai}</strong>
            <span className="text-ink-muted">{b.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Warna grafik dari token (DESIGN §2); dipakai sebagai nilai `fill`/`stroke` SVG. */
export const WARNA = {
  hadir: 'var(--status-hadir-chart)',
  mendampingi: 'var(--status-mendampingi-chart)',
  tidakHadir: 'var(--status-tidak-hadir-chart)',
  aksen: 'var(--accent)',
  permukaan: 'var(--bg-surface)',
  garisBantu: 'var(--border-soft)',
  sumbu: 'var(--border)',
  teksSumbu: 'var(--text-subtle)',
} as const;
