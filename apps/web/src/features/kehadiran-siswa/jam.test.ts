import { describe, expect, it } from 'vitest';
import { buatOpsiJadwal, petaInfoJam } from './jam';

describe('petaInfoJam', () => {
  it('menandai setiap jam yang dicakup slot jadwal', () => {
    const peta = petaInfoJam(
      [
        { jam_ke: 1, total_jam_mengajar: 2, mata_pelajaran: 'Fisika' },
        { jam_ke: 5, total_jam_mengajar: 1, mata_pelajaran: 'Kimia' },
      ],
      [],
    );
    expect(peta.get(1)).toEqual({ mapel: 'Fisika' });
    expect(peta.get(2)).toEqual({ mapel: 'Fisika' });
    expect(peta.get(3)).toBeUndefined();
    expect(peta.get(5)).toEqual({ mapel: 'Kimia' });
  });

  it('menandai jam tersimpan, termasuk jam tanpa jadwal', () => {
    const peta = petaInfoJam(
      [{ jam_ke: 1, total_jam_mengajar: 2, mata_pelajaran: 'Fisika' }],
      [2, 9],
    );
    expect(peta.get(1)).toEqual({ mapel: 'Fisika' });
    expect(peta.get(2)).toEqual({ mapel: 'Fisika', tersimpan: true });
    expect(peta.get(9)).toEqual({ tersimpan: true });
  });

  it('jadwal bentrok di jam yang sama menampilkan kedua mapel', () => {
    const peta = petaInfoJam(
      [
        { jam_ke: 3, total_jam_mengajar: 1, mata_pelajaran: 'Biologi' },
        { jam_ke: 3, total_jam_mengajar: 1, mata_pelajaran: 'Kimia' },
      ],
      [],
    );
    expect(peta.get(3)?.mapel).toBe('Biologi / Kimia');
  });

  it('lama 0 tetap dihitung satu jam (data tidak valid tidak menghilangkan jam)', () => {
    const peta = petaInfoJam([{ jam_ke: 0, total_jam_mengajar: 0, mata_pelajaran: 'Upacara' }], []);
    expect(peta.get(0)).toEqual({ mapel: 'Upacara' });
  });
});

describe('buatOpsiJadwal', () => {
  it('menyusun chip per jadwal pelajaran dan menyertakan jam tersimpan di luar jadwal', () => {
    const opsi = buatOpsiJadwal(
      [
        { jam_ke: 5, total_jam_mengajar: 1, mata_pelajaran: 'Kimia' },
        { jam_ke: 1, total_jam_mengajar: 2, mata_pelajaran: 'Fisika' },
      ],
      [2, 9],
    );
    expect(opsi).toEqual([
      { jam_ke: 1, jam_akhir: 2, judul: 'Fisika', subjudul: 'Jam 1–2', tersimpan: true },
      { jam_ke: 5, jam_akhir: 5, judul: 'Kimia', subjudul: 'Jam 5', tersimpan: false },
      {
        jam_ke: 9,
        jam_akhir: 9,
        judul: 'Jam ke-9',
        subjudul: 'Di luar jadwal',
        tersimpan: true,
      },
    ]);
  });
});
