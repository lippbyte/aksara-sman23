import type {
  Akun,
  AkunQuery,
  AkunUbahInput,
  DaftarQuery,
  Guru,
  GuruInput,
  GuruQuery,
  Jadwal,
  JadwalInput,
  JadwalQuery,
  JenisLatar,
  Kelas,
  KelasInput,
  Mgmp,
  MgmpInput,
  Sekolah,
  SekolahInput,
  Siswa,
  SiswaInput,
  SiswaQuery,
} from '@sms/shared';
import { keAngka, keDate, keNumber, keTanggalISO } from '../../lib/konversi';
import { prisma, type Db } from '../../lib/prisma';
import { uraiHariEfektif, urlLatarDashboard, urlLatarMasuk, urlLogo } from '../../lib/sekolah';

export interface HasilDaftar<T> {
  rows: T[];
  total: number;
}

const potong = (q: { page: number; pageSize: number }) => ({
  skip: (q.page - 1) * q.pageSize,
  take: q.pageSize,
});

// ───────────── Sekolah ─────────────

type BarisSekolah = NonNullable<Awaited<ReturnType<typeof prisma.sekolahSettings.findFirst>>>;

function keSekolah(s: BarisSekolah): Sekolah {
  return {
    id: keNumber(s.id),
    nama_sekolah: s.nama_sekolah,
    logo_url: urlLogo(s.logo_path),
    login_background_url: urlLatarMasuk(s.login_background_path),
    dashboard_background_url: urlLatarDashboard(s.dashboard_background_path),
    tahun_ajaran: s.tahun_ajaran,
    tanggal_awal_pekan: keTanggalISO(s.tanggal_awal_pekan),
    hari_efektif: uraiHariEfektif(s.hari_efektif),
    bobot_kinerja_kehadiran: keAngka(s.bobot_kinerja_kehadiran),
    bobot_kinerja_administrasi: keAngka(s.bobot_kinerja_administrasi),
    bobot_kinerja_manajemen: keAngka(s.bobot_kinerja_manajemen),
    bobot_kinerja_kehadiran_tanpa_manajemen: keAngka(s.bobot_kinerja_kehadiran_tanpa_manajemen),
    bobot_kinerja_administrasi_tanpa_manajemen: keAngka(
      s.bobot_kinerja_administrasi_tanpa_manajemen,
    ),
    bobot_mgmp_kehadiran: keAngka(s.bobot_mgmp_kehadiran),
    bobot_mgmp_siswa: keAngka(s.bobot_mgmp_siswa),
    bobot_mgmp_administrasi: keAngka(s.bobot_mgmp_administrasi),
    jendela_penilaian_hari: s.jendela_penilaian_hari,
  };
}

export const sekolah = {
  async ambil(db: Db = prisma): Promise<Sekolah | null> {
    const s = await db.sekolahSettings.findFirst({ orderBy: { id: 'asc' } });
    return s ? keSekolah(s) : null;
  },

  async ambilLogoPath(db: Db = prisma): Promise<string | null> {
    const s = await db.sekolahSettings.findFirst({
      orderBy: { id: 'asc' },
      select: { logo_path: true },
    });
    return s?.logo_path ?? null;
  },

  /** Tabel ini hanya berisi satu baris: ubah bila ada, buat bila belum. */
  async simpan(db: Db, input: SekolahInput): Promise<Sekolah> {
    const data = { ...input, tanggal_awal_pekan: keDate(input.tanggal_awal_pekan) };
    const lama = await db.sekolahSettings.findFirst({ orderBy: { id: 'asc' } });
    const baris = lama
      ? await db.sekolahSettings.update({ where: { id: lama.id }, data })
      : await db.sekolahSettings.create({ data });
    return keSekolah(baris);
  },

  async simpanLogoPath(db: Db, logoPath: string | null): Promise<void> {
    await db.sekolahSettings.updateMany({ data: { logo_path: logoPath } });
  },

  async ambilLatarPath(jenis: JenisLatar, db: Db = prisma): Promise<string | null> {
    const s = await db.sekolahSettings.findFirst({
      orderBy: { id: 'asc' },
      select: { login_background_path: true, dashboard_background_path: true },
    });
    if (!s) return null;
    return jenis === 'masuk' ? s.login_background_path : s.dashboard_background_path;
  },

  async simpanLatarPath(db: Db, jenis: JenisLatar, latarPath: string | null): Promise<void> {
    await db.sekolahSettings.updateMany({
      data:
        jenis === 'masuk'
          ? { login_background_path: latarPath }
          : { dashboard_background_path: latarPath },
    });
  },
};

// ───────────── Kelas ─────────────

const kelasInclude = { _count: { select: { siswa: true } } } as const;
type BarisKelas = Awaited<
  ReturnType<typeof prisma.kelas.findFirstOrThrow<{ include: typeof kelasInclude }>>
>;
const keKelas = (k: BarisKelas): Kelas => ({
  id: keNumber(k.id),
  nama_kelas: k.nama_kelas,
  jumlah_siswa: k._count.siswa,
});

export const kelas = {
  async daftar(q: DaftarQuery): Promise<HasilDaftar<Kelas>> {
    const where = q.q ? { nama_kelas: { contains: q.q } } : {};
    const [rows, total] = await Promise.all([
      prisma.kelas.findMany({
        where,
        include: kelasInclude,
        orderBy: { nama_kelas: 'asc' },
        ...potong(q),
      }),
      prisma.kelas.count({ where }),
    ]);
    return { rows: rows.map(keKelas), total };
  },
  async ambil(db: Db, id: number): Promise<Kelas | null> {
    const k = await db.kelas.findUnique({ where: { id }, include: kelasInclude });
    return k ? keKelas(k) : null;
  },
  async buat(db: Db, input: KelasInput): Promise<Kelas> {
    return keKelas(await db.kelas.create({ data: input, include: kelasInclude }));
  },
  async ubah(db: Db, id: number, input: KelasInput): Promise<Kelas> {
    return keKelas(await db.kelas.update({ where: { id }, data: input, include: kelasInclude }));
  },
  async hapus(db: Db, id: number): Promise<void> {
    await db.kelas.delete({ where: { id } });
  },
};

// ───────────── MGMP ─────────────

const mgmpInclude = { _count: { select: { guru: true } } } as const;
type BarisMgmp = Awaited<
  ReturnType<typeof prisma.mgmp.findFirstOrThrow<{ include: typeof mgmpInclude }>>
>;
const keMgmp = (m: BarisMgmp): Mgmp => ({
  id: keNumber(m.id),
  nama_mapel: m.nama_mapel,
  deskripsi: m.deskripsi,
  jumlah_guru: m._count.guru,
});

export const mgmp = {
  async daftar(q: DaftarQuery): Promise<HasilDaftar<Mgmp>> {
    const where = q.q ? { nama_mapel: { contains: q.q } } : {};
    const [rows, total] = await Promise.all([
      prisma.mgmp.findMany({
        where,
        include: mgmpInclude,
        orderBy: { nama_mapel: 'asc' },
        ...potong(q),
      }),
      prisma.mgmp.count({ where }),
    ]);
    return { rows: rows.map(keMgmp), total };
  },
  async ambil(db: Db, id: number): Promise<Mgmp | null> {
    const m = await db.mgmp.findUnique({ where: { id }, include: mgmpInclude });
    return m ? keMgmp(m) : null;
  },
  async buat(db: Db, input: MgmpInput): Promise<Mgmp> {
    return keMgmp(await db.mgmp.create({ data: input, include: mgmpInclude }));
  },
  async ubah(db: Db, id: number, input: MgmpInput): Promise<Mgmp> {
    return keMgmp(await db.mgmp.update({ where: { id }, data: input, include: mgmpInclude }));
  },
  async hapus(db: Db, id: number): Promise<void> {
    await db.mgmp.delete({ where: { id } });
  },
};

// ───────────── Guru ─────────────

const guruInclude = { mgmp: { select: { nama_mapel: true } } } as const;
type BarisGuru = Awaited<
  ReturnType<typeof prisma.guru.findFirstOrThrow<{ include: typeof guruInclude }>>
>;
const keGuru = (g: BarisGuru): Guru => ({
  id: keNumber(g.id),
  kode_guru: g.kode_guru,
  nip: g.nip,
  nama_guru: g.nama_guru,
  mata_pelajaran: g.mata_pelajaran,
  jabatan: g.jabatan,
  mgmp_id: keNumber(g.mgmp_id),
  nama_mgmp: g.mgmp?.nama_mapel ?? null,
  status: g.status,
});

export const guru = {
  async daftar(q: GuruQuery): Promise<HasilDaftar<Guru>> {
    const where = {
      ...(q.q
        ? {
            OR: [
              { nama_guru: { contains: q.q } },
              { kode_guru: { contains: q.q } },
              { mata_pelajaran: { contains: q.q } },
            ],
          }
        : {}),
      ...(q.mgmp_id ? { mgmp_id: q.mgmp_id } : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.guru.findMany({
        where,
        include: guruInclude,
        orderBy: { nama_guru: 'asc' },
        ...potong(q),
      }),
      prisma.guru.count({ where }),
    ]);
    return { rows: rows.map(keGuru), total };
  },
  async ambil(db: Db, id: number): Promise<Guru | null> {
    const g = await db.guru.findUnique({ where: { id }, include: guruInclude });
    return g ? keGuru(g) : null;
  },
  async buat(db: Db, input: GuruInput): Promise<Guru> {
    return keGuru(await db.guru.create({ data: input, include: guruInclude }));
  },
  async ubah(db: Db, id: number, input: GuruInput): Promise<Guru> {
    return keGuru(await db.guru.update({ where: { id }, data: input, include: guruInclude }));
  },
  async hapus(db: Db, id: number): Promise<void> {
    await db.guru.delete({ where: { id } });
  },
};

// ───────────── Siswa ─────────────

const siswaInclude = { kelas: { select: { nama_kelas: true } } } as const;
type BarisSiswa = Awaited<
  ReturnType<typeof prisma.siswa.findFirstOrThrow<{ include: typeof siswaInclude }>>
>;
const keSiswa = (s: BarisSiswa): Siswa => ({
  id: keNumber(s.id),
  nis: s.nis,
  nama_siswa: s.nama_siswa,
  jenis_kelamin: s.jenis_kelamin,
  kelas_id: keNumber(s.kelas_id),
  nama_kelas: s.kelas.nama_kelas,
  wali_kelas: s.wali_kelas,
  status: s.status,
});

export const siswa = {
  async daftar(q: SiswaQuery): Promise<HasilDaftar<Siswa>> {
    const where = {
      ...(q.q ? { OR: [{ nama_siswa: { contains: q.q } }, { nis: { contains: q.q } }] } : {}),
      ...(q.kelas_id ? { kelas_id: q.kelas_id } : {}),
      ...(q.status ? { status: q.status } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.siswa.findMany({
        where,
        include: siswaInclude,
        orderBy: [{ kelas: { nama_kelas: 'asc' } }, { nama_siswa: 'asc' }],
        ...potong(q),
      }),
      prisma.siswa.count({ where }),
    ]);
    return { rows: rows.map(keSiswa), total };
  },
  async ambil(db: Db, id: number): Promise<Siswa | null> {
    const s = await db.siswa.findUnique({ where: { id }, include: siswaInclude });
    return s ? keSiswa(s) : null;
  },
  async buat(db: Db, input: SiswaInput): Promise<Siswa> {
    return keSiswa(await db.siswa.create({ data: input, include: siswaInclude }));
  },
  async ubah(db: Db, id: number, input: SiswaInput): Promise<Siswa> {
    return keSiswa(await db.siswa.update({ where: { id }, data: input, include: siswaInclude }));
  },
  async hapus(db: Db, id: number): Promise<void> {
    await db.siswa.delete({ where: { id } });
  },
};

// ───────────── Jadwal mengajar ─────────────

const jadwalInclude = {
  guru: { select: { nama_guru: true, kode_guru: true, mata_pelajaran: true } },
  kelas: { select: { nama_kelas: true } },
} as const;
type BarisJadwal = Awaited<
  ReturnType<typeof prisma.jadwalMengajar.findFirstOrThrow<{ include: typeof jadwalInclude }>>
>;
const keJadwal = (j: BarisJadwal): Jadwal => ({
  id: keNumber(j.id),
  guru_id: keNumber(j.guru_id),
  kelas_id: keNumber(j.kelas_id),
  hari: j.hari,
  jam_ke: j.jam_ke,
  total_jam_mengajar: j.total_jam_mengajar,
  nama_guru: j.guru.nama_guru,
  kode_guru: j.guru.kode_guru,
  mata_pelajaran: j.guru.mata_pelajaran,
  nama_kelas: j.kelas.nama_kelas,
});

export const jadwal = {
  async daftar(q: JadwalQuery): Promise<HasilDaftar<Jadwal>> {
    const where = {
      ...(q.guru_id ? { guru_id: q.guru_id } : {}),
      ...(q.kelas_id ? { kelas_id: q.kelas_id } : {}),
      ...(q.hari ? { hari: q.hari } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.jadwalMengajar.findMany({
        where,
        include: jadwalInclude,
        orderBy: [{ hari: 'asc' }, { jam_ke: 'asc' }, { kelas: { nama_kelas: 'asc' } }],
        ...potong(q),
      }),
      prisma.jadwalMengajar.count({ where }),
    ]);
    return { rows: rows.map(keJadwal), total };
  },
  async ambil(db: Db, id: number): Promise<Jadwal | null> {
    const j = await db.jadwalMengajar.findUnique({ where: { id }, include: jadwalInclude });
    return j ? keJadwal(j) : null;
  },
  async adaBentrokUnik(db: Db, input: JadwalInput, kecualiId?: number): Promise<boolean> {
    const n = await db.jadwalMengajar.count({
      where: {
        guru_id: input.guru_id,
        hari: input.hari,
        jam_ke: input.jam_ke,
        ...(kecualiId ? { NOT: { id: kecualiId } } : {}),
      },
    });
    return n > 0;
  },
  async buat(db: Db, input: JadwalInput): Promise<Jadwal> {
    return keJadwal(await db.jadwalMengajar.create({ data: input, include: jadwalInclude }));
  },
  async ubah(db: Db, id: number, input: JadwalInput): Promise<Jadwal> {
    return keJadwal(
      await db.jadwalMengajar.update({ where: { id }, data: input, include: jadwalInclude }),
    );
  },
  async hapus(db: Db, id: number): Promise<void> {
    await db.jadwalMengajar.delete({ where: { id } });
  },
};

// ───────────── Akun ─────────────

// Kolom `password` tidak pernah ikut dipilih.
const akunSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  kelas_id: true,
  is_active: true,
  kelas: { select: { nama_kelas: true } },
} as const;
type BarisAkun = Awaited<
  ReturnType<typeof prisma.user.findFirstOrThrow<{ select: typeof akunSelect }>>
>;
const keAkun = (u: BarisAkun): Akun => ({
  id: keNumber(u.id),
  name: u.name,
  email: u.email,
  role: u.role,
  kelas_id: keNumber(u.kelas_id),
  nama_kelas: u.kelas?.nama_kelas ?? null,
  is_active: u.is_active,
});

export const users = {
  async daftar(q: AkunQuery): Promise<HasilDaftar<Akun>> {
    const where = {
      ...(q.q ? { OR: [{ name: { contains: q.q } }, { email: { contains: q.q } }] } : {}),
      ...(q.role ? { role: q.role } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({ where, select: akunSelect, orderBy: { name: 'asc' }, ...potong(q) }),
      prisma.user.count({ where }),
    ]);
    return { rows: rows.map(keAkun), total };
  },
  async ambil(db: Db, id: number): Promise<Akun | null> {
    const u = await db.user.findUnique({ where: { id }, select: akunSelect });
    return u ? keAkun(u) : null;
  },
  async buat(db: Db, input: AkunUbahInput & { password: string }): Promise<Akun> {
    return keAkun(await db.user.create({ data: input, select: akunSelect }));
  },
  async ubah(db: Db, id: number, input: AkunUbahInput): Promise<Akun> {
    return keAkun(await db.user.update({ where: { id }, data: input, select: akunSelect }));
  },
  async simpanPassword(db: Db, id: number, hash: string): Promise<void> {
    await db.user.update({ where: { id }, data: { password: hash } });
  },
  async hapus(db: Db, id: number): Promise<void> {
    await db.user.delete({ where: { id } });
  },
};
