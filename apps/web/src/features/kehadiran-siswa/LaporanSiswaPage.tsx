import { STATUS_SISWA, type LaporanSiswaBaris, type StatusSiswa } from '@sms/shared';
import { DownloadSimpleIcon, FileTextIcon } from '@phosphor-icons/react';
import { DataTable, Pagination, type Kolom } from '@/components/DataTable';
import { KartuRingkas } from '@/components/KartuRingkas';
import { FilterBar, FilterItem, useFilterUrl } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { angka, tanggalPendek } from '@/lib/format';
import { useRefKelas, useRefSiswa } from '@/lib/referensi';
import { useLaporanSiswa, urlEksporLaporanSiswa } from './api';

const KUNCI_FILTER = ['kelas_id', 'siswa_id', 'tanggal_dari', 'tanggal_sampai'] as const;
const LABEL: Record<StatusSiswa, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  alpa: 'Alpa',
};

/** Kartu ponsel: siswa, NIS · kelas, jumlah per status dalam satu baris. */
function kartuLaporan(b: LaporanSiswaBaris) {
  return (
    <KartuRingkas
      judul={b.nama_siswa}
      sub={`NIS ${b.nis} · Kelas ${b.nama_kelas}`}
      detail={[
        ...STATUS_SISWA.map((st) => `${LABEL[st]} ${angka(b[st])}`),
        `Total ${angka(b.total)}`,
      ]}
    />
  );
}

const kolom: Kolom<LaporanSiswaBaris>[] = [
  { id: 'nis', judul: 'NIS', sel: (b) => b.nis },
  { id: 'nama', judul: 'Nama siswa', utama: true, sel: (b) => b.nama_siswa },
  { id: 'kelas', judul: 'Kelas', sel: (b) => b.nama_kelas },
  ...STATUS_SISWA.map((s) => ({
    id: s,
    judul: LABEL[s],
    angka: true,
    sel: (b: LaporanSiswaBaris) => angka(b[s]),
  })),
  { id: 'total', judul: 'Total catatan', angka: true, sel: (b) => angka(b.total) },
];

export function LaporanSiswaPage() {
  const f = useFilterUrl(KUNCI_FILTER);
  const kelasId = Number(f.nilai.kelas_id) || null;
  const kelas = useRefKelas();
  const siswa = useRefSiswa(kelasId);
  const rentangSalah =
    f.nilai.tanggal_dari !== '' &&
    f.nilai.tanggal_sampai !== '' &&
    f.nilai.tanggal_dari > f.nilai.tanggal_sampai;

  const laporan = useLaporanSiswa({ ...f.nilai, page: f.page, pageSize: 20 });

  const periode =
    f.nilai.tanggal_dari || f.nilai.tanggal_sampai
      ? `${f.nilai.tanggal_dari ? tanggalPendek(f.nilai.tanggal_dari) : 'awal'} – ${f.nilai.tanggal_sampai ? tanggalPendek(f.nilai.tanggal_sampai) : 'sekarang'}`
      : 'Semua tanggal';

  const tombolEkspor = rentangSalah ? (
    <Button size="touch" variant="secondary" disabled>
      <DownloadSimpleIcon aria-hidden="true" />
      Ekspor CSV
    </Button>
  ) : (
    <Button asChild size="touch" variant="secondary">
      <a href={urlEksporLaporanSiswa(f.nilai)} download>
        <DownloadSimpleIcon aria-hidden="true" />
        Ekspor CSV
      </a>
    </Button>
  );

  return (
    <div>
      <FilterBar
        lembarMobile
        onReset={f.reset}
        adaFilter={f.adaFilter}
        jumlahAktif={f.jumlahAktif}
        aksi={tombolEkspor}
      >
        <FilterItem label="Kelas" className="sm:w-32">
          {(id) => (
            <Select
              id={id}
              value={f.nilai.kelas_id}
              onChange={(e) => {
                f.atur('kelas_id', e.target.value);
                f.atur('siswa_id', '');
              }}
            >
              <option value="">Semua</option>
              {kelas.data?.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
        <FilterItem label="Siswa" className="sm:w-48">
          {(id) => (
            <Select
              id={id}
              value={f.nilai.siswa_id}
              disabled={kelasId === null}
              onChange={(e) => f.atur('siswa_id', e.target.value)}
            >
              <option value="">{kelasId === null ? 'Pilih kelas dulu' : 'Semua'}</option>
              {siswa.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama_siswa}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
        <FilterItem label="Dari tanggal" className="sm:w-40">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={f.nilai.tanggal_dari}
              max={f.nilai.tanggal_sampai || undefined}
              onChange={(e) => f.atur('tanggal_dari', e.target.value)}
            />
          )}
        </FilterItem>
        <FilterItem label="Sampai tanggal" className="sm:w-40">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={f.nilai.tanggal_sampai}
              min={f.nilai.tanggal_dari || undefined}
              onChange={(e) => f.atur('tanggal_sampai', e.target.value)}
            />
          )}
        </FilterItem>
      </FilterBar>

      <p className="mb-2 text-xs text-ink-subtle">
        Periode: {periode}. Jumlah dihitung dari catatan absensi siswa (per tanggal dan jam ke).
      </p>

      <DataTable
        kolom={kolom}
        data={laporan.data?.data}
        idBaris={(b) => b.siswa_id}
        memuat={laporan.isFetching}
        galat={
          rentangSalah
            ? 'Tanggal akhir tidak boleh sebelum tanggal awal.'
            : laporan.isError
              ? pesanGalat(laporan.error)
              : null
        }
        onCobaLagi={rentangSalah ? undefined : () => void laporan.refetch()}
        keterangan="Laporan rekap kehadiran siswa"
        kartuMobile={kartuLaporan}
        kosong={{
          icon: FileTextIcon,
          pesan: f.adaFilter
            ? 'Tidak ada siswa yang cocok dengan filter.'
            : 'Belum ada data siswa.',
        }}
      />
      {laporan.data && !rentangSalah && (
        <Pagination
          page={laporan.data.meta.page}
          pageSize={laporan.data.meta.pageSize}
          total={laporan.data.meta.total}
          onUbah={f.aturPage}
        />
      )}
    </div>
  );
}
