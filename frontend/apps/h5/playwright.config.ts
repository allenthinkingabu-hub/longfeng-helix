// S7 · SC-01-T01 · Playwright E2E config
// owner: SC01-T01 Coder attempt-3 (retries=2)
// 依据: ai/agents/coder-agent.md §4 真实 E2E + 铁律补充 6 E2E DoD 唯一硬条件
//
// 目标 baseURL: vite dev server (port 5174, configured in vite.config.ts) →
// 反向代理 /api → 真后端 file-service / wrongbook-service / ai-analysis-service。
//
// reporter 三件: html (Tester 审阅) + junit (audit.js trace) + line (实跑可读)
// trace='on-first-retry' + screenshot/video on failure: §4.3 截图证据强制
//
// 不启 webServer 自动起 (避免与已运行 vite 撞端口) — 调用方自己确认 vite + backend
// 都已 up (见 scripts/check-sandbox.sh)。
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174';

export default defineConfig({
  testDir: './tests/e2e',
  // SC-01-T01 attempt-3: 单测一个 spec (单进程跑减少 sandbox 抖动)
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Tester REJECT 反馈: 必须落 raw output → 三种 reporter 同时启
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'playwright-report/junit.xml' }],
  ],
  use: {
    baseURL: BASE_URL,
    // §4.3 DoD 截图证据三件套
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // 浏览器视口（移动端竖屏 · P02 是 H5 拍题）
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Playwright 默认输出到当前 cwd 的 test-results/ —— 整个目录会被拷进 work_log_dir
  outputDir: './test-results',
});
