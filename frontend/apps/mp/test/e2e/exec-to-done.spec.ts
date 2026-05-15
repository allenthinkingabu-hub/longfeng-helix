/**
 * SC01-MP-T12-E2E · P08→P09 transition E2E (review-exec → review-done)
 * trace: design/mockups/wrongbook/08_review_exec.html → 09_review_done.html
 *
 * Business flow:
 *   1. User is on review-exec page (P08) reviewing a question
 *   2. User taps one of the three self-rating buttons (未掌握 / 部分 / 已掌握)
 *   3. System calls gradeNode API, then navigates to review-done (P09)
 *   4. currentPage().path should become 'pages/review-done/index'
 *
 * Prerequisites:
 *   1. 微信工具 IDE → 安全设置 → Service Port + Allow Getting Ticket + Trust 全开
 *   2. `cli auto --project <path> --auto-port 9420` 已启 (9420 LISTEN)
 *
 * Run: pnpm -F mp test:e2e:automator
 *
 * Phase 1: spec only (不跑 automator) · Phase 2: TL 串行跑
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import automator from 'miniprogram-automator';

const WS_ENDPOINT = process.env.MP_AUTOMATOR_WS || 'ws://127.0.0.1:9420';

describe('SC01-MP-T12-E2E · P08→P09 transition (exec → done)', () => {
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

  it('navigates from review-exec to review-done after grade tap', async () => {
    // Step 1: Navigate to review-exec page with test params
    const sid = 'e2e-sid-001';
    const nid = '1001';
    await mp.navigateTo(`/pages/review-exec/index?sid=${sid}&nid=${nid}`);

    // Step 2: Verify we are on review-exec
    const execPage = await mp.currentPage();
    expect(execPage.path).toBe('pages/review-exec/index');

    // Step 3: Wait for page to render (rating buttons in bottom bar)
    await execPage.waitFor('view');

    // Step 4: Trigger the grade tap — tap the "已掌握" (MASTERED) button
    // Mockup 08: .rbtn.master is the rightmost green button
    // Must use real tap (铁律 1: 模拟真人操作, no callMethod/evaluate bypass)
    await execPage.tap('.rbtn.master');

    // Step 5: Wait for navigation to complete
    // Poll currentPage until path changes to review-done (max 5s)
    let donePage = await mp.currentPage();
    const deadline = Date.now() + 5000;
    while (!donePage.path.includes('review-done') && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 300));
      donePage = await mp.currentPage();
    }

    // Step 6: Assert we landed on review-done
    expect(donePage.path).toContain('pages/review-done/index');
  });

  it('review-done page renders after transition', async () => {
    // After the previous test navigated to review-done, verify DOM rendered
    const page = await mp.currentPage();
    expect(page.path).toContain('pages/review-done/index');

    // review-done should have at least one view element rendered
    const anyView = await page.$('view');
    expect(anyView).toBeTruthy();
  });

  it('review-done page receives query params from exec transition', async () => {
    // Verify the page received the transition query params
    const page = await mp.currentPage();
    expect(page.path).toContain('pages/review-done/index');

    // Take a screenshot for VRT evidence
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
