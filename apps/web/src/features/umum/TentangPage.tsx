import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { APP_NAME, PENGEMBANG, STATUS_PRODUK } from '@/lib/config';

export function TentangPage() {
  const { sekolah } = useAuth();
  return (
    <Card className="max-w-2xl">
      <CardHeader judul={APP_NAME} />
      <CardBody className="flex flex-col gap-4 text-sm text-ink-muted">
        <p>
          Aplikasi untuk mencatat dan merekap kehadiran guru di kelas dan kehadiran siswa, serta
          mendokumentasikan penilaian kinerja guru.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-ink-subtle">Status produk</dt>
          <dd className="text-ink">{STATUS_PRODUK}</dd>
          <dt className="text-ink-subtle">Pengembang</dt>
          <dd className="text-ink">Dikembangkan oleh {PENGEMBANG}</dd>
          {sekolah && (
            <>
              <dt className="text-ink-subtle">Sekolah</dt>
              <dd className="text-ink">{sekolah.nama_sekolah}</dd>
              <dt className="text-ink-subtle">Tahun ajaran</dt>
              <dd className="text-ink">{sekolah.tahun_ajaran}</dd>
            </>
          )}
        </dl>
        <p>
          Produk masih dalam pengembangan. Aspek dan bobot penilaian mengikuti ketentuan sekolah;
          aplikasi ini hanya mendokumentasikan.
        </p>
      </CardBody>
    </Card>
  );
}
