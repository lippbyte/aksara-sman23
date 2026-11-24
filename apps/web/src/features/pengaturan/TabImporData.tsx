import {
  BATAS_UKURAN_CSV_BYTE,
  BATAS_UKURAN_XLSX_BYTE,
  JENIS_IMPOR,
  type HasilHapusPilot,
  type HasilPratinjauImpor,
  type HasilSimpanImpor,
  type JenisImpor,
  type PratinjauImporInput,
  type Respons,
} from '@sms/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircleIcon,
  DownloadSimpleIcon,
  FileXlsIcon,
  TrashIcon,
  UploadSimpleIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog, DialogAksi } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Checkbox, Input } from '@/components/ui/input';
import { api, pesanGalat } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { angka } from '@/lib/format';
import { cn } from '@/lib/utils';

const LABEL_JENIS: Record<JenisImpor, { judul: string; keterangan: string }> = {
  guru: {
    judul: 'Guru',
    keterangan:
      'Format Excel (.xlsx) atau CSV. Mengambil Nama Pengajar (nama_guru), Mata Pelajaran, dan Kode (kode_guru). Kolom lain diabaikan; jadwal mengajar per kelas dapat diatur menyusul di tab Jadwal.',
  },
  siswa: {
    judul: 'Siswa (X, XI, XII)',
    keterangan:
      'Format Excel (.xlsx) multi-sheet maupun satu sheet, atau CSV. Mengambil NIS, NAMA, JK (L/P), Kelas (atau dari nama sheet), Wali Kelas, dan Guru BK.',
  },
  jadwal: {
    judul: 'Jadwal mengajar',
    keterangan:
      'Format Excel (.xlsx) atau CSV. Mengambil Kode Guru, Kelas, Hari (Senin–Sabtu / 1–6), Jam Ke, dan Total JP.',
  },
};

const LABEL_KOLOM_PRATINJAU: Record<string, string> = {
  kode_guru: 'Kode',
  nama_guru: 'Nama Pengajar',
  mata_pelajaran: 'Mata Pelajaran',
  nama_mgmp: 'MGMP',
  nis: 'NIS',
  nama_siswa: 'Nama Siswa',
  jenis_kelamin: 'JK',
  nama_kelas: 'Kelas',
  wali_kelas: 'Wali Kelas',
  bk: 'Guru BK',
  hari: 'Hari',
  jam_ke: 'Jam Ke',
  total_jam_mengajar: 'Total JP',
  status: 'Status',
  aksi: 'Aksi',
};

function ubahKeBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const bagian: string[] = [];
  const langkah = 0x8000;
  for (let i = 0; i < bytes.length; i += langkah) {
    bagian.push(String.fromCharCode(...bytes.subarray(i, i + langkah)));
  }
  return btoa(bagian.join(''));
}

export function TabImporData() {
  const { sekolah } = useAuth();
  const queryClient = useQueryClient();
  const inputBerkas = useRef<HTMLInputElement>(null);

  const [jenis, setJenis] = useState<JenisImpor>('guru');
  const [namaBerkas, setNamaBerkas] = useState<string | null>(null);
  const [muatanBerkas, setMuatanBerkas] = useState<PratinjauImporInput | null>(null);
  const [pratinjau, setPratinjau] = useState<HasilPratinjauImpor | null>(null);
  const [izinkanRef, setIzinkanRef] = useState(false);

  const [dialogHapusBuka, setDialogHapusBuka] = useState(false);
  const [konfirmasiNama, setKonfirmasiNama] = useState('');

  const mutasiPratinjau = useMutation({
    mutationFn: ({ target, muatan }: { target: JenisImpor; muatan: PratinjauImporInput }) =>
      api.post<Respons<HasilPratinjauImpor>>(`/settings/impor/${target}/pratinjau`, muatan),
    onSuccess: (res) => {
      setPratinjau(res.data);
      setIzinkanRef(false);
    },
    onError: (err) => {
      setPratinjau(null);
      toast.error(pesanGalat(err));
    },
  });

  const mutasiSimpan = useMutation({
    mutationFn: () => {
      if (!muatanBerkas) throw new Error('Pilih berkas Excel (.xlsx) atau CSV terlebih dahulu.');
      return api.post<Respons<HasilSimpanImpor>>(`/settings/impor/${jenis}/simpan`, {
        ...muatanBerkas,
        izinkan_buat_referensi: izinkanRef,
      });
    },
    onSuccess: (res) => {
      const d = res.data;
      toast.success(
        `Impor ${LABEL_JENIS[d.jenis].judul.toLowerCase()} tersimpan: ${angka(d.baru)} baru, ${angka(d.diperbarui)} diperbarui.`,
      );
      setPratinjau(null);
      setMuatanBerkas(null);
      setNamaBerkas(null);
      setIzinkanRef(false);
      void queryClient.invalidateQueries({ queryKey: ['pengaturan'] });
      void queryClient.invalidateQueries({ queryKey: ['referensi'] });
    },
    onError: (err) => toast.error(pesanGalat(err)),
  });

  const mutasiHapusPilot = useMutation({
    mutationFn: (konfirmasi: string) =>
      api.post<Respons<HasilHapusPilot>>('/settings/hapus-data-pilot', {
        konfirmasi_nama_sekolah: konfirmasi,
      }),
    onSuccess: (res) => {
      const h = res.data.dihapus;
      toast.success(
        `Data pilot dihapus (${angka(h.guru)} guru, ${angka(h.siswa)} siswa, ${angka(h.kehadiran)} kehadiran guru, ${angka(h.kehadiran_siswa)} kehadiran siswa).`,
      );
      setDialogHapusBuka(false);
      setKonfirmasiNama('');
      void queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(pesanGalat(err)),
  });

  function gantiJenis(baru: JenisImpor) {
    setJenis(baru);
    setPratinjau(null);
    setMuatanBerkas(null);
    setNamaBerkas(null);
    setIzinkanRef(false);
  }

  async function pilihBerkas(berkas: File | undefined) {
    if (!berkas) return;
    const namaLower = berkas.name.toLowerCase();

    if (namaLower.endsWith('.xls')) {
      toast.error('Format .xls lama belum didukung. Simpan ulang berkas sebagai .xlsx atau CSV.');
      return;
    }

    const adalahXlsx =
      namaLower.endsWith('.xlsx') ||
      berkas.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const adalahCsv = namaLower.endsWith('.csv') || berkas.type === 'text/csv';

    if (!adalahXlsx && !adalahCsv) {
      toast.error('Berkas harus berformat Excel (.xlsx) atau CSV (UTF-8).');
      return;
    }

    if (adalahXlsx) {
      if (berkas.size > BATAS_UKURAN_XLSX_BYTE) {
        toast.error('Ukuran berkas Excel maksimal 4 MB.');
        return;
      }
      try {
        const buffer = await berkas.arrayBuffer();
        const muatan: PratinjauImporInput = { xlsx_base64: ubahKeBase64(buffer) };
        setNamaBerkas(berkas.name);
        setMuatanBerkas(muatan);
        mutasiPratinjau.mutate({ target: jenis, muatan });
      } catch {
        toast.error('Berkas Excel tidak dapat dibaca.');
      }
      return;
    }

    if (berkas.size > BATAS_UKURAN_CSV_BYTE) {
      toast.error('Ukuran berkas CSV maksimal 2 MB.');
      return;
    }
    try {
      const teks = await berkas.text();
      const muatan: PratinjauImporInput = { csv: teks };
      setNamaBerkas(berkas.name);
      setMuatanBerkas(muatan);
      mutasiPratinjau.mutate({ target: jenis, muatan });
    } catch {
      toast.error('Berkas CSV tidak dapat dibaca.');
    }
  }

  const butuhKonfirmasiRef =
    pratinjau !== null &&
    (pratinjau.referensi_baru.kelas.length > 0 || pratinjau.referensi_baru.mgmp.length > 0);
  const bolehSimpan =
    pratinjau !== null && pratinjau.dapat_disimpan && (!butuhKonfirmasiRef || izinkanRef);

  const namaSekolahResmi = sekolah?.nama_sekolah ?? '';
  const konfirmasiCocok =
    namaSekolahResmi !== '' && konfirmasiNama.trim() === namaSekolahResmi.trim();

  return (
    <div className="grid max-w-4xl gap-4">
      <Card>
        <CardHeader
          judul="Impor data master (Excel .xlsx / CSV)"
          keterangan="Unggah berkas Excel (.xlsx) atau CSV sesuai templat, periksa pratinjau validasi, lalu konfirmasi. Data disimpan seluruhnya dalam satu transaksi tanpa simpan parsial."
        />
        <CardBody className="flex flex-col gap-4">
          {/* Pilihan jenis impor */}
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Jenis data impor">
            {JENIS_IMPOR.map((j) => {
              const aktif = jenis === j;
              return (
                <button
                  key={j}
                  type="button"
                  role="radio"
                  aria-checked={aktif}
                  onClick={() => gantiJenis(j)}
                  className={cn(
                    'tombol-tekan min-h-11 rounded-kontrol border px-3.5 text-sm font-medium pointer-fine:min-h-9',
                    aktif
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line bg-surface text-ink-muted hover:bg-app hover:text-ink',
                  )}
                >
                  {LABEL_JENIS[j].judul}
                </button>
              );
            })}
          </div>

          <p className="text-xs leading-relaxed text-ink-muted">{LABEL_JENIS[jenis].keterangan}</p>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="touch">
              <a href={`/api/v1/settings/impor/${jenis}/templat?format=xlsx`} download>
                <DownloadSimpleIcon aria-hidden="true" />
                Unduh templat Excel (.xlsx)
              </a>
            </Button>

            <Button asChild variant="secondary" size="touch">
              <a href={`/api/v1/settings/impor/${jenis}/templat`} download>
                <DownloadSimpleIcon aria-hidden="true" />
                Unduh templat CSV
              </a>
            </Button>

            <input
              ref={inputBerkas}
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              className="sr-only"
              aria-label={`Pilih berkas Excel atau CSV ${LABEL_JENIS[jenis].judul}`}
              onChange={(e) => {
                void pilihBerkas(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              size="touch"
              loading={mutasiPratinjau.isPending}
              onClick={() => inputBerkas.current?.click()}
            >
              <UploadSimpleIcon aria-hidden="true" />
              Pilih berkas Excel / CSV
            </Button>

            {namaBerkas && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <FileXlsIcon className="size-4 text-icon-muted" aria-hidden="true" />
                {namaBerkas}
              </span>
            )}
          </div>

          {/* Hasil pratinjau */}
          {pratinjau && (
            <div className="flex flex-col gap-3 rounded-kartu border border-line bg-app/50 p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <KotakRingkasan label="Total baris" nilai={pratinjau.ringkasan.total} />
                <KotakRingkasan label="Baru" nilai={pratinjau.ringkasan.baru} nada="hadir" />
                <KotakRingkasan
                  label="Diperbarui"
                  nilai={pratinjau.ringkasan.diperbarui}
                  nada="info"
                />
                <KotakRingkasan
                  label="Ditolak"
                  nilai={pratinjau.ringkasan.ditolak}
                  nada={pratinjau.ringkasan.ditolak > 0 ? 'tidak-hadir' : 'netral'}
                />
              </div>

              {butuhKonfirmasiRef && (
                <div className="rounded-kontrol border border-line bg-peringatan-soft p-3 text-xs text-ink">
                  <p className="font-semibold">Referensi baru yang akan dibuat:</p>
                  <ul className="mt-1 list-inside list-disc text-ink-muted">
                    {pratinjau.referensi_baru.kelas.length > 0 && (
                      <li>Kelas baru: {pratinjau.referensi_baru.kelas.join(', ')}</li>
                    )}
                    {pratinjau.referensi_baru.mgmp.length > 0 && (
                      <li>MGMP baru: {pratinjau.referensi_baru.mgmp.join(', ')}</li>
                    )}
                  </ul>
                  <label className="mt-2 flex min-h-11 items-center gap-2 text-sm text-ink sm:min-h-8">
                    <Checkbox
                      checked={izinkanRef}
                      onChange={(e) => setIzinkanRef(e.target.checked)}
                    />
                    Saya setuju membuat kelas/MGMP baru di atas saat menyimpan
                  </label>
                </div>
              )}

              {pratinjau.galat.length > 0 && (
                <div className="rounded-kontrol border border-line bg-tidak-hadir-soft p-3">
                  <p className="mb-2 text-xs font-semibold text-tidak-hadir">
                    Ditemukan {angka(pratinjau.total_galat)} baris galat. Perbaiki berkas lalu
                    unggah ulang:
                  </p>
                  <div className="max-h-52 overflow-y-auto rounded-kontrol border border-line bg-surface">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-line bg-subtle text-ink-subtle uppercase">
                        <tr>
                          <th scope="col" className="w-20 px-3 py-1.5">
                            Baris
                          </th>
                          <th scope="col" className="px-3 py-1.5">
                            Keterangan
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft">
                        {pratinjau.galat.map((g, i) => (
                          <tr key={`${g.baris}-${i}`}>
                            <td className="px-3 py-1.5 font-medium tabular-nums">{g.baris}</td>
                            <td className="px-3 py-1.5 text-tidak-hadir">{g.pesan}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {pratinjau.contoh.length > 0 && (
                <div>
                  <p className="mb-1.5 text-2xs font-semibold tracking-wider text-ink-subtle uppercase">
                    Pratinjau baris sah (maks. 10 baris pertama)
                  </p>
                  <div className="relative overflow-x-auto rounded-kontrol border border-line bg-surface">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-line bg-subtle text-ink-subtle uppercase">
                        <tr>
                          {Object.keys(pratinjau.contoh[0]!).map((k) => (
                            <th key={k} scope="col" className="px-2.5 py-1.5 whitespace-nowrap">
                              {LABEL_KOLOM_PRATINJAU[k] ?? k}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft">
                        {pratinjau.contoh.map((baris, idx) => (
                          <tr key={idx}>
                            {Object.values(baris).map((v, j) => (
                              <td key={j} className="px-2.5 py-1.5 whitespace-nowrap text-ink">
                                {v === null || v === '' ? '—' : String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
                <p className="text-xs text-ink-muted">
                  {pratinjau.dapat_disimpan ? (
                    <span className="inline-flex items-center gap-1.5 text-hadir">
                      <CheckCircleIcon className="size-4 shrink-0" aria-hidden="true" />
                      Semua baris sah dan siap disimpan.
                    </span>
                  ) : (
                    'Impor tidak dapat disimpan selama masih ada baris galat atau berkas kosong.'
                  )}
                </p>
                <Button
                  size="touch"
                  disabled={!bolehSimpan}
                  loading={mutasiSimpan.isPending}
                  onClick={() => mutasiSimpan.mutate()}
                >
                  Simpan hasil impor
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Hapus data pilot */}
      <Card className="border-tidak-hadir/30">
        <CardHeader
          judul="Hapus data pilot"
          keterangan="Menghapus seluruh data kehadiran guru, kehadiran siswa, rekap, penilaian kinerja & MGMP, jadwal mengajar, siswa, dan guru. Akun pengguna, pengaturan sekolah, dan log aktivitas tetap dipertahankan."
        />
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs text-ink-muted">
            <WarningIcon className="mt-0.5 size-4 shrink-0 text-tidak-hadir" aria-hidden="true" />
            <p>
              Tindakan ini tidak dapat dibatalkan dan tercatat pada log aktivitas. Gunakan hanya
              setelah masa uji coba/pilot berakhir atau sebelum memasukkan data awal yang baru.
            </p>
          </div>
          <Button variant="danger" size="touch" onClick={() => setDialogHapusBuka(true)}>
            <TrashIcon aria-hidden="true" />
            Hapus data pilot
          </Button>
        </CardBody>
      </Card>

      <Dialog
        open={dialogHapusBuka}
        onOpenChange={(buka) => {
          setDialogHapusBuka(buka);
          if (!buka) setKonfirmasiNama('');
        }}
        judul="Konfirmasi hapus data pilot"
        deskripsi="Seluruh catatan kehadiran, rekap, penilaian, jadwal, siswa, dan guru akan dihapus permanen."
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (konfirmasiCocok) mutasiHapusPilot.mutate(konfirmasiNama);
          }}
        >
          <p className="rounded-kontrol bg-tidak-hadir-soft px-3 py-2 text-xs text-tidak-hadir">
            Untuk melanjutkan, ketik persis nama sekolah:{' '}
            <strong className="font-semibold">{namaSekolahResmi || '(belum diatur)'}</strong>
          </p>
          <Field label="Nama sekolah" wajib>
            <Input
              value={konfirmasiNama}
              onChange={(e) => setKonfirmasiNama(e.target.value)}
              placeholder={namaSekolahResmi}
              autoComplete="off"
            />
          </Field>
          <DialogAksi>
            <Button
              variant="secondary"
              size="touch"
              onClick={() => {
                setDialogHapusBuka(false);
                setKonfirmasiNama('');
              }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="touch"
              disabled={!konfirmasiCocok}
              loading={mutasiHapusPilot.isPending}
            >
              Hapus seluruh data pilot
            </Button>
          </DialogAksi>
        </form>
      </Dialog>
    </div>
  );
}

function KotakRingkasan({
  label,
  nilai,
  nada = 'netral',
}: {
  label: string;
  nilai: number;
  nada?: 'netral' | 'hadir' | 'info' | 'tidak-hadir';
}) {
  const warna =
    nada === 'hadir'
      ? 'text-hadir'
      : nada === 'info'
        ? 'text-info'
        : nada === 'tidak-hadir'
          ? 'text-tidak-hadir'
          : 'text-ink';
  return (
    <div className="rounded-kontrol border border-line bg-surface px-3 py-2">
      <p className="text-2xs font-semibold tracking-wider text-ink-subtle uppercase">{label}</p>
      <p className={cn('mt-0.5 text-lg font-bold tabular-nums', warna)}>{angka(nilai)}</p>
    </div>
  );
}
