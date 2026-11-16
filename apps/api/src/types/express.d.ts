import type { PenggunaSesi } from '@sms/shared';

declare global {
  namespace Express {
    interface Request {
      /** Diisi oleh requireAuth. */
      user?: PenggunaSesi;
      /**
       * Diisi oleh scopeKelas: ID kelas untuk sekretaris_kelas,
       * null untuk peran yang tidak dibatasi kelas.
       */
      kelasScope?: number | null;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: number;
  }
}

export {};
