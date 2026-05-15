/**
 * SC01-MP-T08-E2E · Home page E2E (page-load + testid)
 *
 * Phase 3: drop pixelmatch VRT · keep testid + data binding assertions · screenshot artifact only
 *
 * trace: pages/home/index · home 是 app.json pages[0] 默认落地页
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('Home page E2E + testid (SC01-MP-T08-E2E)', () => {
  let mp: Awaited<ReturnType<typeof automator.connect>>;

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
  }, 15_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('currentPage path is pages/home/index', async () => {
    const page = await mp.currentPage();
    expect(page.path).toBe('pages/home/index');
  });

  it('home page renders key DOM nodes with testids', async () => {
    const page = await mp.currentPage();

    const root = await page.$('[data-test-id="p-home-root"]');
    expect(root).toBeTruthy();

    const greeting = await page.$('[data-test-id="greeting-hero"]');
    expect(greeting).toBeTruthy();

    const reviewCard = await page.$('[data-test-id="today-review-card"]');
    expect(reviewCard).toBeTruthy();

    const startBtn = await page.$('[data-test-id="today-review-card-start-all-btn"]');
    expect(startBtn).toBeTruthy();
  });

  it('page data contains expected MVP values after load', async () => {
    const page = await mp.currentPage();
    const data = await page.data();

    expect(data.greeting).toBeTruthy();
    expect(typeof data.greeting).toBe('string');
    expect(data.studentName).toBe('小 A');
    expect(data.streak).toBe(12);
    expect(data.mastered).toBe(142);
    expect(data.estMin).toBe(25);
    expect(data.subjects).toHaveLength(3);
    expect(data.subjects[0].name).toBe('数学');
    expect(data.weekStats).toEqual({ mastered: 23, newItems: 8, forgotten: 2, masteryRate: 68 });
    expect(data.weekDays).toHaveLength(7);
    expect(data.messages).toHaveLength(3);
    expect(data.quickEntries).toHaveLength(4);
  });

  it('mp.screenshot 截图落 artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
