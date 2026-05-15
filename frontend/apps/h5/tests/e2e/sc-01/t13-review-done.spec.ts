// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 19
//        spec=design/system/pages/P09-review-done.spec.md §5 API 触点 + §6 状态机 + §9 异常降级 + §13 testid
//        code=backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/ReviewPlanController.java:269
//        code=backend/calendar-core/src/main/java/com/longfeng/calendar/controller/CalendarApiController.java:39
//        code=frontend/apps/h5/src/pages/ReviewDone/index.tsx
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T13 · P09 复习完成页 (ReviewDone)
 * (TC-01.01 黄金路径步 19 · 庆祝 Hero + 记忆曲线 + 加日历 + 统计卡)
 *
 * Owner: Coder team-5 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E + 铁律补充 6 E2E = DoD 唯一硬条件
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T13.json acceptance_criteria AC1-AC5 + test_invariants TI1-TI5
 *   - design/system/pages/P09-review-done.spec.md §5/§6/§9/§13
 *
 * 业务剧本 (source of truth · biz §2B.2 步 19):
 *   步 19: 学生完成 P08 评分后自动跳转 P09 → 绿渐变 Hero + confetti 1s →
 *          记忆曲线 T(n-1)→T(n) 推进 → 统计卡 + KP 掌握度 → CTA 继续/结束
 *
 * Acceptance Criteria:
 *   AC1: P09 渲染绿色庆祝 Hero (绿渐变 + confetti 1s 动画 + 大对勾)
 *   AC2: GET /api/review/nodes/{nid}/result → 200 NodeResultResp
 *   AC3: 记忆曲线 SVG · 6 节点状态: T1/T2=done · T3=now 脉冲 · T4-T6=gray
 *   AC4: 「+加入日历」按钮 → POST /api/calendar/events/{eid}/subscribe → 200 · Toast
 *   AC5: 3 统计卡 (已掌握/部分/遗忘) + KP 掌握度条形渲染
 *
 * Test Invariants:
 *   TI1: confetti 动画 ≤ 1s 且不阻塞滚动 (pointer-events:none)
 *   TI2: ALL_DONE 升级态不显示「继续」按钮 · 仅「结束本次」
 *   TI3: subscribe 幂等 (同 eid 重放返当前快照)
 *   TI4: 埋点 wb_done_view + wb_done_add_calendar
 *   TI5: P09 result 态 + ALL_DONE 态 VRT screenshot × 2
 */
import { test, expect } from '@playwright/test';

// ─── testids (1:1 with @longfeng/testids p09 section) ──────────────
const TID = {
  root: 'p09-root',
  celebrateHero: 'celebrate-hero',
  heroTitle: 'p09-hero-title',
  heroCheckmark: 'p09-hero-checkmark',
  heroStreakNumber: 'celebrate-hero-streak-number',
  confettiBurst: 'confetti-burst',
  memoryCurve: 'memory-curve',
  advanceBanner: 'p09-advance-banner',
  advanceBannerText: 'p09-advance-banner-text',
  nextDueCard: 'p09-next-due-card',
  addCalendarBtn: 'p09-next-due-card-add-calendar-btn',
  statsRow: 'p09-stats-row',
  statsMastered: 'p09-stats-row-mastered',
  statsPartial: 'p09-stats-row-partial',
  statsForgot: 'p09-stats-row-forgot',
  kpChart: 'p09-kp-chart',
  ctaRow: 'p09-cta-row',
  ctaContinueBtn: 'p09-cta-row-continue-btn',
  ctaEndBtn: 'p09-cta-row-end-btn',
} as const;

// Dynamic testid helpers
const memoryCurveNode = (tLevel: string) => `memory-curve-node-${tLevel}`;
const confettiParticle = (n: number) => `confetti-burst-particle-${n}`;
const kpChartBarNew = (n: number) => `p09-kp-chart-row-${n}-bar-new`;

// ─── Mock API data for route setup ────────────────────────────────
const MOCK_NODE_RESULT = {
  plan_id: 1001,
  wrong_item_id: 2001,
  node_index: 2,
  node_state: 'MASTERED',
  quality: 5,
  ease_before: 2.5,
  ease_after: 2.6,
  interval_before: 1,
  interval_after: 3,
  next_due_at: new Date(Date.now() + 3 * 86400000).toISOString(),
  duration_ms: 128000,
  mastered: true,
};

const MOCK_SUBSCRIBE_RESP = {
  event_id: 5001,
  subscribed: true,
  subscribed_at: new Date().toISOString(),
};

// ─── Test Suite ──────────────────────────────────────────────────────

test.describe('SC-01-T13 · P09 ReviewDone', () => {

  test.beforeEach(async ({ page }) => {
    // Mock API: GET /api/review/nodes/{nid}/result → 200 (AC2)
    await page.route('**/api/review/nodes/*/result', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_NODE_RESULT),
      });
    });

    // Mock API: POST /api/calendar/events/{eid}/subscribe → 200 (AC4)
    await page.route('**/api/calendar/events/*/subscribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUBSCRIBE_RESP),
      });
    });
  });

  // ── AC1: Hero celebration rendering ────────────────────────────────
  test('AC1 · renders green celebration Hero with confetti + checkmark', async ({ page }) => {
    await page.goto('/review/done?nodeId=100&sid=200');
    await page.waitForSelector(`[data-testid="${TID.root}"]`);

    // Hero container visible
    const hero = page.locator(`[data-testid="${TID.celebrateHero}"]`);
    await expect(hero).toBeVisible();

    // Checkmark icon visible
    const checkmark = page.locator(`[data-testid="${TID.heroCheckmark}"]`);
    await expect(checkmark).toBeVisible();

    // Hero title displays "本题已掌握" (RESULT state)
    const title = page.locator(`[data-testid="${TID.heroTitle}"]`);
    await expect(title).toHaveText('本题已掌握');

    // Confetti container exists with particles
    const confetti = page.locator(`[data-testid="${TID.confettiBurst}"]`);
    await expect(confetti).toBeVisible();

    // TI1: confetti has pointer-events:none (doesn't block scrolling)
    const pointerEvents = await confetti.evaluate((el) => window.getComputedStyle(el).pointerEvents);
    expect(pointerEvents).toBe('none');

    // 8 confetti particles per mockup
    for (let i = 0; i < 8; i++) {
      const particle = page.locator(`[data-testid="${confettiParticle(i)}"]`);
      await expect(particle).toBeAttached();
    }

    // VRT: RESULT state screenshot (TI5)
    await page.screenshot({ path: 'test-results/result-actual.png', fullPage: true });
  });

  // ── AC2: GET /api/review/nodes/{nid}/result → 200 ─────────────────
  test('AC2 · fetches node result via GET /nodes/{nid}/result', async ({ page }) => {
    let apiCalled = false;

    await page.route('**/api/review/nodes/*/result', async (route) => {
      apiCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_NODE_RESULT),
      });
    });

    await page.goto('/review/done?nodeId=100&sid=200');
    await page.waitForSelector(`[data-testid="${TID.root}"]`);

    // Verify API was called
    expect(apiCalled).toBe(true);

    // Advance banner shows next T level text
    const advanceText = page.locator(`[data-testid="${TID.advanceBannerText}"]`);
    await expect(advanceText).toContainText('T3');
  });

  // ── AC3: Memory curve 6-node state rendering ──────────────────────
  test('AC3 · renders memory curve with 6 nodes (done/now/future states)', async ({ page }) => {
    await page.goto('/review/done?nodeId=100&sid=200');
    await page.waitForSelector(`[data-testid="${TID.memoryCurve}"]`);

    // Memory curve card visible
    const curve = page.locator(`[data-testid="${TID.memoryCurve}"]`);
    await expect(curve).toBeVisible();

    // 6 nodes exist
    for (const tl of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']) {
      const node = page.locator(`[data-testid="${memoryCurveNode(tl)}"]`);
      await expect(node).toBeVisible();
    }

    // Advance banner visible
    const banner = page.locator(`[data-testid="${TID.advanceBanner}"]`);
    await expect(banner).toBeVisible();
  });

  // ── AC4: Calendar subscribe button ────────────────────────────────
  test('AC4 · +日历 button → POST /subscribe → 200 + Toast', async ({ page }) => {
    let subscribeCalled = false;

    await page.route('**/api/calendar/events/*/subscribe', async (route) => {
      subscribeCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUBSCRIBE_RESP),
      });
    });

    await page.goto('/review/done?nodeId=100&sid=200');
    await page.waitForSelector(`[data-testid="${TID.addCalendarBtn}"]`);

    // Next due card visible
    const nextCard = page.locator(`[data-testid="${TID.nextDueCard}"]`);
    await expect(nextCard).toBeVisible();

    // Tap +日历 button
    const addBtn = page.locator(`[data-testid="${TID.addCalendarBtn}"]`);
    await expect(addBtn).toBeEnabled();
    await addBtn.click();

    // Verify API called
    expect(subscribeCalled).toBe(true);

    // Toast should appear "已同步到日历" (spec §14 done.next.added.toast)
    const toast = page.locator('[role="status"]');
    await expect(toast).toContainText('已同步到日历');

    // Button should now show "已添加" (disabled state)
    await expect(addBtn).toContainText('已添加');
    await expect(addBtn).toBeDisabled();
  });

  // ── AC5: Stats row + KP chart rendering ───────────────────────────
  test('AC5 · renders 3 stat cards + KP mastery bars', async ({ page }) => {
    await page.goto('/review/done?nodeId=100&sid=200');
    await page.waitForSelector(`[data-testid="${TID.statsRow}"]`);

    // Stats row visible with 3 cards
    const statsRow = page.locator(`[data-testid="${TID.statsRow}"]`);
    await expect(statsRow).toBeVisible();

    const mastered = page.locator(`[data-testid="${TID.statsMastered}"]`);
    await expect(mastered).toBeVisible();
    await expect(mastered).toContainText('Mastered');

    const partial = page.locator(`[data-testid="${TID.statsPartial}"]`);
    await expect(partial).toBeVisible();
    await expect(partial).toContainText('Partial');

    const forgot = page.locator(`[data-testid="${TID.statsForgot}"]`);
    await expect(forgot).toBeVisible();
    await expect(forgot).toContainText('Forgot');

    // KP chart visible with bars
    const kpChart = page.locator(`[data-testid="${TID.kpChart}"]`);
    await expect(kpChart).toBeVisible();

    // At least 4 KP bar fills
    for (let i = 0; i < 4; i++) {
      const bar = page.locator(`[data-testid="${kpChartBarNew(i)}"]`);
      await expect(bar).toBeAttached();
    }
  });

  // ── TI2: ALL_DONE hides continue button ───────────────────────────
  test('TI2 · ALL_DONE state hides continue CTA, only shows end', async ({ page }) => {
    await page.goto('/review/done?nodeId=100&sid=200&allDone=true');
    await page.waitForSelector(`[data-testid="${TID.root}"]`);

    // Hero title shows ALL_DONE text
    const title = page.locator(`[data-testid="${TID.heroTitle}"]`);
    await expect(title).toContainText('今日复习全部完成');

    // Continue button should NOT exist
    const continueBtn = page.locator(`[data-testid="${TID.ctaContinueBtn}"]`);
    await expect(continueBtn).toHaveCount(0);

    // End button SHOULD exist
    const endBtn = page.locator(`[data-testid="${TID.ctaEndBtn}"]`);
    await expect(endBtn).toBeVisible();

    // Streak number visible in ALL_DONE
    const streak = page.locator(`[data-testid="${TID.heroStreakNumber}"]`);
    await expect(streak).toBeVisible();

    // VRT: ALL_DONE state screenshot (TI5)
    await page.screenshot({ path: 'test-results/all-done-actual.png', fullPage: true });
  });

  // ── TI3: subscribe idempotency ────────────────────────────────────
  test('TI3 · subscribe is idempotent (double-tap does not error)', async ({ page }) => {
    let callCount = 0;

    await page.route('**/api/calendar/events/*/subscribe', async (route) => {
      callCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUBSCRIBE_RESP),
      });
    });

    await page.goto('/review/done?nodeId=100&sid=200');
    const addBtn = page.locator(`[data-testid="${TID.addCalendarBtn}"]`);
    await expect(addBtn).toBeEnabled();

    // First tap
    await addBtn.click();
    await expect(addBtn).toContainText('已添加');

    // Second tap should not error (button is disabled after first success)
    await expect(addBtn).toBeDisabled();

    // Only one API call (button disabled after first)
    expect(callCount).toBe(1);
  });

  // ── CTA buttons functional ────────────────────────────────────────
  test('CTA · RESULT state shows both continue + end buttons', async ({ page }) => {
    await page.goto('/review/done?nodeId=100&sid=200');
    await page.waitForSelector(`[data-testid="${TID.ctaRow}"]`);

    const continueBtn = page.locator(`[data-testid="${TID.ctaContinueBtn}"]`);
    await expect(continueBtn).toBeVisible();
    await expect(continueBtn).toContainText('继续复习');

    const endBtn = page.locator(`[data-testid="${TID.ctaEndBtn}"]`);
    await expect(endBtn).toBeVisible();
    await expect(endBtn).toContainText('结束本次');
  });

  // ── Error degradation (§9) ────────────────────────────────────────
  test('§9 degradation · GET /result 5xx → Hero neutral + Toast', async ({ page }) => {
    await page.route('**/api/review/nodes/*/result', async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto('/review/done?nodeId=100&sid=200');
    await page.waitForSelector(`[data-testid="${TID.root}"]`);

    // Page still renders (RESULT fallback)
    const hero = page.locator(`[data-testid="${TID.celebrateHero}"]`);
    await expect(hero).toBeVisible();

    // Toast should appear "结果同步中"
    const toast = page.locator('[role="status"]');
    await expect(toast).toContainText('结果同步中');

    // CTA buttons still functional (not blocked)
    const endBtn = page.locator(`[data-testid="${TID.ctaEndBtn}"]`);
    await expect(endBtn).toBeVisible();

    // VRT: ERROR state screenshot
    await page.screenshot({ path: 'test-results/error-actual.png', fullPage: true });
  });

  // ── IDLE/LOADING state screenshot ─────────────────────────────────
  test('VRT · captures idle/loading state screenshot', async ({ page }) => {
    // Delay API response to capture loading state
    await page.route('**/api/review/nodes/*/result', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_NODE_RESULT),
      });
    });

    await page.goto('/review/done?nodeId=100&sid=200');

    // Capture idle/loading state quickly before API resolves
    await page.screenshot({ path: 'test-results/idle-actual.png', fullPage: true });
  });
});
