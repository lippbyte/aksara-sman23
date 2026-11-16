import { describe, expect, it } from 'vitest';
import { apakahJamBentrok, cariJamBentrok } from './bentrok';

// Catatan lama menempati jam ke-3 dan ke-4.
const LAMA = [{ id: 10, jam_ke: 3, lama_jam: 2 }];

describe('apakahJamBentrok', () => {
  it('tidak bentrok bila daftar kosong', () => {
    expect(apakahJamBentrok({ jam_ke: 1, lama_jam: 4 }, [])).toBe(false);
  });

  it('batas bawah: berakhir tepat sebelum catatan lama → tidak bentrok', () => {
    expect(apakahJamBentrok({ jam_ke: 1, lama_jam: 2 }, LAMA)).toBe(false); // jam 1–2
  });

  it('batas bawah: menyentuh jam pertama catatan lama → bentrok', () => {
    expect(apakahJamBentrok({ jam_ke: 2, lama_jam: 2 }, LAMA)).toBe(true); // jam 2–3
  });

  it('batas atas: mulai di jam terakhir catatan lama → bentrok', () => {
    expect(apakahJamBentrok({ jam_ke: 4, lama_jam: 1 }, LAMA)).toBe(true);
  });

  it('batas atas: mulai tepat setelah catatan lama → tidak bentrok', () => {
    expect(apakahJamBentrok({ jam_ke: 5, lama_jam: 1 }, LAMA)).toBe(false);
  });

  it('rentang baru melingkupi atau berada di dalam catatan lama → bentrok', () => {
    expect(apakahJamBentrok({ jam_ke: 2, lama_jam: 4 }, LAMA)).toBe(true); // jam 2–5
    expect(apakahJamBentrok({ jam_ke: 3, lama_jam: 1 }, LAMA)).toBe(true);
  });

  it('jam ke-0 (pembiasaan pagi) ikut diperiksa', () => {
    expect(apakahJamBentrok({ jam_ke: 0, lama_jam: 1 }, [{ id: 1, jam_ke: 0, lama_jam: 1 }])).toBe(
      true,
    );
    expect(apakahJamBentrok({ jam_ke: 0, lama_jam: 3 }, LAMA)).toBe(false); // jam 0–2
    expect(apakahJamBentrok({ jam_ke: 0, lama_jam: 4 }, LAMA)).toBe(true); // jam 0–3
  });

  it('saat ubah, catatan itu sendiri diabaikan', () => {
    expect(apakahJamBentrok({ id: 10, jam_ke: 3, lama_jam: 3 }, LAMA)).toBe(false);
    expect(apakahJamBentrok({ id: 11, jam_ke: 3, lama_jam: 3 }, LAMA)).toBe(true);
  });

  it('id bigint dan number yang sama dianggap catatan yang sama', () => {
    expect(apakahJamBentrok({ id: 10n, jam_ke: 4, lama_jam: 1 }, LAMA)).toBe(false);
  });

  it('catatan baru tanpa id tidak pernah dianggap dirinya sendiri', () => {
    expect(
      apakahJamBentrok({ jam_ke: 3, lama_jam: 1 }, [{ id: null, jam_ke: 3, lama_jam: 1 }]),
    ).toBe(true);
  });
});

describe('cariJamBentrok', () => {
  it('mengembalikan semua catatan yang beririsan', () => {
    const daftar = [
      { id: 1, jam_ke: 1, lama_jam: 2 },
      { id: 2, jam_ke: 3, lama_jam: 2 },
      { id: 3, jam_ke: 7, lama_jam: 1 },
    ];
    expect(cariJamBentrok({ jam_ke: 2, lama_jam: 2 }, daftar).map((c) => c.id)).toEqual([1, 2]);
  });
});
