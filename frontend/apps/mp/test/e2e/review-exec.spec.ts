/**
 * SC01-MP-T11-E2E · P08 review-exec page-load + testid + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean + assertPageRenders
 *
 * trace: pages/review-exec/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders } from './_helpers';

describe('P08 review-exec page-load + testid (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
    await mp.reLaunch('/pages/review-exec/index');
    await new Promise((r) => setTimeout(r, 1000));
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'review-exec.spec');
  });

  it('currentPage.path 为 pages/review-exec/index 且 view 数 ≥ 8', async () => {
    await assertPageRenders(mp, 'pages/review-exec/index', 8);
  });

  it('关键 UI 节点全部渲染 (root / questionHero / gradeButtons / memoryCurve)', async () => {
    const page = await mp.currentPage();
    const root = await page.$('[data-test-id="p08-root"]');
    expect(root).toBeTruthy();

    const questionHero = await page.$('[data-test-id="p08-question-hero"]');
    expect(questionHero).toBeTruthy();

    const gradeButtons = await page.$('[data-test-id="p08-grade-buttons"]');
    expect(gradeButtons).toBeTruthy();

    const memoryCurve = await page.$('[data-test-id="memory-curve"]');
    expect(memoryCurve).toBeTruthy();
  });

  it('revealBtn 初始态存在 (READING state)', async () => {
    const page = await mp.currentPage();
    const revealBtn = await page.$('[data-test-id="p08-reveal-btn"]');
    expect(revealBtn).toBeTruthy();
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
