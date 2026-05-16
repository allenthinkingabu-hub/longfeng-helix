/**
 * SC01-MP-T13-E2E · P09 review-done page-load + testid + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean + assertPageRenders
 *
 * trace: pages/review-done/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders } from './_helpers';

describe('SC01-MP-T13 · P09 review-done page-load + testid (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
    await mp.reLaunch('/pages/review-done/index');
    await new Promise((r) => setTimeout(r, 1000));
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'review-done.spec');
  });

  it('currentPage.path === pages/review-done/index 且 view 数 ≥ 8', async () => {
    await assertPageRenders(mp, 'pages/review-done/index', 8);
  });

  it('hero / memory-curve / stats / cta DOM 元素已渲染', async () => {
    const page = await mp.currentPage();

    const hero = await page.$('[data-test-id="celebrate-hero"]');
    expect(hero).toBeTruthy();

    const memoryCurve = await page.$('[data-test-id="memory-curve"]');
    expect(memoryCurve).toBeTruthy();

    const stats = await page.$('[data-test-id="p09-stats-row"]');
    expect(stats).toBeTruthy();

    const cta = await page.$('[data-test-id="p09-cta-row"]');
    expect(cta).toBeTruthy();
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
