import { latarQuerySchema, type JenisLatar } from '@sms/shared';
import { Router, type RequestHandler } from 'express';
import { DIR_UNGGAH } from '../../env';
import { badRequest, notFound } from '../../lib/errors';
import { requireAuth, requireRole } from '../../middleware/requireAuth';
import * as controller from './controller';
import * as service from './service';

/** Semua rute Pengaturan hanya untuk admin (PROJECT-CONTEXT §4). */
export const settingsRouter = Router();
settingsRouter.use(requireAuth, requireRole('admin'));

settingsRouter.get('/sekolah', controller.sekolah.ambil);
settingsRouter.put('/sekolah', controller.sekolah.simpan);
settingsRouter.put('/sekolah/logo', controller.sekolah.simpanLogo);
settingsRouter.delete('/sekolah/logo', controller.sekolah.hapusLogo);
settingsRouter.put('/sekolah/latar/:jenis', controller.sekolah.simpanLatar);
settingsRouter.delete('/sekolah/latar/:jenis', controller.sekolah.hapusLatar);

interface HandlerCrud {
  daftar: RequestHandler;
  buat: RequestHandler;
  ubah: RequestHandler;
  hapus: RequestHandler;
}

function pasangCrud(path: string, c: HandlerCrud) {
  settingsRouter.get(path, c.daftar);
  settingsRouter.post(path, c.buat);
  settingsRouter.put(`${path}/:id`, c.ubah);
  settingsRouter.delete(`${path}/:id`, c.hapus);
}

pasangCrud('/guru', controller.guru);
pasangCrud('/kelas', controller.kelas);
pasangCrud('/siswa', controller.siswa);
pasangCrud('/jadwal', controller.jadwal);
pasangCrud('/mgmp', controller.mgmp);
pasangCrud('/users', controller.users);
settingsRouter.post('/users/:id/reset-password', controller.users.resetPassword);

/** Logo sekolah: publik (dipakai halaman login), hanya berkas yang tercatat di pengaturan. */
export const logoSekolahHandler: RequestHandler = async (_req, res) => {
  const nama = await service.sekolah.berkasLogo();
  if (!nama) throw notFound('Logo belum diatur.');
  res.sendFile(
    nama,
    { root: DIR_UNGGAH, headers: { 'Cache-Control': 'private, max-age=3600' } },
    (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Logo tidak ditemukan.' } });
      }
    },
  );
};

function buatHandlerLatar(jenis: JenisLatar, cacheControl: string): RequestHandler {
  return async (req, res) => {
    const parsed = latarQuerySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Parameter ukuran atau format gambar tidak valid.');
    const nama = await service.sekolah.berkasLatar(jenis, parsed.data.w, parsed.data.fmt);
    if (!nama) throw notFound('Gambar latar belum diatur.');
    res.sendFile(nama, { root: DIR_UNGGAH, headers: { 'Cache-Control': cacheControl } }, (err) => {
      if (err && !res.headersSent) {
        res
          .status(404)
          .json({ error: { code: 'NOT_FOUND', message: 'Gambar latar tidak ditemukan.' } });
      }
    });
  };
}

/** Gambar latar halaman masuk: disajikan tanpa login (DESIGN §11.3, Fase 12). */
export const latarMasukHandler = buatHandlerLatar('masuk', 'public, max-age=3600');

/** Gambar latar dashboard: wajib sesi login (dipasang setelah requireAuth). */
export const latarDashboardHandler = buatHandlerLatar('dashboard', 'private, max-age=3600');
