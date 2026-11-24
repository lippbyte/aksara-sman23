import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PilihJam } from './PilihJam';

const INFO = new Map([
  [1, { mapel: 'Fisika' }],
  [2, { mapel: 'Fisika', tersimpan: true }],
  [4, { tersimpan: true }],
]);

function Contoh() {
  const [nilai, setNilai] = useState(1);
  return (
    <PilihJam label="Jam ke-" opsi={[0, 1, 2, 3, 4]} nilai={nilai} onUbah={setNilai} info={INFO} />
  );
}

describe('PilihJam', () => {
  it('radio group dengan nama yang menyebut mapel dan status tersimpan', () => {
    render(<Contoh />);
    const grup = screen.getByRole('radiogroup', { name: 'Jam ke-' });
    expect(
      within(grup)
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label')),
    ).toEqual([
      'Jam ke-0',
      'Jam ke-1, Fisika',
      'Jam ke-2, Fisika, sudah tersimpan',
      'Jam ke-3',
      'Jam ke-4, sudah tersimpan',
    ]);
    expect(screen.getByRole('radio', { name: 'Jam ke-1, Fisika' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    // Hanya pilihan aktif yang masuk urutan Tab.
    expect(
      within(grup)
        .getAllByRole('radio')
        .map((r) => r.tabIndex),
    ).toEqual([-1, 0, -1, -1, -1]);
  });

  it('klik, panah, Home, dan End mengubah pilihan', () => {
    render(<Contoh />);
    const grup = screen.getByRole('radiogroup');
    const terpilih = () =>
      within(grup)
        .getAllByRole('radio')
        .find((r) => r.getAttribute('aria-checked') === 'true')
        ?.getAttribute('aria-label');

    fireEvent.click(screen.getByRole('radio', { name: 'Jam ke-3' }));
    expect(terpilih()).toBe('Jam ke-3');
    fireEvent.keyDown(grup, { key: 'ArrowRight' });
    expect(terpilih()).toBe('Jam ke-4, sudah tersimpan');
    fireEvent.keyDown(grup, { key: 'ArrowRight' });
    expect(terpilih()).toBe('Jam ke-0');
    fireEvent.keyDown(grup, { key: 'End' });
    expect(terpilih()).toBe('Jam ke-4, sudah tersimpan');
    fireEvent.keyDown(grup, { key: 'Home' });
    expect(terpilih()).toBe('Jam ke-0');
  });
});
