import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'prisma/**/*.test.ts'],
    env: { NODE_ENV: 'test' },
    globalSetup: ['./src/test/globalSetup.ts'],
    // Semua berkas test memakai satu basis data uji, jadi dijalankan berurutan.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
