import { describe, expect, it } from 'vitest';
import {
  hitungMingguKe,
  pekanBelumDisinkron,
  pekanDalamBulan,
  pekanDariTanggal,
  rentangBeririsan,
  rentangPekan,
  seninPekan,
  tahunPekan,
  type PengaturanPekan,
} from './pekan';

// 2026-01-12 adalah hari Senin.
const AWAL = '2026-01-12';
const SENIN_JUMAT: PengaturanPekan = { tanggal_awal_pekan: AWAL, hari_efektif: [1, 2, 3, 4, 5] };
const SENIN_SABTU: PengaturanPekan = { tanggal_awal_pekan: AWAL, hari_efektif: [1, 2, 3, 4, 5, 6] };

describe('hitungMingguKe', () => {
  it('tanggal awal adalah pekan 1', () => {
    expect(hitungMingguKe('2026-01-12', AWAL)).toBe(1);
  });

  it('Senin sampai Minggu berada di pekan yang sama', () => {
    expect(hitungMingguKe('2026-01-16', AWAL)).toBe(1); // Jumat
    expect(hitungMingguKe('2026-01-18', AWAL)).toBe(1); // Minggu
    expect(hitungMingguKe('2026-01-19', AWAL)).toBe(2); // Senin berikutnya
  });

  it('tanggal sebelum tanggal awal masuk pekan 1', () => {
    expect(hitungMingguKe('2026-01-11', AWAL)).toBe(1);
    expect(hitungMingguKe('2025-12-01', AWAL)).toBe(1);
  });

  it('tanggal awal yang bukan Senin dinormalkan ke Senin pekannya', () => {
    // Rabu 2026-01-14 → pekan 1 dimulai Senin 2026-01-12.
    expect(hitungMingguKe('2026-01-12', '2026-01-14')).toBe(1);
    expect(hitungMingguKe('2026-01-19', '2026-01-14')).toBe(2);
  });

  it('pekan lintas bulan dihitung satu pekan', () => {
    // Senin 29 Jun – Jumat 3 Jul 2026 = pekan 25.
    expect(hitungMingguKe('2026-06-29', AWAL)).toBe(25);
    expect(hitungMingguKe('2026-07-03', AWAL)).toBe(25);
  });

  it('nomor pekan berlanjut melewati pergantian tahun', () => {
    expect(hitungMingguKe('2026-12-28', AWAL)).toBe(51); // Senin
    expect(hitungMingguKe('2027-01-01', AWAL)).toBe(51); // Jumat, pekan yang sama
    expect(hitungMingguKe('2027-01-04', AWAL)).toBe(52);
  });

  it('menolak tanggal yang tidak valid', () => {
    expect(() => hitungMingguKe('2026-02-30', AWAL)).toThrow(RangeError);
    expect(() => hitungMingguKe('16/11/2026', AWAL)).toThrow(RangeError);
  });
});

describe('rentangPekan', () => {
  it('pekan 1: Senin sampai Jumat', () => {
    expect(rentangPekan(1, 2026, SENIN_JUMAT)).toEqual({
      minggu_ke: 1,
      tahun: 2026,
      tanggal_mulai: '2026-01-12',
      tanggal_selesai: '2026-01-16',
    });
  });

  it('mengikuti hari efektif terakhir dari pengaturan (Sabtu)', () => {
    expect(rentangPekan(1, 2026, SENIN_SABTU).tanggal_selesai).toBe('2026-01-17');
  });

  it('hari efektif tidak berurutan: tetap sampai hari efektif terakhir', () => {
    const s: PengaturanPekan = { tanggal_awal_pekan: AWAL, hari_efektif: [4, 1, 2] };
    expect(rentangPekan(1, 2026, s).tanggal_selesai).toBe('2026-01-15');
  });

  it('hari efektif kosong memakai default Senin–Jumat', () => {
    const s: PengaturanPekan = { tanggal_awal_pekan: AWAL, hari_efektif: [] };
    expect(rentangPekan(1, 2026, s).tanggal_selesai).toBe('2026-01-16');
  });

  it('pekan lintas bulan', () => {
    expect(rentangPekan(25, 2026, SENIN_JUMAT)).toMatchObject({
      tanggal_mulai: '2026-06-29',
      tanggal_selesai: '2026-07-03',
    });
  });

  it('pekan lintas tahun: tahun mengikuti Senin', () => {
    expect(rentangPekan(51, 2026, SENIN_JUMAT)).toEqual({
      minggu_ke: 51,
      tahun: 2026,
      tanggal_mulai: '2026-12-28',
      tanggal_selesai: '2027-01-01',
    });
    expect(rentangPekan(52, 2027, SENIN_JUMAT).tanggal_mulai).toBe('2027-01-04');
  });

  it('parameter tahun tidak diabaikan: pasangan yang tidak cocok ditolak', () => {
    expect(() => rentangPekan(51, 2027, SENIN_JUMAT)).toThrow(RangeError);
    expect(() => rentangPekan(1, 2025, SENIN_JUMAT)).toThrow(RangeError);
  });

  it('menolak minggu_ke di bawah 1 atau pecahan', () => {
    expect(() => rentangPekan(0, 2026, SENIN_JUMAT)).toThrow(RangeError);
    expect(() => rentangPekan(1.5, 2026, SENIN_JUMAT)).toThrow(RangeError);
  });
});

describe('seninPekan, tahunPekan, pekanDariTanggal', () => {
  it('seninPekan dan tahunPekan konsisten', () => {
    expect(seninPekan(52, AWAL)).toBe('2027-01-04');
    expect(tahunPekan(51, AWAL)).toBe(2026);
    expect(tahunPekan(52, AWAL)).toBe(2027);
  });

  it('pekanDariTanggal adalah kebalikan rentangPekan', () => {
    for (const tanggal of ['2026-01-12', '2026-07-01', '2026-12-31', '2027-01-01', '2027-03-10']) {
      const p = pekanDariTanggal(tanggal, SENIN_JUMAT);
      expect(hitungMingguKe(tanggal, AWAL)).toBe(p.minggu_ke);
      expect(rentangPekan(p.minggu_ke, p.tahun, SENIN_JUMAT)).toEqual(p);
      expect(p.tanggal_mulai <= tanggal).toBe(true);
    }
  });

  it('1 Januari 2027 (Jumat) termasuk pekan bertahun 2026', () => {
    expect(pekanDariTanggal('2027-01-01', SENIN_JUMAT)).toMatchObject({
      minggu_ke: 51,
      tahun: 2026,
    });
  });
});

describe('rentangBeririsan', () => {
  it('bersinggungan di satu hari dihitung beririsan', () => {
    expect(
      rentangBeririsan(
        { awal: '2026-06-29', akhir: '2026-07-03' },
        { awal: '2026-06-01', akhir: '2026-06-29' },
      ),
    ).toBe(true);
  });

  it('bersebelahan tanpa hari yang sama tidak beririsan', () => {
    expect(
      rentangBeririsan(
        { awal: '2026-06-29', akhir: '2026-07-03' },
        { awal: '2026-06-01', akhir: '2026-06-28' },
      ),
    ).toBe(false);
  });
});

describe('pekanDalamBulan', () => {
  const nomor = (b: number, t: number, s = SENIN_JUMAT) =>
    pekanDalamBulan(b, t, s).map((p) => p.minggu_ke);

  it('bulan pertama: tanggal sebelum awal masuk pekan 1', () => {
    expect(nomor(1, 2026)).toEqual([1, 2, 3]);
  });

  it('pekan lintas bulan ikut di kedua bulan', () => {
    // Pekan 12 = 30 Mar – 3 Apr.
    expect(nomor(3, 2026)).toEqual([8, 9, 10, 11, 12]);
    expect(nomor(4, 2026)).toEqual([12, 13, 14, 15, 16]);
  });

  it('pekan yang hari efektifnya di bulan sebelumnya tidak ikut', () => {
    // Senin 26 Jan – Jumat 30 Jan tidak menyentuh Februari.
    expect(nomor(2, 2026)).toEqual([4, 5, 6, 7]);
  });

  it('bulan sebelum tanggal awal pekan → kosong', () => {
    expect(pekanDalamBulan(12, 2025, SENIN_JUMAT)).toEqual([]);
  });

  it('pekan lintas tahun membawa tahun dari Senin-nya', () => {
    const s: PengaturanPekan = { tanggal_awal_pekan: '2026-12-28', hari_efektif: [1, 2, 3, 4, 5] };
    expect(pekanDalamBulan(1, 2027, s)[0]).toEqual({
      minggu_ke: 1,
      tahun: 2026,
      tanggal_mulai: '2026-12-28',
      tanggal_selesai: '2027-01-01',
    });
  });
});

describe('pekanBelumDisinkron', () => {
  const maret = pekanDalamBulan(3, 2026, SENIN_JUMAT);
  const tersimpan = [
    { tahun: 2026, minggu_ke: 8 },
    { tahun: 2026, minggu_ke: 10 },
  ];

  it('hanya pekan yang sudah selesai dan belum punya rekap', () => {
    // Jumat 27 Mar (akhir pekan 11) belum lewat.
    expect(pekanBelumDisinkron(maret, tersimpan, '2026-03-27').map((p) => p.minggu_ke)).toEqual([
      9,
    ]);
    expect(pekanBelumDisinkron(maret, tersimpan, '2026-03-28').map((p) => p.minggu_ke)).toEqual([
      9, 11,
    ]);
  });

  it('semua pekan tersinkron atau belum ada yang selesai → kosong', () => {
    const semua = maret.map((p) => ({ tahun: p.tahun, minggu_ke: p.minggu_ke }));
    expect(pekanBelumDisinkron(maret, semua, '2026-12-31')).toEqual([]);
    expect(pekanBelumDisinkron(maret, [], '2026-03-02')).toEqual([]);
  });

  it('tahun ikut dibandingkan', () => {
    expect(
      pekanBelumDisinkron(maret, [{ tahun: 2027, minggu_ke: 8 }], '2026-03-07').map(
        (p) => p.minggu_ke,
      ),
    ).toEqual([8]);
  });
});
