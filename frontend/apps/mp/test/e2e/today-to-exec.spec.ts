/**
 * SC01-MP-T10-E2E · P07 review-today → P08 review-exec transition + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean
 *
 * 业务剧本: 用户在 P07 今日复习页 tap 错题卡片 → P08 review-exec
 *
 * trace: pages/review-today → pages/review-exec
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from './_helpers';

describe('SC01-MP-T10-E2E · today→exec transition (真 IDE)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'today-to-exec.spec');
  });

  it('reLaunch review-today → tap item card → currentPage.path = pages/review-exec/index', async () => {
    await mp.reLaunch('/pages/review-today/index');
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
    await mp.reLaunch('/pages/review-today/index');
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
