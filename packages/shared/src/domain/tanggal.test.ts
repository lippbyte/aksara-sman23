import { describe, expect, it } from 'vitest';
import {
  apakahTanggalValid,
  hariDalamPekan,
  rentangBulan,
  selisihHari,
  seninDari,
  tambahHari,
  tanggalDiZona,
} from './tanggal';

describe('helper tanggal', () => {
  it('hariDalamPekan: 1 = Senin … 7 = Minggu', () => {
    expect(hariDalamPekan('2026-11-16')).toBe(1);
    expect(hariDalamPekan('2026-11-21')).toBe(6);
    expect(hariDalamPekan('2026-11-15')).toBe(7);
  });

  it('seninDari mengembalikan Senin pekan itu, termasuk untuk hari Minggu', () => {
    expect(seninDari('2026-11-15')).toBe('2026-11-09');
    expect(seninDari('2026-11-16')).toBe('2026-11-16');
    expect(seninDari('2027-01-01')).toBe('2026-12-28');
  });

  it('tambahHari dan selisihHari melewati batas bulan dan tahun', () => {
    expect(tambahHari('2026-12-30', 3)).toBe('2027-01-02');
    expect(tambahHari('2028-02-28', 1)).toBe('2028-02-29');
    expect(selisihHari('2026-12-28', '2027-01-04')).toBe(7);
    expect(selisihHari('2026-01-12', '2026-01-05')).toBe(-7);
  });

  it('rentangBulan mengenali tahun kabisat', () => {
    expect(rentangBulan(2, 2028)).toEqual({ awal: '2028-02-01', akhir: '2028-02-29' });
    expect(rentangBulan(2, 2027).akhir).toBe('2027-02-28');
    expect(rentangBulan(12, 2026)).toEqual({ awal: '2026-12-01', akhir: '2026-12-31' });
  });

  it('apakahTanggalValid menolak format dan tanggal yang tidak ada', () => {
    expect(apakahTanggalValid('2026-11-16')).toBe(true);
    expect(apakahTanggalValid('2026-02-30')).toBe(false);
    expect(apakahTanggalValid('2026-13-01')).toBe(false);
    expect(apakahTanggalValid('16-11-2026')).toBe(false);
  });

  it('tanggalDiZona memakai Asia/Jakarta (UTC+7), bukan zona mesin', () => {
    // 17.30 UTC = 00.30 WIB hari berikutnya.
    expect(tanggalDiZona(new Date('2026-11-15T17:30:00Z'))).toBe('2026-11-16');
    expect(tanggalDiZona(new Date('2026-11-15T16:59:59Z'))).toBe('2026-11-15');
  });
});
