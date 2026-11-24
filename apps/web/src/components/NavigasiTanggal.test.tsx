import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { hariIni } from '@/lib/format';
import { NavigasiTanggal } from './NavigasiTanggal';

function Contoh({ awal }: { awal: string }) {
  const [nilai, setNilai] = useState(awal);
  return <NavigasiTanggal nilai={nilai} onUbah={setNilai} />;
}

describe('NavigasiTanggal', () => {
  it('tombol sebelum/sesudah menggeser satu hari, termasuk lintas bulan dan tahun', () => {
    render(<Contoh awal="2026-12-31" />);
    const isian = screen.getByLabelText('Tanggal');
    fireEvent.click(screen.getByRole('button', { name: /^Hari berikutnya/ }));
    expect(isian).toHaveValue('2027-01-01');
    fireEvent.click(screen.getByRole('button', { name: /^Hari sebelumnya/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Hari sebelumnya/ }));
    expect(isian).toHaveValue('2026-12-30');
  });

  it('label tombol panah menyebut tanggal tujuan', () => {
    render(<Contoh awal="2026-11-24" />);
    expect(
      screen.getByRole('button', { name: 'Hari sebelumnya, Senin, 23 Nov 2026' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hari berikutnya, Rabu, 25 Nov 2026' }),
    ).toBeInTheDocument();
  });

  it('"Hari ini" nonaktif pada hari ini dan kembali ke hari ini dari tanggal lain', () => {
    render(<Contoh awal="2026-01-05" />);
    const tombol = screen.getByRole('button', { name: 'Hari ini' });
    expect(tombol).toBeEnabled();
    fireEvent.click(tombol);
    expect(screen.getByLabelText('Tanggal')).toHaveValue(hariIni());
    expect(tombol).toBeDisabled();
  });

  it('mengosongkan isian tidak menghapus tanggal yang dipakai', () => {
    render(<Contoh awal="2026-11-24" />);
    const isian = screen.getByLabelText('Tanggal');
    fireEvent.change(isian, { target: { value: '' } });
    expect(isian).toHaveValue('2026-11-24');
  });
});
