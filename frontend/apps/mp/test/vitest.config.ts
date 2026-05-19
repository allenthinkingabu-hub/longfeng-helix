import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// SC20-T04: 加 @longfeng/* alias 让 vitest 能直 import workspace 包源码 ·
//   tsconfig.json paths 是 tsc-only 的 · vitest 看不见 · 必须重声明
const ROOT = resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: {
      '@longfeng/testids': resolve(ROOT, '../../packages/testids/src/index.ts'),
      '@longfeng/api-contracts': resolve(ROOT, '../../packages/api-contracts/src/index.ts'),
      '@longfeng/telemetry': resolve(ROOT, '../../packages/telemetry/src/index.ts'),
      '@longfeng/ui-kit': resolve(ROOT, '../../packages/ui-kit/src/index.ts'),
      '@longfeng/i18n/locales/zh.json': resolve(ROOT, '../../packages/i18n/src/locales/zh.json'),
      '@longfeng/i18n/locales/en.json': resolve(ROOT, '../../packages/i18n/src/locales/en.json'),
      '@longfeng/i18n': resolve(ROOT, '../../packages/i18n/src/index.ts'),
    },
  },
  test: {
    include: ['test/**/*.spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
