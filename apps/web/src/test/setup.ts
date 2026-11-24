import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  // Toast sonner disimpan di store tingkat modul: bersihkan agar tombol aksi (mis. "Urungkan")
  // dari uji sebelumnya tidak terbawa ke uji berikutnya.
  toast.dismiss();
});

// jsdom tidak menyediakan ResizeObserver (dipakai ResponsiveContainer Recharts).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

// jsdom tidak menggulir (window.scrollTo hanya mencetak "Not implemented"); cukup tanpa efek.
window.scrollTo = () => {};
