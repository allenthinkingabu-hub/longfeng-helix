/**
 * P08 复习执行 · page-load + testid E2E spec
 *
 * Phase 3: drop pixelmatch VRT · use mp.reLaunch · assert testid · screenshot artifact only
 *
 * trace: SC01-MP-T11-E2E · pages/review-exec/index
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('P08 review-exec page-load + testid (真 IDE)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;
  let page: Awaited<ReturnType<typeof mp.currentPage>>;

  beforeAll(async () => {
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)),
          8000,
        ),
      ),
    ]);

    await mp.reLaunch({ url: '/pages/review-exec/index' });
    await new Promise((r) => setTimeout(r, 1000));
    page = await mp.currentPage();
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('currentPage.path 为 pages/review-exec/index', async () => {
    expect(page.path).toBe('pages/review-exec/index');
  });

  it('关键 UI 节点全部渲染 (root / questionHero / gradeButtons / memoryCurve)', async () => {
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
    const revealBtn = await page.$('[data-test-id="p08-reveal-btn"]');
    expect(revealBtn).toBeTruthy();
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
