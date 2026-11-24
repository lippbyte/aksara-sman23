import type { Kehadiran } from '@sms/shared';
import { useId, type ReactNode } from 'react';
import { StatusBadge } from '@/components/StatusBadge';
import { rentangJam } from './kolom';

interface KartuKehadiranProps {
  k: Kehadiran;
  /** Tampilkan nama kelas (peran selain sekretaris melihat banyak kelas). */
  tampilKelas?: boolean;
  /** Tombol aksi (ubah/hapus), masing-masing ≥ 44 px di layar sentuh. */
  aksi?: ReactNode;
}

/**
 * Tugas hanya bermakna bila guru tidak hadir atau tidak meninggalkan tugas
 * (PROJECT-CONTEXT §6.1); nilai bawaan "Ada" pada guru yang hadir tidak ditampilkan.
 */
export function tugasPerluDitampilkan(k: Pick<Kehadiran, 'status_kehadiran' | 'status_tugas'>) {
  return k.status_tugas === 'Tidak Ada' || k.status_kehadiran === 'Tidak Hadir';
}

/**
 * Kartu ringkas satu catatan kehadiran guru untuk ponsel (audit Fase 2 G1–G3):
 * jam di kolom kiri, guru + status lebih dulu, lalu detail yang hanya tampil bila berisi.
 */
export function KartuKehadiran({ k, tampilKelas = false, aksi }: KartuKehadiranProps) {
  const idJudul = useId();
  // Spasi tak-putus (U+00A0) di "Kelas X-1" dan "2 JP": baris hanya patah di pemisah " · ",
  // bukan di tengah frasa pendek. Nama mapel boleh patah karena bisa panjang.
  const detail = [
    k.mata_pelajaran,
    tampilKelas ? `Kelas\u00A0${k.nama_kelas}` : null,
    `${k.lama_jam}\u00A0JP`,
  ]
    .filter(Boolean)
    // Titik pemisah menempel ke bagian sebelumnya, jadi baris baru tidak diawali "·".
    .join('\u00A0· ');

  return (
    <article
      aria-labelledby={idJudul}
      className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-x-3 gap-y-2 rounded-kartu border border-line bg-surface p-3 shadow-[var(--shadow-card)]"
    >
      <p className="row-span-2 flex flex-col items-center self-start rounded-kontrol bg-subtle px-1 py-1.5 text-center leading-tight">
        <span className="text-2xs text-ink-subtle">Jam</span>
        <span className="text-sm font-bold text-ink tabular-nums">{rentangJam(k)}</span>
      </p>

      <div className="min-w-0 self-center">
        <h3 id={idJudul} className="text-sm font-semibold text-ink">
          {k.nama_guru}
        </h3>
        <p className="text-xs text-ink-muted">{detail}</p>
      </div>

      {aksi ? <div className="-my-1 -mr-1.5 flex items-start">{aksi}</div> : <span />}

      <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={k.status_kehadiran} />
        {tugasPerluDitampilkan(k) && (
          <StatusBadge
            status={k.status_tugas}
            label={k.status_tugas === 'Ada' ? 'Tugas: Ada' : 'Tugas: Tidak ada'}
          />
        )}
      </div>

      {k.keterangan && (
        <p className="col-span-2 col-start-2 line-clamp-2 text-xs text-ink-muted">
          <span className="sr-only">Keterangan: </span>
          {k.keterangan}
        </p>
      )}
    </article>
  );
}
