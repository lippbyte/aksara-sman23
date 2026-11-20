import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { isProduction, isTest } from './env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { batasSesi, sessionMiddleware, tutupSessionStore } from './lib/session';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { originCheck } from './middleware/originCheck';
import { auditRouter } from './modules/audit/routes';
import { buatAuthRouter } from './modules/auth/routes';
import { dashboardRouter } from './modules/dashboard/routes';
import { healthRouter } from './modules/health/routes';
import { kehadiranRouter } from './modules/kehadiran/routes';
import { kehadiranSiswaRouter } from './modules/kehadiran-siswa/routes';
import { laporanRouter } from './modules/laporan/routes';
import { penilaianKinerjaRouter } from './modules/penilaian-kinerja/routes';
import { penilaianMgmpRouter } from './modules/penilaian-mgmp/routes';
import { rekapRouter } from './modules/rekap/routes';
import { referensiRouter } from './modules/referensi/routes';
import { requireAuth } from './middleware/requireAuth';
import {
  latarDashboardHandler,
  latarMasukHandler,
  logoSekolahHandler,
  settingsRouter,
} from './modules/settings/routes';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  // Di produksi API berada di belakang reverse proxy (TLS berakhir di proxy).
  if (isProduction) app.set('trust proxy', 1);

  app.use(helmet());
  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        // Ringkas: tanpa header, cookie, atau body.
        serializers: {
          req: (req: { id: unknown; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
        },
      }),
    );
  }

  // Batas ukuran body: gambar latar & logo lebih longgar, selebihnya 100 KB.
  app.use('/api/v1/settings/sekolah/logo', express.json({ limit: '500kb' }));
  app.use('/api/v1/settings/sekolah/latar', express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '100kb' }));

  const v1 = Router();
  v1.use('/health', healthRouter);
  v1.get('/sekolah/logo', logoSekolahHandler);
  v1.get('/sekolah/latar/masuk', latarMasukHandler);

  // Mulai dari sini semua rute memakai sesi dan pemeriksaan asal permintaan.
  v1.use(sessionMiddleware, batasSesi, originCheck);
  v1.get('/sekolah/latar/dashboard', requireAuth, latarDashboardHandler);
  v1.use('/auth', buatAuthRouter());
  v1.use('/referensi', referensiRouter);
  v1.use('/dashboard', dashboardRouter);
  v1.use('/kehadiran', kehadiranRouter);
  v1.use('/kehadiran-siswa', kehadiranSiswaRouter);
  v1.use('/laporan', laporanRouter);
  v1.use('/rekap-kehadiran', rekapRouter);
  v1.use('/penilaian-kinerja', penilaianKinerjaRouter);
  v1.use('/penilaian-mgmp', penilaianMgmpRouter);
  v1.use('/settings', settingsRouter);
  v1.use('/audit-logs', auditRouter);

  app.use('/api/v1', v1);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

/** Menutup koneksi basis data dan penyimpanan sesi (dipakai saat server berhenti dan di test). */
export async function tutupSumberDaya(): Promise<void> {
  await Promise.allSettled([tutupSessionStore(), prisma.$disconnect()]);
}
