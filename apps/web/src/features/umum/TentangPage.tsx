import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { APP_NAME, PENGEMBANG, STATUS_PRODUK } from '@/lib/config';

export function TentangPage() {
  const { sekolah } = useAuth();
  return (
    <Card className="max-w-2xl">
      <CardHeader judul={APP_NAME} />
      <CardBody className="flex flex-col gap-4 text-sm leading-relaxed text-ink-muted">
        <p>
          Platform terintegrasi untuk mencatat dan merekap kehadiran guru serta siswa di kelas,
          mengelola jadwal mengajar, dan mendokumentasikan penilaian kinerja sekolah.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-ink-subtle">Status produk</dt>
          <dd className="font-medium text-ink">{STATUS_PRODUK}</dd>
          <dt className="text-ink-subtle">Pengembang</dt>
          <dd className="text-ink">Dikembangkan oleh {PENGEMBANG}</dd>
          {sekolah && (
            <>
              <dt className="text-ink-subtle">Sekolah</dt>
              <dd className="font-medium text-ink">{sekolah.nama_sekolah}</dd>
              <dt className="text-ink-subtle">Tahun ajaran</dt>
              <dd className="text-ink">{sekolah.tahun_ajaran}</dd>
            </>
          )}
        </dl>
        <p className="text-xs text-ink-subtle">
          Produk masih dalam pengembangan. Aspek dan bobot penilaian mengikuti ketentuan sekolah;
          aplikasi ini hanya mendokumentasikan.
        </p>
      </CardBody>
    </Card>
  );
}
