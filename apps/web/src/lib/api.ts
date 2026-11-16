const DASAR = '/api/v1';

export const PERISTIWA_SESI_BERAKHIR = 'sms:sesi-berakhir';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Galat per isian dari validasi server: `{ path, message }[]`. */
  get galatIsian(): { path: string; message: string }[] {
    if (!Array.isArray(this.details)) return [];
    return this.details.filter(
      (d): d is { path: string; message: string } =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as { path?: unknown }).path === 'string' &&
        typeof (d as { message?: unknown }).message === 'string',
    );
  }
}

type NilaiQuery = string | number | boolean | null | undefined;

/** Menyusun query string; nilai kosong dilewati. */
export function qs(params: Record<string, NilaiQuery>): string {
  const sp = new URLSearchParams();
  for (const [kunci, nilai] of Object.entries(params)) {
    if (nilai === undefined || nilai === null || nilai === '') continue;
    sp.set(kunci, String(nilai));
  }
  const teks = sp.toString();
  return teks ? `?${teks}` : '';
}

async function minta<T>(metode: string, path: string, body?: unknown): Promise<T> {
  const mengubah = metode !== 'GET';
  let res: Response;
  try {
    res = await fetch(`${DASAR}${path}`, {
      method: metode,
      credentials: 'same-origin',
      // Server mewajibkan Content-Type JSON untuk semua permintaan yang mengubah data.
      headers: mengubah
        ? { 'Content-Type': 'application/json', Accept: 'application/json' }
        : { Accept: 'application/json' },
      body: mengubah ? JSON.stringify(body ?? {}) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Tidak dapat terhubung ke server. Periksa koneksi Anda.',
    );
  }

  if (res.status === 204) return undefined as T;

  const isi: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const galat = (isi as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(PERISTIWA_SESI_BERAKHIR));
    }
    throw new ApiError(
      res.status,
      galat?.code ?? 'UNKNOWN',
      galat?.message ?? 'Terjadi kesalahan. Coba lagi.',
      galat?.details,
    );
  }
  return isi as T;
}

export const api = {
  get: <T>(path: string) => minta<T>('GET', path),
  post: <T>(path: string, body?: unknown) => minta<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => minta<T>('PUT', path, body),
  delete: <T = void>(path: string) => minta<T>('DELETE', path),
};

export function pesanGalat(err: unknown): string {
  return err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.';
}
