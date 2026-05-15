/**
 * SC01-MP-T12-E2E · P08→P09 transition E2E (review-exec → review-done)
 *
 * Phase 3: use mp.reLaunch · drop pixelmatch
 *
 * Business flow: User on P08 taps grade button → navigate to P09 review-done
 *
 * trace: pages/review-exec → pages/review-done
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
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
  });

  it('navigates from review-exec to review-done after grade tap', async () => {
    const sid = 'e2e-sid-001';
    const nid = '1001';
    await mp.reLaunch(`/pages/review-exec/index?sid=${sid}&nid=${nid}`);
    await new Promise((r) => setTimeout(r, 1000));

    const execPage = await mp.currentPage();
    expect(execPage.path).toBe('pages/review-exec/index');

    await execPage.waitFor('view');

    // Tap "已掌握" (MASTERED) button
    await execPage.tap('.rbtn.master');

    // Poll currentPage until path changes to review-done (max 5s)
    let donePage = await mp.currentPage();
    const deadline = Date.now() + 5000;
    while (!donePage.path.includes('review-done') && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 300));
      donePage = await mp.currentPage();
    }

    expect(donePage.path).toContain('pages/review-done/index');
  });

  it('review-done page renders after transition', async () => {
    const page = await mp.currentPage();
    expect(page.path).toContain('pages/review-done/index');

    const anyView = await page.$('view');
    expect(anyView).toBeTruthy();
  });

  it('review-done page screenshot artifact', async () => {
    const screenshot = await mp.screenshot();
    expect(screenshot).toBeTruthy();
  });
});
