import { describe, expect, it } from 'vitest';
import { BOM, keCsv, netralkanSel } from './csv';

describe('netralkanSel (formula injection)', () => {
  it.each([
    ['=1+1', "'=1+1"],
    ['+62 812', "'+62 812"],
    ['-SUM(A1)', "'-SUM(A1)"],
    ['@HYPERLINK("x")', '\'@HYPERLINK("x")'],
    ['\tTab', "'\tTab"],
    ['Nama biasa', 'Nama biasa'],
    ['A=B', 'A=B'],
  ])('%j → %j', (masuk, keluar) => {
    expect(netralkanSel(masuk)).toBe(keluar);
  });

  it('angka, kosong, dan boolean', () => {
    expect(netralkanSel(-5)).toBe('-5');
    expect(netralkanSel(87.5)).toBe('87.5');
    expect(netralkanSel(null)).toBe('');
    expect(netralkanSel(undefined)).toBe('');
    expect(netralkanSel(Number.NaN)).toBe('');
    expect(netralkanSel(true)).toBe('Ya');
  });
});

describe('keCsv', () => {
  const kolom = [
    { judul: 'Nama', nilai: (b: { nama: string; n: number }) => b.nama },
    { judul: 'Jumlah', nilai: (b: { nama: string; n: number }) => b.n },
  ];

  it('diawali BOM, baris CRLF, sel berkoma/kutip/baris baru dikutip', () => {
    const csv = keCsv(kolom, [
      { nama: 'Siswa, Contoh', n: 3 },
      { nama: 'Kata "kutip"', n: 0 },
      { nama: 'Dua\nbaris', n: 1 },
    ]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Nama,Jumlah',
      '"Siswa, Contoh",3',
      '"Kata ""kutip""",0',
      '"Dua\nbaris",1',
      '',
    ]);
  });

  it('sel rumus dinetralkan sebelum dikutip', () => {
    const csv = keCsv(kolom, [{ nama: '=HYPERLINK("http://contoh.test","x")', n: 1 }]);
    expect(csv).toContain('"\'=HYPERLINK(""http://contoh.test"",""x"")",1');
  });
});
