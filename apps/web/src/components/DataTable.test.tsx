import { describe, expect, it } from 'vitest';
import { kelompokkanBerurutan } from './DataTable';

describe('kelompokkanBerurutan', () => {
  it('menggabungkan baris berurutan dengan kunci sama dan menjaga urutan', () => {
    const hasil = kelompokkanBerurutan(
      [
        { t: '2026-11-24', j: 1 },
        { t: '2026-11-24', j: 3 },
        { t: '2026-11-23', j: 1 },
      ],
      (b) => b.t,
    );
    expect(hasil.map((g) => [g.kunci, g.isi.map((b) => b.j)])).toEqual([
      ['2026-11-24', [1, 3]],
      ['2026-11-23', [1]],
    ]);
  });

  it('daftar kosong menghasilkan tanpa kelompok', () => {
    expect(kelompokkanBerurutan([], String)).toEqual([]);
  });
});
