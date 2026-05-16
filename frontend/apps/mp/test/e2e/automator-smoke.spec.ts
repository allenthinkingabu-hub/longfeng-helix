/**
 * MP automator smoke (sample · 给后续 Coder 当 reference template)
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean 三件套 ·
 *   这是 14 spec 的"标杆" · Coder 写新 spec 必须照这个模式抄
 *
 * 前置：
 *   1. 微信工具 IDE 设置 → 安全设置 → Service Port + Allow Getting Ticket + Trust 全开
 *   2. `cli auto --project <path> --auto-port 9420` 已启 (有 9420 在 LISTEN)
 *
 * 跑：pnpm -F mp test:e2e:automator
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from './_helpers';

describe('MP automator smoke (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'automator-smoke.spec');
  });

  it('systemInfo 返回 devtools platform + SDK 版本', async () => {
    const sys = await mp.systemInfo();
    expect(sys.platform).toBe('devtools');
    expect(sys.SDKVersion).toMatch(/^\d+\.\d+/);
  });

  it('currentPage 是 app.json pages[0] (home)', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/home/index');
  });

  it('home 页 DOM 已渲染 (至少 1 个 view)', async () => {
    const page = await mp.currentPage();
    const anyView = await page.$('view');
    expect(anyView).toBeTruthy();
  });
});
