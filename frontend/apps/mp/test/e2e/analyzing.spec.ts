/**
 * SC01-MP-T03-E2E · P03 Analyzing page-load + testid + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean + assertPageRenders
 *
 * trace: pages/analyzing/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders } from './_helpers';

describe('P03 Analyzing page · page-load + testid', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'analyzing.spec');
  });

  it('reLaunch → pages/analyzing/index · currentPage.path correct 且 view 数 ≥ 5', async () => {
    await mp.reLaunch('/pages/analyzing/index?taskId=demo');
    await new Promise((r) => setTimeout(r, 800));
    await assertPageRenders(mp, 'pages/analyzing/index', 5);
  });

  it('关键 testid DOM 已渲染 (p03-thumb-card + analyzing-pipeline)', async () => {
    const page = await mp.currentPage();
    const thumbCard = await page.$('[data-test-id="p03-thumb-card"]');
    expect(thumbCard).toBeTruthy();
    const pipeline = await page.$('[data-test-id="analyzing-pipeline"]');
    expect(pipeline).toBeTruthy();
  });

  it('mp.screenshot captures analyzing page artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
