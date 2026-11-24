import { useId, type ReactNode } from 'react';

export interface Ringkasan {
  judul: string;
  sub?: string;
  /** Bagian kosong dilewati; sisanya digabung dengan " · ". */
  detail?: (string | null | undefined | false)[];
  /** Mis. lencana "Tidak aktif" atau "Dikoreksi manual"; hanya yang menyimpang dari biasanya. */
  lencana?: ReactNode;
  /** Isi tambahan selebar kartu di bawah teks, mis. batang persentase. */
  bawah?: ReactNode;
}

/**
 * Kartu ponsel ringkas untuk `DataTable.kartuMobile` (DESIGN §12.10): judul + 1–2 baris pendek +
 * aksi 44 px di kanan, tanpa baris label/nilai per kolom. Tabel desktop tetap lengkap.
 */
export function KartuRingkas({
  judul,
  sub,
  detail,
  lencana,
  bawah,
  aksi,
}: Ringkasan & { aksi?: ReactNode }) {
  const idJudul = useId();
  const teksDetail = (detail ?? []).filter(Boolean).join(' · ');
  return (
    <article
      aria-labelledby={idJudul}
      className="rounded-kartu border border-line bg-surface py-2.5 pr-2 pl-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 py-0.5">
          <p id={idJudul} className="text-sm font-semibold text-ink">
            {judul}
          </p>
          {sub && <p className="text-xs break-words text-ink-muted">{sub}</p>}
          {teksDetail && <p className="text-xs break-words text-ink-subtle">{teksDetail}</p>}
          {lencana && <div className="mt-1.5 flex flex-wrap gap-1">{lencana}</div>}
        </div>
        {aksi && <div className="flex shrink-0">{aksi}</div>}
      </div>
      {bawah && <div className="mt-2 pr-2">{bawah}</div>}
    </article>
  );
}
