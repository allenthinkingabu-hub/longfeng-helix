/**
 * SC01-MP-T10-E2E · P07→P08 transition E2E (review-today → review-exec)
 *
 * Phase 3: use mp.reLaunch · drop pixelmatch · testid assert
 *
 * Business flow: 用户在 P07 今日复习页 tap 错题卡片 → P08 review-exec
 * Phase 3: reLaunch 起点 → tap item card → currentPage.path 验跳转
 *
 * trace: pages/review-today → pages/review-exec
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('SC01-MP-T10-E2E · today→exec transition (真 IDE)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;

  beforeAll(async () => {
    mp = await Promise.race([
      automator.connect({ wsEndpoint: WS_ENDPOINT }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`connect timeout: ${WS_ENDPOINT} not listening · 先跑 cli auto`)), 8000),
      ),
    ]);
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('reLaunch review-today → tap item card → currentPage.path = pages/review-exec/index', async () => {
    await mp.reLaunch({ url: '/pages/review-today/index' });
    await new Promise((r) => setTimeout(r, 2000));

    const todayPage = await mp.currentPage();
    expect(todayPage.path).toBe('pages/review-today/index');

    const itemCard = await todayPage.$('.it');
    expect(itemCard).toBeTruthy();

    await itemCard!.tap();
    await new Promise((r) => setTimeout(r, 1500));

    const execPage = await mp.currentPage();
    expect(execPage.path).toBe('pages/review-exec/index');

    const query = (execPage as unknown as { query: Record<string, string> }).query;
    expect(query).toBeDefined();
    expect(query.nid).toBeTruthy();
  }, 60_000);

  it('review-today page renders hero card and at least one slot item', async () => {
    await mp.reLaunch({ url: '/pages/review-today/index' });
    await new Promise((r) => setTimeout(r, 2000));

    const page = await mp.currentPage();
    expect(page.path).toBe('pages/review-today/index');

    const hero = await page.$('.hero');
    expect(hero).toBeTruthy();

    const item = await page.$('.it');
    expect(item).toBeTruthy();
  }, 45_000);

  it('screenshot: review-today page captured', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  }, 45_000);
});
