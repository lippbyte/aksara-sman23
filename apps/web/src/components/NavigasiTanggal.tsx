import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { addDays, format, isValid, parseISO } from 'date-fns';
import { useId } from 'react';
import { hariIni, tanggalPanjang } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface NavigasiTanggalProps {
  /** `YYYY-MM-DD` */
  nilai: string;
  onUbah: (tanggal: string) => void;
  label?: string;
  className?: string;
}

function geser(tanggal: string, hari: number): string {
  return format(addDays(parseISO(tanggal), hari), 'yyyy-MM-dd');
}

/**
 * Pilih tanggal dengan tombol hari sebelum/sesudah dan "Hari ini" di satu baris, dengan isian
 * tanggal bawaan browser di tengah (pemilih asli di ponsel, papan ketik di desktop).
 * Tombol tidak berpindah tempat saat tanggal berubah: "Hari ini" dinonaktifkan, bukan disembunyikan.
 */
export function NavigasiTanggal({
  nilai,
  onUbah,
  label = 'Tanggal',
  className,
}: NavigasiTanggalProps) {
  const id = useId();
  const hari = hariIni();
  const sah = /^\d{4}-\d{2}-\d{2}$/.test(nilai) && isValid(parseISO(nilai));
  const kemarin = sah ? geser(nilai, -1) : null;
  const besok = sah ? geser(nilai, 1) : null;

  // Tata letak mengikuti lebar komponen (container query). Sempit (< 22rem): "Hari ini" naik ke
  // baris label agar isian tanggal cukup lebar (±200 px di layar 360 px). Lebar: satu baris
  // ‹ tanggal › Hari ini. Tanpa dukungan container query: tata letak sempit (tetap utuh).
  return (
    <div className={cn('@container min-w-0', className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
        <label
          htmlFor={id}
          className="col-start-1 row-start-1 self-end text-xs font-medium text-ink-muted @min-[22rem]:col-span-2"
        >
          {label}
        </label>
        <div className="col-span-2 row-start-2 flex gap-1.5 @min-[22rem]:col-span-1">
          <Button
            variant="secondary"
            size="icon"
            disabled={!kemarin}
            aria-label={kemarin ? `Hari sebelumnya, ${tanggalPanjang(kemarin)}` : 'Hari sebelumnya'}
            onClick={() => kemarin && onUbah(kemarin)}
          >
            <CaretLeftIcon aria-hidden="true" />
          </Button>
          <Input
            id={id}
            name="tanggal"
            type="date"
            autoComplete="off"
            value={nilai}
            // Isian dikosongkan (tombol hapus bawaan) tidak mengubah tanggal yang sedang dipakai.
            onChange={(e) => e.target.value && onUbah(e.target.value)}
            className="min-w-0 flex-1"
          />
          <Button
            variant="secondary"
            size="icon"
            disabled={!besok}
            aria-label={besok ? `Hari berikutnya, ${tanggalPanjang(besok)}` : 'Hari berikutnya'}
            onClick={() => besok && onUbah(besok)}
          >
            <CaretRightIcon aria-hidden="true" />
          </Button>
        </div>
        <Button
          variant="secondary"
          className="col-start-2 row-start-1 shrink-0 px-3 @min-[22rem]:row-start-2"
          disabled={nilai === hari}
          onClick={() => onUbah(hari)}
        >
          Hari ini
        </Button>
      </div>
    </div>
  );
}
