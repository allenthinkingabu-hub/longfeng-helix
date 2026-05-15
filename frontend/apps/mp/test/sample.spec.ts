// miniprogram-automator E2E · PHASE-C bootstrap sample test
// 预启 IDE (scripts/devtools-cli.sh auto) → automator.connect() 接 ws://127.0.0.1:9420
// trace: SC01-MP-T00 scope_in · 禁 Mock IDE · 禁 Mock socket · 禁 automator.launch()

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';
import { automatorConfig } from './automator.config';

describe('MP bootstrap · sample E2E', () => {
  let miniProgram: Awaited<ReturnType<typeof automator.connect>>;

  beforeAll(async () => {
    // connect 到预启的 IDE socket（由 scripts/devtools-cli.sh auto 预启）
    // 禁用 automator.launch() — attempt-1 死因: launch() 25 进程泄漏
    miniProgram = await automator.connect({
      wsEndpoint: automatorConfig.wsEndpoint,
    });
  }, 30_000);

  afterAll(async () => {
    if (miniProgram) {
      await miniProgram.disconnect();
    }
  }, 10_000);

  it('systemInfo returns valid platform object', async () => {
    const info = await miniProgram.systemInfo();
    expect(info).toBeTruthy();
    expect(info).toHaveProperty('platform');
    expect(info).toHaveProperty('SDKVersion');
  }, 15_000);

  it('capture page loads and van-button is visible', async () => {
    // 获取当前页面（app.json 首页 = pages/capture/index）
    const page = await miniProgram.currentPage();
    expect(page.path).toBe('pages/capture/index');

    // 断言 van-button 组件已渲染
    const button = await page.$('van-button');
    expect(button).toBeTruthy();

    // 断言 data-test-id="p02-root" 的根元素存在
    const root = await page.$('[data-test-id="p02-root"]');
    expect(root).toBeTruthy();

    // 断言 data-test-id="capture-shutter" 的按钮存在
    const shutter = await page.$('[data-test-id="capture-shutter"]');
    expect(shutter).toBeTruthy();
  }, 30_000);
});
