import type { Response } from 'express';

export type NilaiSel = string | number | boolean | null | undefined;

export interface KolomCsv<T> {
  judul: string;
  nilai: (baris: T) => NilaiSel;
}

/** BOM UTF-8 agar Excel membaca huruf non-ASCII dengan benar (PROJECT-CONTEXT §7). */
export const BOM = '﻿';

/** Awalan yang membuat spreadsheet menafsirkan sel sebagai rumus (CSV/formula injection). */
const AWALAN_RUMUS = /^[=+\-@\t\r]/;

/**
 * Menetralkan sel teks yang diawali `= + - @` (juga tab dan CR) dengan apostrof,
 * sehingga ditampilkan sebagai teks, bukan dijalankan sebagai rumus (AGENTS §6).
 * Angka asli tidak diubah: -5 tetap angka.
 */
export function netralkanSel(nilai: NilaiSel): string {
  if (nilai === null || nilai === undefined) return '';
  if (typeof nilai === 'number') return Number.isFinite(nilai) ? String(nilai) : '';
  if (typeof nilai === 'boolean') return nilai ? 'Ya' : 'Tidak';
  return AWALAN_RUMUS.test(nilai) ? `'${nilai}` : nilai;
}

function kutip(teks: string): string {
  return /[",\r\n;]/.test(teks) ? `"${teks.replace(/"/g, '""')}"` : teks;
}

/** Menyusun CSV (UTF-8 + BOM, pemisah koma, baris CRLF). */
export function keCsv<T>(kolom: readonly KolomCsv<T>[], baris: readonly T[]): string {
  const garis = [
    kolom.map((k) => kutip(netralkanSel(k.judul))).join(','),
    ...baris.map((b) => kolom.map((k) => kutip(netralkanSel(k.nilai(b)))).join(',')),
  ];
  return `${BOM}${garis.join('\r\n')}\r\n`;
}

/** Mengirim CSV sebagai unduhan. Nama berkas hanya huruf, angka, titik, dan tanda hubung. */
export function kirimCsv(res: Response, namaBerkas: string, isi: string): void {
  const bersih = namaBerkas.replace(/[^A-Za-z0-9._-]/g, '-');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${bersih}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(isi);
}
