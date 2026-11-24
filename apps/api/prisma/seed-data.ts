/**
 * Seeder DATA FIKTIF. Semua nama, NIS, NIP, dan email dibuat-buat dan diberi
 * penanda "Contoh". Tidak ada data dari prototype atau sekolah nyata.
 */
import {
  BOBOT_DEFAULT,
  HARI_EFEKTIF_DEFAULT,
  JENDELA_PENILAIAN_HARI_DEFAULT,
  hariDalamPekan,
  persentaseKehadiran,
  rentangPekan,
  seninDari,
  tahunPekan,
  tambahHari,
  totalJamHadir,
  totalJamWajib,
  type Role,
  type StatusKehadiran,
  type StatusSiswa,
  type TanggalISO,
} from '@sms/shared';
import argon2 from 'argon2';
import type { PrismaClient } from '../src/generated/prisma/client';
import { keDate, statusKehadiranKeDb, statusTugasKeDb } from '../src/lib/konversi';

export interface OpsiSeed {
  /** Tanggal "hari ini" (YYYY-MM-DD, zona Asia/Jakarta). Pekan berjalan = pekan ke-4. */
  hariIni: TanggalISO;
  /** Kata sandi akun contoh (dari SEED_PASSWORD). */
  password: string;
  /** Skala untuk uji kinerja; default sesuai Fase 1. */
  jumlahGuru?: number;
  jumlahKelas?: number;
  siswaPerKelas?: number;
  /** Jumlah pekan data kehadiran sampai pekan berjalan. */
  jumlahPekan?: number;
}

export const AKUN_CONTOH: { role: Role; name: string; email: string; kelas?: string }[] = [
  { role: 'admin', name: 'Admin Contoh', email: 'admin@contoh.test' },
  { role: 'manajemen_guru', name: 'Kepala Sekolah Contoh', email: 'manajemen@contoh.test' },
  {
    role: 'sekretaris_kelas',
    name: 'Sekretaris X-1 Contoh',
    email: 'sekretaris.x1@contoh.test',
    kelas: 'X-1',
  },
  { role: 'guru_penilai', name: 'Guru Penilai Contoh', email: 'penilai@contoh.test' },
];

const MGMP_CONTOH = [
  { nama_mapel: 'Matematika', deskripsi: 'MGMP Matematika (data contoh)', mapel: ['Matematika'] },
  {
    nama_mapel: 'Bahasa Indonesia',
    deskripsi: 'MGMP Bahasa Indonesia (data contoh)',
    mapel: ['Bahasa Indonesia'],
  },
  {
    nama_mapel: 'Ilmu Pengetahuan Alam',
    deskripsi: 'MGMP IPA (data contoh)',
    mapel: ['Fisika', 'Kimia', 'Biologi'],
  },
];

const TINGKAT = ['X', 'XI', 'XII'];
const SLOT_JAM = [1, 3, 5, 7];
const JP_PER_SLOT = 2;

/** PRNG deterministik agar seed selalu menghasilkan data yang sama. */
function mulberry32(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nomor(n: number, lebar: number): string {
  return String(n).padStart(lebar, '0');
}

function potong<T>(daftar: T[], ukuran: number): T[][] {
  const hasil: T[][] = [];
  for (let i = 0; i < daftar.length; i += ukuran) hasil.push(daftar.slice(i, i + ukuran));
  return hasil;
}

export async function kosongkanData(prisma: PrismaClient): Promise<void> {
  // Urutan mengikuti arah kunci asing.
  await prisma.auditLog.deleteMany();
  await prisma.session.deleteMany();
  await prisma.penilaianMgmpSiswa.deleteMany();
  await prisma.penilaianMgmp.deleteMany();
  await prisma.penilaianKinerjaBulanan.deleteMany();
  await prisma.rekapKehadiranGuru.deleteMany();
  await prisma.kehadiranSiswa.deleteMany();
  await prisma.kehadiran.deleteMany();
  await prisma.jadwalMengajar.deleteMany();
  await prisma.siswa.deleteMany();
  await prisma.user.deleteMany();
  await prisma.guru.deleteMany();
  await prisma.mgmp.deleteMany();
  await prisma.kelas.deleteMany();
  await prisma.sekolahSettings.deleteMany();
}

export interface HasilSeed {
  tanggalAwalPekan: TanggalISO;
  jumlah: {
    guru: number;
    kelas: number;
    siswa: number;
    jadwal: number;
    kehadiran: number;
    kehadiranSiswa: number;
    rekap: number;
  };
}

export async function isiDataContoh(prisma: PrismaClient, opsi: OpsiSeed): Promise<HasilSeed> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeder data fiktif tidak boleh dijalankan di produksi.');
  }
  if (!opsi.password || opsi.password.length < 8) {
    throw new Error('SEED_PASSWORD wajib diisi (minimal 8 karakter).');
  }

  const jumlahGuru = opsi.jumlahGuru ?? 12;
  const jumlahKelas = opsi.jumlahKelas ?? 6;
  const siswaPerKelas = opsi.siswaPerKelas ?? 30;
  const jumlahPekan = opsi.jumlahPekan ?? 4;
  if (jumlahGuru < jumlahKelas) {
    throw new Error('Jumlah guru minimal sama dengan jumlah kelas agar jadwal tidak bentrok.');
  }
  // Langkah pembagian guru antarkelas; 2 menyebar beban lebih merata bila gurunya cukup.
  const langkah = jumlahGuru >= jumlahKelas * 2 ? 2 : 1;

  const acak = mulberry32(20261115);
  const hariEfektif = [...HARI_EFEKTIF_DEFAULT];
  const tanggalAwalPekan = tambahHari(seninDari(opsi.hariIni), -7 * (jumlahPekan - 1));
  const tahunAwal = Number(tanggalAwalPekan.slice(0, 4));

  await kosongkanData(prisma);

  // ── Pengaturan sekolah ──
  await prisma.sekolahSettings.create({
    data: {
      nama_sekolah: 'SMA Contoh Fiktif',
      logo_path: null,
      tahun_ajaran: `${tahunAwal}/${tahunAwal + 1}`,
      tanggal_awal_pekan: keDate(tanggalAwalPekan),
      hari_efektif: hariEfektif,
      bobot_kinerja_kehadiran: BOBOT_DEFAULT.kinerja.dengan_manajemen.kehadiran,
      bobot_kinerja_administrasi: BOBOT_DEFAULT.kinerja.dengan_manajemen.administrasi,
      bobot_kinerja_manajemen: BOBOT_DEFAULT.kinerja.dengan_manajemen.manajemen,
      bobot_kinerja_kehadiran_tanpa_manajemen: BOBOT_DEFAULT.kinerja.tanpa_manajemen.kehadiran,
      bobot_kinerja_administrasi_tanpa_manajemen:
        BOBOT_DEFAULT.kinerja.tanpa_manajemen.administrasi,
      bobot_mgmp_kehadiran: BOBOT_DEFAULT.mgmp.kehadiran,
      bobot_mgmp_siswa: BOBOT_DEFAULT.mgmp.siswa,
      bobot_mgmp_administrasi: BOBOT_DEFAULT.mgmp.administrasi,
      jendela_penilaian_hari: JENDELA_PENILAIAN_HARI_DEFAULT,
    },
  });

  // ── MGMP, kelas, guru ──
  await prisma.mgmp.createMany({
    data: MGMP_CONTOH.map(({ nama_mapel, deskripsi }) => ({ nama_mapel, deskripsi })),
  });
  const mgmp = await prisma.mgmp.findMany({ orderBy: { id: 'asc' } });

  const namaKelas = Array.from({ length: jumlahKelas }, (_, i) => {
    const tingkat = TINGKAT[i % TINGKAT.length] ?? 'X';
    return `${tingkat}-${Math.floor(i / TINGKAT.length) + 1}`;
  }).sort((a, b) => {
    const [ta = '', na = '0'] = a.split('-');
    const [tb = '', nb = '0'] = b.split('-');
    return TINGKAT.indexOf(ta) - TINGKAT.indexOf(tb) || Number(na) - Number(nb);
  });
  await prisma.kelas.createMany({ data: namaKelas.map((nama_kelas) => ({ nama_kelas })) });
  const kelas = await prisma.kelas.findMany({ orderBy: { id: 'asc' } });

  await prisma.guru.createMany({
    data: Array.from({ length: jumlahGuru }, (_, i) => {
      const m = MGMP_CONTOH[i % MGMP_CONTOH.length];
      const mgmpBaris = mgmp[i % mgmp.length];
      if (!m || !mgmpBaris) throw new Error('MGMP contoh tidak tersedia.');
      const mapel = m.mapel[Math.floor(i / MGMP_CONTOH.length) % m.mapel.length] ?? m.nama_mapel;
      return {
        kode_guru: `G${nomor(i + 1, 2)}`,
        // NIP fiktif: diawali 99 agar jelas bukan NIP nyata.
        nip: i % 4 === 3 ? null : `99${nomor(i + 1, 16)}`,
        nama_guru: `Guru Contoh ${nomor(i + 1, 2)}`,
        mata_pelajaran: mapel,
        jabatan: i === 0 ? 'Wakil Kepala Sekolah' : 'Guru Mata Pelajaran',
        mgmp_id: mgmpBaris.id,
        status: 'aktif' as const,
      };
    }),
  });
  const guru = await prisma.guru.findMany({ orderBy: { id: 'asc' } });

  // ── Akun: satu per peran ──
  const hash = await argon2.hash(opsi.password, { type: argon2.argon2id });
  await prisma.user.createMany({
    data: AKUN_CONTOH.map((a) => ({
      name: a.name,
      email: a.email,
      password: hash,
      role: a.role,
      kelas_id: a.kelas ? (kelas.find((k) => k.nama_kelas === a.kelas)?.id ?? null) : null,
      is_active: true,
    })),
  });
  const users = await prisma.user.findMany();
  const admin = users.find((u) => u.role === 'admin');
  const sekretaris = users.find((u) => u.role === 'sekretaris_kelas');
  if (!admin || !sekretaris) throw new Error('Akun contoh gagal dibuat.');
  const pembuat = (kelasId: bigint) => (sekretaris.kelas_id === kelasId ? sekretaris.id : admin.id);

  // ── Siswa ──
  await prisma.siswa.createMany({
    data: kelas.flatMap((k, ki) =>
      Array.from({ length: siswaPerKelas }, (_, si) => ({
        // NIS fiktif: diawali 99.
        nis: `99${nomor(ki + 1, 2)}${nomor(si + 1, 3)}`,
        nama_siswa: `Siswa Contoh ${k.nama_kelas} ${nomor(si + 1, 2)}`,
        jenis_kelamin: (si % 2 === 0 ? 'L' : 'P') as 'L' | 'P',
        kelas_id: k.id,
        wali_kelas: guru[ki % guru.length]?.nama_guru ?? null,
        bk: guru[(ki + 1) % guru.length]?.nama_guru ?? null,
        status: 'aktif' as const,
      })),
    ),
  });
  const siswa = await prisma.siswa.findMany({ orderBy: { id: 'asc' } });

  // ── Jadwal mengajar: Senin–Jumat, 4 slot × 2 JP per kelas ──
  // Untuk hari dan slot yang sama, tiap kelas mendapat guru berbeda (langkah·k mod n unik),
  // sehingga kunci unik (guru_id, hari, jam_ke) terpenuhi.
  const jadwalData = hariEfektif.flatMap((hari) =>
    SLOT_JAM.flatMap((jam_ke, slotIdx) =>
      kelas.map((k, ki) => {
        const g = guru[(ki * langkah + slotIdx + hari) % guru.length];
        if (!g) throw new Error('Guru contoh tidak tersedia.');
        return { guru_id: g.id, kelas_id: k.id, hari, jam_ke, total_jam_mengajar: JP_PER_SLOT };
      }),
    ),
  );
  await prisma.jadwalMengajar.createMany({ data: jadwalData });

  // ── Kehadiran guru dan siswa: dari awal pekan 1 sampai hari ini ──
  const tanggalEfektif: TanggalISO[] = [];
  for (let t = tanggalAwalPekan; t <= opsi.hariIni; t = tambahHari(t, 1)) {
    if (hariEfektif.includes(hariDalamPekan(t))) tanggalEfektif.push(t);
  }

  interface BarisKehadiran {
    tanggal: TanggalISO;
    guru_id: bigint;
    kelas_id: bigint;
    jam_ke: number;
    lama_jam: number;
    status_kehadiran: StatusKehadiran;
  }
  const kehadiran: BarisKehadiran[] = [];
  const kehadiranData = tanggalEfektif.flatMap((tanggal) =>
    jadwalData
      .filter((j) => j.hari === hariDalamPekan(tanggal))
      .map((j) => {
        const r = acak();
        const status: StatusKehadiran =
          r < 0.86 ? 'Hadir' : r < 0.93 ? 'Mendampingi' : 'Tidak Hadir';
        const adaTugas = status !== 'Tidak Hadir' || acak() < 0.65;
        kehadiran.push({
          tanggal,
          guru_id: j.guru_id,
          kelas_id: j.kelas_id,
          jam_ke: j.jam_ke,
          lama_jam: j.total_jam_mengajar,
          status_kehadiran: status,
        });
        return {
          tanggal: keDate(tanggal),
          guru_id: j.guru_id,
          kelas_id: j.kelas_id,
          jam_ke: j.jam_ke,
          lama_jam: j.total_jam_mengajar,
          status_kehadiran: statusKehadiranKeDb(status),
          status_tugas: statusTugasKeDb(adaTugas ? 'Ada' : 'Tidak Ada'),
          keterangan:
            status === 'Tidak Hadir'
              ? adaTugas
                ? 'Tugas dititipkan (contoh)'
                : 'Tanpa keterangan (contoh)'
              : null,
          created_by: pembuat(j.kelas_id),
        };
      }),
  );
  for (const bagian of potong(kehadiranData, 1000)) {
    await prisma.kehadiran.createMany({ data: bagian });
  }

  const kehadiranSiswaData = tanggalEfektif.flatMap((tanggal) =>
    siswa.map((s) => {
      const r = acak();
      const status: StatusSiswa =
        r < 0.93 ? 'hadir' : r < 0.96 ? 'izin' : r < 0.98 ? 'sakit' : 'alpa';
      return {
        siswa_id: s.id,
        kelas_id: s.kelas_id,
        tanggal: keDate(tanggal),
        jam_ke: 1,
        status,
        keterangan: status === 'hadir' ? null : 'Keterangan contoh',
        created_by: pembuat(s.kelas_id),
      };
    }),
  );
  for (const bagian of potong(kehadiranSiswaData, 1000)) {
    await prisma.kehadiranSiswa.createMany({ data: bagian });
  }

  // ── Rekap pekan: dihitung dengan fungsi domain ──
  const pengaturan = { tanggal_awal_pekan: tanggalAwalPekan, hari_efektif: hariEfektif };
  const rekapData = Array.from({ length: jumlahPekan }, (_, i) => i + 1).flatMap((minggu_ke) => {
    const r = rentangPekan(minggu_ke, tahunPekan(minggu_ke, tanggalAwalPekan), pengaturan);
    return guru.map((g) => {
      const wajib = totalJamWajib(
        jadwalData.filter((j) => j.guru_id === g.id),
        hariEfektif,
      );
      const hadir = totalJamHadir(
        kehadiran.filter((k) => k.guru_id === g.id),
        r,
      );
      return {
        guru_id: g.id,
        tahun: r.tahun,
        minggu_ke,
        tanggal_mulai: keDate(r.tanggal_mulai),
        tanggal_selesai: keDate(r.tanggal_selesai),
        total_jam_wajib: wajib,
        total_jam_hadir: hadir,
        persentase_kehadiran: persentaseKehadiran(hadir, wajib),
      };
    });
  });
  await prisma.rekapKehadiranGuru.createMany({ data: rekapData });

  return {
    tanggalAwalPekan,
    jumlah: {
      guru: guru.length,
      kelas: kelas.length,
      siswa: siswa.length,
      jadwal: jadwalData.length,
      kehadiran: kehadiranData.length,
      kehadiranSiswa: kehadiranSiswaData.length,
      rekap: rekapData.length,
    },
  };
}
