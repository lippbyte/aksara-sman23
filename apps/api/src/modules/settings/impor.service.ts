import {
  BATAS_BARIS_CSV,
  BATAS_UKURAN_CSV_BYTE,
  BATAS_UKURAN_XLSX_BYTE,
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
  type PratinjauImporInput,
  type StatusAktif,
} from '@sms/shared';
import ExcelJS from 'exceljs';
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
      semua: ['nis', 'nama_siswa', 'jenis_kelamin', 'nama_kelas', 'wali_kelas', 'bk', 'status'],
      wajib: ['nis', 'nama_siswa', 'jenis_kelamin', 'nama_kelas'],
    },
    jadwal: {
      semua: ['kode_guru', 'nama_kelas', 'hari', 'jam_ke', 'total_jam_mengajar'],
      wajib: ['kode_guru', 'nama_kelas', 'hari', 'jam_ke', 'total_jam_mengajar'],
    },
  };

/** Pemetaan alias header (dari templat CSV atau dokumen Excel sekolah) ke nama kolom kanonik. */
const ALIAS_KOLOM: Record<JenisImpor, Record<string, string>> = {
  guru: {
    kode_guru: 'kode_guru',
    'kode guru': 'kode_guru',
    kode: 'kode_guru',
    nip: 'nip',
    nama_guru: 'nama_guru',
    'nama guru': 'nama_guru',
    'nama pengajar': 'nama_guru',
    pengajar: 'nama_guru',
    nama: 'nama_guru',
    mata_pelajaran: 'mata_pelajaran',
    'mata pelajaran': 'mata_pelajaran',
    mapel: 'mata_pelajaran',
    jabatan: 'jabatan',
    nama_mgmp: 'nama_mgmp',
    'nama mgmp': 'nama_mgmp',
    mgmp: 'nama_mgmp',
    status: 'status',
  },
  siswa: {
    nis: 'nis',
    'no induk': 'nis',
    'nomor induk': 'nis',
    nama_siswa: 'nama_siswa',
    'nama siswa': 'nama_siswa',
    'nama peserta didik': 'nama_siswa',
    'nama lengkap': 'nama_siswa',
    nama: 'nama_siswa',
    jenis_kelamin: 'jenis_kelamin',
    'jenis kelamin': 'jenis_kelamin',
    jk: 'jenis_kelamin',
    'j/k': 'jenis_kelamin',
    'l/p': 'jenis_kelamin',
    kelamin: 'jenis_kelamin',
    nama_kelas: 'nama_kelas',
    'nama kelas': 'nama_kelas',
    kelas: 'nama_kelas',
    rombel: 'nama_kelas',
    wali_kelas: 'wali_kelas',
    'wali kelas': 'wali_kelas',
    wali: 'wali_kelas',
    'nama wali kelas': 'wali_kelas',
    bk: 'bk',
    guru_bk: 'bk',
    'guru bk': 'bk',
    'nama bk': 'bk',
    'nama guru bk': 'bk',
    'bimbingan konseling': 'bk',
    konselor: 'bk',
    status: 'status',
  },
  jadwal: {
    kode_guru: 'kode_guru',
    'kode guru': 'kode_guru',
    kode: 'kode_guru',
    nama_kelas: 'nama_kelas',
    'nama kelas': 'nama_kelas',
    kelas: 'nama_kelas',
    rombel: 'nama_kelas',
    hari: 'hari',
    jam_ke: 'jam_ke',
    'jam ke': 'jam_ke',
    'jam ke-': 'jam_ke',
    total_jam_mengajar: 'total_jam_mengajar',
    'total jam mengajar': 'total_jam_mengajar',
    'total jp': 'total_jam_mengajar',
    'jumlah jp': 'total_jam_mengajar',
    jp: 'total_jam_mengajar',
  },
};

const KOLOM_PENOMORAN_DIABAIKAN = new Set(['no', 'no.', 'nomor', '#']);

const SHEET_GENERIK = new Set([
  'sheet1',
  'sheet2',
  'sheet3',
  'data',
  'siswa',
  'guru',
  'jadwal',
  'template',
  'templat',
  'petunjuk',
  'master',
]);

const HEADER_TEMPLAT_XLSX: Record<JenisImpor, readonly string[]> = {
  guru: ['Kode', 'Nama Pengajar', 'Mata Pelajaran', 'NIP', 'Jabatan', 'Nama MGMP', 'Status'],
  siswa: ['NIS', 'NAMA', 'JK', 'Kelas', 'Wali Kelas', 'BK', 'Status'],
  jadwal: ['Kode Guru', 'Kelas', 'Hari', 'Jam Ke', 'Total JP'],
};

const PETA_HARI: Record<string, number> = Object.fromEntries(
  Object.entries(NAMA_HARI).map(([angka, nama]) => [nama.toLowerCase(), Number(angka)]),
);

const MAKS_GALAT_DIKEMBALIKAN = 200;

function kunciHeader(raw: string): string {
  return raw.trim().toLowerCase().replace(/[:]+$/, '').replace(/\s+/g, ' ');
}

function terjemahkanHeader(jenis: JenisImpor, raw: string): string | null {
  const k = kunciHeader(raw);
  if (!k) return null;
  const peta = ALIAS_KOLOM[jenis];
  return peta[k] ?? peta[k.replace(/_/g, ' ')] ?? null;
}

/** Menghasilkan CSV templat kosong (UTF-8 + BOM) untuk tiap jenis data master. */
export function templatCsv(jenis: JenisImpor): { namaBerkas: string; isi: string } {
  const kolom = KOLOM_PER_JENIS[jenis].semua.map((k) => ({ judul: k, nilai: () => '' }));
  return {
    namaBerkas: `templat-impor-${jenis}.csv`,
    isi: keCsv(kolom, []),
  };
}

/** Menghasilkan templat Excel (.xlsx) siap pakai untuk admin. */
export async function templatXlsx(jenis: JenisImpor): Promise<{ namaBerkas: string; isi: Buffer }> {
  const wb = new ExcelJS.Workbook();
  const sheetNama =
    jenis === 'guru' ? 'Data Guru' : jenis === 'siswa' ? 'Data Siswa' : 'Data Jadwal';
  const ws = wb.addWorksheet(sheetNama);
  const headers = [...HEADER_TEMPLAT_XLSX[jenis]];
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headers.forEach((h, idx) => {
    ws.getColumn(idx + 1).width = Math.max(h.length + 6, 16);
  });

  const info = wb.addWorksheet('Petunjuk');
  info.addRow(['Jenis Impor', sheetNama]);
  info.addRow([
    'Kolom Wajib',
    jenis === 'guru'
      ? 'Kode, Nama Pengajar, Mata Pelajaran'
      : jenis === 'siswa'
        ? 'NIS, NAMA, JK (L/P), Kelas (atau gunakan nama sheet per kelas, mis. X-1, XI-1, XII-1)'
        : 'Kode Guru, Kelas, Hari (Senin–Sabtu / 1–6), Jam Ke, Total JP',
  ]);
  info.addRow([
    'Catatan',
    'Kolom tambahan di luar bidang yang dibutuhkan pada berkas .xlsx akan diabaikan otomatis.',
  ]);
  info.getColumn(1).width = 18;
  info.getColumn(2).width = 80;

  const raw = await wb.xlsx.writeBuffer();
  return {
    namaBerkas: `templat-impor-${jenis}.xlsx`,
    isi: Buffer.from(raw),
  };
}

interface HasilUraiCsv {
  header: string[];
  baris: { nomor: number; sel: string[] }[];
}

function deteksiPemisahCsv(teks: string): ',' | ';' {
  const barisPertama = teks.split(/\r?\n/, 1)[0] ?? '';
  let dalamKutip = false;
  let koma = 0;
  let titikKoma = 0;
  for (let i = 0; i < barisPertama.length; i += 1) {
    const c = barisPertama[i];
    if (c === '"') {
      if (barisPertama[i + 1] === '"') i += 1;
      else dalamKutip = !dalamKutip;
    } else if (!dalamKutip) {
      if (c === ',') koma += 1;
      else if (c === ';') titikKoma += 1;
    }
  }
  return koma === 0 && titikKoma > 0 ? ';' : ',';
}

/**
 * Pengurai CSV RFC-4180 ketat (UTF-8, BOM opsional, pemisah koma/titik koma, tanda kutip ganda).
 * Melempar 400 bila tanda kutip rusak atau jumlah baris melebihi batas.
 */
export function uraiCsv(mentah: string): HasilUraiCsv {
  if (Buffer.byteLength(mentah, 'utf8') > BATAS_UKURAN_CSV_BYTE) {
    throw badRequest('Ukuran berkas CSV maksimal 2 MB.');
  }
  const teks = mentah.startsWith('\uFEFF') ? mentah.slice(1) : mentah;
  const pemisah = deteksiPemisahCsv(teks);
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
    } else if (ch === pemisah) {
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

  const header = semuaBaris[0]!.sel.map((h) => h.trim());
  const dataBaris = semuaBaris.slice(1);
  if (dataBaris.length > BATAS_BARIS_CSV) {
    throw badRequest(`Jumlah baris melebihi batas maksimal ${BATAS_BARIS_CSV} baris.`);
  }
  return { header, baris: dataBaris };
}

interface BarisRekord {
  nomor: number;
  sheet?: string;
  selJumlahSalah?: { aktual: number; diharapkan: number };
  nilai: Partial<Record<string, string>>;
}

function uraiCsvKeRekord(jenis: JenisImpor, csv: string): BarisRekord[] {
  const { header, baris } = uraiCsv(csv);
  const def = KOLOM_PER_JENIS[jenis];
  const izin = new Set(def.semua);
  const dilihat = new Set<string>();
  const ganda: string[] = [];
  const takDikenal: string[] = [];
  const pemetaan: (string | null)[] = [];

  for (const h of header) {
    const kunci = kunciHeader(h);
    if (!kunci) {
      takDikenal.push('(kosong)');
      pemetaan.push(null);
      continue;
    }
    if (KOLOM_PENOMORAN_DIABAIKAN.has(kunci)) {
      pemetaan.push(null);
      continue;
    }
    const kanonik = terjemahkanHeader(jenis, h);
    if (!kanonik || !izin.has(kanonik)) {
      takDikenal.push(kunci);
      pemetaan.push(null);
      continue;
    }
    if (dilihat.has(kanonik)) ganda.push(kanonik);
    dilihat.add(kanonik);
    pemetaan.push(kanonik);
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

  return baris.map((b) => {
    if (b.sel.length !== header.length) {
      return {
        nomor: b.nomor,
        selJumlahSalah: { aktual: b.sel.length, diharapkan: header.length },
        nilai: {},
      };
    }
    const nilai: Partial<Record<string, string>> = {};
    for (let i = 0; i < pemetaan.length; i += 1) {
      const k = pemetaan[i];
      if (k) nilai[k] = (b.sel[i] ?? '').trim();
    }
    return { nomor: b.nomor, nilai };
  });
}

function ekstrakNilaiSelExcel(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return '';
    return Number.isInteger(val) ? String(val) : String(val);
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'object') {
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText
        .map((r) => r.text ?? '')
        .join('')
        .trim();
    }
    if ('text' in val && typeof val.text === 'string') {
      return val.text.trim();
    }
    if ('result' in val) {
      return ekstrakNilaiSelExcel((val as ExcelJS.CellFormulaValue).result ?? null);
    }
  }
  return String(val).trim();
}

function bacaBarisSelExcel(row: ExcelJS.Row, maksKolom: number): string[] {
  const hasil: string[] = [];
  for (let col = 1; col <= maksKolom; col += 1) {
    hasil.push(ekstrakNilaiSelExcel(row.getCell(col).value));
  }
  return hasil;
}

function bersihkanNamaSheetKelas(namaSheet: string): string | null {
  const bersih = namaSheet.trim().replace(/\s+/g, ' ');
  if (!bersih || SHEET_GENERIK.has(bersih.toLowerCase())) return null;
  const tanpaAwalan = bersih.replace(/^kelas\s+/i, '').trim();
  if (!tanpaAwalan || SHEET_GENERIK.has(tanpaAwalan.toLowerCase())) return null;
  return tanpaAwalan;
}

interface MetadataSheetSiswa {
  kelas?: string;
  wali_kelas?: string;
  bk?: string;
}

function ekstrakNilaiSetelahLabel(sel: string[], index: number): string | null {
  const isi = sel[index] ?? '';
  const cocokInline = isi.match(/^[^:]+:\s*(.+)$/);
  if (cocokInline?.[1]) {
    const v = cocokInline[1].trim();
    if (v && v !== ':') return v;
  }
  for (let j = index + 1; j < Math.min(sel.length, index + 6); j += 1) {
    const mentah = sel[j] ?? '';
    if (
      /^(wali(\s+kelas)?|guru\s+bk|bimbingan\s+konseling|konselor|bk|kelas)(\s*:|$)/i.test(mentah)
    ) {
      break;
    }
    const kanan = mentah.replace(/^:\s*/, '').trim();
    if (kanan && kanan !== ':') return kanan;
  }
  return null;
}

function ekstrakMetaSheetSiswa(ws: ExcelJS.Worksheet, sebelumBaris: number): MetadataSheetSiswa {
  const meta: MetadataSheetSiswa = {};
  const maksKolom = Math.min(Math.max(ws.columnCount, 12), 30);

  for (let r = 1; r < sebelumBaris; r += 1) {
    const sel = bacaBarisSelExcel(ws.getRow(r), maksKolom);
    for (let c = 0; c < sel.length; c += 1) {
      const teks = sel[c] ?? '';
      if (!teks) continue;
      const lower = teks.toLowerCase();

      if (!meta.wali_kelas && /^wali(\s+kelas)?(\s*:.*)?$/.test(lower)) {
        const v = ekstrakNilaiSetelahLabel(sel, c);
        if (v) meta.wali_kelas = v;
      } else if (
        !meta.bk &&
        /^(guru\s+bk|bimbingan\s+konseling|konselor|bk)(\s*:.*)?$/.test(lower)
      ) {
        const v = ekstrakNilaiSetelahLabel(sel, c);
        if (v) meta.bk = v;
      } else if (!meta.kelas && /^kelas(\s*:.*)?$/.test(lower)) {
        const v = ekstrakNilaiSetelahLabel(sel, c);
        if (v) meta.kelas = v;
      }
    }
  }
  return meta;
}

function cariBarisHeaderExcel(
  ws: ExcelJS.Worksheet,
  jenis: JenisImpor,
): { rowIdx: number; petaKolom: Map<number, string> } | null {
  const batasScan = Math.min(ws.rowCount, 30);
  const maksKolom = Math.min(Math.max(ws.columnCount, 10), 40);

  for (let r = 1; r <= batasScan; r += 1) {
    const sel = bacaBarisSelExcel(ws.getRow(r), maksKolom);
    const petaKolom = new Map<number, string>();
    const sudah = new Set<string>();

    for (let c = 0; c < sel.length; c += 1) {
      const kanonik = terjemahkanHeader(jenis, sel[c] ?? '');
      if (kanonik && !sudah.has(kanonik)) {
        sudah.add(kanonik);
        petaKolom.set(c, kanonik);
      }
    }

    const cocok =
      jenis === 'siswa'
        ? sudah.has('nis') && sudah.has('nama_siswa')
        : jenis === 'guru'
          ? sudah.has('kode_guru') && sudah.has('nama_guru') && sudah.has('mata_pelajaran')
          : KOLOM_PER_JENIS.jadwal.wajib.every((k) => sudah.has(k));

    if (cocok) {
      return { rowIdx: r, petaKolom };
    }
  }
  return null;
}

const PENANDA_CATATAN_BAWAH_TABEL = /^(jumlah|total|mengetahui|kepala|nip\.?|catatan|rekap)\b/i;

async function uraiXlsxKeRekord(
  jenis: JenisImpor,
  xlsxBase64: string,
): Promise<{ records: BarisRekord[]; multiSheet: boolean }> {
  const bersih = xlsxBase64.replace(/^data:[^;]+;base64,/, '').trim();
  const buf = Buffer.from(bersih, 'base64');
  if (buf.byteLength === 0) {
    throw badRequest('Berkas Excel kosong.');
  }
  if (buf.byteLength > BATAS_UKURAN_XLSX_BYTE) {
    throw badRequest('Ukuran berkas Excel maksimal 4 MB.');
  }
  // Signature ZIP (.xlsx adalah arsip OpenXML PK\x03\x04).
  if (buf.byteLength < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw badRequest('Berkas bukan format Excel (.xlsx) yang valid.');
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as never);
  } catch {
    throw badRequest('Berkas Excel (.xlsx) rusak atau terproteksi kata sandi.');
  }

  const records: BarisRekord[] = [];
  const sheetTerbaca: string[] = [];

  for (const ws of wb.worksheets) {
    if (ws.rowCount === 0) continue;
    const header = cariBarisHeaderExcel(ws, jenis);
    if (!header) continue;

    sheetTerbaca.push(ws.name);
    const metaSiswa = jenis === 'siswa' ? ekstrakMetaSheetSiswa(ws, header.rowIdx) : {};
    const namaSheetKelas =
      jenis === 'siswa' ? (metaSiswa.kelas ?? bersihkanNamaSheetKelas(ws.name)) : null;
    const maksKolom = Math.max(...header.petaKolom.keys()) + 1;

    for (let r = header.rowIdx + 1; r <= ws.rowCount; r += 1) {
      const sel = bacaBarisSelExcel(ws.getRow(r), maksKolom);
      const nilai: Partial<Record<string, string>> = {};
      let adaIsi = false;

      for (const [idxKol, kanonik] of header.petaKolom) {
        const v = (sel[idxKol] ?? '').trim();
        if (v) adaIsi = true;
        nilai[kanonik] = v;
      }

      if (!adaIsi) continue;

      if (jenis === 'siswa') {
        const nis = nilai.nis ?? '';
        const nama = nilai.nama_siswa ?? '';
        const jk = nilai.jenis_kelamin ?? '';
        // Lewati baris ringkasan/tanda tangan di bagian bawah daftar siswa.
        if (!nis && !jk && (!nama || PENANDA_CATATAN_BAWAH_TABEL.test(nama))) {
          continue;
        }
        if (!nilai.nama_kelas && namaSheetKelas) {
          nilai.nama_kelas = namaSheetKelas;
        }
        if (!nilai.wali_kelas && metaSiswa.wali_kelas) {
          nilai.wali_kelas = metaSiswa.wali_kelas;
        }
        if (!nilai.bk && metaSiswa.bk) {
          nilai.bk = metaSiswa.bk;
        }
      }

      records.push({ nomor: r, sheet: ws.name, nilai });
      if (records.length > BATAS_BARIS_CSV) {
        throw badRequest(`Jumlah baris melebihi batas maksimal ${BATAS_BARIS_CSV} baris.`);
      }
    }
  }

  if (sheetTerbaca.length === 0) {
    const butuh =
      jenis === 'guru'
        ? 'Kode (kode_guru), Nama Pengajar (nama_guru), dan Mata Pelajaran (mata_pelajaran)'
        : jenis === 'siswa'
          ? 'NIS, NAMA (nama_siswa), dan JK (jenis_kelamin)'
          : 'kode_guru, nama_kelas, hari, jam_ke, dan total_jam_mengajar';
    throw badRequest(`Header kolom wajib (${butuh}) tidak ditemukan pada sheet Excel manapun.`);
  }

  return { records, multiSheet: sheetTerbaca.length > 1 };
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
  bk: string | null;
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

function uraiJenisKelamin(mentah: string): JenisKelamin | null {
  const v = mentah.trim().toUpperCase().replace(/\./g, '');
  if (v === 'L' || v === 'LK' || v === 'LAKI-LAKI' || v === 'LAKI LAKI' || v === 'PUTRA') {
    return 'L';
  }
  if (v === 'P' || v === 'PR' || v === 'PEREMPUAN' || v === 'WANITA' || v === 'PUTRI') {
    return 'P';
  }
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

async function uraiMasukanImpor(
  jenis: JenisImpor,
  input: PratinjauImporInput,
): Promise<{ records: BarisRekord[]; multiSheet: boolean }> {
  if (input.xlsx_base64) {
    return uraiXlsxKeRekord(jenis, input.xlsx_base64);
  }
  return { records: uraiCsvKeRekord(jenis, input.csv ?? ''), multiSheet: false };
}

async function validasiMasukan(
  jenis: JenisImpor,
  input: PratinjauImporInput,
): Promise<HasilValidasi> {
  const { records, multiSheet } = await uraiMasukanImpor(jenis, input);

  const galat: GalatBarisImpor[] = [];
  const tambahGalat = (b: BarisRekord, pesan: string) => {
    const awalan = multiSheet && b.sheet ? `[Sheet ${b.sheet}] ` : '';
    galat.push({ baris: b.nomor, pesan: `${awalan}${pesan}` });
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
    const kodeUnik = new Set<string>();
    const nipUnik = new Set<string>();
    const sah: BarisGuruSah[] = [];

    for (const b of records) {
      if (b.selJumlahSalah) {
        tambahGalat(
          b,
          `Jumlah kolom tidak sesuai header (${b.selJumlahSalah.aktual}/${b.selJumlahSalah.diharapkan}).`,
        );
        continue;
      }
      const r = b.nilai;
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
      else if (kodeUnik.has(kode.toLowerCase()))
        masalah.push(`kode_guru "${kode}" ganda di berkas`);

      if (!nama) masalah.push('nama_guru wajib diisi');
      else if (nama.length > 150) masalah.push('nama_guru maksimal 150 karakter');

      if (!mapel) masalah.push('mata_pelajaran wajib diisi');
      else if (mapel.length > 100) masalah.push('mata_pelajaran maksimal 100 karakter');

      if (nip) {
        if (nip.length > 30) masalah.push('nip maksimal 30 karakter');
        else if (nipUnik.has(nip)) masalah.push(`nip "${nip}" ganda di berkas`);
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
        tambahGalat(b, `${masalah.join('; ')}.`);
        continue;
      }

      kodeUnik.add(kode.toLowerCase());
      if (nip) nipUnik.add(nip);
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
        ringkasan: { total: records.length, baru, diperbarui, ditolak: galat.length },
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
        dapat_disimpan: records.length > 0 && galat.length === 0,
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
    const nisUnik = new Set<string>();
    const sah: BarisSiswaSah[] = [];

    for (const b of records) {
      if (b.selJumlahSalah) {
        tambahGalat(
          b,
          `Jumlah kolom tidak sesuai header (${b.selJumlahSalah.aktual}/${b.selJumlahSalah.diharapkan}).`,
        );
        continue;
      }
      const r = b.nilai;
      const masalah: string[] = [];
      const nis = r.nis ?? '';
      const nama = r.nama_siswa ?? '';
      const jk = uraiJenisKelamin(r.jenis_kelamin ?? '');
      const namaKelas = r.nama_kelas ?? '';
      const wali = r.wali_kelas || null;
      const bk = r.bk || null;
      const status = uraiStatus(r.status ?? '');

      if (!nis) masalah.push('nis wajib diisi');
      else if (nis.length > 30) masalah.push('nis maksimal 30 karakter');
      else if (nisUnik.has(nis)) masalah.push(`nis "${nis}" ganda di berkas`);

      if (!nama) masalah.push('nama_siswa wajib diisi');
      else if (nama.length > 150) masalah.push('nama_siswa maksimal 150 karakter');

      if (!jk) masalah.push('jenis_kelamin harus "L" atau "P"');

      if (!namaKelas) masalah.push('nama_kelas wajib diisi');
      else if (namaKelas.length > 50) masalah.push('nama_kelas maksimal 50 karakter');

      if (wali && wali.length > 150) masalah.push('wali_kelas maksimal 150 karakter');
      if (bk && bk.length > 150) masalah.push('bk maksimal 150 karakter');
      if (!status) masalah.push('status harus "aktif" atau "tidak_aktif"');

      if (masalah.length > 0) {
        tambahGalat(b, `${masalah.join('; ')}.`);
        continue;
      }

      nisUnik.add(nis);
      if (!kelasAda.has(namaKelas.toLowerCase())) {
        kelasBaru.set(namaKelas.toLowerCase(), namaKelas);
      }

      sah.push({
        nis,
        nama_siswa: nama,
        jenis_kelamin: jk!,
        nama_kelas: namaKelas,
        wali_kelas: wali,
        bk,
        status: status!,
        aksi: nisAda.has(nis) ? 'diperbarui' : 'baru',
      });
    }

    const baru = sah.filter((x) => x.aksi === 'baru').length;
    const diperbarui = sah.length - baru;
    return {
      pratinjau: {
        jenis,
        ringkasan: { total: records.length, baru, diperbarui, ditolak: galat.length },
        referensi_baru: { kelas: [...kelasBaru.values()].sort(), mgmp: [] },
        galat: galat.slice(0, MAKS_GALAT_DIKEMBALIKAN),
        total_galat: galat.length,
        contoh: sah.slice(0, 10).map((x) => ({
          nis: x.nis,
          nama_siswa: x.nama_siswa,
          jenis_kelamin: x.jenis_kelamin,
          nama_kelas: x.nama_kelas,
          wali_kelas: x.wali_kelas,
          bk: x.bk,
          status: x.status,
          aksi: x.aksi,
        })),
        dapat_disimpan: records.length > 0 && galat.length === 0,
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
  const kunciUnik = new Set<string>();
  const sah: BarisJadwalSah[] = [];

  for (const b of records) {
    if (b.selJumlahSalah) {
      tambahGalat(
        b,
        `Jumlah kolom tidak sesuai header (${b.selJumlahSalah.aktual}/${b.selJumlahSalah.diharapkan}).`,
      );
      continue;
    }
    const r = b.nilai;
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
    if (kunci && kunciUnik.has(kunci)) {
      masalah.push(`jadwal ganda untuk guru "${kodeGuru}" hari ${hari} jam ke-${jamKe}`);
    }

    if (masalah.length > 0 || guruId === undefined || hari === null || !kunci) {
      tambahGalat(b, `${masalah.join('; ')}.`);
      continue;
    }

    kunciUnik.add(kunci);
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
      ringkasan: { total: records.length, baru, diperbarui, ditolak: galat.length },
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
      dapat_disimpan: records.length > 0 && galat.length === 0,
    },
    rencana: { jenis: 'jadwal', baris: sah },
  };
}

export const impor = {
  async pratinjau(jenis: JenisImpor, input: PratinjauImporInput): Promise<HasilPratinjauImpor> {
    const { pratinjau } = await validasiMasukan(jenis, input);
    return pratinjau;
  },

  async simpan(
    jenis: JenisImpor,
    input: PratinjauImporInput,
    izinkanBuatReferensi: boolean,
    audit: KonteksAudit,
  ): Promise<HasilSimpanImpor> {
    const { pratinjau, rencana } = await validasiMasukan(jenis, input);
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
              bk: b.bk,
              status: b.status,
            },
            update: {
              nama_siswa: b.nama_siswa,
              jenis_kelamin: b.jenis_kelamin,
              kelas_id: kelasId,
              wali_kelas: b.wali_kelas,
              bk: b.bk,
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
