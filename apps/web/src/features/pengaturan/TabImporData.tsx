import {
  BATAS_UKURAN_CSV_BYTE,
  JENIS_IMPOR,
  type HasilHapusPilot,
  type HasilPratinjauImpor,
  type HasilSimpanImpor,
  type JenisImpor,
  type Respons,
} from '@sms/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
} from 'lucide-react';
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
    keterangan: 'Kunci unik: kode_guru. Kolom wajib: kode_guru, nama_guru, mata_pelajaran.',
  },
  siswa: {
    judul: 'Siswa',
    keterangan: 'Kunci unik: nis. Kolom wajib: nis, nama_siswa, jenis_kelamin (L/P), nama_kelas.',
  },
  jadwal: {
    judul: 'Jadwal mengajar',
    keterangan:
      'Kunci unik: (kode_guru, hari, jam_ke). Kolom wajib: kode_guru, nama_kelas, hari, jam_ke, total_jam_mengajar.',
  },
};

export function TabImporData() {
  const { sekolah } = useAuth();
  const queryClient = useQueryClient();
  const inputBerkas = useRef<HTMLInputElement>(null);

  const [jenis, setJenis] = useState<JenisImpor>('guru');
  const [namaBerkas, setNamaBerkas] = useState<string | null>(null);
  const [isiCsv, setIsiCsv] = useState<string | null>(null);
  const [pratinjau, setPratinjau] = useState<HasilPratinjauImpor | null>(null);
  const [izinkanRef, setIzinkanRef] = useState(false);

  const [dialogHapusBuka, setDialogHapusBuka] = useState(false);
  const [konfirmasiNama, setKonfirmasiNama] = useState('');

  const mutasiPratinjau = useMutation({
    mutationFn: ({ target, csv }: { target: JenisImpor; csv: string }) =>
      api.post<Respons<HasilPratinjauImpor>>(`/settings/impor/${target}/pratinjau`, { csv }),
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
      if (!isiCsv) throw new Error('Pilih berkas CSV terlebih dahulu.');
      return api.post<Respons<HasilSimpanImpor>>(`/settings/impor/${jenis}/simpan`, {
        csv: isiCsv,
        izinkan_buat_referensi: izinkanRef,
      });
    },
    onSuccess: (res) => {
      const d = res.data;
      toast.success(
        `Impor ${LABEL_JENIS[d.jenis].judul.toLowerCase()} tersimpan: ${angka(d.baru)} baru, ${angka(d.diperbarui)} diperbarui.`,
      );
      setPratinjau(null);
      setIsiCsv(null);
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
    setIsiCsv(null);
    setNamaBerkas(null);
    setIzinkanRef(false);
  }

  function pilihBerkas(berkas: File | undefined) {
    if (!berkas) return;
    if (!berkas.name.toLowerCase().endsWith('.csv') && berkas.type !== 'text/csv') {
      toast.error('Berkas harus berformat CSV (UTF-8).');
      return;
    }
    if (berkas.size > BATAS_UKURAN_CSV_BYTE) {
      toast.error('Ukuran berkas CSV maksimal 2 MB.');
      return;
    }
    const pembaca = new FileReader();
    pembaca.onload = () => {
      const teks = typeof pembaca.result === 'string' ? pembaca.result : '';
      setNamaBerkas(berkas.name);
      setIsiCsv(teks);
      mutasiPratinjau.mutate({ target: jenis, csv: teks });
    };
    pembaca.onerror = () => toast.error('Berkas CSV tidak dapat dibaca.');
    pembaca.readAsText(berkas, 'utf-8');
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
          judul="Impor data master (CSV UTF-8)"
          keterangan="Unggah berkas CSV sesuai templat, periksa pratinjau validasi, lalu konfirmasi. Data disimpan seluruhnya dalam satu transaksi tanpa simpan parsial."
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
                    'tombol-tekan min-h-11 rounded-lg border px-3.5 text-sm font-medium sm:min-h-9',
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

          <p className="text-xs text-ink-muted">{LABEL_JENIS[jenis].keterangan}</p>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="touch">
              <a href={`/api/v1/settings/impor/${jenis}/templat`} download>
                <Download aria-hidden="true" />
                Unduh templat CSV
              </a>
            </Button>

            <input
              ref={inputBerkas}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label={`Pilih berkas CSV ${LABEL_JENIS[jenis].judul}`}
              onChange={(e) => {
                pilihBerkas(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              size="touch"
              loading={mutasiPratinjau.isPending}
              onClick={() => inputBerkas.current?.click()}
            >
              <Upload aria-hidden="true" />
              Pilih berkas CSV
            </Button>

            {namaBerkas && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                <FileSpreadsheet className="size-4 text-icon-muted" aria-hidden="true" />
                {namaBerkas}
              </span>
            )}
          </div>

          {/* Hasil pratinjau */}
          {pratinjau && (
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-app/50 p-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <KotakRingkasan label="Total baris" nilai={pratinjau.ringkasan.total} />
                <KotakRingkasan label="Baru" nilai={pratinjau.ringkasan.baru} nada="hadir" />
                <KotakRingkasan
                  label="Diperbarui"
                  nilai={pratinjau.ringkasan.diperbarui}
                  nada="mendampingi"
                />
                <KotakRingkasan
                  label="Ditolak"
                  nilai={pratinjau.ringkasan.ditolak}
                  nada={pratinjau.ringkasan.ditolak > 0 ? 'tidak-hadir' : 'netral'}
                />
              </div>

              {butuhKonfirmasiRef && (
                <div className="rounded-lg border border-line bg-izin-soft p-3 text-xs text-ink">
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
                <div className="rounded-lg border border-line bg-tidak-hadir-soft p-3">
                  <p className="mb-2 text-xs font-semibold text-tidak-hadir">
                    Ditemukan {angka(pratinjau.total_galat)} baris galat. Perbaiki berkas CSV lalu
                    unggah ulang:
                  </p>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-line bg-surface">
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
                  <div className="overflow-x-auto rounded-lg border border-line bg-surface">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-line bg-subtle text-ink-subtle uppercase">
                        <tr>
                          {Object.keys(pratinjau.contoh[0]!).map((k) => (
                            <th key={k} scope="col" className="px-2.5 py-1.5 whitespace-nowrap">
                              {k}
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
                      <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
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
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-tidak-hadir" aria-hidden="true" />
            <p>
              Tindakan ini tidak dapat dibatalkan dan tercatat pada log aktivitas. Gunakan hanya
              setelah masa uji coba/pilot berakhir atau sebelum memasukkan data awal yang baru.
            </p>
          </div>
          <Button variant="danger" size="touch" onClick={() => setDialogHapusBuka(true)}>
            <Trash2 aria-hidden="true" />
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
          <p className="rounded-lg bg-tidak-hadir-soft px-3 py-2 text-xs text-tidak-hadir">
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
  nada?: 'netral' | 'hadir' | 'mendampingi' | 'tidak-hadir';
}) {
  const warna =
    nada === 'hadir'
      ? 'text-hadir'
      : nada === 'mendampingi'
        ? 'text-mendampingi'
        : nada === 'tidak-hadir'
          ? 'text-tidak-hadir'
          : 'text-ink';
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2">
      <p className="text-2xs font-semibold tracking-wider text-ink-subtle uppercase">{label}</p>
      <p className={cn('mt-0.5 text-lg font-bold tabular-nums', warna)}>{angka(nilai)}</p>
    </div>
  );
}
