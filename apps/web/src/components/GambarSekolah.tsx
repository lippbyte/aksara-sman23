import { GraduationCapIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/*
 * Gambar spesifik sekolah (logo, foto gedung) tidak pernah dibundel di repo (AGENTS §12,
 * PROJECT-CONTEXT §9). Semuanya berasal dari Pengaturan Sekolah lewat API, dengan cadangan netral.
 */

/** URL publik (tanpa sesi) untuk halaman masuk. API menjawab 404 bila admin belum mengunggah. */
export const URL_LOGO_PUBLIK = '/api/v1/sekolah/logo';
export const URL_LATAR_MASUK_PUBLIK = '/api/v1/sekolah/latar/masuk';

interface LogoSekolahProps {
  /** URL logo dari pengaturan; kosong = tampilkan tanda netral. */
  url: string | null | undefined;
  namaSekolah?: string | null;
  /** Ukuran sisi dalam px (dipakai untuk atribut width/height agar tidak terjadi CLS). */
  ukuran?: number;
  className?: string;
}

/** Logo sekolah dari pengaturan, atau tanda netral bila belum diunggah/gagal dimuat. */
export function LogoSekolah({ url, namaSekolah, ukuran = 36, className }: LogoSekolahProps) {
  const [gagal, setGagal] = useState(false);

  if (url && !gagal) {
    return (
      <img
        src={url}
        alt={namaSekolah ? `Logo ${namaSekolah}` : 'Logo sekolah'}
        width={ukuran}
        height={ukuran}
        decoding="async"
        onError={() => setGagal(true)}
        className={cn('shrink-0 rounded-kontrol object-contain', className)}
        style={{ width: ukuran, height: ukuran }}
      />
    );
  }

  // Tanda netral: dekoratif, karena nama aplikasi/sekolah selalu tertulis di sebelahnya.
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-kontrol bg-primary text-on-primary',
        className,
      )}
      style={{ width: ukuran, height: ukuran }}
    >
      <GraduationCapIcon weight="fill" style={{ width: ukuran * 0.58, height: ukuran * 0.58 }} />
    </span>
  );
}

/** Tambahkan parameter varian ukuran/format yang dilayani API (640/1280/1920 px, WebP/JPEG). */
export function urlVarian(dasar: string, lebar: 640 | 1280 | 1920, fmt: 'webp' | 'jpeg'): string {
  const pemisah = dasar.includes('?') ? '&' : '?';
  return `${dasar}${pemisah}w=${lebar}&fmt=${fmt}`;
}

interface FotoLatarProps {
  /** URL dasar gambar latar dari API; kosong = tidak dirender. */
  url: string | null | undefined;
  /** Kelas untuk elemen <img> (opasitas, filter, object-fit). */
  className?: string;
}

/**
 * Foto latar dekoratif responsif (srcset WebP + JPEG). Menghilang sendiri bila gambar belum
 * diatur (404) sehingga pola bawaan di belakangnya tetap terlihat (DESIGN §11.3).
 */
export function FotoLatar({ url, className }: FotoLatarProps) {
  const [gagal, setGagal] = useState(false);
  if (!url || gagal) return null;
  const set = (fmt: 'webp' | 'jpeg') =>
    ([640, 1280, 1920] as const).map((w) => `${urlVarian(url, w, fmt)} ${w}w`).join(', ');
  return (
    <picture>
      <source type="image/webp" srcSet={set('webp')} sizes="100vw" />
      <img
        src={urlVarian(url, 1280, 'jpeg')}
        srcSet={set('jpeg')}
        sizes="100vw"
        alt=""
        decoding="async"
        fetchPriority="low"
        onError={() => setGagal(true)}
        className={cn('h-full w-full object-cover', className)}
      />
    </picture>
  );
}
