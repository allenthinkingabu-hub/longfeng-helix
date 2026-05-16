/**
 * SC01-MP-T05-E2E · P04 result page-load + testid + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean + assertPageRenders
 *
 * trace: pages/result/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders } from './_helpers';

describe('P04 result page-load + testid (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
    await mp.reLaunch('/pages/result/index?qid=test-vrt-001');
    await new Promise((r) => setTimeout(r, 1000));
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'result.spec');
  });

  it('currentPage.path 为 pages/result/index 且 view 数 ≥ 5', async () => {
    await assertPageRenders(mp, 'pages/result/index', 5);
  });

  it('页面 DOM 包含 p04-root view 且已渲染', async () => {
    const page = await mp.currentPage();
    const root = await page.$('[data-test-id="p04-root"]');
    expect(root).toBeTruthy();
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
