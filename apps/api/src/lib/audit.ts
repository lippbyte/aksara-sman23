import type { AuditModule } from '@sms/shared';
import type { Request } from 'express';
import type { Db } from './prisma';

export interface KonteksAudit {
  user_id: number | null;
  ip_address: string | null;
  user_agent: string | null;
}

export function konteksAudit(req: Request, userId?: number | null): KonteksAudit {
  const ua = req.headers['user-agent'];
  return {
    user_id: userId ?? req.user?.id ?? null,
    ip_address: req.ip ?? null,
    user_agent: typeof ua === 'string' ? ua.slice(0, 255) : null,
  };
}

export interface DataAudit {
  module: AuditModule;
  /** Kode aktivitas, mis. CREATE_KEHADIRAN. */
  aktivitas: string;
  entity_type?: string | null;
  entity_id?: number | bigint | string | null;
  /** Jangan pernah memuat kata sandi atau isi sesi. */
  description: string;
}

/** Mencatat log aktivitas. Berikan klien transaksi agar ikut satu transaksi dengan perubahannya. */
export async function catatAudit(db: Db, konteks: KonteksAudit, data: DataAudit): Promise<void> {
  await db.auditLog.create({
    data: {
      user_id: konteks.user_id,
      module: data.module,
      aktivitas: data.aktivitas,
      entity_type: data.entity_type ?? null,
      entity_id:
        data.entity_id === null || data.entity_id === undefined ? null : String(data.entity_id),
      description: data.description,
      ip_address: konteks.ip_address,
      user_agent: konteks.user_agent,
    },
  });
}
