/**
 * SC01-MP-T12-E2E · P08 review-exec → P09 review-done transition + console-clean
 *
 * Phase 4 (Fix-2 · 2026-05-16): 用 connectMp + assertConsoleClean
 *
 * Business flow: User on P08 taps grade button → navigate to P09 review-done
 *
 * trace: pages/review-exec → pages/review-done
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { type Mp, connectMp, assertConsoleClean } from './_helpers';

describe('SC01-MP-T12-E2E · P08→P09 transition (exec → done)', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    ({ mp, errors } = await connectMp());
  }, 45_000);

  afterAll(async () => {
    if (mp) await mp.disconnect();
    assertConsoleClean(errors, 'exec-to-done.spec');
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
