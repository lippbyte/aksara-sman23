import type { KehadiranKelasHariIni, KelasJamKosong, TitikTren } from '@sms/shared';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { angka, labelPekan, persen } from '@/lib/format';
import { KotakTooltip, WARNA } from './ChartCard';

/** Hormati prefers-reduced-motion pada grafik (DESIGN §11.4). */
function useAnimasiGrafik(): boolean {
  const [aktif, setAktif] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const ubah = () => setAktif(!mq.matches);
    mq.addEventListener('change', ubah);
    return () => mq.removeEventListener('change', ubah);
  }, []);

  return aktif;
}

const SUMBU = {
  tick: { fill: WARNA.teksSumbu, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: WARNA.sumbu },
} as const;

/**
 * Kehadiran guru hari ini per kelas: bar bertumpuk JP per status. `horizontal` untuk layar
 * sempit: nama kelas di sumbu Y sehingga tidak bertabrakan (audit H5; sebelumnya `interval={0}`
 * memaksa semua label X tampil berdempet di ponsel).
 */
export function GrafikKehadiranKelas({
  data,
  horizontal = false,
}: {
  data: KehadiranKelasHariIni[];
  horizontal?: boolean;
}) {
  const animasi = useAnimasiGrafik();
  const seri = [
    { kunci: 'Hadir' as const, warna: WARNA.hadir },
    { kunci: 'Mendampingi' as const, warna: WARNA.mendampingi },
    { kunci: 'Tidak Hadir' as const, warna: WARNA.tidakHadir },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        // Grafik disembunyikan dari pembaca layar (tabel alternatif di ChartCard); lapisan
        // aksesibilitas Recharts membuatnya bisa difokus → axe aria-hidden-focus.
        accessibilityLayer={false}
        data={data}
        layout={horizontal ? 'vertical' : 'horizontal'}
        margin={
          horizontal
            ? { top: 0, right: 12, bottom: 0, left: 0 }
            : { top: 8, right: 8, bottom: 0, left: -16 }
        }
        barCategoryGap="30%"
      >
        {horizontal ? (
          <>
            <CartesianGrid horizontal={false} stroke={WARNA.garisBantu} />
            <XAxis type="number" allowDecimals={false} {...SUMBU} />
            <YAxis type="category" dataKey="nama_kelas" width={56} interval={0} {...SUMBU} />
          </>
        ) : (
          <>
            <CartesianGrid vertical={false} stroke={WARNA.garisBantu} />
            <XAxis dataKey="nama_kelas" {...SUMBU} interval={0} />
            <YAxis {...SUMBU} axisLine={false} allowDecimals={false} />
          </>
        )}
        <Tooltip
          cursor={{ fill: 'var(--bg-subtle)' }}
          content={(p: TooltipContentProps) =>
            p.active && p.payload.length > 0 ? (
              <KotakTooltip
                judul={`Kelas ${String(p.label)}`}
                baris={seri.map((s) => {
                  const baris = p.payload[0]?.payload as KehadiranKelasHariIni;
                  return { label: s.kunci, nilai: `${angka(baris[s.kunci])} JP`, warna: s.warna };
                })}
              />
            ) : null
          }
        />
        {seri.map((s, i) => (
          <Bar
            key={s.kunci}
            dataKey={s.kunci}
            stackId="status"
            fill={s.warna}
            maxBarSize={24}
            // Celah 2px warna permukaan antarsegmen; ujung data membulat 4px.
            stroke={WARNA.permukaan}
            strokeWidth={2}
            radius={i === seri.length - 1 ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0}
            isAnimationActive={animasi}
            animationDuration={320}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Tren persentase kehadiran guru per pekan (satu seri, sumbu Y 0–100). */
export function GrafikTren({ data }: { data: TitikTren[] }) {
  const animasi = useAnimasiGrafik();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        accessibilityLayer={false}
        data={data}
        margin={{ top: 12, right: 16, bottom: 0, left: -16 }}
      >
        <CartesianGrid vertical={false} stroke={WARNA.garisBantu} />
        <XAxis dataKey="minggu_ke" tickFormatter={(m: number) => `P${m}`} {...SUMBU} />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={(v: number) => `${v}%`}
          {...SUMBU}
          axisLine={false}
        />
        <Tooltip
          cursor={{ stroke: WARNA.sumbu, strokeWidth: 1 }}
          content={(p: TooltipContentProps) => {
            const t = p.payload[0]?.payload as TitikTren | undefined;
            if (!p.active || !t) return null;
            return (
              <KotakTooltip
                judul={labelPekan(t.minggu_ke, t.tanggal_mulai, t.tanggal_selesai)}
                baris={[
                  {
                    label: `${angka(t.jumlah_guru)} guru`,
                    nilai: t.persentase === null ? 'Belum ada rekap' : persen(t.persentase),
                    warna: WARNA.aksen,
                  },
                ]}
              />
            );
          }}
        />
        <Line
          type="linear"
          dataKey="persentase"
          stroke={WARNA.aksen}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls={false}
          dot={{ r: 4, fill: WARNA.aksen, stroke: WARNA.permukaan, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: WARNA.aksen, stroke: WARNA.permukaan, strokeWidth: 2 }}
          isAnimationActive={animasi}
          animationDuration={320}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Kelas dengan jam kosong terbanyak: bar horizontal, klik → dashboard kelas. */
export function GrafikJamKosong({
  data,
  onPilih,
}: {
  data: KelasJamKosong[];
  onPilih: (kelasId: number) => void;
}) {
  const animasi = useAnimasiGrafik();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        accessibilityLayer={false}
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 40, bottom: 0, left: 0 }}
      >
        <CartesianGrid horizontal={false} stroke={WARNA.garisBantu} />
        <XAxis type="number" allowDecimals={false} {...SUMBU} />
        <YAxis type="category" dataKey="nama_kelas" width={56} {...SUMBU} />
        <Tooltip
          cursor={{ fill: 'var(--bg-subtle)' }}
          content={(p: TooltipContentProps) => {
            const k = p.payload[0]?.payload as KelasJamKosong | undefined;
            if (!p.active || !k) return null;
            return (
              <KotakTooltip
                judul={`Kelas ${k.nama_kelas}`}
                baris={[
                  {
                    label: 'jam kosong',
                    nilai: `${angka(k.jp_kosong)} JP`,
                    warna: WARNA.tidakHadir,
                  },
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="jp_kosong"
          fill={WARNA.tidakHadir}
          maxBarSize={24}
          radius={[0, 4, 4, 0]}
          className="cursor-pointer"
          onClick={(d: { payload?: KelasJamKosong }) => d.payload && onPilih(d.payload.kelas_id)}
          isAnimationActive={animasi}
          animationDuration={320}
        >
          <LabelList
            dataKey="jp_kosong"
            position="right"
            formatter={(v: unknown) => `${angka(Number(v))} JP`}
            style={{ fill: 'var(--text-muted)', fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
