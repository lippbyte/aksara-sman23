import { describe, expect, it } from 'vitest';
import {
  pekanBeririsanBulan,
  persentaseKehadiran,
  rataRata,
  skorKehadiranGuruMgmp,
  skorKehadiranMgmp,
  persentaseJamTerisi,
  rataRataPekanGuru,
  rataRataBulanan,
  berubahSejakKoreksi,
  totalJamHadir,
  totalJamWajib,
} from './rekap';

describe('persentaseKehadiran', () => {
  it('jam wajib 0 → 0 (tidak membagi dengan nol)', () => {
    expect(persentaseKehadiran(0, 0)).toBe(0);
    expect(persentaseKehadiran(5, 0)).toBe(0);
  });

  it('menghitung persentase dua desimal', () => {
    expect(persentaseKehadiran(10, 20)).toBe(50);
    expect(persentaseKehadiran(1, 3)).toBe(33.33);
    expect(persentaseKehadiran(2, 3)).toBe(66.67);
    expect(persentaseKehadiran(7, 8)).toBe(87.5);
  });

  it('dibatasi 100 bila jam hadir melebihi jam wajib', () => {
    expect(persentaseKehadiran(25, 20)).toBe(100);
    expect(persentaseKehadiran(20, 20)).toBe(100);
  });

  it('nilai negatif atau bukan angka → 0', () => {
    expect(persentaseKehadiran(-1, 20)).toBe(0);
    expect(persentaseKehadiran(5, -3)).toBe(0);
    expect(persentaseKehadiran(Number.NaN, 20)).toBe(0);
  });
});

describe('totalJamWajib', () => {
  const jadwal = [
    { hari: 1, total_jam_mengajar: 2 },
    { hari: 3, total_jam_mengajar: 3 },
    { hari: 5, total_jam_mengajar: 2 },
    { hari: 6, total_jam_mengajar: 4 }, // Sabtu
  ];

  it('hanya menjumlahkan hari efektif (Sabtu tidak ikut pada Senin–Jumat)', () => {
    expect(totalJamWajib(jadwal, [1, 2, 3, 4, 5])).toBe(7);
  });

  it('Sabtu ikut bila sekolah menetapkannya sebagai hari efektif', () => {
    expect(totalJamWajib(jadwal, [1, 2, 3, 4, 5, 6])).toBe(11);
  });

  it('tanpa jadwal → 0', () => {
    expect(totalJamWajib([], [1, 2, 3, 4, 5])).toBe(0);
  });
});

describe('totalJamHadir', () => {
  const rentang = { tanggal_mulai: '2026-01-12', tanggal_selesai: '2026-01-16' };

  it('menjumlahkan lama_jam Hadir dan Mendampingi, bukan Tidak Hadir', () => {
    const kehadiran = [
      { tanggal: '2026-01-12', lama_jam: 2, status_kehadiran: 'Hadir' as const },
      { tanggal: '2026-01-13', lama_jam: 3, status_kehadiran: 'Mendampingi' as const },
      { tanggal: '2026-01-14', lama_jam: 4, status_kehadiran: 'Tidak Hadir' as const },
    ];
    expect(totalJamHadir(kehadiran, rentang)).toBe(5);
  });

  it('batas rentang inklusif; di luar rentang (mis. Sabtu) tidak dihitung', () => {
    const kehadiran = [
      { tanggal: '2026-01-11', lama_jam: 1, status_kehadiran: 'Hadir' as const },
      { tanggal: '2026-01-12', lama_jam: 1, status_kehadiran: 'Hadir' as const },
      { tanggal: '2026-01-16', lama_jam: 2, status_kehadiran: 'Hadir' as const },
      { tanggal: '2026-01-17', lama_jam: 4, status_kehadiran: 'Hadir' as const },
    ];
    expect(totalJamHadir(kehadiran, rentang)).toBe(3);
  });
});

describe('rataRataBulanan', () => {
  const rekap = [
    { tanggal_mulai: '2026-06-22', tanggal_selesai: '2026-06-26', persentase_kehadiran: 80 },
    // Pekan lintas bulan: 29 Jun – 3 Jul.
    { tanggal_mulai: '2026-06-29', tanggal_selesai: '2026-07-03', persentase_kehadiran: 90 },
    { tanggal_mulai: '2026-07-06', tanggal_selesai: '2026-07-10', persentase_kehadiran: 100 },
  ];

  it('pekan lintas bulan dihitung di KEDUA bulan', () => {
    expect(rataRataBulanan(rekap, 6, 2026)).toBe(85); // (80 + 90) / 2
    expect(rataRataBulanan(rekap, 7, 2026)).toBe(95); // (90 + 100) / 2
  });

  it('pekan lintas tahun dihitung di Desember dan Januari', () => {
    const lintasTahun = [
      { tanggal_mulai: '2026-12-21', tanggal_selesai: '2026-12-25', persentase_kehadiran: 60 },
      { tanggal_mulai: '2026-12-28', tanggal_selesai: '2027-01-01', persentase_kehadiran: 70 },
      { tanggal_mulai: '2027-01-04', tanggal_selesai: '2027-01-08', persentase_kehadiran: 100 },
    ];
    expect(rataRataBulanan(lintasTahun, 12, 2026)).toBe(65);
    expect(rataRataBulanan(lintasTahun, 1, 2027)).toBe(85);
    expect(rataRataBulanan(lintasTahun, 1, 2026)).toBe(0);
  });

  it('tanpa pekan di bulan itu → 0', () => {
    expect(rataRataBulanan(rekap, 9, 2026)).toBe(0);
    expect(rataRataBulanan([], 6, 2026)).toBe(0);
  });

  it('hasil dibulatkan dua desimal', () => {
    const tiga = [
      { tanggal_mulai: '2026-03-02', tanggal_selesai: '2026-03-06', persentase_kehadiran: 100 },
      { tanggal_mulai: '2026-03-09', tanggal_selesai: '2026-03-13', persentase_kehadiran: 100 },
      { tanggal_mulai: '2026-03-16', tanggal_selesai: '2026-03-20', persentase_kehadiran: 95 },
    ];
    expect(rataRataBulanan(tiga, 3, 2026)).toBe(98.33);
  });

  it('pekan yang hanya menyentuh hari terakhir bulan tetap dihitung', () => {
    // Senin 31 Agu 2026 adalah satu-satunya hari pekan itu di bulan Agustus.
    const p = [
      { tanggal_mulai: '2026-08-31', tanggal_selesai: '2026-09-04', persentase_kehadiran: 50 },
    ];
    expect(pekanBeririsanBulan(p, 8, 2026)).toHaveLength(1);
    expect(pekanBeririsanBulan(p, 9, 2026)).toHaveLength(1);
    expect(pekanBeririsanBulan(p, 10, 2026)).toHaveLength(0);
  });

  it('menolak bulan di luar 1–12', () => {
    expect(() => rataRataBulanan(rekap, 13, 2026)).toThrow(RangeError);
  });
});

describe('skorKehadiranMgmp', () => {
  const pekan = (mulai: string, selesai: string, persen: number, wajib = 10) => ({
    tanggal_mulai: mulai,
    tanggal_selesai: selesai,
    persentase_kehadiran: persen,
    total_jam_wajib: wajib,
  });
  const guru = (rekap: ReturnType<typeof pekan>[], jam_wajib_jadwal = 10) => ({
    jam_wajib_jadwal,
    rekap,
  });

  it('rata-rata skor bulanan tiap guru, termasuk pekan lintas bulan', () => {
    const guruA = guru([
      pekan('2026-06-22', '2026-06-26', 80),
      pekan('2026-06-29', '2026-07-03', 90), // lintas bulan: ikut Juni dan Juli
    ]);
    const guruB = guru([pekan('2026-06-29', '2026-07-03', 70)]);
    // Juni: A = (80 + 90) / 2 = 85; B = 70 → (85 + 70) / 2 = 77,5
    expect(skorKehadiranMgmp([guruA, guruB], 6, 2026)).toBe(77.5);
    // Juli: A = 90; B = 70 → 80
    expect(skorKehadiranMgmp([guruA, guruB], 7, 2026)).toBe(80);
  });

  it('guru berjadwal tanpa catatan/rekap pada bulan itu dihitung 0', () => {
    const guruA = guru([pekan('2026-03-02', '2026-03-06', 100)]);
    const tanpaRekap = guru([]);
    const rekapBulanLain = guru([pekan('2026-04-06', '2026-04-10', 100)]);
    // (100 + 0 + 0) / 3
    expect(skorKehadiranMgmp([guruA, tanpaRekap, rekapBulanLain], 3, 2026)).toBe(33.33);
  });

  it('hanya guru tanpa jam wajib yang dikeluarkan', () => {
    const guruA = guru([pekan('2026-03-02', '2026-03-06', 80)]);
    const tanpaJadwal = guru([], 0);
    const rekapWajibNol = guru([pekan('2026-03-02', '2026-03-06', 0, 0)], 0);
    expect(skorKehadiranMgmp([guruA, tanpaJadwal, rekapWajibNol], 3, 2026)).toBe(80);
  });

  it('rekap pekan berjam wajib 0 diutamakan dari jadwal sekarang (guru dikeluarkan)', () => {
    // Jadwal baru ditambah setelah bulan itu; rekap bulan itu mencatat jam wajib 0.
    const jadwalBaru = guru([pekan('2026-03-02', '2026-03-06', 0, 0)], 12);
    const guruA = guru([pekan('2026-03-02', '2026-03-06', 90)]);
    expect(skorKehadiranMgmp([guruA, jadwalBaru], 3, 2026)).toBe(90);
  });

  it('pekan berjam wajib 0 dilewati bila guru punya pekan berjadwal lain', () => {
    const g = guru([
      pekan('2026-03-02', '2026-03-06', 100),
      pekan('2026-03-09', '2026-03-13', 0, 0),
    ]);
    expect(skorKehadiranGuruMgmp(g, 3, 2026)).toBe(100);
    expect(skorKehadiranGuruMgmp(guru([], 0), 3, 2026)).toBeNull();
    expect(skorKehadiranGuruMgmp(guru([], 4), 3, 2026)).toBe(0);
  });

  it('MGMP tanpa guru, atau semua guru tanpa jam wajib → 0', () => {
    expect(skorKehadiranMgmp([], 3, 2026)).toBe(0);
    expect(skorKehadiranMgmp([guru([], 0), guru([], 0)], 3, 2026)).toBe(0);
  });

  it('pembulatan hanya di hasil akhir', () => {
    const a = guru([pekan('2026-03-02', '2026-03-06', 100), pekan('2026-03-09', '2026-03-13', 95)]);
    const b = guru([pekan('2026-03-02', '2026-03-06', 66.67)]);
    // A = 97,5; B = 66,67 → 82,085 → 82,09
    expect(skorKehadiranMgmp([a, b], 3, 2026)).toBe(82.09);
  });
});

describe('rataRata', () => {
  it('kosong → 0; selain itu rata-rata dua desimal', () => {
    expect(rataRata([])).toBe(0);
    expect(rataRata([100, 50])).toBe(75);
    expect(rataRata([100, 100, 95])).toBe(98.33);
  });
});

describe('persentaseJamTerisi', () => {
  it('jadwal 0 → 0; dibatasi 100; dua desimal', () => {
    expect(persentaseJamTerisi(0, 0)).toBe(0);
    expect(persentaseJamTerisi(5, 0)).toBe(0);
    expect(persentaseJamTerisi(30, 48)).toBe(62.5);
    expect(persentaseJamTerisi(50, 48)).toBe(100);
    expect(persentaseJamTerisi(1, 3)).toBe(33.33);
  });
});

describe('rataRataPekanGuru', () => {
  it('rata-rata persentase guru berjadwal; guru tanpa jam wajib diabaikan', () => {
    expect(
      rataRataPekanGuru([
        { total_jam_wajib: 8, persentase_kehadiran: 100 },
        { total_jam_wajib: 8, persentase_kehadiran: 75 },
        { total_jam_wajib: 0, persentase_kehadiran: 0 },
      ]),
    ).toBe(87.5);
  });

  it('tanpa guru berjadwal → null', () => {
    expect(rataRataPekanGuru([])).toBeNull();
    expect(rataRataPekanGuru([{ total_jam_wajib: 0, persentase_kehadiran: 0 }])).toBeNull();
  });
});

describe('berubahSejakKoreksi', () => {
  const rekap = {
    tanggal_mulai: '2026-03-02',
    tanggal_selesai: '2026-03-06',
    dikoreksi_pada: '2026-03-10T03:00:00.000Z',
  };

  it('catatan pekan itu yang diubah setelah koreksi → true', () => {
    expect(
      berubahSejakKoreksi(rekap, [
        { tanggal: '2026-03-04', updated_at: '2026-03-10T03:00:01.000Z' },
      ]),
    ).toBe(true);
  });

  it('catatan sebelum/tepat saat koreksi, atau di luar pekan → false', () => {
    expect(
      berubahSejakKoreksi(rekap, [
        { tanggal: '2026-03-04', updated_at: '2026-03-10T03:00:00.000Z' },
        { tanggal: '2026-03-09', updated_at: '2026-03-11T00:00:00.000Z' },
        { tanggal: '2026-02-27', updated_at: '2026-03-11T00:00:00.000Z' },
      ]),
    ).toBe(false);
  });

  it('batas pekan inklusif', () => {
    const baru = '2026-03-11T00:00:00.000Z';
    expect(berubahSejakKoreksi(rekap, [{ tanggal: '2026-03-02', updated_at: baru }])).toBe(true);
    expect(berubahSejakKoreksi(rekap, [{ tanggal: '2026-03-06', updated_at: baru }])).toBe(true);
  });

  it('belum dikoreksi atau tanpa catatan → false', () => {
    expect(
      berubahSejakKoreksi({ ...rekap, dikoreksi_pada: null }, [
        { tanggal: '2026-03-04', updated_at: '2026-03-11T00:00:00.000Z' },
      ]),
    ).toBe(false);
    expect(berubahSejakKoreksi(rekap, [])).toBe(false);
  });
});

describe('pekan belum disinkron tidak dihitung 0', () => {
  it('rata-rata bulanan hanya dari pekan yang punya rekap', () => {
    // Maret: hanya pekan 2 Mar yang punya rekap (100%); pekan lain belum disinkron.
    const rekap = [
      { tanggal_mulai: '2026-03-02', tanggal_selesai: '2026-03-06', persentase_kehadiran: 100 },
    ];
    expect(rataRataBulanan(rekap, 3, 2026)).toBe(100);
    expect(
      skorKehadiranMgmp(
        [{ jam_wajib_jadwal: 10, rekap: rekap.map((r) => ({ ...r, total_jam_wajib: 10 })) }],
        3,
        2026,
      ),
    ).toBe(100);
  });
});
