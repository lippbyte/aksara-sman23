import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp, tutupSumberDaya } from '../../app';
import { prisma } from '../../lib/prisma';
import { emailPeran, Klien, masukSebagai, ORIGIN } from '../../test/bantuan';
import { PASSWORD_UJI } from '../../test/globalSetup';
import { hashPassword } from './service';

const app = createApp();
afterAll(() => tutupSumberDaya());

const LOGIN = '/api/v1/auth/login';

describe('POST /auth/login', () => {
  it('kredensial benar → 200, cookie httpOnly SameSite=Lax, tanpa kata sandi di respons', async () => {
    const klien = new Klien(app);
    const res = await klien.masuk(emailPeran('admin'));
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ email: emailPeran('admin'), role: 'admin' });
    expect(JSON.stringify(res.body)).not.toContain('argon2');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.body.data.sekolah.nama_sekolah).toContain('Contoh');

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain('sms.sid=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('kata sandi salah → 401 dengan pesan yang sama seperti email tidak terdaftar', async () => {
    const salah = await new Klien(app).masuk(emailPeran('guru_penilai'), 'kata-sandi-salah');
    const tidakAda = await new Klien(app).masuk('tidak-ada@contoh.test', 'kata-sandi-salah');
    expect(salah.status).toBe(401);
    expect(tidakAda.status).toBe(401);
    expect(salah.body.error).toEqual(tidakAda.body.error);
    expect(salah.headers['set-cookie']).toBeUndefined();
  });

  it('body tidak valid → 400', async () => {
    const res = await new Klien(app).post(LOGIN, { email: 'bukan-email', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('email tidak peka huruf besar dan spasi', async () => {
    const res = await new Klien(app).masuk(`  ${emailPeran('admin').toUpperCase()} `);
    expect(res.status).toBe(200);
  });

  it('ID sesi diganti saat login (regenerasi)', async () => {
    const klien = new Klien(app);
    const a = await klien.masuk(emailPeran('manajemen_guru'));
    const b = await klien.masuk(emailPeran('manajemen_guru'));
    const sid = (r: typeof a) => /sms\.sid=([^;]+)/.exec(String(r.headers['set-cookie']))?.[1];
    expect(sid(a)).toBeTruthy();
    expect(sid(b)).toBeTruthy();
    expect(sid(a)).not.toBe(sid(b));
  });

  it('akun nonaktif tidak bisa masuk', async () => {
    const email = 'nonaktif.uji@contoh.test';
    await prisma.user.upsert({
      where: { email },
      update: { is_active: false },
      create: {
        name: 'Akun Nonaktif Contoh',
        email,
        password: await hashPassword(PASSWORD_UJI),
        role: 'guru_penilai',
        is_active: false,
      },
    });
    const res = await new Klien(app).masuk(email);
    expect(res.status).toBe(401);
  });

  it('login dan kegagalan login tercatat di log aktivitas tanpa kata sandi', async () => {
    await new Klien(app).masuk(emailPeran('admin'));
    await new Klien(app).masuk('audit.gagal@contoh.test', 'rahasia-yang-salah');
    const log = await prisma.auditLog.findMany({ where: { module: 'Auth' } });
    expect(log.some((l) => l.aktivitas === 'LOGIN' && l.user_id !== null)).toBe(true);
    const gagal = log.find(
      (l) => l.aktivitas === 'LOGIN_GAGAL' && l.description.includes('audit.gagal@contoh.test'),
    );
    expect(gagal).toBeDefined();
    const isi = log.map((l) => l.description).join(' ');
    expect(isi).not.toContain('rahasia-yang-salah');
    expect(isi).not.toContain(PASSWORD_UJI);
  });
});

describe('batas percobaan login', () => {
  it('percobaan gagal ke-6 untuk email yang sama → 429; email lain tidak terpengaruh', async () => {
    const appBaru = createApp();
    const email = 'dibatasi@contoh.test';
    for (let i = 0; i < 5; i++) {
      const res = await new Klien(appBaru).masuk(email, 'salah');
      expect(res.status).toBe(401);
    }
    const ke6 = await new Klien(appBaru).masuk(email, 'salah');
    expect(ke6.status).toBe(429);
    expect(ke6.body.error.code).toBe('TOO_MANY_REQUESTS');

    const lain = await new Klien(appBaru).masuk(emailPeran('admin'));
    expect(lain.status).toBe(200);
  });

  it('login yang berhasil tidak menghabiskan jatah', async () => {
    const appBaru = createApp();
    for (let i = 0; i < 7; i++) {
      const res = await new Klien(appBaru).masuk(emailPeran('admin'));
      expect(res.status).toBe(200);
    }
  });
});

describe('perlindungan CSRF (originCheck)', () => {
  it('tanpa header Origin → 403', async () => {
    const res = await request(app)
      .post(LOGIN)
      .send({ email: emailPeran('admin'), password: PASSWORD_UJI });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ORIGIN_MISMATCH');
  });

  it('Origin situs lain → 403', async () => {
    const res = await request(app)
      .post(LOGIN)
      .set('Origin', 'https://situs-lain.test')
      .send({ email: emailPeran('admin'), password: PASSWORD_UJI });
    expect(res.status).toBe(403);
  });

  it('Content-Type form → 415', async () => {
    const res = await request(app)
      .post(LOGIN)
      .set('Origin', ORIGIN)
      .type('form')
      .send({ email: emailPeran('admin'), password: PASSWORD_UJI });
    expect(res.status).toBe(415);
  });
});

describe('GET /auth/me dan POST /auth/logout', () => {
  it('tanpa sesi → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('sekretaris: me memuat kelasnya', async () => {
    const klien = await masukSebagai(app, 'sekretaris_kelas');
    const res = await klien.get('/api/v1/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('sekretaris_kelas');
    expect(res.body.data.user.nama_kelas).toBe('X-1');
    expect(typeof res.body.data.user.kelas_id).toBe('number');
  });

  it('setelah logout sesi tidak berlaku lagi', async () => {
    const klien = await masukSebagai(app, 'admin');
    expect((await klien.post('/api/v1/auth/logout')).status).toBe(204);
    expect((await klien.get('/api/v1/auth/me')).status).toBe(401);
    const log = await prisma.auditLog.findFirst({ where: { aktivitas: 'LOGOUT' } });
    expect(log).not.toBeNull();
  });

  it('akun yang dinonaktifkan langsung kehilangan akses', async () => {
    const email = 'sementara.uji@contoh.test';
    await prisma.user.upsert({
      where: { email },
      update: { is_active: true },
      create: {
        name: 'Akun Sementara Contoh',
        email,
        password: await hashPassword(PASSWORD_UJI),
        role: 'guru_penilai',
      },
    });
    const klien = new Klien(app);
    expect((await klien.masuk(email)).status).toBe(200);
    await prisma.user.update({ where: { email }, data: { is_active: false } });
    expect((await klien.get('/api/v1/auth/me')).status).toBe(401);
  });
});

describe('PUT /auth/password', () => {
  const email = 'ganti.sandi@contoh.test';

  it('ubah kata sandi sendiri: lama salah → 422, benar → 204, lalu login dengan yang baru', async () => {
    await prisma.user.upsert({
      where: { email },
      update: { password: await hashPassword(PASSWORD_UJI), is_active: true },
      create: {
        name: 'Akun Ganti Sandi Contoh',
        email,
        password: await hashPassword(PASSWORD_UJI),
        role: 'guru_penilai',
      },
    });
    const klien = new Klien(app);
    await klien.masuk(email);

    const salah = await klien.put('/api/v1/auth/password', {
      password_lama: 'bukan-yang-lama',
      password_baru: 'kata-sandi-baru-456',
    });
    expect(salah.status).toBe(422);

    const pendek = await klien.put('/api/v1/auth/password', {
      password_lama: PASSWORD_UJI,
      password_baru: 'pendek',
    });
    expect(pendek.status).toBe(400);

    const benar = await klien.put('/api/v1/auth/password', {
      password_lama: PASSWORD_UJI,
      password_baru: 'kata-sandi-baru-456',
    });
    expect(benar.status).toBe(204);

    expect((await new Klien(app).masuk(email, PASSWORD_UJI)).status).toBe(401);
    expect((await new Klien(app).masuk(email, 'kata-sandi-baru-456')).status).toBe(200);

    const log = await prisma.auditLog.findFirst({ where: { aktivitas: 'UBAH_PASSWORD' } });
    expect(log).not.toBeNull();
    expect(log?.description).not.toContain('kata-sandi-baru-456');
  });

  it('tanpa sesi → 401', async () => {
    const res = await new Klien(app).put('/api/v1/auth/password', {
      password_lama: 'a',
      password_baru: 'kata-sandi-baru-456',
    });
    expect(res.status).toBe(401);
  });
});
