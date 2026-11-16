import type { AuditLog, AuditQuery } from '@sms/shared';
import { keNumber } from '../../lib/konversi';
import { prisma } from '../../lib/prisma';
import { akhirHariWib, awalHariWib } from '../../lib/waktu';

export async function daftar(q: AuditQuery): Promise<{ rows: AuditLog[]; total: number }> {
  const where = {
    ...(q.module ? { module: q.module } : {}),
    ...(q.user_id ? { user_id: q.user_id } : {}),
    ...(q.tanggal_dari || q.tanggal_sampai
      ? {
          created_at: {
            ...(q.tanggal_dari ? { gte: awalHariWib(q.tanggal_dari) } : {}),
            ...(q.tanggal_sampai ? { lt: akhirHariWib(q.tanggal_sampai) } : {}),
          },
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return {
    total,
    rows: rows.map((r) => ({
      id: keNumber(r.id),
      user_id: keNumber(r.user_id),
      nama_pengguna: r.user?.name ?? null,
      module: r.module,
      aktivitas: r.aktivitas,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      description: r.description,
      ip_address: r.ip_address,
      created_at: r.created_at.toISOString(),
    })),
  };
}

export async function daftarPengguna(): Promise<{ id: number; name: string }[]> {
  const rows = await prisma.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((u) => ({ id: keNumber(u.id), name: u.name }));
}
