import {
  predikatKinerja,
  rataRataBulanan,
  skorAkhirKinerja,
  type DaftarPenilaian,
  type HasilSyncPenilaian,
  type PenggunaSesi,
  type PenilaianKinerjaBaris,
  type PenilaianKinerjaQuery,
  type Periode,
  type SimpanPenilaianKinerjaInput,
} from '@sms/shared';
import { catatAudit, type KonteksAudit } from '../../lib/audit';
import { batalkanCacheDashboard } from '../../lib/cache';
import { badRequest } from '../../lib/errors';
import { keAngka, keNumber } from '../../lib/konversi';
import {
  catatDiLuarJendela,
  infoJendela,
  namaPeriode,
  periksaJendela,
  statusSinkronPeriode,
} from '../../lib/penilaian';
import { prisma } from '../../lib/prisma';
import { ambilPengaturan } from '../../lib/sekolah';
import * as repo from './repo';

type BarisGuru = Awaited<ReturnType<typeof repo.daftar>>['rows'][number];

function keBaris(g: BarisGuru): PenilaianKinerjaBaris {
  const p = g.penilaian[0];
  const sudah = p !== undefined && p.dinilai_oleh !== null;
  const akhir = p ? keAngka(p.skor_akhir) : null;
  return {
    guru_id: keNumber(g.id),
    kode_guru: g.kode_guru,
    nama_guru: g.nama_guru,
    mata_pelajaran: g.mata_pelajaran,
    id: p ? keNumber(p.id) : null,
    skor_kehadiran: p ? keAngka(p.skor_kehadiran) : null,
    skor_administrasi_avg: p && sudah ? keAngka(p.skor_administrasi_avg) : null,
    skor_manajemen_avg: p && sudah ? keAngka(p.skor_manajemen_avg) : null,
    skor_akhir: sudah ? akhir : null,
    predikat: sudah && akhir !== null ? predikatKinerja(akhir) : null,
    catatan: p?.catatan ?? null,
    sudah_dinilai: sudah,
    nama_penilai: p?.penilai?.name ?? null,
    updated_at: p ? p.updated_at.toISOString() : null,
  };
}

export async function daftar(
  q: PenilaianKinerjaQuery,
): Promise<DaftarPenilaian<PenilaianKinerjaBaris>> {
  const pengaturan = await ambilPengaturan(prisma);
  const { page, pageSize, ...periode } = q;
  const [hasil, sinkron] = await Promise.all([
    repo.daftar(periode, { page, pageSize }),
    statusSinkronPeriode(prisma, periode, pengaturan),
  ]);
  return {
    data: hasil.rows.map(keBaris),
    meta: { page, pageSize, total: hasil.total },
    jendela: infoJendela(periode, pengaturan),
    pekan_belum_disinkron: sinkron.belum,
    pekan_rekap_sebagian: sinkron.sebagian,
  };
}

export async function semua(p: Periode): Promise<PenilaianKinerjaBaris[]> {
  return (await repo.daftar(p)).rows.map(keBaris);
}

/**
 * Sinkron skor kehadiran otomatis untuk semua guru aktif: rata-rata rekap pekan yang
 * BERIRISAN dengan bulan (§6.4, perbaikan §8.3). Satu query rekap, satu query penilaian,
 * satu upsert massal. Skor akhir dihitung ulang dengan bobot dari pengaturan sekolah.
 */
export async function sinkron(p: Periode, audit: KonteksAudit): Promise<HasilSyncPenilaian> {
  const pengaturan = await ambilPengaturan(prisma);
  const n = await prisma.$transaction(async (tx) => {
    const ids = await repo.guruAktif(tx);
    const [rekap, lama] = await Promise.all([
      repo.rekapPerGuru(tx, ids, p),
      repo.penilaianPeriode(tx, ids, p),
    ]);
    const baris = ids.map((guru_id) => {
      const skor_kehadiran = rataRataBulanan(rekap.get(guru_id) ?? [], p.bulan, p.tahun);
      const l = lama.get(guru_id);
      return {
        guru_id,
        skor_kehadiran,
        skor_akhir: skorAkhirKinerja(
          {
            skor_kehadiran,
            skor_administrasi_avg: l?.skor_administrasi_avg ?? 0,
            skor_manajemen_avg: l?.skor_manajemen_avg ?? null,
          },
          pengaturan.bobot.kinerja,
        ),
      };
    });
    await repo.upsertSinkron(tx, p, baris);
    await catatAudit(tx, audit, {
      module: 'Penilaian',
      aktivitas: 'SYNC_PENILAIAN_KINERJA',
      entity_type: 'penilaian_kinerja_bulanan',
      entity_id: `${p.tahun}-${p.bulan}`,
      description: `Sinkron skor kehadiran penilaian kinerja ${namaPeriode(p)} untuk ${baris.length} guru aktif.`,
    });
    return baris.length;
  });
  batalkanCacheDashboard();
  return { bulan: p.bulan, tahun: p.tahun, disinkronkan: n };
}

/** Simpan nilai satu guru. Skor kehadiran selalu dari rekap; skor akhir dari fungsi domain. */
export async function simpan(
  input: SimpanPenilaianKinerjaInput,
  user: PenggunaSesi,
  audit: KonteksAudit,
): Promise<PenilaianKinerjaBaris> {
  const pengaturan = await ambilPengaturan(prisma);
  const periode = { bulan: input.bulan, tahun: input.tahun };
  const diLuarJendela = periksaJendela(user, periode, pengaturan);

  await prisma.$transaction(async (tx) => {
    const guru = await repo.ambilGuru(tx, input.guru_id);
    if (!guru) throw badRequest('Guru tidak ditemukan.');

    const rekap = await repo.rekapPerGuru(tx, [input.guru_id], periode);
    const skor_kehadiran = rataRataBulanan(
      rekap.get(input.guru_id) ?? [],
      input.bulan,
      input.tahun,
    );
    const skor_akhir = skorAkhirKinerja(
      {
        skor_kehadiran,
        skor_administrasi_avg: input.skor_administrasi_avg,
        skor_manajemen_avg: input.skor_manajemen_avg,
      },
      pengaturan.bobot.kinerja,
    );
    const baris = await repo.simpan(tx, {
      ...input,
      skor_kehadiran,
      skor_akhir,
      dinilai_oleh: user.id,
    });

    await catatAudit(tx, audit, {
      module: 'Penilaian',
      aktivitas: 'SIMPAN_PENILAIAN_KINERJA',
      entity_type: 'penilaian_kinerja_bulanan',
      entity_id: baris.id,
      description: `Menilai kinerja ${guru.nama_guru} ${namaPeriode(periode)}: skor akhir ${skor_akhir} (${predikatKinerja(skor_akhir)}).`,
    });
    if (diLuarJendela) {
      await catatDiLuarJendela(
        tx,
        audit,
        'kinerja',
        periode,
        'penilaian_kinerja_bulanan',
        keNumber(baris.id),
      );
    }
  });
  batalkanCacheDashboard();

  const hasil = await repo.daftar(periode);
  const baris = hasil.rows.find((g) => keNumber(g.id) === input.guru_id);
  if (!baris) throw badRequest('Guru tidak ditemukan.');
  return keBaris(baris);
}
