import {
  BATAS_BARIS_CSV,
  BATAS_UKURAN_CSV_BYTE,
  HARI_MAX,
  HARI_MIN,
  JAM_KE_MAX,
  JAM_KE_MIN,
  LAMA_JAM_MAX,
  LAMA_JAM_MIN,
  NAMA_HARI,
  type GalatBarisImpor,
  type HasilHapusPilot,
  type HasilPratinjauImpor,
  type HasilSimpanImpor,
  type JenisImpor,
  type JenisKelamin,
  type StatusAktif,
} from '@sms/shared';
import { catatAudit, type KonteksAudit } from '../../lib/audit';
import { batalkanCacheDashboard } from '../../lib/cache';
import { keCsv } from '../../lib/csv';
import { badRequest, businessRule, notFound } from '../../lib/errors';
import { keNumber } from '../../lib/konversi';
import { prisma } from '../../lib/prisma';

const KOLOM_PER_JENIS: Record<JenisImpor, { semua: readonly string[]; wajib: readonly string[] }> =
  {
    guru: {
      semua: ['kode_guru', 'nip', 'nama_guru', 'mata_pelajaran', 'jabatan', 'nama_mgmp', 'status'],
      wajib: ['kode_guru', 'nama_guru', 'mata_pelajaran'],
    },
    siswa: {
      semua: ['nis', 'nama_siswa', 'jenis_kelamin', 'nama_kelas', 'wali_kelas', 'status'],
      wajib: ['nis', 'nama_siswa', 'jenis_kelamin', 'nama_kelas'],
    },
    jadwal: {
      semua: ['kode_guru', 'nama_kelas', 'hari', 'jam_ke', 'total_jam_mengajar'],
      wajib: ['kode_guru', 'nama_kelas', 'hari', 'jam_ke', 'total_jam_mengajar'],
    },
  };

const PETA_HARI: Record<string, number> = Object.fromEntries(
  Object.entries(NAMA_HARI).map(([angka, nama]) => [nama.toLowerCase(), Number(angka)]),
);

const MAKS_GALAT_DIKEMBALIKAN = 200;

/** Menghasilkan CSV templat kosong (UTF-8 + BOM) untuk tiap jenis data master. */
export function templatCsv(jenis: JenisImpor): { namaBerkas: string; isi: string } {
  const kolom = KOLOM_PER_JENIS[jenis].semua.map((k) => ({ judul: k, nilai: () => '' }));
  return {
    namaBerkas: `templat-impor-${jenis}.csv`,
    isi: keCsv(kolom, []),
  };
}

interface HasilUraiCsv {
  header: string[];
  baris: { nomor: number; sel: string[] }[];
}

/**
 * Pengurai CSV RFC-4180 ketat (UTF-8, BOM opsional, pemisah koma, tanda kutip ganda).
 * Melempar 400 bila tanda kutip rusak atau jumlah baris melebihi batas.
 */
export function uraiCsv(mentah: string): HasilUraiCsv {
  if (Buffer.byteLength(mentah, 'utf8') > BATAS_UKURAN_CSV_BYTE) {
    throw badRequest('Ukuran berkas CSV maksimal 2 MB.');
  }
  const teks = mentah.startsWith('\uFEFF') ? mentah.slice(1) : mentah;
  const semuaBaris: { nomor: number; sel: string[] }[] = [];

  let sel: string[] = [];
  let nilai = '';
  let dalamKutip = false;
  let nomorBaris = 1;
  let awalBaris = 1;

  for (let i = 0; i < teks.length; i += 1) {
    const ch = teks[i]!;
    if (dalamKutip) {
      if (ch === '"') {
        if (teks[i + 1] === '"') {
          nilai += '"';
          i += 1;
        } else {
          dalamKutip = false;
        }
      } else {
        if (ch === '\n') nomorBaris += 1;
        nilai += ch;
      }
      continue;
    }

    if (ch === '"') {
      if (nilai.length > 0) {
        throw badRequest(`Format CSV rusak pada baris ${nomorBaris}: tanda kutip tidak valid.`);
      }
      dalamKutip = true;
    } else if (ch === ',') {
      sel.push(nilai);
      nilai = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && teks[i + 1] === '\n') i += 1;
      sel.push(nilai);
      if (sel.some((s) => s.trim() !== '')) {
        semuaBaris.push({ nomor: awalBaris, sel });
      }
      sel = [];
      nilai = '';
      nomorBaris += 1;
      awalBaris = nomorBaris;
    } else {
      nilai += ch;
    }
  }

  if (dalamKutip) {
    throw badRequest(`Format CSV rusak pada baris ${awalBaris}: tanda kutip tidak ditutup.`);
  }
  if (nilai.length > 0 || sel.length > 0) {
    sel.push(nilai);
    if (sel.some((s) => s.trim() !== '')) {
      semuaBaris.push({ nomor: awalBaris, sel });
    }
  }

  if (semuaBaris.length === 0) {
    throw badRequest('Berkas CSV kosong.');
  }

  const header = semuaBaris[0]!.sel.map((h) => h.trim().toLowerCase());
  const dataBaris = semuaBaris.slice(1);
  if (dataBaris.length > BATAS_BARIS_CSV) {
    throw badRequest(`Jumlah baris melebihi batas maksimal ${BATAS_BARIS_CSV} baris.`);
  }
  return { header, baris: dataBaris };
}

function periksaHeader(jenis: JenisImpor, header: string[]): void {
  const def = KOLOM_PER_JENIS[jenis];
  const izin = new Set(def.semua);
  const dilihat = new Set<string>();
  const ganda: string[] = [];
  const takDikenal: string[] = [];

  for (const h of header) {
    if (!h) {
      takDikenal.push('(kosong)');
      continue;
    }
    if (dilihat.has(h)) ganda.push(h);
    dilihat.add(h);
    if (!izin.has(h)) takDikenal.push(h);
  }

  if (takDikenal.length > 0) {
    throw badRequest(`Kolom tidak dikenal: ${takDikenal.join(', ')}.`);
  }
  if (ganda.length > 0) {
    throw badRequest(`Kolom ganda pada header: ${ganda.join(', ')}.`);
  }
  const kurang = def.wajib.filter((w) => !dilihat.has(w));
  if (kurang.length > 0) {
    throw badRequest(`Kolom wajib tidak ditemukan: ${kurang.join(', ')}.`);
  }
}

interface BarisGuruSah {
  kode_guru: string;
  nip: string | null;
  nama_guru: string;
  mata_pelajaran: string;
  jabatan: string | null;
  nama_mgmp: string | null;
  status: StatusAktif;
  aksi: 'baru' | 'diperbarui';
}

interface BarisSiswaSah {
  nis: string;
  nama_siswa: string;
  jenis_kelamin: JenisKelamin;
  nama_kelas: string;
  wali_kelas: string | null;
  status: StatusAktif;
  aksi: 'baru' | 'diperbarui';
}

interface BarisJadwalSah {
  kode_guru: string;
  guru_id: number;
  nama_kelas: string;
  hari: number;
  jam_ke: number;
  total_jam_mengajar: number;
  aksi: 'baru' | 'diperbarui';
}

type RencanaImpor =
  | { jenis: 'guru'; baris: BarisGuruSah[] }
  | { jenis: 'siswa'; baris: BarisSiswaSah[] }
  | { jenis: 'jadwal'; baris: BarisJadwalSah[] };

interface HasilValidasi {
  pratinjau: HasilPratinjauImpor;
  rencana: RencanaImpor;
}

function uraiStatus(mentah: string): StatusAktif | null {
  const v = mentah.trim().toLowerCase();
  if (v === '' || v === 'aktif') return 'aktif';
  if (v === 'tidak_aktif' || v === 'tidak aktif' || v === 'nonaktif') return 'tidak_aktif';
  return null;
}

function uraiHari(mentah: string): number | null {
  const v = mentah.trim().toLowerCase();
  if (v in PETA_HARI) return PETA_HARI[v]!;
  if (/^\d+$/.test(v)) {
    const n = Number(v);
    if (n >= HARI_MIN && n <= HARI_MAX) return n;
  }
  return null;
}

function petaBaris(header: string[], sel: string[]): Record<string, string> | null {
  if (sel.length !== header.length) return null;
  const obj: Record<string, string> = {};
  for (let i = 0; i < header.length; i += 1) {
    obj[header[i]!] = (sel[i] ?? '').trim();
  }
  return obj;
}

async function validasiCsv(jenis: JenisImpor, csv: string): Promise<HasilValidasi> {
  const { header, baris } = uraiCsv(csv);
  periksaHeader(jenis, header);

  const galat: GalatBarisImpor[] = [];
  const tambahGalat = (nomor: number, pesan: string) => {
    galat.push({ baris: nomor, pesan });
  };

  if (jenis === 'guru') {
    const [guruLama, mgmpLama] = await Promise.all([
      prisma.guru.findMany({ select: { kode_guru: true, nip: true } }),
      prisma.mgmp.findMany({ select: { nama_mapel: true } }),
    ]);
    const kodeAda = new Set(guruLama.map((g) => g.kode_guru.toLowerCase()));
    const nipKeKode = new Map<string, string>();
    for (const g of guruLama) {
      if (g.nip) nipKeKode.set(g.nip, g.kode_guru.toLowerCase());
    }
    const mgmpAda = new Set(mgmpLama.map((m) => m.nama_mapel.toLowerCase()));
    const mgmpBaru = new Map<string, string>();
    const kodeCsv = new Set<string>();
    const nipCsv = new Set<string>();
    const sah: BarisGuruSah[] = [];

    for (const b of baris) {
      const r = petaBaris(header, b.sel);
      if (!r) {
        tambahGalat(
          b.nomor,
          `Jumlah kolom tidak sesuai header (${b.sel.length}/${header.length}).`,
        );
        continue;
      }
      const masalah: string[] = [];
      const kode = r.kode_guru ?? '';
      const nama = r.nama_guru ?? '';
      const mapel = r.mata_pelajaran ?? '';
      const nip = r.nip || null;
      const jabatan = r.jabatan || null;
      const namaMgmp = r.nama_mgmp || null;
      const status = uraiStatus(r.status ?? '');

      if (!kode) masalah.push('kode_guru wajib diisi');
      else if (kode.length > 20) masalah.push('kode_guru maksimal 20 karakter');
      else if (kodeCsv.has(kode.toLowerCase())) masalah.push(`kode_guru "${kode}" ganda di CSV`);

      if (!nama) masalah.push('nama_guru wajib diisi');
      else if (nama.length > 150) masalah.push('nama_guru maksimal 150 karakter');

      if (!mapel) masalah.push('mata_pelajaran wajib diisi');
      else if (mapel.length > 100) masalah.push('mata_pelajaran maksimal 100 karakter');

      if (nip) {
        if (nip.length > 30) masalah.push('nip maksimal 30 karakter');
        else if (nipCsv.has(nip)) masalah.push(`nip "${nip}" ganda di CSV`);
        else {
          const pemilik = nipKeKode.get(nip);
          if (pemilik && pemilik !== kode.toLowerCase()) {
            masalah.push(`nip "${nip}" sudah dipakai guru lain`);
          }
        }
      }
      if (jabatan && jabatan.length > 100) masalah.push('jabatan maksimal 100 karakter');
      if (namaMgmp && namaMgmp.length > 100) masalah.push('nama_mgmp maksimal 100 karakter');
      if (!status) masalah.push('status harus "aktif" atau "tidak_aktif"');

      if (masalah.length > 0) {
        tambahGalat(b.nomor, `${masalah.join('; ')}.`);
        continue;
      }

      kodeCsv.add(kode.toLowerCase());
      if (nip) nipCsv.add(nip);
      if (namaMgmp && !mgmpAda.has(namaMgmp.toLowerCase())) {
        mgmpBaru.set(namaMgmp.toLowerCase(), namaMgmp);
      }

      sah.push({
        kode_guru: kode,
        nip,
        nama_guru: nama,
        mata_pelajaran: mapel,
        jabatan,
        nama_mgmp: namaMgmp,
        status: status!,
        aksi: kodeAda.has(kode.toLowerCase()) ? 'diperbarui' : 'baru',
      });
    }

    const baru = sah.filter((x) => x.aksi === 'baru').length;
    const diperbarui = sah.length - baru;
    return {
      pratinjau: {
        jenis,
        ringkasan: { total: baris.length, baru, diperbarui, ditolak: galat.length },
        referensi_baru: { kelas: [], mgmp: [...mgmpBaru.values()].sort() },
        galat: galat.slice(0, MAKS_GALAT_DIKEMBALIKAN),
        total_galat: galat.length,
        contoh: sah.slice(0, 10).map((x) => ({
          kode_guru: x.kode_guru,
          nama_guru: x.nama_guru,
          mata_pelajaran: x.mata_pelajaran,
          nama_mgmp: x.nama_mgmp,
          status: x.status,
          aksi: x.aksi,
        })),
        dapat_disimpan: baris.length > 0 && galat.length === 0,
      },
      rencana: { jenis: 'guru', baris: sah },
    };
  }

  if (jenis === 'siswa') {
    const [siswaLama, kelasLama] = await Promise.all([
      prisma.siswa.findMany({ select: { nis: true } }),
      prisma.kelas.findMany({ select: { nama_kelas: true } }),
    ]);
    const nisAda = new Set(siswaLama.map((s) => s.nis));
    const kelasAda = new Set(kelasLama.map((k) => k.nama_kelas.toLowerCase()));
    const kelasBaru = new Map<string, string>();
    const nisCsv = new Set<string>();
    const sah: BarisSiswaSah[] = [];

    for (const b of baris) {
      const r = petaBaris(header, b.sel);
      if (!r) {
        tambahGalat(
          b.nomor,
          `Jumlah kolom tidak sesuai header (${b.sel.length}/${header.length}).`,
        );
        continue;
      }
      const masalah: string[] = [];
      const nis = r.nis ?? '';
      const nama = r.nama_siswa ?? '';
      const jk = (r.jenis_kelamin ?? '').toUpperCase();
      const namaKelas = r.nama_kelas ?? '';
      const wali = r.wali_kelas || null;
      const status = uraiStatus(r.status ?? '');

      if (!nis) masalah.push('nis wajib diisi');
      else if (nis.length > 30) masalah.push('nis maksimal 30 karakter');
      else if (nisCsv.has(nis)) masalah.push(`nis "${nis}" ganda di CSV`);

      if (!nama) masalah.push('nama_siswa wajib diisi');
      else if (nama.length > 150) masalah.push('nama_siswa maksimal 150 karakter');

      if (jk !== 'L' && jk !== 'P') masalah.push('jenis_kelamin harus "L" atau "P"');

      if (!namaKelas) masalah.push('nama_kelas wajib diisi');
      else if (namaKelas.length > 50) masalah.push('nama_kelas maksimal 50 karakter');

      if (wali && wali.length > 150) masalah.push('wali_kelas maksimal 150 karakter');
      if (!status) masalah.push('status harus "aktif" atau "tidak_aktif"');

      if (masalah.length > 0) {
        tambahGalat(b.nomor, `${masalah.join('; ')}.`);
        continue;
      }

      nisCsv.add(nis);
      if (!kelasAda.has(namaKelas.toLowerCase())) {
        kelasBaru.set(namaKelas.toLowerCase(), namaKelas);
      }

      sah.push({
        nis,
        nama_siswa: nama,
        jenis_kelamin: jk as JenisKelamin,
        nama_kelas: namaKelas,
        wali_kelas: wali,
        status: status!,
        aksi: nisAda.has(nis) ? 'diperbarui' : 'baru',
      });
    }

    const baru = sah.filter((x) => x.aksi === 'baru').length;
    const diperbarui = sah.length - baru;
    return {
      pratinjau: {
        jenis,
        ringkasan: { total: baris.length, baru, diperbarui, ditolak: galat.length },
        referensi_baru: { kelas: [...kelasBaru.values()].sort(), mgmp: [] },
        galat: galat.slice(0, MAKS_GALAT_DIKEMBALIKAN),
        total_galat: galat.length,
        contoh: sah.slice(0, 10).map((x) => ({
          nis: x.nis,
          nama_siswa: x.nama_siswa,
          jenis_kelamin: x.jenis_kelamin,
          nama_kelas: x.nama_kelas,
          status: x.status,
          aksi: x.aksi,
        })),
        dapat_disimpan: baris.length > 0 && galat.length === 0,
      },
      rencana: { jenis: 'siswa', baris: sah },
    };
  }

  // jenis === 'jadwal'
  const [guruLama, kelasLama, jadwalLama] = await Promise.all([
    prisma.guru.findMany({ select: { id: true, kode_guru: true } }),
    prisma.kelas.findMany({ select: { nama_kelas: true } }),
    prisma.jadwalMengajar.findMany({ select: { guru_id: true, hari: true, jam_ke: true } }),
  ]);
  const petaGuru = new Map(guruLama.map((g) => [g.kode_guru.toLowerCase(), keNumber(g.id)]));
  const kelasAda = new Set(kelasLama.map((k) => k.nama_kelas.toLowerCase()));
  const jadwalAda = new Set(jadwalLama.map((j) => `${keNumber(j.guru_id)}:${j.hari}:${j.jam_ke}`));
  const kelasBaru = new Map<string, string>();
  const kunciCsv = new Set<string>();
  const sah: BarisJadwalSah[] = [];

  for (const b of baris) {
    const r = petaBaris(header, b.sel);
    if (!r) {
      tambahGalat(b.nomor, `Jumlah kolom tidak sesuai header (${b.sel.length}/${header.length}).`);
      continue;
    }
    const masalah: string[] = [];
    const kodeGuru = r.kode_guru ?? '';
    const guruId = petaGuru.get(kodeGuru.toLowerCase());
    const namaKelas = r.nama_kelas ?? '';
    const hari = uraiHari(r.hari ?? '');
    const jamKe = /^\d+$/.test(r.jam_ke ?? '') ? Number(r.jam_ke) : Number.NaN;
    const jp = /^\d+$/.test(r.total_jam_mengajar ?? '') ? Number(r.total_jam_mengajar) : Number.NaN;

    if (!kodeGuru) masalah.push('kode_guru wajib diisi');
    else if (guruId === undefined) masalah.push(`kode_guru "${kodeGuru}" tidak ditemukan`);

    if (!namaKelas) masalah.push('nama_kelas wajib diisi');
    else if (namaKelas.length > 50) masalah.push('nama_kelas maksimal 50 karakter');

    if (hari === null) masalah.push('hari harus 1–6 atau Senin–Sabtu');

    if (!Number.isInteger(jamKe) || jamKe < JAM_KE_MIN || jamKe > JAM_KE_MAX) {
      masalah.push(`jam_ke harus bilangan bulat ${JAM_KE_MIN}–${JAM_KE_MAX}`);
    }
    if (!Number.isInteger(jp) || jp < LAMA_JAM_MIN || jp > LAMA_JAM_MAX) {
      masalah.push(`total_jam_mengajar harus bilangan bulat ${LAMA_JAM_MIN}–${LAMA_JAM_MAX}`);
    }

    const kunci = guruId !== undefined && hari !== null ? `${guruId}:${hari}:${jamKe}` : null;
    if (kunci && kunciCsv.has(kunci)) {
      masalah.push(`jadwal ganda di CSV untuk guru "${kodeGuru}" hari ${hari} jam ke-${jamKe}`);
    }

    if (masalah.length > 0 || guruId === undefined || hari === null || !kunci) {
      tambahGalat(b.nomor, `${masalah.join('; ')}.`);
      continue;
    }

    kunciCsv.add(kunci);
    if (!kelasAda.has(namaKelas.toLowerCase())) {
      kelasBaru.set(namaKelas.toLowerCase(), namaKelas);
    }

    sah.push({
      kode_guru: kodeGuru,
      guru_id: guruId,
      nama_kelas: namaKelas,
      hari,
      jam_ke: jamKe,
      total_jam_mengajar: jp,
      aksi: jadwalAda.has(kunci) ? 'diperbarui' : 'baru',
    });
  }

  const baru = sah.filter((x) => x.aksi === 'baru').length;
  const diperbarui = sah.length - baru;
  return {
    pratinjau: {
      jenis,
      ringkasan: { total: baris.length, baru, diperbarui, ditolak: galat.length },
      referensi_baru: { kelas: [...kelasBaru.values()].sort(), mgmp: [] },
      galat: galat.slice(0, MAKS_GALAT_DIKEMBALIKAN),
      total_galat: galat.length,
      contoh: sah.slice(0, 10).map((x) => ({
        kode_guru: x.kode_guru,
        nama_kelas: x.nama_kelas,
        hari: NAMA_HARI[x.hari] ?? x.hari,
        jam_ke: x.jam_ke,
        total_jam_mengajar: x.total_jam_mengajar,
        aksi: x.aksi,
      })),
      dapat_disimpan: baris.length > 0 && galat.length === 0,
    },
    rencana: { jenis: 'jadwal', baris: sah },
  };
}

export const impor = {
  async pratinjau(jenis: JenisImpor, csv: string): Promise<HasilPratinjauImpor> {
    const { pratinjau } = await validasiCsv(jenis, csv);
    return pratinjau;
  },

  async simpan(
    jenis: JenisImpor,
    csv: string,
    izinkanBuatReferensi: boolean,
    audit: KonteksAudit,
  ): Promise<HasilSimpanImpor> {
    const { pratinjau, rencana } = await validasiCsv(jenis, csv);
    if (pratinjau.ringkasan.total === 0) {
      throw businessRule('Tidak ada baris data untuk diimpor.');
    }
    if (pratinjau.ringkasan.ditolak > 0) {
      throw businessRule(
        `Impor dibatalkan: terdapat ${pratinjau.ringkasan.ditolak} baris tidak valid. Perbaiki semua galat terlebih dahulu.`,
      );
    }

    const butuhRefBaru =
      pratinjau.referensi_baru.kelas.length > 0 || pratinjau.referensi_baru.mgmp.length > 0;
    if (butuhRefBaru && !izinkanBuatReferensi) {
      const daftar = [
        ...pratinjau.referensi_baru.kelas.map((k) => `kelas "${k}"`),
        ...pratinjau.referensi_baru.mgmp.map((m) => `MGMP "${m}"`),
      ];
      throw businessRule(
        `Konfirmasi pembuatan referensi baru terlebih dahulu: ${daftar.join(', ')}.`,
      );
    }

    const hasil = await prisma.$transaction(async (tx) => {
      let kelasDibuat = 0;
      let mgmpDibuat = 0;

      for (const namaKelas of pratinjau.referensi_baru.kelas) {
        await tx.kelas.create({ data: { nama_kelas: namaKelas } });
        kelasDibuat += 1;
      }
      for (const namaMapel of pratinjau.referensi_baru.mgmp) {
        await tx.mgmp.create({ data: { nama_mapel: namaMapel } });
        mgmpDibuat += 1;
      }

      if (rencana.jenis === 'guru') {
        const semuaMgmp = await tx.mgmp.findMany({ select: { id: true, nama_mapel: true } });
        const petaMgmp = new Map(semuaMgmp.map((m) => [m.nama_mapel.toLowerCase(), m.id]));

        for (const b of rencana.baris) {
          const mgmpId = b.nama_mgmp ? (petaMgmp.get(b.nama_mgmp.toLowerCase()) ?? null) : null;
          await tx.guru.upsert({
            where: { kode_guru: b.kode_guru },
            create: {
              kode_guru: b.kode_guru,
              nip: b.nip,
              nama_guru: b.nama_guru,
              mata_pelajaran: b.mata_pelajaran,
              jabatan: b.jabatan,
              mgmp_id: mgmpId,
              status: b.status,
            },
            update: {
              nip: b.nip,
              nama_guru: b.nama_guru,
              mata_pelajaran: b.mata_pelajaran,
              jabatan: b.jabatan,
              mgmp_id: mgmpId,
              status: b.status,
            },
          });
        }
      } else if (rencana.jenis === 'siswa') {
        const semuaKelas = await tx.kelas.findMany({ select: { id: true, nama_kelas: true } });
        const petaKelas = new Map(semuaKelas.map((k) => [k.nama_kelas.toLowerCase(), k.id]));

        for (const b of rencana.baris) {
          const kelasId = petaKelas.get(b.nama_kelas.toLowerCase());
          if (!kelasId) {
            throw businessRule(`Kelas "${b.nama_kelas}" tidak ditemukan.`);
          }
          await tx.siswa.upsert({
            where: { nis: b.nis },
            create: {
              nis: b.nis,
              nama_siswa: b.nama_siswa,
              jenis_kelamin: b.jenis_kelamin,
              kelas_id: kelasId,
              wali_kelas: b.wali_kelas,
              status: b.status,
            },
            update: {
              nama_siswa: b.nama_siswa,
              jenis_kelamin: b.jenis_kelamin,
              kelas_id: kelasId,
              wali_kelas: b.wali_kelas,
              status: b.status,
            },
          });
        }
      } else {
        const semuaKelas = await tx.kelas.findMany({ select: { id: true, nama_kelas: true } });
        const petaKelas = new Map(semuaKelas.map((k) => [k.nama_kelas.toLowerCase(), k.id]));

        for (const b of rencana.baris) {
          const kelasId = petaKelas.get(b.nama_kelas.toLowerCase());
          if (!kelasId) {
            throw businessRule(`Kelas "${b.nama_kelas}" tidak ditemukan.`);
          }
          await tx.jadwalMengajar.upsert({
            where: {
              guru_id_hari_jam_ke: { guru_id: b.guru_id, hari: b.hari, jam_ke: b.jam_ke },
            },
            create: {
              guru_id: b.guru_id,
              kelas_id: kelasId,
              hari: b.hari,
              jam_ke: b.jam_ke,
              total_jam_mengajar: b.total_jam_mengajar,
            },
            update: {
              kelas_id: kelasId,
              total_jam_mengajar: b.total_jam_mengajar,
            },
          });
        }
      }

      // Log aktivitas hanya mencatat jumlah baris, bukan isi data pribadi (Fase 14).
      await catatAudit(tx, audit, {
        module: 'Settings',
        aktivitas: `IMPOR_${jenis.toUpperCase()}`,
        entity_type: jenis === 'jadwal' ? 'jadwal_mengajar' : jenis,
        description: `Impor ${jenis}: ${pratinjau.ringkasan.baru} baru, ${pratinjau.ringkasan.diperbarui} diperbarui${kelasDibuat > 0 ? `, ${kelasDibuat} kelas baru` : ''}${mgmpDibuat > 0 ? `, ${mgmpDibuat} MGMP baru` : ''}.`,
      });

      return {
        jenis,
        baru: pratinjau.ringkasan.baru,
        diperbarui: pratinjau.ringkasan.diperbarui,
        kelas_dibuat: kelasDibuat,
        mgmp_dibuat: mgmpDibuat,
      };
    });

    batalkanCacheDashboard();
    return hasil;
  },

  async hapusDataPilot(
    konfirmasiNamaSekolah: string,
    audit: KonteksAudit,
  ): Promise<HasilHapusPilot> {
    const sekolah = await prisma.sekolahSettings.findFirst({ orderBy: { id: 'asc' } });
    if (!sekolah) throw notFound('Pengaturan sekolah belum diisi.');
    if (konfirmasiNamaSekolah.trim() !== sekolah.nama_sekolah.trim()) {
      throw businessRule('Nama sekolah tidak sesuai. Penghapusan data pilot dibatalkan.');
    }

    const dihapus = await prisma.$transaction(async (tx) => {
      const penilaianMgmpSiswa = (await tx.penilaianMgmpSiswa.deleteMany()).count;
      const penilaianMgmp = (await tx.penilaianMgmp.deleteMany()).count;
      const penilaianKinerja = (await tx.penilaianKinerjaBulanan.deleteMany()).count;
      const rekap = (await tx.rekapKehadiranGuru.deleteMany()).count;
      const kehadiranSiswa = (await tx.kehadiranSiswa.deleteMany()).count;
      const kehadiran = (await tx.kehadiran.deleteMany()).count;
      const jadwal = (await tx.jadwalMengajar.deleteMany()).count;
      const siswa = (await tx.siswa.deleteMany()).count;
      const guru = (await tx.guru.deleteMany()).count;

      const hasil = {
        penilaian_mgmp_siswa: penilaianMgmpSiswa,
        penilaian_mgmp: penilaianMgmp,
        penilaian_kinerja: penilaianKinerja,
        rekap,
        kehadiran_siswa: kehadiranSiswa,
        kehadiran,
        jadwal,
        siswa,
        guru,
      };

      await catatAudit(tx, audit, {
        module: 'Settings',
        aktivitas: 'HAPUS_DATA_PILOT',
        entity_type: 'sekolah_settings',
        entity_id: sekolah.id,
        description: `Menghapus data pilot: ${guru} guru, ${siswa} siswa, ${jadwal} jadwal, ${kehadiran} kehadiran guru, ${kehadiranSiswa} kehadiran siswa, ${rekap} rekap, ${penilaianKinerja} penilaian kinerja, ${penilaianMgmp} penilaian MGMP.`,
      });

      return hasil;
    });

    batalkanCacheDashboard();
    return { dihapus };
  },
};
