import { describe, expect, it } from 'vitest';
import { BOBOT_DEFAULT, type BobotKinerja } from '../constants';
import { batasiSkor, bulatkan2 } from './angka';
import {
  apakahBobotValid,
  jendelaPenilaian,
  predikatKinerja,
  predikatMgmp,
  skorAkhirKinerja,
  skorAkhirMgmp,
  skorSiswaMgmp,
  kelasBerjadwalPerMgmp,
  ringkasanSkorSiswaMgmp,
} from './skor';

const BOBOT = BOBOT_DEFAULT.kinerja;

describe('skorSiswaMgmp', () => {
  it('belum ada kelas yang mengisi → 0', () => {
    expect(skorSiswaMgmp([])).toBe(0);
  });

  it('rata-rata kelas yang sudah mengisi, dua desimal di akhir', () => {
    expect(skorSiswaMgmp([80])).toBe(80);
    expect(skorSiswaMgmp([80, 90])).toBe(85);
    expect(skorSiswaMgmp([100, 100, 95])).toBe(98.33);
    expect(skorSiswaMgmp([66.67, 66.67, 66.66])).toBe(66.67);
  });

  it('nilai di luar 0–100 dibatasi sebelum dirata-rata', () => {
    expect(skorSiswaMgmp([120, 80])).toBe(90);
  });
});

describe('bulatkan2 dan batasiSkor', () => {
  it('membulatkan setengah ke atas tanpa galat biner', () => {
    expect(bulatkan2(1.005)).toBe(1.01);
    expect(bulatkan2(87.495)).toBe(87.5);
    expect(bulatkan2(33.3333)).toBe(33.33);
    expect(bulatkan2(66.6666)).toBe(66.67);
    expect(bulatkan2(100)).toBe(100);
  });

  it('nilai sangat kecil, NaN, dan tak hingga menjadi 0', () => {
    expect(bulatkan2(1e-7)).toBe(0);
    expect(bulatkan2(Number.NaN)).toBe(0);
    expect(bulatkan2(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('batasiSkor menjaga rentang 0–100', () => {
    expect(batasiSkor(-5)).toBe(0);
    expect(batasiSkor(120)).toBe(100);
    expect(batasiSkor(55.5)).toBe(55.5);
  });
});

describe('skorAkhirKinerja', () => {
  it('manajemen kosong → kehadiran 50% + administrasi 50%', () => {
    expect(skorAkhirKinerja({ skor_kehadiran: 80, skor_administrasi_avg: 90 }, BOBOT)).toBe(85);
    expect(
      skorAkhirKinerja(
        { skor_kehadiran: 80, skor_administrasi_avg: 90, skor_manajemen_avg: null },
        BOBOT,
      ),
    ).toBe(85);
  });

  it('manajemen 0 diperlakukan sama dengan kosong', () => {
    expect(
      skorAkhirKinerja(
        { skor_kehadiran: 80, skor_administrasi_avg: 90, skor_manajemen_avg: 0 },
        BOBOT,
      ),
    ).toBe(85);
  });

  it('manajemen ada → kehadiran 50% + administrasi 30% + manajemen 20%', () => {
    expect(
      skorAkhirKinerja(
        { skor_kehadiran: 80, skor_administrasi_avg: 90, skor_manajemen_avg: 70 },
        BOBOT,
      ),
    ).toBe(81); // 40 + 27 + 14
  });

  it('pembulatan hanya pada nilai akhir, dua desimal', () => {
    expect(skorAkhirKinerja({ skor_kehadiran: 87.55, skor_administrasi_avg: 91.33 }, BOBOT)).toBe(
      89.44,
    );
    expect(
      skorAkhirKinerja(
        { skor_kehadiran: 33.33, skor_administrasi_avg: 66.67, skor_manajemen_avg: 12.34 },
        BOBOT,
      ),
    ).toBe(39.13); // 16.665 + 20.001 + 2.468 = 39.134
  });

  it('memakai bobot dari pengaturan sekolah, bukan angka tetap', () => {
    const bobot: BobotKinerja = {
      dengan_manajemen: { kehadiran: 40, administrasi: 40, manajemen: 20 },
      tanpa_manajemen: { kehadiran: 70, administrasi: 30 },
    };
    expect(skorAkhirKinerja({ skor_kehadiran: 100, skor_administrasi_avg: 0 }, bobot)).toBe(70);
    expect(
      skorAkhirKinerja(
        { skor_kehadiran: 100, skor_administrasi_avg: 50, skor_manajemen_avg: 50 },
        bobot,
      ),
    ).toBe(70);
  });

  it('batas 0 dan 100', () => {
    expect(skorAkhirKinerja({ skor_kehadiran: 0, skor_administrasi_avg: 0 }, BOBOT)).toBe(0);
    expect(
      skorAkhirKinerja(
        { skor_kehadiran: 100, skor_administrasi_avg: 100, skor_manajemen_avg: 100 },
        BOBOT,
      ),
    ).toBe(100);
  });
});

describe('skorAkhirMgmp', () => {
  it('kehadiran 40% + siswa 30% + administrasi 30%', () => {
    expect(
      skorAkhirMgmp(
        { skor_kehadiran: 90, skor_siswa: 80, skor_administrasi: 70 },
        BOBOT_DEFAULT.mgmp,
      ),
    ).toBe(81); // 36 + 24 + 21
  });

  it('nilai yang belum diisi (0) tetap dihitung sebagai 0', () => {
    expect(
      skorAkhirMgmp(
        { skor_kehadiran: 95.5, skor_siswa: 0, skor_administrasi: 0 },
        BOBOT_DEFAULT.mgmp,
      ),
    ).toBe(38.2);
  });

  it('memakai bobot dari pengaturan sekolah', () => {
    expect(
      skorAkhirMgmp(
        { skor_kehadiran: 100, skor_siswa: 50, skor_administrasi: 0 },
        { kehadiran: 50, siswa: 25, administrasi: 25 },
      ),
    ).toBe(62.5);
  });
});

describe('predikatKinerja di ambang', () => {
  it.each([
    [100, 'Sangat Baik'],
    [91, 'Sangat Baik'],
    [90.99, 'Baik'],
    [76, 'Baik'],
    [75.99, 'Cukup'],
    [61, 'Cukup'],
    [60.99, 'Kurang'],
    [0, 'Kurang'],
  ])('%s → %s', (skor, predikat) => {
    expect(predikatKinerja(skor)).toBe(predikat);
  });
});

describe('predikatMgmp di ambang', () => {
  it.each([
    [100, 'Sangat Aktif'],
    [90, 'Sangat Aktif'],
    [89.99, 'Aktif'],
    [75, 'Aktif'],
    [74.99, 'Cukup Aktif'],
    [60, 'Cukup Aktif'],
    [59.99, 'Kurang Aktif'],
    [0, 'Kurang Aktif'],
  ])('%s → %s', (skor, predikat) => {
    expect(predikatMgmp(skor)).toBe(predikat);
  });
});

describe('apakahBobotValid', () => {
  it('jumlah harus tepat 100 dan tiap bobot 0–100', () => {
    expect(apakahBobotValid([50, 30, 20])).toBe(true);
    expect(apakahBobotValid([50, 50])).toBe(true);
    expect(apakahBobotValid([50, 30, 30])).toBe(false);
    expect(apakahBobotValid([120, -20])).toBe(false);
  });
});

describe('jendelaPenilaian', () => {
  it('3 hari terakhir bulan 30 hari: buka tanggal 28', () => {
    expect(jendelaPenilaian('2026-11-27', 11, 2026, 3)).toEqual({
      buka: '2026-11-28',
      tutup: '2026-11-30',
      terbuka: false,
    });
    expect(jendelaPenilaian('2026-11-28', 11, 2026, 3).terbuka).toBe(true);
    expect(jendelaPenilaian('2026-11-30', 11, 2026, 3).terbuka).toBe(true);
  });

  it('tertutup setelah bulan berganti', () => {
    expect(jendelaPenilaian('2026-12-01', 11, 2026, 3).terbuka).toBe(false);
  });

  it('Februari kabisat dan bukan kabisat', () => {
    expect(jendelaPenilaian('2028-02-27', 2, 2028, 3)).toMatchObject({
      buka: '2028-02-27',
      tutup: '2028-02-29',
      terbuka: true,
    });
    expect(jendelaPenilaian('2027-02-25', 2, 2027, 3)).toMatchObject({
      buka: '2027-02-26',
      tutup: '2027-02-28',
      terbuka: false,
    });
  });

  it('lebar jendela mengikuti pengaturan', () => {
    expect(jendelaPenilaian('2026-12-25', 12, 2026, 7)).toMatchObject({
      buka: '2026-12-25',
      terbuka: true,
    });
    expect(jendelaPenilaian('2026-12-30', 12, 2026, 1).terbuka).toBe(false);
    expect(jendelaPenilaian('2026-12-31', 12, 2026, 1).terbuka).toBe(true);
  });

  it('periode bulan lain tidak terbuka walau hari ini akhir bulan', () => {
    expect(jendelaPenilaian('2026-11-30', 10, 2026, 3).terbuka).toBe(false);
  });
});

describe('kelasBerjadwalPerMgmp', () => {
  it('kelas unik terurut per MGMP; MGMP tanpa jadwal tidak muncul', () => {
    const peta = kelasBerjadwalPerMgmp([
      { mgmp_id: 1, kelas_id: 3 },
      { mgmp_id: 1, kelas_id: 1 },
      { mgmp_id: 1, kelas_id: 3 },
      { mgmp_id: 2, kelas_id: 2 },
    ]);
    expect(peta.get(1)).toEqual([1, 3]);
    expect(peta.get(2)).toEqual([2]);
    expect(peta.get(9)).toBeUndefined();
    expect(kelasBerjadwalPerMgmp([]).size).toBe(0);
  });
});

describe('ringkasanSkorSiswaMgmp', () => {
  it('n dari m: hanya kelas berjadwal; rata-rata kelas yang mengisi', () => {
    expect(
      ringkasanSkorSiswaMgmp(
        [1, 2, 3],
        [
          { kelas_id: 1, skor: 80 },
          { kelas_id: 3, skor: 90 },
        ],
      ),
    ).toEqual({ skor_siswa: 85, kelas_terisi: 2, jumlah_kelas: 3 });
  });

  it('isian dari kelas tanpa jadwal MGMP itu diabaikan', () => {
    expect(
      ringkasanSkorSiswaMgmp(
        [1],
        [
          { kelas_id: 1, skor: 70 },
          { kelas_id: 5, skor: 10 },
        ],
      ),
    ).toEqual({ skor_siswa: 70, kelas_terisi: 1, jumlah_kelas: 1 });
  });

  it('MGMP tanpa jadwal sama sekali → 0 dari 0 kelas, skor 0', () => {
    expect(ringkasanSkorSiswaMgmp([], [{ kelas_id: 1, skor: 90 }])).toEqual({
      skor_siswa: 0,
      kelas_terisi: 0,
      jumlah_kelas: 0,
    });
  });

  it('belum ada kelas yang mengisi → skor 0', () => {
    expect(ringkasanSkorSiswaMgmp([1, 2], [])).toEqual({
      skor_siswa: 0,
      kelas_terisi: 0,
      jumlah_kelas: 2,
    });
  });
});
