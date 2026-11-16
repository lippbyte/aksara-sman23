import {
  AUDIT_MODULES,
  type AuditLog,
  type Halaman,
  type RefPengguna,
  type Respons,
} from '@sms/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DataTable, Pagination, type Kolom } from '@/components/DataTable';
import { FilterBar, FilterItem, useFilterUrl } from '@/components/FilterBar';
import { Input, Select } from '@/components/ui/input';
import { api, pesanGalat, qs } from '@/lib/api';
import { waktu } from '@/lib/format';

const KUNCI_FILTER = ['module', 'user_id', 'tanggal_dari', 'tanggal_sampai'] as const;

const kolom: Kolom<AuditLog>[] = [
  {
    id: 'waktu',
    judul: 'Waktu',
    sel: (l) => <span className="whitespace-nowrap tabular-nums">{waktu(l.created_at)}</span>,
  },
  { id: 'pengguna', judul: 'Pengguna', sel: (l) => l.nama_pengguna ?? '—' },
  { id: 'modul', judul: 'Modul', sel: (l) => l.module },
  {
    id: 'aktivitas',
    judul: 'Aktivitas',
    sel: (l) => <code className="text-xs text-ink-muted">{l.aktivitas}</code>,
  },
  { id: 'deskripsi', judul: 'Keterangan', utama: true, sel: (l) => l.description },
  { id: 'ip', judul: 'Alamat IP', sel: (l) => l.ip_address ?? '—' },
];

export function LogAktivitasPage() {
  const f = useFilterUrl(KUNCI_FILTER);
  const params = { ...f.nilai, page: f.page, pageSize: 20 };

  const log = useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.get<Halaman<AuditLog>>(`/audit-logs${qs(params)}`),
    placeholderData: keepPreviousData,
  });
  const pengguna = useQuery({
    queryKey: ['audit-logs', 'pengguna'],
    queryFn: async () => (await api.get<Respons<RefPengguna[]>>('/audit-logs/pengguna')).data,
    staleTime: 5 * 60_000,
  });

  return (
    <div>
      <FilterBar onReset={f.reset} adaFilter={f.adaFilter}>
        <FilterItem label="Modul">
          {(id) => (
            <Select
              id={id}
              value={f.nilai.module}
              onChange={(e) => f.atur('module', e.target.value)}
            >
              <option value="">Semua</option>
              {AUDIT_MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
        <FilterItem label="Pengguna">
          {(id) => (
            <Select
              id={id}
              value={f.nilai.user_id}
              onChange={(e) => f.atur('user_id', e.target.value)}
            >
              <option value="">Semua</option>
              {pengguna.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </FilterItem>
        <FilterItem label="Dari tanggal">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={f.nilai.tanggal_dari}
              max={f.nilai.tanggal_sampai || undefined}
              onChange={(e) => f.atur('tanggal_dari', e.target.value)}
            />
          )}
        </FilterItem>
        <FilterItem label="Sampai tanggal">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={f.nilai.tanggal_sampai}
              min={f.nilai.tanggal_dari || undefined}
              onChange={(e) => f.atur('tanggal_sampai', e.target.value)}
            />
          )}
        </FilterItem>
      </FilterBar>

      <DataTable
        kolom={kolom}
        data={log.data?.data}
        idBaris={(l) => l.id}
        memuat={log.isFetching}
        galat={log.isError ? pesanGalat(log.error) : null}
        onCobaLagi={() => void log.refetch()}
        keterangan="Log aktivitas"
        kosong={{
          pesan: f.adaFilter
            ? 'Tidak ada aktivitas yang cocok dengan filter.'
            : 'Belum ada aktivitas tercatat.',
        }}
      />
      {log.data && (
        <Pagination
          page={log.data.meta.page}
          pageSize={log.data.meta.pageSize}
          total={log.data.meta.total}
          onUbah={f.aturPage}
        />
      )}
    </div>
  );
}
