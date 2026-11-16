import { createHash } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Akun,
  AkunBuatInput,
  AkunUbahInput,
  Guru,
  GuruInput,
  Halaman,
  Jadwal,
  JadwalInput,
  Kelas,
  KelasInput,
  LogoInput,
  Mgmp,
  MgmpInput,
  PenggunaSesi,
  Sekolah,
  SekolahInput,
  Siswa,
  SiswaInput,
} from '@sms/shared';
import { NAMA_HARI } from '@sms/shared';
import { DIR_UNGGAH } from '../../env';
import { catatAudit, type KonteksAudit } from '../../lib/audit';
import { batalkanCacheDashboard } from '../../lib/cache';
import { badRequest, businessRule, conflict, notFound } from '../../lib/errors';
import { prisma, type Db } from '../../lib/prisma';
import { akhiriSesiPengguna } from '../../lib/session';
import { hashPassword } from '../auth/service';
import * as repo from './repo';
import type { HasilDaftar } from './repo';

export function keHalaman<T>(
  hasil: HasilDaftar<T>,
  q: { page: number; pageSize: number },
): Halaman<T> {
  return { data: hasil.rows, meta: { page: q.page, pageSize: q.pageSize, total: hasil.total } };
}

// ───────────── CRUD umum dengan log aktivitas ─────────────

interface Sumber<I, D extends { id: number }> {
  /** Nama tabel untuk `entity_type`. */
  entity: string;
  /** Kata benda untuk deskripsi log, mis. "guru". */
  label: string;
  /** Akhiran kode aktivitas, mis. GURU → CREATE_GURU. */
  kode: string;
  ambil(db: Db, id: number): Promise<D | null>;
  buat(db: Db, input: I): Promise<D>;
  ubah(db: Db, id: number, input: I): Promise<D>;
  hapus(db: Db, id: number): Promise<void>;
  /** Nama yang mudah dikenali untuk deskripsi log. */
  nama(d: D): string;
  /** Aturan tambahan sebelum simpan; lempar AppError bila dilanggar. */
  periksa?(db: Db, input: I, id?: number): Promise<void>;
}

function buatCrud<I, D extends { id: number }>(s: Sumber<I, D>) {
  const crud = {
    buat(input: I, audit: KonteksAudit): Promise<D> {
      return prisma.$transaction(async (tx) => {
        await s.periksa?.(tx, input);
        const baru = await s.buat(tx, input);
        await catatAudit(tx, audit, {
          module: 'Settings',
          aktivitas: `CREATE_${s.kode}`,
          entity_type: s.entity,
          entity_id: baru.id,
          description: `Menambah ${s.label} "${s.nama(baru)}".`,
        });
        return baru;
      });
    },

    ubah(id: number, input: I, audit: KonteksAudit): Promise<D> {
      return prisma.$transaction(async (tx) => {
        const lama = await s.ambil(tx, id);
        if (!lama) throw notFound(`Data ${s.label} tidak ditemukan.`);
        await s.periksa?.(tx, input, id);
        const baru = await s.ubah(tx, id, input);
        await catatAudit(tx, audit, {
          module: 'Settings',
          aktivitas: `UPDATE_${s.kode}`,
          entity_type: s.entity,
          entity_id: id,
          description: `Mengubah ${s.label} "${s.nama(baru)}".`,
        });
        return baru;
      });
    },

    hapus(id: number, audit: KonteksAudit): Promise<void> {
      return prisma.$transaction(async (tx) => {
        const lama = await s.ambil(tx, id);
        if (!lama) throw notFound(`Data ${s.label} tidak ditemukan.`);
        try {
          await s.hapus(tx, id);
        } catch (err) {
          if ((err as { code?: string }).code === 'P2003') {
            throw conflict(
              `${s.label[0]?.toUpperCase()}${s.label.slice(1)} "${s.nama(lama)}" masih dipakai data lain sehingga tidak bisa dihapus.`,
            );
          }
          throw err;
        }
        await catatAudit(tx, audit, {
          module: 'Settings',
          aktivitas: `DELETE_${s.kode}`,
          entity_type: s.entity,
          entity_id: id,
          description: `Menghapus ${s.label} "${s.nama(lama)}".`,
        });
      });
    },
  };
  // Data master memengaruhi angka dashboard: batalkan cache setelah perubahan berhasil.
  return {
    buat: async (input: I, audit: KonteksAudit) => {
      const hasil = await crud.buat(input, audit);
      batalkanCacheDashboard();
      return hasil;
    },
    ubah: async (id: number, input: I, audit: KonteksAudit) => {
      const hasil = await crud.ubah(id, input, audit);
      batalkanCacheDashboard();
      return hasil;
    },
    hapus: async (id: number, audit: KonteksAudit) => {
      await crud.hapus(id, audit);
      batalkanCacheDashboard();
    },
  };
}

async function pastikanKelasAda(db: Db, kelasId: number): Promise<void> {
  if (!(await repo.kelas.ambil(db, kelasId))) throw badRequest('Kelas tidak ditemukan.');
}

export const kelas = {
  daftar: repo.kelas.daftar,
  ...buatCrud<KelasInput, Kelas>({
    entity: 'kelas',
    label: 'kelas',
    kode: 'KELAS',
    ...repo.kelas,
    nama: (k) => k.nama_kelas,
  }),
};

export const mgmp = {
  daftar: repo.mgmp.daftar,
  ...buatCrud<MgmpInput, Mgmp>({
    entity: 'mgmp',
    label: 'MGMP',
    kode: 'MGMP',
    ...repo.mgmp,
    nama: (m) => m.nama_mapel,
  }),
};

export const guru = {
  daftar: repo.guru.daftar,
  ...buatCrud<GuruInput, Guru>({
    entity: 'guru',
    label: 'guru',
    kode: 'GURU',
    ...repo.guru,
    nama: (g) => `${g.kode_guru} ${g.nama_guru}`,
    async periksa(db, input) {
      if (input.mgmp_id !== null && !(await repo.mgmp.ambil(db, input.mgmp_id))) {
        throw badRequest('MGMP tidak ditemukan.');
      }
    },
  }),
};

export const siswa = {
  daftar: repo.siswa.daftar,
  ...buatCrud<SiswaInput, Siswa>({
    entity: 'siswa',
    label: 'siswa',
    kode: 'SISWA',
    ...repo.siswa,
    nama: (s) => `${s.nis} ${s.nama_siswa}`,
    periksa: (db, input) => pastikanKelasAda(db, input.kelas_id),
  }),
};

export const jadwal = {
  daftar: repo.jadwal.daftar,
  ...buatCrud<JadwalInput, Jadwal>({
    entity: 'jadwal_mengajar',
    label: 'jadwal',
    kode: 'JADWAL',
    ...repo.jadwal,
    nama: (j) =>
      `${j.nama_guru}, ${NAMA_HARI[j.hari] ?? j.hari} jam ke-${j.jam_ke}, ${j.nama_kelas}`,
    async periksa(db, input, id) {
      if (!(await repo.guru.ambil(db, input.guru_id))) throw badRequest('Guru tidak ditemukan.');
      await pastikanKelasAda(db, input.kelas_id);
      // Unik (guru_id, hari, jam_ke): satu guru tidak bisa mengajar dua kelas di jam yang sama.
      if (await repo.jadwal.adaBentrokUnik(db, input, id)) {
        throw conflict('Guru ini sudah punya jadwal pada hari dan jam ke yang sama.');
      }
    },
  }),
};

// ───────────── Akun ─────────────

/** Selain sekretaris_kelas, akun tidak terikat ke kelas. */
function rapikanKelas<T extends { role: string; kelas_id: number | null }>(input: T): T {
  return input.role === 'sekretaris_kelas' ? input : { ...input, kelas_id: null };
}

const akunCrud = buatCrud<AkunUbahInput, Akun>({
  entity: 'users',
  label: 'akun',
  kode: 'USER',
  ...repo.users,
  // `buat` di sini tidak dipakai (pembuatan akun butuh kata sandi, lihat users.buat).
  buat: () => Promise.reject(new Error('Gunakan users.buat.')),
  nama: (u) => u.email,
  async periksa(db, input) {
    if (input.kelas_id !== null) await pastikanKelasAda(db, input.kelas_id);
  },
});

export const users = {
  daftar: repo.users.daftar,

  async buat(input: AkunBuatInput, audit: KonteksAudit): Promise<Akun> {
    const { password, ...sisa } = rapikanKelas(input);
    const hash = await hashPassword(password);
    return prisma.$transaction(async (tx) => {
      if (sisa.kelas_id !== null) await pastikanKelasAda(tx, sisa.kelas_id);
      const baru = await repo.users.buat(tx, { ...sisa, password: hash });
      await catatAudit(tx, audit, {
        module: 'Settings',
        aktivitas: 'CREATE_USER',
        entity_type: 'users',
        entity_id: baru.id,
        description: `Menambah akun "${baru.email}" dengan peran ${baru.role}.`,
      });
      return baru;
    });
  },

  async ubah(id: number, input: AkunUbahInput, pelaku: PenggunaSesi, audit: KonteksAudit) {
    if (id === pelaku.id && (input.role !== 'admin' || !input.is_active)) {
      throw businessRule('Anda tidak dapat menonaktifkan atau mengubah peran akun sendiri.');
    }
    return akunCrud.ubah(id, rapikanKelas(input), audit);
  },

  async hapus(id: number, pelaku: PenggunaSesi, audit: KonteksAudit): Promise<void> {
    if (id === pelaku.id) throw businessRule('Anda tidak dapat menghapus akun sendiri.');
    try {
      await akunCrud.hapus(id, audit);
    } catch (err) {
      if ((err as { code?: string }).code === 'CONFLICT') {
        throw conflict('Akun sudah punya riwayat aktivitas. Nonaktifkan saja, jangan dihapus.');
      }
      throw err;
    }
  },

  /**
   * Reset kata sandi oleh admin; semua sesi pengguna itu diakhiri. Bila admin mereset
   * akunnya sendiri, sesi yang sedang dipakai dipertahankan.
   */
  async resetPassword(
    id: number,
    passwordBaru: string,
    audit: KonteksAudit,
    sesiSaatIni: string,
  ): Promise<void> {
    const hash = await hashPassword(passwordBaru);
    await prisma.$transaction(async (tx) => {
      const akun = await repo.users.ambil(tx, id);
      if (!akun) throw notFound('Akun tidak ditemukan.');
      await repo.users.simpanPassword(tx, id, hash);
      const n = await akhiriSesiPengguna(tx, id, id === audit.user_id ? sesiSaatIni : undefined);
      await catatAudit(tx, audit, {
        module: 'Auth',
        aktivitas: 'RESET_PASSWORD',
        entity_type: 'users',
        entity_id: id,
        description: `Mereset kata sandi akun "${akun.email}"; ${n} sesi diakhiri.`,
      });
    });
  },
};

// ───────────── Sekolah ─────────────

const POLA_NAMA_LOGO = /^logo-[a-f0-9]{16}\.(png|jpg|webp)$/;

export function apakahNamaLogoValid(nama: string): boolean {
  return POLA_NAMA_LOGO.test(nama);
}

/** Jenis berkas ditentukan dari isi (magic bytes), bukan dari klaim pengirim. */
function kenaliGambar(buf: Buffer): 'png' | 'jpg' | 'webp' | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

async function hapusBerkasLogo(nama: string | null): Promise<void> {
  if (!nama || !apakahNamaLogoValid(nama)) return;
  await unlink(join(DIR_UNGGAH, nama)).catch(() => undefined);
}

export const sekolah = {
  async ambil(): Promise<Sekolah> {
    const s = await repo.sekolah.ambil();
    if (!s) throw notFound('Pengaturan sekolah belum diisi.');
    return s;
  },

  async simpan(input: SekolahInput, audit: KonteksAudit): Promise<Sekolah> {
    // Hari efektif dan tanggal awal pekan memengaruhi dashboard.
    const hasil = await prisma.$transaction(async (tx) => {
      const baru = await repo.sekolah.simpan(tx, input);
      await catatAudit(tx, audit, {
        module: 'Settings',
        aktivitas: 'UPDATE_SEKOLAH',
        entity_type: 'sekolah_settings',
        entity_id: baru.id,
        description: `Mengubah pengaturan sekolah "${baru.nama_sekolah}".`,
      });
      return baru;
    });
    batalkanCacheDashboard();
    return hasil;
  },

  async simpanLogo(input: LogoInput, audit: KonteksAudit): Promise<Sekolah> {
    const base64 = input.data_url.slice(input.data_url.indexOf(',') + 1);
    const buf = Buffer.from(base64, 'base64');
    const jenis = kenaliGambar(buf);
    if (!jenis) throw badRequest('Berkas logo bukan gambar PNG, JPEG, atau WebP yang valid.');

    const lama = await repo.sekolah.ambilLogoPath();
    const nama = `logo-${createHash('sha256').update(buf).digest('hex').slice(0, 16)}.${jenis}`;
    await mkdir(DIR_UNGGAH, { recursive: true });
    await writeFile(join(DIR_UNGGAH, nama), buf);

    await prisma.$transaction(async (tx) => {
      if (!(await repo.sekolah.ambil(tx))) throw notFound('Pengaturan sekolah belum diisi.');
      await repo.sekolah.simpanLogoPath(tx, nama);
      await catatAudit(tx, audit, {
        module: 'Settings',
        aktivitas: 'UPDATE_LOGO_SEKOLAH',
        entity_type: 'sekolah_settings',
        description: 'Mengganti logo sekolah.',
      });
    });
    if (lama !== nama) await hapusBerkasLogo(lama);
    return this.ambil();
  },

  async hapusLogo(audit: KonteksAudit): Promise<Sekolah> {
    const lama = await repo.sekolah.ambilLogoPath();
    await prisma.$transaction(async (tx) => {
      await repo.sekolah.simpanLogoPath(tx, null);
      await catatAudit(tx, audit, {
        module: 'Settings',
        aktivitas: 'DELETE_LOGO_SEKOLAH',
        entity_type: 'sekolah_settings',
        description: 'Menghapus logo sekolah.',
      });
    });
    await hapusBerkasLogo(lama);
    return this.ambil();
  },

  /** Nama berkas logo yang sudah divalidasi, untuk disajikan. */
  async berkasLogo(): Promise<string | null> {
    const nama = await repo.sekolah.ambilLogoPath();
    return nama && apakahNamaLogoValid(nama) ? nama : null;
  },
};
