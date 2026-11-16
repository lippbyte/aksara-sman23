import {
  predikatMgmp,
  skorAkhirMgmp,
  skorKehadiranMgmp,
  type DaftarPenilaian,
  type HasilSyncPenilaian,
  type PenggunaSesi,
  type PenilaianMgmpBaris,
  type Periode,
  type SimpanPenilaianMgmpInput,
} from '@sms/shared';
import { catatAudit, type KonteksAudit } from '../../lib/audit';
import { batalkanCacheDashboard } from '../../lib/cache';
import { badRequest, forbidden } from '../../lib/errors';
import { keAngka, keNumber } from '../../lib/konversi';
import { catatDiLuarJendela, infoJendela, namaPeriode, periksaJendela } from '../../lib/penilaian';
import { prisma } from '../../lib/prisma';
import { ambilPengaturan } from '../../lib/sekolah';
import * as repo from './repo';

type BarisMgmp = Awaited<ReturnType<typeof repo.daftar>>[number];

/**
 * Sekretaris kelas hanya berurusan dengan skor siswa (§4, §6.5).
 * ASUMSI: skor lain, catatan, dan skor akhir tidak ditampilkan kepada sekretaris.
 */
function keBaris(m: BarisMgmp, user: PenggunaSesi): PenilaianMgmpBaris {
  const p = m.penilaian[0];
  const sudah = p !== undefined && p.dinilai_oleh !== null;
  const akhir = p ? keAngka(p.skor_akhir) : null;
  const terbatas = user.role === 'sekretaris_kelas';
  return {
    mgmp_id: keNumber(m.id),
    nama_mapel: m.nama_mapel,
    jumlah_guru_aktif: m._count.guru,
    id: p ? keNumber(p.id) : null,
    skor_kehadiran: p && !terbatas ? keAngka(p.skor_kehadiran) : null,
    skor_siswa: p && sudah ? keAngka(p.skor_siswa) : null,
    skor_administrasi: p && sudah && !terbatas ? keAngka(p.skor_administrasi) : null,
    skor_akhir: sudah && !terbatas ? akhir : null,
    predikat: sudah && !terbatas && akhir !== null ? predikatMgmp(akhir) : null,
    catatan: terbatas ? null : (p?.catatan ?? null),
    sudah_dinilai: sudah,
    nama_penilai: terbatas ? null : (p?.penilai?.name ?? null),
    updated_at: p ? p.updated_at.toISOString() : null,
  };
}

export async function daftar(
  p: Periode,
  user: PenggunaSesi,
): Promise<DaftarPenilaian<PenilaianMgmpBaris>> {
  const pengaturan = await ambilPengaturan(prisma);
  const rows = (await repo.daftar(p)).map((m) => keBaris(m, user));
  return {
    data: rows,
    meta: { page: 1, pageSize: rows.length, total: rows.length },
    jendela: infoJendela(p, pengaturan),
  };
}

/**
 * Sinkron skor kehadiran MGMP untuk semua MGMP (§6.5, perbaikan §8.4): dari rekap pekan
 * guru aktif anggota MGMP yang beririsan dengan bulan. Skor akhir dari bobot pengaturan.
 */
export async function sinkron(p: Periode, audit: KonteksAudit): Promise<HasilSyncPenilaian> {
  const pengaturan = await ambilPengaturan(prisma);
  const n = await prisma.$transaction(async (tx) => {
    const [ids, rekap, lama] = await Promise.all([
      repo.semuaMgmp(tx),
      repo.rekapPerMgmp(tx, p),
      repo.penilaianPeriode(tx, p),
    ]);
    const baris = ids.map((mgmp_id) => {
      const skor_kehadiran = skorKehadiranMgmp(rekap.get(mgmp_id) ?? [], p.bulan, p.tahun);
      const l = lama.get(mgmp_id);
      return {
        mgmp_id,
        skor_kehadiran,
        skor_akhir: skorAkhirMgmp(
          {
            skor_kehadiran,
            skor_siswa: l?.skor_siswa ?? 0,
            skor_administrasi: l?.skor_administrasi ?? 0,
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
      description: `Sinkron skor kehadiran penilaian MGMP ${namaPeriode(p)} untuk ${baris.length} MGMP.`,
    });
    return baris.length;
  });
  batalkanCacheDashboard();
  return { bulan: p.bulan, tahun: p.tahun, disinkronkan: n };
}

/**
 * Simpan nilai MGMP. Isian yang tidak dikirim tidak diubah.
 * `sekretaris_kelas` hanya boleh mengisi `skor_siswa`.
 */
export async function simpan(
  input: SimpanPenilaianMgmpInput,
  user: PenggunaSesi,
  audit: KonteksAudit,
): Promise<PenilaianMgmpBaris> {
  if (
    user.role === 'sekretaris_kelas' &&
    (input.skor_administrasi !== undefined || input.catatan !== undefined)
  ) {
    throw forbidden('Sekretaris kelas hanya boleh mengisi skor siswa.');
  }
  if (user.role === 'sekretaris_kelas' && input.skor_siswa === undefined) {
    throw badRequest('Skor siswa wajib diisi.');
  }

  const pengaturan = await ambilPengaturan(prisma);
  const periode = { bulan: input.bulan, tahun: input.tahun };
  const diLuarJendela = periksaJendela(user, periode, pengaturan);

  await prisma.$transaction(async (tx) => {
    const mgmp = await repo.ambilMgmp(tx, input.mgmp_id);
    if (!mgmp) throw badRequest('MGMP tidak ditemukan.');

    const [rekap, lamaPeta] = await Promise.all([
      repo.rekapPerMgmp(tx, periode, [input.mgmp_id]),
      repo.penilaianPeriode(tx, periode),
    ]);
    const lama = lamaPeta.get(input.mgmp_id);
    const skor_kehadiran = skorKehadiranMgmp(
      rekap.get(input.mgmp_id) ?? [],
      input.bulan,
      input.tahun,
    );
    const skor_siswa = input.skor_siswa ?? lama?.skor_siswa ?? 0;
    const skor_administrasi = input.skor_administrasi ?? lama?.skor_administrasi ?? 0;
    const catatan = input.catatan !== undefined ? input.catatan : (lama?.catatan ?? null);
    const skor_akhir = skorAkhirMgmp(
      { skor_kehadiran, skor_siswa, skor_administrasi },
      pengaturan.bobot.mgmp,
    );

    const baris = await repo.simpan(tx, {
      mgmp_id: input.mgmp_id,
      bulan: input.bulan,
      tahun: input.tahun,
      skor_kehadiran,
      skor_siswa,
      skor_administrasi,
      skor_akhir,
      catatan,
      dinilai_oleh: user.id,
    });

    const diisi = [
      input.skor_siswa !== undefined ? `skor siswa ${input.skor_siswa}` : null,
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

  const rows = await repo.daftar(periode);
  const m = rows.find((r) => keNumber(r.id) === input.mgmp_id);
  if (!m) throw badRequest('MGMP tidak ditemukan.');
  return keBaris(m, user);
}
