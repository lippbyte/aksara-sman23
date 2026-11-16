-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('admin', 'manajemen_guru', 'sekretaris_kelas', 'guru_penilai') NOT NULL,
    `kelas_id` BIGINT UNSIGNED NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_kelas_id_idx`(`kelas_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sekolah_settings` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nama_sekolah` VARCHAR(150) NOT NULL,
    `logo_path` VARCHAR(255) NULL,
    `tahun_ajaran` VARCHAR(20) NOT NULL,
    `tanggal_awal_pekan` DATE NOT NULL,
    `hari_efektif` JSON NOT NULL,
    `bobot_kinerja_kehadiran` DECIMAL(5, 2) NOT NULL DEFAULT 50,
    `bobot_kinerja_administrasi` DECIMAL(5, 2) NOT NULL DEFAULT 30,
    `bobot_kinerja_manajemen` DECIMAL(5, 2) NOT NULL DEFAULT 20,
    `bobot_kinerja_kehadiran_tanpa_manajemen` DECIMAL(5, 2) NOT NULL DEFAULT 50,
    `bobot_kinerja_administrasi_tanpa_manajemen` DECIMAL(5, 2) NOT NULL DEFAULT 50,
    `bobot_mgmp_kehadiran` DECIMAL(5, 2) NOT NULL DEFAULT 40,
    `bobot_mgmp_siswa` DECIMAL(5, 2) NOT NULL DEFAULT 30,
    `bobot_mgmp_administrasi` DECIMAL(5, 2) NOT NULL DEFAULT 30,
    `jendela_penilaian_hari` TINYINT UNSIGNED NOT NULL DEFAULT 3,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kelas` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nama_kelas` VARCHAR(50) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `kelas_nama_kelas_key`(`nama_kelas`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mgmp` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nama_mapel` VARCHAR(100) NOT NULL,
    `deskripsi` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `mgmp_nama_mapel_key`(`nama_mapel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guru` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `kode_guru` VARCHAR(20) NOT NULL,
    `nip` VARCHAR(30) NULL,
    `nama_guru` VARCHAR(150) NOT NULL,
    `mata_pelajaran` VARCHAR(100) NOT NULL,
    `jabatan` VARCHAR(100) NULL,
    `mgmp_id` BIGINT UNSIGNED NULL,
    `status` ENUM('aktif', 'tidak_aktif') NOT NULL DEFAULT 'aktif',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `guru_kode_guru_key`(`kode_guru`),
    UNIQUE INDEX `guru_nip_key`(`nip`),
    INDEX `guru_mgmp_id_idx`(`mgmp_id`),
    INDEX `guru_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `siswa` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nis` VARCHAR(30) NOT NULL,
    `nama_siswa` VARCHAR(150) NOT NULL,
    `jenis_kelamin` ENUM('L', 'P') NOT NULL,
    `kelas_id` BIGINT UNSIGNED NOT NULL,
    `wali_kelas` VARCHAR(150) NULL,
    `status` ENUM('aktif', 'tidak_aktif') NOT NULL DEFAULT 'aktif',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `siswa_nis_key`(`nis`),
    INDEX `siswa_kelas_id_status_idx`(`kelas_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jadwal_mengajar` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `guru_id` BIGINT UNSIGNED NOT NULL,
    `kelas_id` BIGINT UNSIGNED NOT NULL,
    `hari` TINYINT UNSIGNED NOT NULL,
    `jam_ke` TINYINT UNSIGNED NOT NULL,
    `total_jam_mengajar` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `jadwal_mengajar_kelas_id_hari_idx`(`kelas_id`, `hari`),
    UNIQUE INDEX `jadwal_mengajar_guru_id_hari_jam_ke_key`(`guru_id`, `hari`, `jam_ke`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kehadiran` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tanggal` DATE NOT NULL,
    `guru_id` BIGINT UNSIGNED NOT NULL,
    `kelas_id` BIGINT UNSIGNED NOT NULL,
    `jam_ke` TINYINT UNSIGNED NOT NULL,
    `lama_jam` TINYINT UNSIGNED NOT NULL,
    `status_kehadiran` ENUM('Hadir', 'Mendampingi', 'Tidak Hadir') NOT NULL,
    `status_tugas` ENUM('Ada', 'Tidak Ada') NOT NULL,
    `keterangan` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `kehadiran_tanggal_guru_id_kelas_id_jam_ke_idx`(`tanggal`, `guru_id`, `kelas_id`, `jam_ke`),
    INDEX `kehadiran_tanggal_idx`(`tanggal`),
    INDEX `kehadiran_status_kehadiran_idx`(`status_kehadiran`),
    INDEX `kehadiran_guru_id_tanggal_idx`(`guru_id`, `tanggal`),
    INDEX `kehadiran_kelas_id_tanggal_idx`(`kelas_id`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kehadiran_siswa` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `siswa_id` BIGINT UNSIGNED NOT NULL,
    `kelas_id` BIGINT UNSIGNED NOT NULL,
    `tanggal` DATE NOT NULL,
    `jam_ke` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `status` ENUM('hadir', 'izin', 'sakit', 'alpa') NOT NULL,
    `keterangan` TEXT NULL,
    `created_by` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `kehadiran_siswa_kelas_id_tanggal_idx`(`kelas_id`, `tanggal`),
    INDEX `kehadiran_siswa_tanggal_idx`(`tanggal`),
    UNIQUE INDEX `kehadiran_siswa_siswa_id_tanggal_jam_ke_key`(`siswa_id`, `tanggal`, `jam_ke`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rekap_kehadiran_guru` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `guru_id` BIGINT UNSIGNED NOT NULL,
    `tahun` SMALLINT UNSIGNED NOT NULL,
    `minggu_ke` SMALLINT UNSIGNED NOT NULL,
    `tanggal_mulai` DATE NOT NULL,
    `tanggal_selesai` DATE NOT NULL,
    `total_jam_wajib` INTEGER UNSIGNED NOT NULL,
    `total_jam_hadir` INTEGER UNSIGNED NOT NULL,
    `persentase_kehadiran` DECIMAL(5, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `rekap_kehadiran_guru_tahun_minggu_ke_idx`(`tahun`, `minggu_ke`),
    INDEX `rekap_kehadiran_guru_tanggal_mulai_tanggal_selesai_idx`(`tanggal_mulai`, `tanggal_selesai`),
    UNIQUE INDEX `rekap_kehadiran_guru_guru_id_tahun_minggu_ke_key`(`guru_id`, `tahun`, `minggu_ke`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `penilaian_kinerja_bulanan` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `guru_id` BIGINT UNSIGNED NOT NULL,
    `bulan` TINYINT UNSIGNED NOT NULL,
    `tahun` SMALLINT UNSIGNED NOT NULL,
    `skor_kehadiran` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `skor_administrasi_avg` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `skor_manajemen_avg` DECIMAL(5, 2) NULL,
    `skor_akhir` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `catatan` TEXT NULL,
    `dinilai_oleh` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `penilaian_kinerja_bulanan_tahun_bulan_idx`(`tahun`, `bulan`),
    UNIQUE INDEX `penilaian_kinerja_bulanan_guru_id_bulan_tahun_key`(`guru_id`, `bulan`, `tahun`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `penilaian_mgmp` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `mgmp_id` BIGINT UNSIGNED NOT NULL,
    `bulan` TINYINT UNSIGNED NOT NULL,
    `tahun` SMALLINT UNSIGNED NOT NULL,
    `skor_kehadiran` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `skor_siswa` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `skor_administrasi` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `skor_akhir` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `catatan` TEXT NULL,
    `dinilai_oleh` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `penilaian_mgmp_tahun_bulan_idx`(`tahun`, `bulan`),
    UNIQUE INDEX `penilaian_mgmp_mgmp_id_bulan_tahun_key`(`mgmp_id`, `bulan`, `tahun`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `module` VARCHAR(30) NOT NULL,
    `aktivitas` VARCHAR(60) NOT NULL,
    `entity_type` VARCHAR(60) NULL,
    `entity_id` VARCHAR(64) NULL,
    `description` TEXT NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `audit_logs_module_idx`(`module`),
    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `session_id` VARCHAR(128) NOT NULL,
    `expires` INTEGER UNSIGNED NOT NULL,
    `data` MEDIUMTEXT NULL,

    INDEX `sessions_expires_idx`(`expires`),
    PRIMARY KEY (`session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_kelas_id_fkey` FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `guru` ADD CONSTRAINT `guru_mgmp_id_fkey` FOREIGN KEY (`mgmp_id`) REFERENCES `mgmp`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `siswa` ADD CONSTRAINT `siswa_kelas_id_fkey` FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jadwal_mengajar` ADD CONSTRAINT `jadwal_mengajar_guru_id_fkey` FOREIGN KEY (`guru_id`) REFERENCES `guru`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jadwal_mengajar` ADD CONSTRAINT `jadwal_mengajar_kelas_id_fkey` FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kehadiran` ADD CONSTRAINT `kehadiran_guru_id_fkey` FOREIGN KEY (`guru_id`) REFERENCES `guru`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kehadiran` ADD CONSTRAINT `kehadiran_kelas_id_fkey` FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kehadiran` ADD CONSTRAINT `kehadiran_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kehadiran_siswa` ADD CONSTRAINT `kehadiran_siswa_siswa_id_fkey` FOREIGN KEY (`siswa_id`) REFERENCES `siswa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kehadiran_siswa` ADD CONSTRAINT `kehadiran_siswa_kelas_id_fkey` FOREIGN KEY (`kelas_id`) REFERENCES `kelas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kehadiran_siswa` ADD CONSTRAINT `kehadiran_siswa_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rekap_kehadiran_guru` ADD CONSTRAINT `rekap_kehadiran_guru_guru_id_fkey` FOREIGN KEY (`guru_id`) REFERENCES `guru`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penilaian_kinerja_bulanan` ADD CONSTRAINT `penilaian_kinerja_bulanan_guru_id_fkey` FOREIGN KEY (`guru_id`) REFERENCES `guru`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penilaian_kinerja_bulanan` ADD CONSTRAINT `penilaian_kinerja_bulanan_dinilai_oleh_fkey` FOREIGN KEY (`dinilai_oleh`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penilaian_mgmp` ADD CONSTRAINT `penilaian_mgmp_mgmp_id_fkey` FOREIGN KEY (`mgmp_id`) REFERENCES `mgmp`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `penilaian_mgmp` ADD CONSTRAINT `penilaian_mgmp_dinilai_oleh_fkey` FOREIGN KEY (`dinilai_oleh`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
