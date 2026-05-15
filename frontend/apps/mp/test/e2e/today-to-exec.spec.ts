/**
 * SC01-MP-T10-E2E · P07→P08 transition E2E (review-today → review-exec)
 *
 * Business flow (biz trace):
 *   用户在 P07 今日复习页 tap 某错题卡片 → wx.navigateTo → P08 review-exec 页
 *   onItemTap reads data-nid from dataset, navigates to /pages/review-exec/index?nid=<nid>
 *
 * Design trace:
 *   07_review_today.html → 08_review_exec.html
 *   wxml line 79: bind:tap="onItemTap" data-nid="{{card.nid}}"
 *   index.ts line 85-90: onItemTap → wx.navigateTo({ url: `/pages/review-exec/index?nid=${nid}` })
 *
 * Phase 1: spec only (no automator run) · Phase 2 TL runs automator
 *
 * Prerequisites:
 *   1. 微信工具 IDE → 安全设置 → Service Port + Allow Getting Ticket + Trust
 *   2. `cli auto --project <path> --auto-port 9420` running
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
  }, 15_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('reLaunch review-today → tap item card → currentPage.path = pages/review-exec/index', async () => {
    // Step 1: navigate to review-today page
    await mp.reLaunch({ url: '/pages/review-today/index' });
    // wait for page render + data load
    await new Promise(r => setTimeout(r, 2000));

    const todayPage = await mp.currentPage();
    expect(todayPage.path).toBe('pages/review-today/index');

    // Step 2: find first item card with bind:tap="onItemTap"
    // wxml: <view ... class="it ..." bind:tap="onItemTap" data-nid="{{card.nid}}">
    const itemCard = await todayPage.$('.it');
    expect(itemCard).toBeTruthy();

    // Step 3: tap the item card to trigger onItemTap → wx.navigateTo
    await itemCard!.tap();
    // wait for navigation
    await new Promise(r => setTimeout(r, 1500));

    // Step 4: verify currentPage switched to review-exec
    const execPage = await mp.currentPage();
    expect(execPage.path).toContain('pages/review-exec');
  }, 20_000);

  it('review-today page renders hero card and at least one slot item', async () => {
    // Re-navigate to review-today for independent assertion
    await mp.reLaunch({ url: '/pages/review-today/index' });
    await new Promise(r => setTimeout(r, 2000));

    const page = await mp.currentPage();
    expect(page.path).toBe('pages/review-today/index');

    // Hero card must be rendered
    const hero = await page.$('.hero');
    expect(hero).toBeTruthy();

    // At least one item card must exist for tap transition to work
    const item = await page.$('.it');
    expect(item).toBeTruthy();
  }, 15_000);

  it('screenshot: review-today page captured', async () => {
    await mp.reLaunch({ url: '/pages/review-today/index' });
    await new Promise(r => setTimeout(r, 2000));

    // mp.screenshot returns base64 or saves to path
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  }, 15_000);
});
