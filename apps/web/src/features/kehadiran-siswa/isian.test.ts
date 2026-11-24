import { describe, expect, it } from 'vitest';
import { gabungIsian, hitungBerubah, type IsianSiswa, type PetaIsian } from './isian';

const hadir: IsianSiswa = { status: 'hadir', keterangan: '' };
const peta = (entri: [number, IsianSiswa][]): PetaIsian => new Map(entri);

describe('gabungIsian', () => {
  it('tanpa isian pengguna: hasil sama dengan data server baru', () => {
    const lama = peta([
      [1, hadir],
      [2, hadir],
    ]);
    const baru = peta([
      [1, hadir],
      [2, { status: 'izin', keterangan: '' }],
    ]);
    expect(gabungIsian(lama, lama, baru)).toEqual(baru);
  });

  it('baris yang diubah pengguna dipertahankan, baris lain mengikuti server', () => {
    const lama = peta([
      [1, hadir],
      [2, hadir],
    ]);
    const lokal = peta([
      [1, { status: 'alpa', keterangan: 'tanpa kabar' }],
      [2, hadir],
    ]);
    const baru = peta([
      [1, hadir],
      [2, { status: 'sakit', keterangan: '' }],
    ]);
    expect(gabungIsian(lokal, lama, baru)).toEqual(
      peta([
        [1, { status: 'alpa', keterangan: 'tanpa kabar' }],
        [2, { status: 'sakit', keterangan: '' }],
      ]),
    );
  });

  it('siswa baru dari server ikut; siswa yang tidak ada lagi dibuang', () => {
    const lama = peta([
      [1, hadir],
      [2, hadir],
    ]);
    const lokal = peta([
      [1, hadir],
      [2, { status: 'izin', keterangan: '' }],
    ]);
    const baru = peta([
      [1, hadir],
      [3, hadir],
    ]);
    expect(gabungIsian(lokal, lama, baru)).toEqual(
      peta([
        [1, hadir],
        [3, hadir],
      ]),
    );
  });
});

describe('hitungBerubah', () => {
  it('menghitung baris yang berbeda status atau keterangan', () => {
    const dasar = peta([
      [1, hadir],
      [2, hadir],
      [3, hadir],
    ]);
    const isian = peta([
      [1, hadir],
      [2, { status: 'sakit', keterangan: '' }],
      [3, { status: 'hadir', keterangan: 'catatan' }],
    ]);
    expect(hitungBerubah(isian, dasar)).toBe(2);
    expect(hitungBerubah(dasar, dasar)).toBe(0);
  });
});
