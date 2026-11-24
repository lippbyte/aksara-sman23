import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@sms/shared';
import { WarningCircleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import {
  FotoLatar,
  LogoSekolah,
  URL_LATAR_MASUK_PUBLIK,
  URL_LOGO_PUBLIK,
} from '@/components/GambarSekolah';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, InputSandi } from '@/components/ui/input';
import { pesanGalat } from '@/lib/api';
import { useAuth, useMasuk } from '@/lib/auth';
import {
  APP_BRAND,
  APP_NAME,
  APP_NAME_KUSTOM,
  APP_SUBTITLE,
  PENGEMBANG,
  STATUS_PRODUK,
} from '@/lib/config';

/** Fokus otomatis hanya untuk tetikus: di ponsel papan ketik tidak langsung menutupi halaman. */
function pakaiTetikus(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
}

export function LoginPage() {
  const { status } = useAuth();
  const masuk = useMasuk();
  const navigate = useNavigate();
  const lokasi = useLocation();
  const tujuan = (lokasi.state as { dari?: string } | null)?.dari ?? '/';
  const [fokusAwal] = useState(pakaiTetikus);

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
      {/*
        Foto latar dari Pengaturan Sekolah (bila diunggah admin), samar di bawah scrim agar
        kontras teks aman. Tanpa unggahan, pola bawaan yang tampil (DESIGN §11.3).
      */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <FotoLatar url={URL_LATAR_MASUK_PUBLIK} className="opacity-12 grayscale" />
        <div className="absolute inset-0 bg-gradient-to-b from-app/50 via-app/30 to-app/65" />
      </div>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10">
        <div className="halaman-masuk w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-kartu border border-line bg-surface shadow-[var(--shadow-card)]">
              <LogoSekolah url={URL_LOGO_PUBLIK} ukuran={40} />
            </span>
            {/* Nama produk sekali saja (sebelumnya merek, nama panjang, dan subjudul mengulang
                hal yang sama). Nama kustom sekolah (VITE_APP_NAME) menggantikan subjudul. */}
            <div>
              <h1 translate="no" className="text-2xl font-bold tracking-tight text-ink">
                {APP_BRAND}
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                {APP_NAME_KUSTOM ? APP_NAME : APP_SUBTITLE}
              </p>
            </div>
          </div>

          <form
            onSubmit={kirim}
            noValidate
            aria-labelledby="judul-masuk"
            className="kartu-kaca flex flex-col gap-4 rounded-kartu border border-line p-5 shadow-[var(--shadow-popover)] sm:p-6"
          >
            <div className="border-b border-line-soft pb-3">
              <h2 id="judul-masuk" className="text-base font-semibold text-ink">
                Masuk ke ruang kerja
              </h2>
              <p className="mt-0.5 text-xs text-ink-subtle">Masuk untuk melanjutkan.</p>
            </div>

            {masuk.isError && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-kontrol bg-tidak-hadir-soft px-3 py-2 text-sm text-tidak-hadir"
              >
                <WarningCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {pesanGalat(masuk.error)}
              </p>
            )}
            <Field label="Email" galat={form.formState.errors.email?.message}>
              <Input
                type="email"
                autoComplete="username"
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                required
                autoFocus={fokusAwal}
                {...form.register('email')}
              />
            </Field>
            <Field label="Kata sandi" galat={form.formState.errors.password?.message}>
              <InputSandi
                autoComplete="current-password"
                enterKeyHint="done"
                required
                {...form.register('password')}
              />
            </Field>
            <Button
              type="submit"
              className="h-12 w-full pointer-fine:h-10"
              loading={masuk.isPending}
            >
              Masuk
            </Button>
          </form>
        </div>
      </main>
      <footer className="relative z-10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] text-center text-xs text-ink-subtle">
        Dikembangkan oleh <span translate="no">{PENGEMBANG}</span> · {STATUS_PRODUK}
      </footer>
    </div>
  );
}
