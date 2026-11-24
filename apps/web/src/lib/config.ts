/** Nama produk resmi; dapat disesuaikan lewat VITE_APP_NAME tanpa menyentuh komponen. */
export const APP_NAME: string =
  import.meta.env.VITE_APP_NAME || 'Aksara - Administrasi dan Sistem Informasi Sekolah';

/** `true` bila sekolah memasang nama sendiri lewat VITE_APP_NAME. */
export const APP_NAME_KUSTOM: boolean = Boolean(import.meta.env.VITE_APP_NAME);

export const APP_BRAND = 'AKSARA';
export const APP_SUBTITLE = 'Administrasi & Sistem Informasi Sekolah';
export const PENGEMBANG = 'EDILAKSO';
export const STATUS_PRODUK = 'In Development';
