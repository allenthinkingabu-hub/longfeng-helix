/**
 * SC01-MP-T08-E2E · Home page E2E (page-load + testid + console-clean)
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean + assertPageRenders 三件套 ·
 *   不再裸调 automator.connect + expect(page.path) · 防 IDE Console silent error 漏过
 *
 * 历史 RC: 之前 8/8 PASS 时 home 只渲染 hero · 7 sections 未 mount (READY-block 全包) ·
 *   path 断言绿但 view 数严重不足 · 故 assertPageRenders(minViews=15) 当场炸
 *
 * trace: pages/home/index · home 是 app.json pages[0] 默认落地页
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders } from './_helpers';

describe('Home page E2E + testid (SC01-MP-T08-E2E)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'home.spec');
  });

  it('currentPage path is pages/home/index 且 view 数 ≥ 15 (sections 全 mount)', async () => {
    await assertPageRenders(mp, 'pages/home/index', 15);
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
