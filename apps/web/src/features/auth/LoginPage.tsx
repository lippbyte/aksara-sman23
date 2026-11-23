import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@sms/shared';
import { CircleAlert } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import bgSekolah from '@/images/background.jpeg';
import logoSman23 from '@/images/logo.png';
import { pesanGalat } from '@/lib/api';
import { useAuth, useMasuk } from '@/lib/auth';
import { APP_NAME, PENGEMBANG, STATUS_PRODUK } from '@/lib/config';

export function LoginPage() {
  const { status } = useAuth();
  const masuk = useMasuk();
  const navigate = useNavigate();
  const lokasi = useLocation();
  const tujuan = (lokasi.state as { dari?: string } | null)?.dari ?? '/';

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (status === 'masuk') return <Navigate to={tujuan} replace />;

  const kirim = form.handleSubmit((nilai) => {
    masuk.mutate(nilai, { onSuccess: () => navigate(tujuan, { replace: true }) });
  });

  return (
    <div className="pola-latar-bawaan relative flex min-h-dvh flex-col overflow-hidden">
      {/* Lapisan gambar latar dekoratif terpisah agar kontras teks tetap tajam (DESIGN §11.3). */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <img
          src={bgSekolah}
          alt=""
          decoding="async"
          fetchPriority="low"
          className="h-full w-full object-cover opacity-[0.08]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-app/60 via-app/45 to-app/75" />
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="halaman-masuk w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="flex size-12 items-center justify-center overflow-hidden">
              <img
                src={logoSman23}
                alt="Logo SMAN 23"
                decoding="async"
                className="size-10 object-contain"
              />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-ink">{APP_NAME}</h1>
              <p className="mt-1 text-sm text-ink-muted">Masuk untuk melanjutkan.</p>
            </div>
          </div>

          <form
            onSubmit={kirim}
            noValidate
            className="kartu-kaca flex flex-col gap-4 rounded-xl border border-line p-5 shadow-xs"
          >
            {masuk.isError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg bg-tidak-hadir-soft px-3 py-2 text-sm text-tidak-hadir"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {pesanGalat(masuk.error)}
              </p>
            )}
            <Field label="Email" galat={form.formState.errors.email?.message}>
              <Input
                type="email"
                autoComplete="username"
                inputMode="email"
                autoFocus
                {...form.register('email')}
              />
            </Field>
            <Field label="Kata sandi" galat={form.formState.errors.password?.message}>
              <Input
                type="password"
                autoComplete="current-password"
                {...form.register('password')}
              />
            </Field>
            <Button type="submit" className="h-12 w-full sm:h-11" loading={masuk.isPending}>
              Masuk
            </Button>
          </form>
        </div>
      </main>
      <footer className="relative z-10 px-4 py-3 text-center text-xs text-ink-subtle">
        Dikembangkan oleh {PENGEMBANG} · {STATUS_PRODUK}
      </footer>
    </div>
  );
}
