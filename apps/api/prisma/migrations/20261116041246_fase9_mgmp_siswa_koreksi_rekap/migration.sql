-- AlterTable
ALTER TABLE `rekap_kehadiran_guru` ADD COLUMN `alasan_koreksi` TEXT NULL,
    ADD COLUMN `dikoreksi_manual` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `dikoreksi_oleh` BIGINT UNSIGNED NULL,
    ADD COLUMN `dikoreksi_pada` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `penilaian_mgmp_siswa` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `mgmp_id` BIGINT UNSIGNED NOT NULL,
    `kelas_id` BIGINT UNSIGNED NOT NULL,
    `bulan` TINYINT UNSIGNED NOT NULL,
    `tahun` SMALLINT UNSIGNED NOT NULL,
    `skor` DECIMAL(5, 2) NOT NULL,
    `diisi_oleh` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `penilaian_mgmp_siswa_tahun_bulan_idx`(`tahun`, `bulan`),
    INDEX `penilaian_mgmp_siswa_kelas_id_idx`(`kelas_id`),
    INDEX `penilaian_mgmp_siswa_diisi_oleh_idx`(`diisi_oleh`),
    UNIQUE INDEX `penilaian_mgmp_siswa_mgmp_id_kelas_id_bulan_tahun_key`(`mgmp_id`, `kelas_id`, `bulan`, `tahun`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `rekap_kehadiran_guru_dikoreksi_oleh_idx` ON `rekap_kehadiran_guru`(`dikoreksi_oleh`);

-- AddForeignKey
ALTER TABLE `rekap_kehadiran_guru` ADD CONSTRAINT `rekap_kehadiran_guru_dikoreksi_oleh_fkey` FOREIGN KEY (`dikoreksi_oleh`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penilaian_mgmp_siswa` ADD CONSTRAINT `penilaian_mgmp_siswa_mgmp_id_fkey` FOREIGN KEY (`mgmp_id`) REFERENCES `mgmp`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penilaian_mgmp_siswa` ADD CONSTRAINT `penilaian_mgmp_siswa_kelas_id_fkey` FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penilaian_mgmp_siswa` ADD CONSTRAINT `penilaian_mgmp_siswa_diisi_oleh_fkey` FOREIGN KEY (`diisi_oleh`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Migrasi data (Fase 9, keputusan tim 16 Nov 2026) ───
-- Skor siswa MGMP kini rata-rata penilaian_mgmp_siswa per kelas. Nilai lama
-- (satu skor per MGMP per bulan, tanpa kelas) TIDAK dipindahkan: dihapus (jadi 0).
-- Skor akhir dihitung ulang dengan bobot sekolah, setara skorAkhirMgmp
-- (packages/shared/src/domain/skor.ts) dengan skor_siswa = 0.
UPDATE `penilaian_mgmp` p
  CROSS JOIN (SELECT * FROM `sekolah_settings` ORDER BY `id` LIMIT 1) s
SET p.`skor_siswa` = 0,
    p.`skor_akhir` = ROUND(LEAST(100, GREATEST(0,
      (LEAST(100, GREATEST(0, p.`skor_kehadiran`)) * s.`bobot_mgmp_kehadiran`
       + LEAST(100, GREATEST(0, p.`skor_administrasi`)) * s.`bobot_mgmp_administrasi`) / 100)), 2);

-- Baris yang hanya pernah diisi sekretaris (skor siswa lama) tidak lagi berstatus "sudah dinilai".
UPDATE `penilaian_mgmp` p
  JOIN `users` u ON u.`id` = p.`dinilai_oleh`
SET p.`dinilai_oleh` = NULL
WHERE u.`role` = 'sekretaris_kelas';
