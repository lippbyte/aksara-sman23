import { tableFeatures, useTable, type ColumnDef, type RowData } from '@tanstack/react-table';
import {
  CaretLeftIcon,
  CaretRightIcon,
  TrayIcon,
  WarningIcon,
  type Icon as Ikon,
} from '@phosphor-icons/react';
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
  kosong?: { icon?: Ikon; pesan: string; aksi?: ReactNode };
  barisSkeleton?: number;
  /**
   * Kartu ponsel khusus halaman (<768 px). Tanpa ini, kartu generik menampilkan semua kolom
   * sebagai pasangan label/nilai. Tabel desktop tidak terpengaruh.
   */
  kartuMobile?: (baris: T) => ReactNode;
  /**
   * Kelompokkan kartu ponsel berurutan dengan judul lekat (mis. per tanggal). Data harus sudah
   * terurut menurut kunci kelompok; baris berurutan dengan kunci sama menjadi satu kelompok.
   */
  grupMobile?: GrupMobile<T>;
}

export interface GrupMobile<T> {
  kunci: (baris: T) => string;
  judul: (kunci: string) => ReactNode;
  /** Tingkat judul kelompok mengikuti struktur halaman (bawaan 2). */
  level?: 2 | 3;
}

/** Pecah baris terurut menjadi kelompok berurutan dengan kunci yang sama. */
export function kelompokkanBerurutan<T>(
  baris: readonly T[],
  kunci: (b: T) => string,
): { kunci: string; isi: T[] }[] {
  const hasil: { kunci: string; isi: T[] }[] = [];
  for (const b of baris) {
    const k = kunci(b);
    const akhir = hasil.at(-1);
    if (akhir && akhir.kunci === k) akhir.isi.push(b);
    else hasil.push({ kunci: k, isi: [b] });
  }
  return hasil;
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
  kartuMobile,
  grupMobile,
}: DataTableProps<T>) {
  const idDaftar = useId();
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
        icon={WarningIcon}
        nada="galat"
        judul="Data gagal dimuat"
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
        className="rounded-kartu border border-line bg-surface p-4"
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
        icon={kosong?.icon ?? TrayIcon}
        pesan={kosong?.pesan ?? 'Belum ada data.'}
        aksi={kosong?.aksi}
      />
    );
  }

  const peta = new Map(kolom.map((k) => [k.id, k]));
  const rows = table.getRowModel().rows;

  return (
    <div
      aria-busy={memuat || undefined}
      className={cn(memuat && 'opacity-60 transition-opacity duration-200')}
    >
      {/* Desktop dan tablet (>=768 px): tabel dengan kontainer gulir aksesibel papan ketik */}
      <div
        tabIndex={0}
        role="region"
        aria-label={keterangan}
        // `relative`: elemen sr-only (absolute) di dalam tabel tetap terkurung wadah gulir;
        // tanpa ini teks "Aksi" di ujung kanan tabel melebarkan halaman di 768–1023 px.
        className="gulir-stabil relative hidden overflow-x-auto rounded-kartu border border-line bg-surface shadow-[var(--shadow-card)] md:block"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{keterangan}</caption>
          <thead>
            {table.getHeaderGroups().map((grup) => (
              <tr key={grup.id} className="border-b border-line bg-subtle/55">
                {grup.headers.map((h) => {
                  const k = peta.get(h.column.id);
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      className={cn(
                        'px-4 py-3 text-2xs font-semibold tracking-wider whitespace-nowrap text-ink-subtle uppercase',
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
              <tr key={row.id} className="transition-colors duration-150 hover:bg-accent-soft/45">
                {kolom.map((k) => (
                  <td
                    key={k.id}
                    className={cn(
                      'px-4 py-3 align-middle text-ink',
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

      {/* Ponsel (<768 px): daftar kartu, opsional dikelompokkan dengan judul lekat */}
      <div className="md:hidden">
        {grupMobile ? (
          kelompokkanBerurutan(rows, (r) => grupMobile.kunci(r.original)).map((g, i) => {
            const Judul = grupMobile.level === 3 ? 'h3' : 'h2';
            const idJudul = `${idDaftar}-grup-${i}`;
            return (
              <section key={g.kunci} aria-labelledby={idJudul} className="mb-4 last:mb-0">
                {/* Lekat di bawah header (tinggi diukur Header) agar konteks tidak hilang saat
                    menggulir; latar solid agar kartu yang lewat di bawahnya tidak tembus. */}
                <Judul
                  id={idJudul}
                  className="sticky top-(--tinggi-header) z-10 -mx-4 bg-app px-4 py-2 text-xs font-semibold text-ink-muted sm:-mx-6 sm:px-6"
                >
                  {grupMobile.judul(g.kunci)}
                </Judul>
                <DaftarKartu
                  baris={g.isi}
                  kolom={kolom}
                  kartuMobile={kartuMobile}
                  label={keterangan}
                />
              </section>
            );
          })
        ) : (
          <DaftarKartu baris={rows} kolom={kolom} kartuMobile={kartuMobile} label={keterangan} />
        )}
      </div>
    </div>
  );
}

function DaftarKartu<T>({
  baris,
  kolom,
  kartuMobile,
  label,
}: {
  baris: { id: string; original: T }[];
  kolom: Kolom<T>[];
  kartuMobile?: (baris: T) => ReactNode;
  label: string;
}) {
  return (
    <ul className={cn('flex flex-col', kartuMobile ? 'gap-2' : 'gap-3')} aria-label={label}>
      {baris.map((row) => (
        <li key={row.id}>
          {kartuMobile ? (
            kartuMobile(row.original)
          ) : (
            <KartuGenerik baris={row.original} kolom={kolom} />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Kartu bawaan: semua kolom sebagai pasangan label/nilai. */
function KartuGenerik<T>({ baris, kolom }: { baris: T; kolom: Kolom<T>[] }) {
  const utama = kolom.find((k) => k.utama) ?? kolom[0];
  const aksi = kolom.filter((k) => k.aksi);
  const lain = kolom.filter((k) => k !== utama && !k.aksi);
  return (
    <article className="kartu-kontainer rounded-kartu border border-line bg-surface p-4 shadow-[var(--shadow-card)]">
      {utama && <div className="text-sm font-semibold text-ink">{utama.sel(baris)}</div>}
      <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        {lain.map((k) => (
          <div key={k.id} className="contents">
            <dt className="text-ink-subtle">{k.judul}</dt>
            <dd className={cn('min-w-0 text-right text-ink', k.angka && 'tabular-nums')}>
              {k.sel(baris)}
            </dd>
          </div>
        ))}
      </dl>
      {aksi.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-line-soft pt-3">
          {aksi.map((k) => (
            <div key={k.id}>{k.sel(baris)}</div>
          ))}
        </div>
      )}
    </article>
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
          <CaretLeftIcon aria-hidden="true" />
          Sebelumnya
        </Button>

        {jumlahHalaman > 1 ? (
          <form onSubmit={lompat} className="flex items-center gap-1.5">
            <label htmlFor={idLoncat} className="sr-only">
              Loncat ke halaman
            </label>
            <input
              id={idLoncat}
              name="halaman"
              type="number"
              inputMode="numeric"
              min={1}
              max={jumlahHalaman}
              value={inputHalaman}
              onChange={(e) => setInputHalaman(e.target.value)}
              onBlur={() => lompat()}
              className="isian-kontrol h-11 w-14 rounded-kontrol border border-line-kontrol bg-surface px-2 text-center text-sm text-ink tabular-nums pointer-fine:h-9"
            />
            <span className="text-ink-subtle tabular-nums">/ {angka(jumlahHalaman)}</span>
            <Button type="submit" variant="secondary" className="min-w-11 px-3">
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
          <CaretRightIcon aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
