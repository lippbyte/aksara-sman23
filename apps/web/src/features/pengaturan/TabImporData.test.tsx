import type { HasilPratinjauImpor } from '@sms/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pasangApiTiruan, tampilkanApp } from '@/test/bantuan';

afterEach(() => vi.unstubAllGlobals());

const PRATINJAU_SISWA: HasilPratinjauImpor = {
  jenis: 'siswa',
  ringkasan: { total: 2, baru: 2, diperbarui: 0, ditolak: 0 },
  referensi_baru: { kelas: ['X-1', 'XII-1'], mgmp: [] },
  galat: [],
  total_galat: 0,
  contoh: [
    {
      nis: '26001',
      nama_siswa: 'Siswa Uji Impor',
      jenis_kelamin: 'L',
      nama_kelas: 'X-1',
      wali_kelas: 'Ibu Wali Contoh',
      bk: 'Bpk. BK Contoh',
      status: 'aktif',
      aksi: 'baru',
    },
  ],
  dapat_disimpan: true,
};

describe('Impor Excel (.xlsx) dan CSV Admin', () => {
  it('unggah berkas .xlsx siswa menampilkan pratinjau Wali Kelas & BK lalu menyimpan setelah konfirmasi kelas baru', async () => {
    const muatanDikirim: Record<string, unknown>[] = [];
    pasangApiTiruan('admin', (url, init) => {
      if (url.includes('/settings/impor/siswa/pratinjau')) {
        muatanDikirim.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
        return { body: { data: PRATINJAU_SISWA } };
      }
      if (url.includes('/settings/impor/siswa/simpan')) {
        muatanDikirim.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
        return {
          body: {
            data: { jenis: 'siswa', baru: 2, diperbarui: 0, kelas_dibuat: 2, mgmp_dibuat: 0 },
          },
        };
      }
      return undefined;
    });

    tampilkanApp('/pengaturan/impor');

    const radioSiswa = await screen.findByRole('radio', { name: 'Siswa (X, XI, XII)' });
    fireEvent.click(radioSiswa);

    const input = screen.getByLabelText('Pilih berkas Excel atau CSV Siswa (X, XI, XII)');
    const berkas = new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'siswa-x-xi-xii.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(input, { target: { files: [berkas] } });

    expect(await screen.findByText('Ibu Wali Contoh')).toBeInTheDocument();
    expect(screen.getByText('Bpk. BK Contoh')).toBeInTheDocument();
    expect(muatanDikirim[0]).toMatchObject({ xlsx_base64: 'UEsDBA==' });

    const tombolSimpan = screen.getByRole('button', { name: 'Simpan hasil impor' });
    expect(tombolSimpan).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(tombolSimpan).toBeEnabled();
    fireEvent.click(tombolSimpan);

    await waitFor(() => expect(muatanDikirim).toHaveLength(2));
    expect(muatanDikirim[1]).toMatchObject({
      xlsx_base64: 'UEsDBA==',
      izinkan_buat_referensi: true,
    });
  });

  it('menampilkan keterangan kolom guru dan tautan templat .xlsx serta .csv', async () => {
    pasangApiTiruan('admin');
    tampilkanApp('/pengaturan/impor');

    expect(
      await screen.findByText(/Mengambil Nama Pengajar \(nama_guru\), Mata Pelajaran, dan Kode/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Unduh templat Excel (.xlsx)' })).toHaveAttribute(
      'href',
      '/api/v1/settings/impor/guru/templat?format=xlsx',
    );
  });
});
