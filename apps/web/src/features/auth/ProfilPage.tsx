import { zodResolver } from '@hookform/resolvers/zod';
import { ROLE_LABEL, ubahPasswordSchema, type UbahPasswordInput } from '@sms/shared';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, pesanGalat } from '@/lib/api';
import { usePengguna } from '@/lib/auth';

export function ProfilPage() {
  const user = usePengguna();
  const form = useForm<UbahPasswordInput>({
    resolver: zodResolver(ubahPasswordSchema),
    defaultValues: { password_lama: '', password_baru: '' },
  });

  const ubah = useMutation({
    mutationFn: (input: UbahPasswordInput) => api.put<void>('/auth/password', input),
    onSuccess: () => {
      toast.success('Kata sandi berhasil diubah.');
      form.reset();
    },
    onError: (err) => toast.error(pesanGalat(err)),
  });

  const galat = form.formState.errors;

  return (
    <div className="grid max-w-3xl gap-4">
      <Card>
        <CardHeader judul="Akun" />
        <CardBody>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-ink-subtle">Nama</dt>
            <dd className="text-ink">{user.name}</dd>
            <dt className="text-ink-subtle">Email</dt>
            <dd className="break-all text-ink">{user.email}</dd>
            <dt className="text-ink-subtle">Peran</dt>
            <dd className="text-ink">{ROLE_LABEL[user.role]}</dd>
            {user.nama_kelas && (
              <>
                <dt className="text-ink-subtle">Kelas</dt>
                <dd className="text-ink">{user.nama_kelas}</dd>
              </>
            )}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader judul="Ubah kata sandi" />
        <CardBody>
          <form
            onSubmit={form.handleSubmit((nilai) => ubah.mutate(nilai))}
            noValidate
            className="flex max-w-sm flex-col gap-4"
          >
            <Field label="Kata sandi lama" galat={galat.password_lama?.message}>
              <Input
                type="password"
                autoComplete="current-password"
                {...form.register('password_lama')}
              />
            </Field>
            <Field
              label="Kata sandi baru"
              bantuan="Minimal 8 karakter."
              galat={galat.password_baru?.message}
            >
              <Input
                type="password"
                autoComplete="new-password"
                {...form.register('password_baru')}
              />
            </Field>
            <div>
              <Button type="submit" size="touch" loading={ubah.isPending}>
                Simpan kata sandi
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
