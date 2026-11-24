import type { JadwalHari, Kehadiran } from '@sms/shared';
import { describe, expect, it } from 'vitest';
import { labelRentang, susunJadwalHari } from './jadwalHari';

function slot(guru_id: number, jam_ke: number, total = 2, sudah_dicatat = false): JadwalHari {
  return {
    guru_id,
    kode_guru: `G0${guru_id}`,
    nama_guru: `Guru Contoh 0${guru_id}`,
    mata_pelajaran: 'Fisika',
    jam_ke,
    total_jam_mengajar: total,
    sudah_dicatat,
  };
}

function catatan(id: number, guru_id: number, jam_ke: number, lama_jam = 2): Kehadiran {
  return {
    id,
    tanggal: '2026-11-24',
    guru_id,
    kode_guru: `G0${guru_id}`,
    nama_guru: `Guru Contoh 0${guru_id}`,
    mata_pelajaran: 'Fisika',
    kelas_id: 7,
    nama_kelas: 'X-1',
    jam_ke,
    lama_jam,
    status_kehadiran: 'Hadir',
    status_tugas: 'Ada',
    keterangan: null,
    created_by: 1,
    nama_pembuat: 'Sekretaris Contoh',
    created_at: '2026-11-24T01:00:00.000Z',
  };
}

describe('susunJadwalHari', () => {
  it('slot tercatat bila catatan guru yang sama mencakup jam awal slot (aturan server)', () => {
    const baris = susunJadwalHari(
      [slot(3, 1), slot(4, 3), slot(5, 5)],
      [catatan(11, 3, 1), catatan(12, 4, 2, 3)],
    );
    expect(baris.map((b) => [b.nama_guru, b.tercatat, b.catatan?.id ?? null])).toEqual([
      ['Guru Contoh 03', true, 11],
      ['Guru Contoh 04', true, 12], // catatan 2–4 mencakup jam awal 3
      ['Guru Contoh 05', false, null],
    ]);
  });

  it('catatan guru lain di jam yang sama tidak dianggap mengisi slot', () => {
    const [b] = susunJadwalHari([slot(3, 1)], [catatan(11, 9, 1)]);
    expect(b?.tercatat).toBe(false);
  });

  it('catatan tanpa slot yang cocok tampil sebagai di luar jadwal, urut jam', () => {
    const baris = susunJadwalHari([slot(3, 5)], [catatan(21, 7, 2, 1), catatan(22, 3, 5)]);
    expect(baris.map((b) => [b.kunci, b.terjadwal, labelRentang(b)])).toEqual([
      ['catatan-21', false, '2'],
      ['jadwal-3-5', true, '5–6'],
    ]);
  });

  it('memakai sudah_dicatat dari server walau catatannya tidak ada di jurnal', () => {
    const [b] = susunJadwalHari([slot(3, 1, 2, true)], []);
    expect(b).toMatchObject({ tercatat: true, catatan: null });
  });

  it('jadwal kosong dan jurnal kosong menghasilkan daftar kosong', () => {
    expect(susunJadwalHari([], [])).toEqual([]);
  });
});
