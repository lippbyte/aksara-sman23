import { createApp, tutupSumberDaya } from './app';
import { env } from './env';
import { logger } from './lib/logger';

const app = createApp();

const server = app.listen(env.API_PORT, () => {
  logger.info(`API berjalan di http://localhost:${env.API_PORT}/api/v1`);
});

let sedangBerhenti = false;
function shutdown(signal: string) {
  if (sedangBerhenti) return;
  sedangBerhenti = true;
  logger.info(`${signal} diterima, menutup server.`);
  server.close(() => {
    void tutupSumberDaya().finally(() => process.exit(0));
  });
  // Jangan menggantung bila ada koneksi yang tidak mau tutup.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
