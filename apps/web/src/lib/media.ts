import { useCallback, useSyncExternalStore } from 'react';

/**
 * Nilai `matchMedia` yang ikut berubah. Hanya untuk hal yang tidak bisa diselesaikan CSS,
 * mis. orientasi grafik Recharts (butuh ukuran piksel di JS). Tata letak biasa tetap memakai
 * container query / media query di CSS.
 */
export function useKueriMedia(kueri: string, bawaan = false): boolean {
  const langganan = useCallback(
    (ubah: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {};
      const mq = window.matchMedia(kueri);
      mq.addEventListener('change', ubah);
      return () => mq.removeEventListener('change', ubah);
    },
    [kueri],
  );
  return useSyncExternalStore(
    langganan,
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(kueri).matches : bawaan),
    () => bawaan,
  );
}
