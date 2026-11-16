import type { Role } from '@sms/shared';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { usePengguna } from '@/lib/auth';

interface Panduan {
  judul: string;
  roles: readonly Role[];
  langkah: string[];
}

const PANDUAN: Panduan[] = [
  {
    judul: 'Mencatat kehadiran guru',
    roles: ['admin', 'manajemen_guru', 'sekretaris_kelas', 'guru_penilai'],
    langkah: [
      'Buka menu Absensi Guru, lalu pilih "Catat kehadiran".',
      'Pilih tanggal, jam ke, dan lama JP. Jam ke 0 adalah pembiasaan pagi.',
      'Pilih guru dan status: Hadir, Mendampingi, atau Tidak Hadir.',
      'Bila guru tidak hadir, tandai apakah ada tugas, lalu simpan.',
      'Satu guru tidak bisa dicatat di dua kelas pada jam yang sama.',
    ],
  },
  {
    judul: 'Mengisi absensi siswa',
    roles: ['admin', 'sekretaris_kelas'],
    langkah: [
      'Buka menu Absensi Siswa, pilih tanggal dan jam ke.',
      'Semua siswa aktif tampil dengan status Hadir.',
      'Ubah status siswa yang izin, sakit, atau alpa, lalu simpan.',
    ],
  },
  {
    judul: 'Membaca rekap kehadiran guru',
    roles: ['admin', 'manajemen_guru'],
    langkah: [
      'Buka menu Rekap Kehadiran Guru dan pilih pekan.',
      'Persentase = jam hadir dibagi jam wajib pada hari efektif, paling tinggi 100%.',
      'Gunakan "Sinkronkan rekap" untuk menghitung ulang satu pekan bagi semua guru aktif.',
    ],
  },
  {
    judul: 'Mengisi penilaian',
    roles: ['admin', 'manajemen_guru', 'guru_penilai', 'sekretaris_kelas'],
    langkah: [
      'Pilih bulan dan tahun pada menu Penilaian Kinerja atau Penilaian MGMP.',
      'Skor kehadiran diisi otomatis dari rekap pekan yang beririsan dengan bulan itu.',
      'Pengisian dibuka pada hari-hari terakhir bulan sesuai pengaturan sekolah.',
      'Aspek dan bobot mengikuti ketentuan sekolah.',
    ],
  },
  {
    judul: 'Mengelola data master',
    roles: ['admin'],
    langkah: [
      'Buka menu Pengaturan untuk mengelola sekolah, guru, kelas, siswa, jadwal, MGMP, dan akun.',
      'Akun sekretaris kelas wajib terikat ke satu kelas.',
      'Semua perubahan tercatat di Log Aktivitas.',
    ],
  },
];

export function BantuanPage() {
  const user = usePengguna();
  const panduan = PANDUAN.filter((p) => p.roles.includes(user.role));
  return (
    <div className="grid max-w-3xl gap-4">
      {panduan.map((p) => (
        <Card key={p.judul}>
          <CardHeader judul={p.judul} />
          <CardBody>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-muted">
              {p.langkah.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
