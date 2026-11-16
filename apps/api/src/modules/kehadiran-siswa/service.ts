import type {
  Halaman,
  HasilSimpanSiswa,
  PenggunaSesi,
  RiwayatSesiSiswa,
  RiwayatSiswaQuery,
  SesiAbsenSiswa,
  SesiSiswaQuery,
  SimpanKehadiranSiswaInput,
} from '@sms/shared';
import { catatAudit, type KonteksAudit } from '../../lib/audit';
import { batalkanCacheDashboard } from '../../lib/cache';
import { badRequest, businessRule, forbidden, notFound } from '../../lib/errors';
import { prisma } from '../../lib/prisma';
import * as repo from './repo';

/** Sekretaris: kelas selalu dari akunnya (§6.2), bukan dari isian. Peran lain wajib memilih. */
function tentukanKelas(kelasId: number | null | undefined, kelasScope: number | null): number {
  if (kelasScope !== null) return kelasScope;
  if (kelasId === null || kelasId === undefined) throw badRequest('Kelas wajib dipilih.');
  return kelasId;
}

function ringkasHitungan(h: HasilSimpanSiswa['hitungan']): string {
  return `${h.hadir} hadir, ${h.izin} izin, ${h.sakit} sakit, ${h.alpa} alpa`;
}

export async function sesi(q: SesiSiswaQuery, kelasScope: number | null): Promise<SesiAbsenSiswa> {
  const kelasId = tentukanKelas(q.kelas_id, kelasScope);
  const kelas = await repo.ambilKelas(prisma, kelasId);
  if (!kelas) throw notFound('Kelas tidak ditemukan.');
  const { siswa, sudahDiisi } = await repo.daftarSesi(kelasId, q.tanggal, q.jam_ke);
  return { kelas, tanggal: q.tanggal, jam_ke: q.jam_ke, sudah_diisi: sudahDiisi, siswa };
}

/** Simpan massal satu sesi dalam satu transaksi: validasi siswa → upsert → log aktivitas. */
export async function simpan(
  input: SimpanKehadiranSiswaInput,
  user: PenggunaSesi,
  kelasScope: number | null,
  audit: KonteksAudit,
): Promise<HasilSimpanSiswa> {
  const kelasId = tentukanKelas(input.kelas_id, kelasScope);

  const hasil = await prisma.$transaction(async (tx) => {
    const kelas = await repo.ambilKelas(tx, kelasId);
    if (!kelas) throw badRequest('Kelas tidak ditemukan.');

    const ids = input.items.map((i) => i.siswa_id);
    const sah = await repo.siswaSah(tx, kelasId, input.tanggal, input.jam_ke, ids);
    const tidakSah = ids.filter((id) => !sah.has(id));
    if (tidakSah.length > 0) {
      throw businessRule(`${tidakSah.length} siswa bukan siswa aktif kelas ${kelas.nama_kelas}.`, {
        siswa_id: tidakSah,
      });
    }

    await repo.upsertSesi(tx, kelasId, input.tanggal, input.jam_ke, input.items, user.id);

    const hitungan = repo.hitunganKosong();
    for (const i of input.items) hitungan[i.status] += 1;
    await catatAudit(tx, audit, {
      module: 'Siswa',
      aktivitas: 'SIMPAN_KEHADIRAN_SISWA',
      entity_type: 'kehadiran_siswa',
      entity_id: `${kelasId}:${input.tanggal}:${input.jam_ke}`,
      description: `Menyimpan absensi siswa kelas ${kelas.nama_kelas}, ${input.tanggal} jam ke-${input.jam_ke}: ${ringkasHitungan(hitungan)}.`,
    });
    return { disimpan: input.items.length, hitungan };
  });
  batalkanCacheDashboard();
  return hasil;
}

export async function hapusCatatan(
  id: number,
  kelasScope: number | null,
  audit: KonteksAudit,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const c = await repo.ambilCatatan(tx, id);
    if (!c) throw notFound('Catatan kehadiran siswa tidak ditemukan.');
    if (kelasScope !== null && c.kelas_id !== kelasScope) {
      throw forbidden('Catatan ini milik kelas lain.');
    }
    await repo.hapusCatatan(tx, id);
    await catatAudit(tx, audit, {
      module: 'Siswa',
      aktivitas: 'DELETE_KEHADIRAN_SISWA',
      entity_type: 'kehadiran_siswa',
      entity_id: id,
      description: `Menghapus absensi ${c.nama_siswa} (${c.nama_kelas}), ${c.tanggal} jam ke-${c.jam_ke}.`,
    });
  });
  batalkanCacheDashboard();
}

export async function hapusSesi(
  q: SesiSiswaQuery,
  kelasScope: number | null,
  audit: KonteksAudit,
): Promise<{ dihapus: number }> {
  const kelasId = tentukanKelas(q.kelas_id, kelasScope);
  const dihapus = await prisma.$transaction(async (tx) => {
    const kelas = await repo.ambilKelas(tx, kelasId);
    if (!kelas) throw notFound('Kelas tidak ditemukan.');
    const n = await repo.hapusSesi(tx, kelasId, q.tanggal, q.jam_ke);
    if (n === 0) throw notFound('Belum ada absensi siswa pada sesi ini.');
    await catatAudit(tx, audit, {
      module: 'Siswa',
      aktivitas: 'DELETE_SESI_KEHADIRAN_SISWA',
      entity_type: 'kehadiran_siswa',
      entity_id: `${kelasId}:${q.tanggal}:${q.jam_ke}`,
      description: `Menghapus ${n} catatan absensi siswa kelas ${kelas.nama_kelas}, ${q.tanggal} jam ke-${q.jam_ke}.`,
    });
    return n;
  });
  batalkanCacheDashboard();
  return { dihapus };
}

export async function riwayat(
  q: RiwayatSiswaQuery,
  kelasScope: number | null,
): Promise<Halaman<RiwayatSesiSiswa>> {
  const hasil = await repo.riwayat(q, kelasScope);
  return { data: hasil.rows, meta: { page: q.page, pageSize: q.pageSize, total: hasil.total } };
}
