import { STATUS_KEHADIRAN, type Kehadiran } from '@sms/shared';
import { ClipboardTextIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DataTable, Pagination, type GrupMobile, type Kolom } from '@/components/DataTable';
import { FilterBar, FilterItem, useFilterUrl } from '@/components/FilterBar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';
import { hariIni, tanggalPanjang, tanggalPendek } from '@/lib/format';
import { useRefGuru, useRefKelas } from '@/lib/referensi';
import { useDaftarKehadiran, useHapusKehadiran } from './api';
import { FormKehadiran } from './FormKehadiran';
import { KartuKehadiran } from './KartuKehadiran';
import {
  kolomGuru,
  kolomJam,
  kolomJp,
  kolomKelas,
  kolomKeterangan,
  kolomStatus,
  kolomTanggal,
  kolomTugas,
  rentangJam,
} from './kolom';

const KUNCI_FILTER = ['tanggal', 'kelas_id', 'guru_id', 'status'] as const;

/** `Hari ini · Selasa, 24 Nov 2026` atau `Senin, 23 Nov 2026`. */
function judulTanggal(tanggal: string) {
  return tanggal === hariIni() ? `Hari ini · ${tanggalPanjang(tanggal)}` : tanggalPanjang(tanggal);
}

export function AbsensiGuruPage() {
  const user = usePengguna();
  const sekretaris = user.role === 'sekretaris_kelas';
  // Cermin matriks akses: guru_penilai tidak boleh menghapus (server tetap memeriksa).
  const bolehHapus = user.role !== 'guru_penilai';

  const f = useFilterUrl(KUNCI_FILTER);
  const kelas = useRefKelas();
  const guru = useRefGuru();
  const daftar = useDaftarKehadiran({ ...f.nilai, page: f.page, pageSize: 20 });
  const hapusMutasi = useHapusKehadiran();

  const [form, setForm] = useState<{ catatan: Kehadiran | null } | null>(null);
  const [hapus, setHapus] = useState<Kehadiran | null>(null);

  const tombolAksi = useCallback(
    (k: Kehadiran) => {
      // Tanggal ikut disebut: di ponsel tanggal hanya ada di judul kelompok, bukan di kartu.
      const siapa = `${k.nama_guru}, ${tanggalPendek(k.tanggal)}, jam ke-${rentangJam(k)}`;
      return (
        <span className="inline-flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Ubah catatan ${siapa}`}
            onClick={() => setForm({ catatan: k })}
          >
            <PencilSimpleIcon aria-hidden="true" />
          </Button>
          {bolehHapus && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Hapus catatan ${siapa}`}
              onClick={() => setHapus(k)}
            >
              <TrashIcon aria-hidden="true" />
            </Button>
          )}
        </span>
      );
    },
    [bolehHapus],
  );

  const kolom = useMemo<Kolom<Kehadiran>[]>(
    () => [
      kolomTanggal,
      ...(sekretaris ? [] : [kolomKelas]),
      kolomJam,
      kolomJp,
      kolomGuru,
      kolomStatus,
      kolomTugas,
      kolomKeterangan,
      { id: 'aksi', judul: 'Aksi', aksi: true, sel: tombolAksi },
    ],
    [sekretaris, tombolAksi],
  );

  // Daftar dari API sudah terurut tanggal (terbaru dulu) lalu jam, jadi kartu ponsel bisa
  // dikelompokkan per tanggal tanpa mengulang tanggal di setiap kartu (audit Fase 2 G1).
  const grupTanggal = useMemo<GrupMobile<Kehadiran>>(
    () => ({ kunci: (k) => k.tanggal, judul: judulTanggal }),
    [],
  );

  const tombolCatat = (
    <Button size="touch" onClick={() => setForm({ catatan: null })}>
      <PlusIcon aria-hidden="true" />
      Catat kehadiran
    </Button>
  );

  return (
    <div>
      <FilterBar
        lembarMobile
        onReset={f.reset}
        adaFilter={f.adaFilter}
        jumlahAktif={f.jumlahAktif}
        aksi={tombolCatat}
      >
        <FilterItem label="Tanggal" className="sm:w-56">
          {(id) => (
            <div className="flex gap-1.5">
              <Input
                id={id}
                type="date"
                value={f.nilai.tanggal}
                onChange={(e) => f.atur('tanggal', e.target.value)}
              />
              <Button
                variant="secondary"
                size="touch"
                onClick={() => f.atur('tanggal', hariIni())}
                disabled={f.nilai.tanggal === hariIni()}
              >
                Hari ini
              </Button>
            </div>
          )}
        </FilterItem>
        {!sekretaris && (
          <FilterItem label="Kelas" className="sm:w-28">
            {(id) => (
              <Select
                id={id}
                value={f.nilai.kelas_id}
                onChange={(e) => f.atur('kelas_id', e.target.value)}
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
        )}
        <FilterItem label="Guru" className="sm:w-40">
          {(id) => (
            <Select
              id={id}
              value={f.nilai.guru_id}
              onChange={(e) => f.atur('guru_id', e.target.value)}
            >
              <option value="">Semua</option>
              {guru.data?.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama_guru}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
        <FilterItem label="Status" className="sm:w-32">
          {(id) => (
            <Select
              id={id}
              value={f.nilai.status}
              onChange={(e) => f.atur('status', e.target.value)}
            >
              <option value="">Semua</option>
              {STATUS_KEHADIRAN.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
      </FilterBar>

      <DataTable
        kolom={kolom}
        data={daftar.data?.data}
        idBaris={(k) => k.id}
        memuat={daftar.isFetching}
        galat={daftar.isError ? pesanGalat(daftar.error) : null}
        onCobaLagi={() => void daftar.refetch()}
        keterangan="Daftar kehadiran guru"
        kartuMobile={(k) => <KartuKehadiran k={k} tampilKelas={!sekretaris} aksi={tombolAksi(k)} />}
        grupMobile={grupTanggal}
        kosong={{
          icon: ClipboardTextIcon,
          pesan: f.adaFilter
            ? 'Tidak ada catatan yang cocok dengan filter.'
            : 'Belum ada catatan kehadiran.',
          aksi: f.adaFilter ? (
            <Button variant="secondary" onClick={f.reset}>
              Reset filter
            </Button>
          ) : (
            tombolCatat
          ),
        }}
      />
      {daftar.data && (
        <Pagination
          page={daftar.data.meta.page}
          pageSize={daftar.data.meta.pageSize}
          total={daftar.data.meta.total}
          onUbah={f.aturPage}
        />
      )}

      {form && (
        <FormKehadiran
          key={form.catatan?.id ?? 'baru'}
          catatan={form.catatan}
          awal={{
            kelas_id: f.nilai.kelas_id ? Number(f.nilai.kelas_id) : null,
            tanggal: f.nilai.tanggal,
          }}
          onTutup={() => setForm(null)}
        />
      )}

      <ConfirmDialog
        open={hapus !== null}
        onOpenChange={(buka) => !buka && setHapus(null)}
        judul="Hapus catatan kehadiran?"
        pesan={
          hapus && (
            <>
              Catatan{' '}
              <strong className="font-semibold text-ink">
                {hapus.nama_guru}, kelas {hapus.nama_kelas}, {tanggalPanjang(hapus.tanggal)}, jam
                ke-{rentangJam(hapus)}
              </strong>{' '}
              akan dihapus dan rekap pekan guru ini dihitung ulang.
            </>
          )
        }
        labelSetuju="Hapus"
        berbahaya
        memproses={hapusMutasi.isPending}
        onSetuju={() =>
          hapus &&
          hapusMutasi.mutate(hapus.id, {
            onSuccess: () => {
              toast.success('Catatan kehadiran dihapus.');
              setHapus(null);
            },
            onError: (err) => toast.error(pesanGalat(err)),
          })
        }
      />
    </div>
  );
}
