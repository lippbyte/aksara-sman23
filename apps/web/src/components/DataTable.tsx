import { tableFeatures, useTable, type ColumnDef, type RowData } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Inbox, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { angka } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState } from './EmptyState';
import { Button } from './ui/button';
import { Skeleton } from './ui/card';

// Pengurutan, penyaringan, dan paginasi dilakukan di server; tabel hanya butuh fitur inti.
const fitur = tableFeatures({});

export interface Kolom<T> {
  id: string;
  judul: string;
  sel: (baris: T) => ReactNode;
  /** Kolom angka: rata kanan + tabular-nums. */
  angka?: boolean;
  /** Di ponsel menjadi judul kartu. */
  utama?: boolean;
  /** Kolom tombol aksi: tanpa label di kartu ponsel. */
  aksi?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  kolom: Kolom<T>[];
  data: T[] | undefined;
  idBaris: (baris: T) => string | number;
  memuat?: boolean;
  galat?: string | null;
  onCobaLagi?: () => void;
  /** Keterangan tabel untuk pembaca layar. */
  keterangan: string;
  kosong?: { icon?: LucideIcon; pesan: string; aksi?: ReactNode };
  barisSkeleton?: number;
}

/** Tabel data (TanStack Table); di ponsel berubah menjadi daftar kartu (DESIGN §6 & §11.5). */
export function DataTable<T extends RowData>({
  kolom,
  data,
  idBaris,
  memuat = false,
  galat,
  onCobaLagi,
  keterangan,
  kosong,
  barisSkeleton = 6,
}: DataTableProps<T>) {
  const columns = useMemo<ColumnDef<typeof fitur, T>[]>(
    () =>
      kolom.map((k) => ({
        id: k.id,
        header: k.judul,
        cell: (ctx) => k.sel(ctx.row.original),
      })),
    [kolom],
  );
  const baris = useMemo(() => data ?? [], [data]);

  const table = useTable<typeof fitur, T>({
    features: fitur,
    columns,
    data: baris,
    getRowId: (b) => String(idBaris(b)),
  });

  if (galat) {
    return (
      <EmptyState
        icon={TriangleAlert}
        pesan={galat}
        aksi={
          onCobaLagi && (
            <Button variant="secondary" onClick={onCobaLagi}>
              Coba lagi
            </Button>
          )
        }
      />
    );
  }

  if (memuat && !data) {
    return (
      <div
        className="rounded-xl border border-line bg-surface p-4"
        role="status"
        aria-label="Memuat data"
      >
        <div className="flex flex-col gap-3">
          {Array.from({ length: barisSkeleton }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (baris.length === 0) {
    return (
      <EmptyState
        icon={kosong?.icon ?? Inbox}
        pesan={kosong?.pesan ?? 'Belum ada data.'}
        aksi={kosong?.aksi}
      />
    );
  }

  const peta = new Map(kolom.map((k) => [k.id, k]));
  const rows = table.getRowModel().rows;

  return (
    <div className={cn(memuat && 'opacity-60 transition-opacity duration-200')}>
      {/* Desktop dan tablet (>=768 px): tabel dengan kontainer gulir aksesibel papan ketik */}
      <div
        tabIndex={0}
        role="group"
        aria-label={keterangan}
        className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{keterangan}</caption>
          <thead>
            {table.getHeaderGroups().map((grup) => (
              <tr key={grup.id} className="border-b border-line">
                {grup.headers.map((h) => {
                  const k = peta.get(h.column.id);
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={cn(
                        'px-3 py-2.5 text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-subtle uppercase',
                        k?.angka && 'text-right',
                        k?.aksi && 'text-right',
                      )}
                    >
                      {k?.aksi ? <span className="sr-only">{k.judul}</span> : k?.judul}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line-soft">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors duration-200 hover:bg-app">
                {kolom.map((k) => (
                  <td
                    key={k.id}
                    className={cn(
                      'px-3 py-2.5 align-middle text-ink',
                      k.angka && 'text-right tabular-nums',
                      k.aksi && 'text-right whitespace-nowrap',
                      k.className,
                    )}
                  >
                    {k.sel(row.original)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ponsel (<768 px): daftar kartu */}
      <ul className="flex flex-col gap-3 md:hidden" aria-label={keterangan}>
        {rows.map((row) => {
          const utama = kolom.find((k) => k.utama) ?? kolom[0];
          const aksi = kolom.filter((k) => k.aksi);
          const lain = kolom.filter((k) => k !== utama && !k.aksi);
          return (
            <li key={row.id} className="rounded-xl border border-line bg-surface p-4">
              {utama && (
                <div className="text-sm font-semibold text-ink">{utama.sel(row.original)}</div>
              )}
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
                {lain.map((k) => (
                  <div key={k.id} className="contents">
                    <dt className="text-ink-subtle">{k.judul}</dt>
                    <dd className={cn('min-w-0 text-right text-ink', k.angka && 'tabular-nums')}>
                      {k.sel(row.original)}
                    </dd>
                  </div>
                ))}
              </dl>
              {aksi.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line-soft pt-3">
                  {aksi.map((k) => (
                    <div key={k.id}>{k.sel(row.original)}</div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onUbah: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onUbah }: PaginationProps) {
  const idLoncat = useId();
  const jumlahHalaman = Math.max(1, Math.ceil(total / pageSize));
  const [inputHalaman, setInputHalaman] = useState(String(page));

  useEffect(() => {
    setInputHalaman(String(page));
  }, [page]);

  if (total === 0) return null;

  const dari = (page - 1) * pageSize + 1;
  const sampai = Math.min(total, page * pageSize);

  function lompat(e?: FormEvent) {
    e?.preventDefault();
    const angkaMasuk = Number.parseInt(inputHalaman, 10);
    if (!Number.isFinite(angkaMasuk)) {
      setInputHalaman(String(page));
      return;
    }
    const tujuan = Math.min(jumlahHalaman, Math.max(1, angkaMasuk));
    setInputHalaman(String(tujuan));
    if (tujuan !== page) onUbah(tujuan);
  }

  return (
    <nav
      aria-label="Navigasi halaman"
      className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted"
    >
      <p className="tabular-nums" aria-live="polite">
        Menampilkan {angka(dari)}–{angka(sampai)} dari {angka(total)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="touch"
          disabled={page <= 1}
          onClick={() => onUbah(page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          Sebelumnya
        </Button>

        {jumlahHalaman > 1 ? (
          <form onSubmit={lompat} className="flex items-center gap-1.5">
            <label htmlFor={idLoncat} className="sr-only">
              Loncat ke halaman
            </label>
            <input
              id={idLoncat}
              type="number"
              inputMode="numeric"
              min={1}
              max={jumlahHalaman}
              aria-label="Loncat ke halaman"
              value={inputHalaman}
              onChange={(e) => setInputHalaman(e.target.value)}
              onBlur={() => lompat()}
              className="h-11 w-14 rounded-lg border border-line bg-surface px-2 text-center text-sm text-ink tabular-nums sm:h-9"
            />
            <span className="text-ink-subtle tabular-nums">/ {angka(jumlahHalaman)}</span>
            <Button type="submit" variant="secondary" size="sm" className="h-11 px-2.5 sm:h-9">
              Ke
            </Button>
          </form>
        ) : (
          <span className="px-1 tabular-nums">
            {angka(page)} / {angka(jumlahHalaman)}
          </span>
        )}

        <Button
          variant="secondary"
          size="touch"
          disabled={page >= jumlahHalaman}
          onClick={() => onUbah(page + 1)}
        >
          Berikutnya
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
