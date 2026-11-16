import {
  predikatMgmp,
  skorAkhirMgmp,
  skorKehadiranMgmp,
  ringkasanSkorSiswaMgmp,
  type DaftarPenilaian,
  type HasilSyncPenilaian,
  type PenggunaSesi,
  type PenilaianMgmpBaris,
  type Periode,
  type SimpanPenilaianMgmpInput,
  type SimpanSkorSiswaMgmpInput,
  type SkorSiswaKelasBaris,
  type SkorSiswaMgmpQuery,
} from '@sms/shared';
import { catatAudit, type KonteksAudit } from '../../lib/audit';
import { batalkanCacheDashboard } from '../../lib/cache';
import { badRequest, businessRule, forbidden } from '../../lib/errors';
import { keAngka, keNumber } from '../../lib/konversi';
import {
  catatDiLuarJendela,
  infoJendela,
  namaPeriode,
  pekanBelumDisinkronPeriode,
  periksaJendela,
} from '../../lib/penilaian';
import { prisma, type Tx } from '../../lib/prisma';
import { ambilPengaturan, type PengaturanSekolah } from '../../lib/sekolah';
import * as repo from './repo';

type BarisMgmp = Awaited<ReturnType<typeof repo.daftar>>[number];
type IsianKelas = { kelas_id: number; skor: number }[];

/**
 * Sekretaris kelas hanya berurusan dengan skor siswa kelasnya (§4, §6.5).
 * ASUMSI: sekretaris melihat skor kelasnya dan jumlah kelas yang sudah mengisi, tetapi
 * tidak melihat rata-rata skor siswa, skor lain, catatan, maupun skor akhir.
 */
function keBaris(
  m: BarisMgmp,
  user: PenggunaSesi,
  kelas: readonly number[],
  isian: IsianKelas,
  skorKelasSaya: Map<number, number> | null,
): PenilaianMgmpBaris {
  const p = m.penilaian[0];
  const sudah = p !== undefined && p.dinilai_oleh !== null;
  const akhir = p ? keAngka(p.skor_akhir) : null;
  const terbatas = user.role === 'sekretaris_kelas';
  const r = ringkasanSkorSiswaMgmp(kelas, isian);
  return {
    mgmp_id: keNumber(m.id),
    nama_mapel: m.nama_mapel,
    jumlah_guru_aktif: m._count.guru,
    id: p ? keNumber(p.id) : null,
    skor_kehadiran: p && !terbatas ? keAngka(p.skor_kehadiran) : null,
    skor_siswa: p && r.kelas_terisi > 0 && !terbatas ? keAngka(p.skor_siswa) : null,
    kelas_terisi: r.kelas_terisi,
    jumlah_kelas: r.jumlah_kelas,
    skor_kelas_saya: terbatas ? (skorKelasSaya?.get(keNumber(m.id)) ?? null) : null,
    skor_administrasi: p && sudah && !terbatas ? keAngka(p.skor_administrasi) : null,
    skor_akhir: sudah && !terbatas ? akhir : null,
    predikat: sudah && !terbatas && akhir !== null ? predikatMgmp(akhir) : null,
    catatan: terbatas ? null : (p?.catatan ?? null),
    sudah_dinilai: sudah,
    nama_penilai: terbatas ? null : (p?.penilai?.name ?? null),
    updated_at: p ? p.updated_at.toISOString() : null,
  };
}

/**
 * Baris daftar MGMP. Untuk sekretaris hanya MGMP yang gurunya punya jadwal di kelasnya
 * (§4); MGMP lain tidak tampil.
 */
async function susunBaris(p: Periode, user: PenggunaSesi): Promise<PenilaianMgmpBaris[]> {
  const sekretaris = user.role === 'sekretaris_kelas';
  const [rows, kelas, isian, skorSaya] = await Promise.all([
    repo.daftar(p),
    repo.kelasBerjadwal(prisma),
    repo.skorSiswaPerMgmp(prisma, p),
    sekretaris && user.kelas_id !== null ? repo.skorKelas(p, user.kelas_id) : Promise.resolve(null),
  ]);
  return rows
    .filter(
      (m) =>
        !sekretaris ||
        (user.kelas_id !== null && (kelas.get(keNumber(m.id)) ?? []).includes(user.kelas_id)),
    )
    .map((m) =>
      keBaris(m, user, kelas.get(keNumber(m.id)) ?? [], isian.get(keNumber(m.id)) ?? [], skorSaya),
    );
}

export async function daftar(
  p: Periode,
  user: PenggunaSesi,
): Promise<DaftarPenilaian<PenilaianMgmpBaris>> {
  const pengaturan = await ambilPengaturan(prisma);
  const [rows, belum] = await Promise.all([
    susunBaris(p, user),
    pekanBelumDisinkronPeriode(prisma, p, pengaturan),
  ]);
  return {
    data: rows,
    meta: { page: 1, pageSize: rows.length, total: rows.length },
    jendela: infoJendela(p, pengaturan),
    pekan_belum_disinkron: belum,
  };
}

/** Sekretaris hanya untuk MGMP yang gurunya punya jadwal di kelasnya; selain itu 403. */
function periksaKelasSekretaris(berjadwal: readonly number[], kelasId: number): void {
  if (!berjadwal.includes(kelasId)) {
    throw forbidden('Guru MGMP ini tidak punya jadwal di kelas Anda.');
  }
}

/**
 * Rincian skor siswa per kelas untuk satu MGMP: kelas berjadwal, ditambah kelas lain yang
 * sudah punya isian (ditandai tidak dihitung). Sekretaris hanya melihat kelasnya.
 */
export async function rincianSkorSiswa(
  q: SkorSiswaMgmpQuery,
  kelasScope: number | null,
): Promise<SkorSiswaKelasBaris[]> {
  const berjadwal = (await repo.kelasBerjadwal(prisma, [q.mgmp_id])).get(q.mgmp_id) ?? [];
  if (kelasScope !== null) periksaKelasSekretaris(berjadwal, kelasScope);
  const rows = await repo.rincianSkorSiswa(q, kelasScope === null ? null : [kelasScope]);
  return rows
    .filter((k) => berjadwal.includes(keNumber(k.id)) || k.penilaian_mgmp_siswa.length > 0)
    .map((k) => {
      const s = k.penilaian_mgmp_siswa[0];
      return {
        kelas_id: keNumber(k.id),
        nama_kelas: k.nama_kelas,
        skor: s ? keAngka(s.skor) : null,
        nama_pengisi: s?.pengisi.name ?? null,
        updated_at: s ? s.updated_at.toISOString() : null,
        berjadwal: berjadwal.includes(keNumber(k.id)),
      };
    });
}

/** Skor otomatis satu MGMP: kehadiran (rekap guru) dan siswa (rata-rata kelas berjadwal). */
async function skorOtomatis(
  tx: Tx,
  mgmpId: number,
  p: Periode,
  pengaturan: PengaturanSekolah,
): Promise<{ skor_kehadiran: number; skor_siswa: number }> {
  const [kehadiran, siswa, kelas] = await Promise.all([
    repo.kehadiranPerMgmp(tx, p, pengaturan.pekan.hari_efektif, [mgmpId]),
    repo.skorSiswaPerMgmp(tx, p, [mgmpId]),
    repo.kelasBerjadwal(tx, [mgmpId]),
  ]);
  return {
    skor_kehadiran: skorKehadiranMgmp(kehadiran.get(mgmpId) ?? [], p.bulan, p.tahun),
    skor_siswa: ringkasanSkorSiswaMgmp(kelas.get(mgmpId) ?? [], siswa.get(mgmpId) ?? []).skor_siswa,
  };
}

/**
 * Hitung ulang dan simpan baris penilaian MGMP satu periode. Isian penilai yang tidak
 * dikirim dipertahankan. Dipanggil setelah `repo.kunciMgmp`.
 */
async function simpanBaris(
  tx: Tx,
  mgmpId: number,
  p: Periode,
  pengaturan: PengaturanSekolah,
  isian: { skor_administrasi?: number; catatan?: string | null; dinilai_oleh?: number },
) {
  const [otomatis, lamaPeta] = await Promise.all([
    skorOtomatis(tx, mgmpId, p, pengaturan),
    repo.penilaianPeriode(tx, p),
  ]);
  const lama = lamaPeta.get(mgmpId);
  const skor_administrasi = isian.skor_administrasi ?? lama?.skor_administrasi ?? 0;
  const catatan = isian.catatan !== undefined ? isian.catatan : (lama?.catatan ?? null);
  const skor_akhir = skorAkhirMgmp({ ...otomatis, skor_administrasi }, pengaturan.bobot.mgmp);
  const baris = await repo.simpan(tx, {
    mgmp_id: mgmpId,
    bulan: p.bulan,
    tahun: p.tahun,
    ...otomatis,
    skor_administrasi,
    skor_akhir,
    catatan,
    ...(isian.dinilai_oleh !== undefined ? { dinilai_oleh: isian.dinilai_oleh } : {}),
  });
  return { baris, skor_akhir, skor_siswa: otomatis.skor_siswa };
}

/**
 * Sinkron skor otomatis MGMP untuk semua MGMP (§6.5, perbaikan §8.4): skor kehadiran dari
 * rekap pekan guru aktif anggota MGMP yang beririsan dengan bulan, dan skor siswa dari
 * rata-rata skor per kelas. Skor akhir dari bobot pengaturan.
 */
export async function sinkron(p: Periode, audit: KonteksAudit): Promise<HasilSyncPenilaian> {
  const pengaturan = await ambilPengaturan(prisma);
  const n = await prisma.$transaction(async (tx) => {
    const ids = await repo.kunciMgmp(tx);
    const [kehadiran, siswa, kelas, lama] = await Promise.all([
      repo.kehadiranPerMgmp(tx, p, pengaturan.pekan.hari_efektif),
      repo.skorSiswaPerMgmp(tx, p),
      repo.kelasBerjadwal(tx),
      repo.penilaianPeriode(tx, p),
    ]);
    const baris = ids.map((mgmp_id) => {
      const skor_kehadiran = skorKehadiranMgmp(kehadiran.get(mgmp_id) ?? [], p.bulan, p.tahun);
      const { skor_siswa } = ringkasanSkorSiswaMgmp(
        kelas.get(mgmp_id) ?? [],
        siswa.get(mgmp_id) ?? [],
      );
      return {
        mgmp_id,
        skor_kehadiran,
        skor_siswa,
        skor_akhir: skorAkhirMgmp(
          {
            skor_kehadiran,
            skor_siswa,
            skor_administrasi: lama.get(mgmp_id)?.skor_administrasi ?? 0,
          },
          pengaturan.bobot.mgmp,
        ),
      };
    });
    await repo.upsertSinkron(tx, p, baris);
    await catatAudit(tx, audit, {
      module: 'Penilaian',
      aktivitas: 'SYNC_PENILAIAN_MGMP',
      entity_type: 'penilaian_mgmp',
      entity_id: `${p.tahun}-${p.bulan}`,
      description: `Sinkron skor kehadiran dan skor siswa penilaian MGMP ${namaPeriode(p)} untuk ${baris.length} MGMP.`,
    });
    return baris.length;
  });
  batalkanCacheDashboard();
  return { bulan: p.bulan, tahun: p.tahun, disinkronkan: n };
}

async function barisUntuk(
  p: Periode,
  mgmpId: number,
  user: PenggunaSesi,
): Promise<PenilaianMgmpBaris> {
  const baris = (await susunBaris(p, user)).find((b) => b.mgmp_id === mgmpId);
  if (!baris) throw badRequest('MGMP tidak ditemukan.');
  return baris;
}

/** Isian penilai MGMP (skor administrasi, catatan). Isian yang tidak dikirim tidak diubah. */
export async function simpan(
  input: SimpanPenilaianMgmpInput,
  user: PenggunaSesi,
  audit: KonteksAudit,
): Promise<PenilaianMgmpBaris> {
  const pengaturan = await ambilPengaturan(prisma);
  const periode = { bulan: input.bulan, tahun: input.tahun };
  const diLuarJendela = periksaJendela(user, periode, pengaturan);

  await prisma.$transaction(async (tx) => {
    const [terkunci] = await repo.kunciMgmp(tx, [input.mgmp_id]);
    const mgmp = terkunci === undefined ? null : await repo.ambilMgmp(tx, input.mgmp_id);
    if (!mgmp) throw badRequest('MGMP tidak ditemukan.');

    const { baris, skor_akhir } = await simpanBaris(tx, input.mgmp_id, periode, pengaturan, {
      skor_administrasi: input.skor_administrasi,
      catatan: input.catatan,
      dinilai_oleh: user.id,
    });

    const diisi = [
      input.skor_administrasi !== undefined ? `skor administrasi ${input.skor_administrasi}` : null,
      input.catatan !== undefined ? 'catatan' : null,
    ]
      .filter(Boolean)
      .join(', ');
    await catatAudit(tx, audit, {
      module: 'Penilaian',
      aktivitas: 'SIMPAN_PENILAIAN_MGMP',
      entity_type: 'penilaian_mgmp',
      entity_id: baris.id,
      description: `Mengisi penilaian MGMP ${mgmp.nama_mapel} ${namaPeriode(periode)} (${diisi}); skor akhir ${skor_akhir} (${predikatMgmp(skor_akhir)}).`,
    });
    if (diLuarJendela) {
      await catatDiLuarJendela(tx, audit, 'MGMP', periode, 'penilaian_mgmp', keNumber(baris.id));
    }
  });
  batalkanCacheDashboard();
  return barisUntuk(periode, input.mgmp_id, user);
}

/**
 * Skor siswa MGMP per kelas (§6.5). Sekretaris hanya mengisi baris kelasnya (kelas dari
 * akun, bukan isian form); peran lain wajib memilih kelas. Skor siswa MGMP dihitung ulang
 * sebagai rata-rata kelas berjadwal yang sudah mengisi.
 */
export async function simpanSkorSiswa(
  input: SimpanSkorSiswaMgmpInput,
  user: PenggunaSesi,
  kelasScope: number | null,
  audit: KonteksAudit,
): Promise<PenilaianMgmpBaris> {
  const kelasId = user.role === 'sekretaris_kelas' ? kelasScope : (input.kelas_id ?? null);
  if (kelasId === null) {
    throw user.role === 'sekretaris_kelas'
      ? forbidden('Akun sekretaris belum terikat ke kelas. Hubungi admin.')
      : badRequest('Kelas wajib dipilih.', { kelas_id: ['Kelas wajib dipilih.'] });
  }

  // Hanya kelas yang punya jadwal dari guru aktif MGMP ini (§6.5). Sekretaris → 403
  // (akses); peran lain → 422, karena isian kelas tak berjadwal tidak akan dihitung.
  // ASUMSI: pembatasan untuk peran lain ini perlu dikonfirmasi tim.
  const berjadwal = (await repo.kelasBerjadwal(prisma, [input.mgmp_id])).get(input.mgmp_id) ?? [];
  if (user.role === 'sekretaris_kelas') periksaKelasSekretaris(berjadwal, kelasId);
  else if (!berjadwal.includes(kelasId)) {
    throw businessRule('Kelas ini tidak punya jadwal dari guru MGMP tersebut.');
  }

  const pengaturan = await ambilPengaturan(prisma);
  const periode = { bulan: input.bulan, tahun: input.tahun };
  const diLuarJendela = periksaJendela(user, periode, pengaturan);

  await prisma.$transaction(async (tx) => {
    const [terkunci] = await repo.kunciMgmp(tx, [input.mgmp_id]);
    const [mgmp, kelas] = await Promise.all([
      terkunci === undefined ? null : repo.ambilMgmp(tx, input.mgmp_id),
      repo.ambilKelas(tx, kelasId),
    ]);
    if (!mgmp) throw badRequest('MGMP tidak ditemukan.');
    if (!kelas) throw badRequest('Kelas tidak ditemukan.');

    const isian = await repo.simpanSkorSiswa(tx, {
      mgmp_id: input.mgmp_id,
      kelas_id: kelasId,
      bulan: input.bulan,
      tahun: input.tahun,
      skor: input.skor,
      diisi_oleh: user.id,
    });
    const { baris, skor_siswa } = await simpanBaris(tx, input.mgmp_id, periode, pengaturan, {});

    await catatAudit(tx, audit, {
      module: 'Penilaian',
      aktivitas: 'SIMPAN_SKOR_SISWA_MGMP',
      entity_type: 'penilaian_mgmp_siswa',
      entity_id: isian.id,
      description: `Mengisi skor siswa MGMP ${mgmp.nama_mapel} ${namaPeriode(periode)} untuk kelas ${kelas.nama_kelas}: ${input.skor}; rata-rata skor siswa menjadi ${skor_siswa}.`,
    });
    if (diLuarJendela) {
      await catatDiLuarJendela(tx, audit, 'MGMP', periode, 'penilaian_mgmp', keNumber(baris.id));
    }
  });
  batalkanCacheDashboard();
  return barisUntuk(periode, input.mgmp_id, user);
}
