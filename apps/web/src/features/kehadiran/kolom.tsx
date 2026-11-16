import type { Kehadiran } from '@sms/shared';
import type { Kolom } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { tanggalPendek } from '@/lib/format';

export function rentangJam(k: { jam_ke: number; lama_jam: number }): string {
  const akhir = k.jam_ke + k.lama_jam - 1;
  return akhir > k.jam_ke ? `${k.jam_ke}–${akhir}` : String(k.jam_ke);
}

export const kolomGuru: Kolom<Kehadiran> = {
  id: 'guru',
  judul: 'Guru',
  utama: true,
  sel: (k) => (
    <span>
      {k.nama_guru}
      <span className="block text-xs font-normal text-ink-subtle">{k.mata_pelajaran}</span>
    </span>
  ),
};

export const kolomJam: Kolom<Kehadiran> = {
  id: 'jam',
  judul: 'Jam ke-',
  angka: true,
  sel: (k) => rentangJam(k),
};

export const kolomJp: Kolom<Kehadiran> = {
  id: 'jp',
  judul: 'JP',
  angka: true,
  sel: (k) => k.lama_jam,
};

export const kolomStatus: Kolom<Kehadiran> = {
  id: 'status',
  judul: 'Status',
  sel: (k) => <StatusBadge status={k.status_kehadiran} />,
};

export const kolomTugas: Kolom<Kehadiran> = {
  id: 'tugas',
  judul: 'Tugas',
  sel: (k) => <StatusBadge status={k.status_tugas} />,
};

export const kolomKeterangan: Kolom<Kehadiran> = {
  id: 'keterangan',
  judul: 'Keterangan',
  sel: (k) => k.keterangan ?? '—',
};

export const kolomTanggal: Kolom<Kehadiran> = {
  id: 'tanggal',
  judul: 'Tanggal',
  sel: (k) => <span className="whitespace-nowrap tabular-nums">{tanggalPendek(k.tanggal)}</span>,
};

export const kolomKelas: Kolom<Kehadiran> = {
  id: 'kelas',
  judul: 'Kelas',
  sel: (k) => k.nama_kelas,
};
