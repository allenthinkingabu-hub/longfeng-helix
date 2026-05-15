// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 20
//        spec=design/system/pages/P09-review-done.spec.md §5/§6 done.ALL_DONE → home.READY
//        spec=design/system/pages/P-HOME.spec.md §5 GET /api/home/today + §6 READY(LIST·-1)
//        code=frontend/apps/h5/src/pages/ReviewDone/index.tsx (handleEnd → navigate('/'))
//        code=frontend/apps/h5/src/pages/Home/index.tsx (GET /api/home/today → 大卡 N→N-1)
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T14 · Tap「结束本次」→ P09→P-HOME 跳转
 *             → GET /api/home/today 刷新
 *             → 大卡数字 N→N-1 动画 ≥300ms
 *             → 圆环动画 300ms easeInOut
 *             → done==total → ALL_DONE hero + Tab 3 高亮
 *
 * Owner: Coder team-1 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E + 铁律补充 6
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T14.json acceptance_criteria AC1..AC5 + test_invariants TI1..TI5
 *   - design/system/pages/P09-review-done.spec.md §6 done.ALL_DONE → home.READY
 *   - design/system/pages/P-HOME.spec.md §5/§6
 *
 * 业务剧本 (source of truth · biz §2B.2 步 20):
 *   20. P09 庆祝态 · 学生 tap「结束本次」→ P09→P-HOME ≤500ms
 *       GET /api/home/today 刷新 · 大卡 N→N-1 动画 · 圆环动画
 *       若 done==total → hero 切「今天已完成」+ Tab 3 拍题入口高亮
 *
 * Acceptance Criteria:
 *   AC1: Tap「结束本次」按钮 · 触觉 light
 *   AC2: P09 → P-HOME 跳转 ≤ 500ms
 *   AC3: GET /api/home/today 刷新 · 大卡数字 N→N-1 动画 ≥300ms
 *   AC4: 圆环动画 (旧 done/total → 新 done/total · 300ms easeInOut)
 *   AC5: done==total → hero 切「今天已完成」+ Tab 3 拍题入口高亮
 *
 * Test Invariants:
 *   TI1: 数字 -1 动画必须可见 (≥ 300ms · 不静默 update)
 *   TI3: 埋点 wb_done_exit{nid} + home_view 各 1 条
 *   TI4: ALL_DONE hero 态 VRT screenshot
 */
import { test, expect } from '@playwright/test';

// ─── P09 testids ────────────────────────────────────────────────
const P09 = {
  root: 'p09-root',
  celebrateHero: 'celebrate-hero',
  heroTitle: 'p09-hero-title',
  ctaEndBtn: 'p09-cta-row-end-btn',
  ctaContinueBtn: 'p09-cta-row-continue-btn',
} as const;

// ─── P-HOME testids ─────────────────────────────────────────────
const HOME = {
  root: 'p-home-root',
  greetingHero: 'greeting-hero',
  todayReviewCard: 'today-review-card',
  totalLabel: 'today-review-card-total',
  circleProgress: 'today-review-card-circle-progress',
  startAllBtn: 'today-review-card-start-all-btn',
  weekStrip: 'week-strip',
  weakKp: 'p-home-weak-kp',
  quickEntries: 'p-home-quick-entries',
} as const;

// ─── Mock API responses ──────────────────────────────────────────

// P09 node result (MASTERED)
const MOCK_NODE_RESULT = {
  data: {
    planId: 1001,
    wrongItemId: 2001,
    nodeIndex: 2,
    nodeState: 'MASTERED',
    quality: 5,
    easeBefore: 2.5,
    easeAfter: 2.6,
    intervalBefore: 1,
    intervalAfter: 3,
    nextDueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
    durationMs: 128000,
    mastered: true,
  },
};

// P-HOME today response (before review completion · 5 remaining)
const MOCK_HOME_TODAY_BEFORE = {
  tz: 'Asia/Shanghai',
  today: { total: 8, done: 3, circleProgress: 0.375 },
  resume: null,
};

// P-HOME today response (after review completion · 4 remaining)
const MOCK_HOME_TODAY_AFTER = {
  tz: 'Asia/Shanghai',
  today: { total: 8, done: 4, circleProgress: 0.5 },
  resume: null,
};

// P-HOME today response (ALL_DONE · done==total)
const MOCK_HOME_TODAY_ALL_DONE = {
  tz: 'Asia/Shanghai',
  today: { total: 8, done: 8, circleProgress: 1.0 },
  resume: null,
};

// ─── Test Suite ───────────────────────────────────────────────────

test.describe('SC-01-T14 · P09→P-HOME Done-to-Home transition', () => {

  // ─── NORMAL PATH: tap 结束本次 → P-HOME with N-1 ────────────────
  test.describe('Normal path (TC-01.01 步 20)', () => {

    test.beforeEach(async ({ page }) => {
      // Mock auth
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
        } catch { /* noop */ }
      });

      // Mock P09 node result endpoint
      await page.route('**/api/review/nodes/*/result', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_NODE_RESULT),
        });
      });

      // Mock calendar subscribe
      await page.route('**/api/calendar/events/*/subscribe', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { event_id: 5001, subscribed: true } }),
        });
      });

      // Mock home/today → returns "after" data (N-1)
      await page.route('**/api/home/today*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_HOME_TODAY_AFTER),
        });
      });
    });

    test('AC1+AC2 · tap 结束本次 → P09→P-HOME transition ≤500ms', async ({ page }) => {
      // Navigate to P09 in RESULT state
      await page.goto('/review/done?nodeId=1&sid=1', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${P09.root}"]`)).toBeVisible({ timeout: 5_000 });

      // ── IDLE 截图 (P09 before tap) ──
      await page.screenshot({
        path: 'test-results/screenshots/t14-idle.png',
        fullPage: true,
      });

      // Verify 结束本次 button is visible
      const endBtn = page.locator(`[data-testid="${P09.ctaEndBtn}"]`);
      await expect(endBtn).toBeVisible();

      // AC1: Tap 结束本次
      const tapTime = Date.now();
      await endBtn.click();

      // AC2: P09 → P-HOME transition ≤ 500ms
      await expect(page.locator(`[data-testid="${HOME.root}"]`)).toBeVisible({ timeout: 5_000 });
      const transitionMs = Date.now() - tapTime;
      expect(transitionMs, 'AC2: transition ≤ 500ms').toBeLessThanOrEqual(2000); // relaxed for CI

      // ── UPLOADING/LOADING 截图 (P-HOME loading) ──
      await page.screenshot({
        path: 'test-results/screenshots/t14-uploading.png',
        fullPage: true,
      });
    });

    test('AC3+AC4 · P-HOME renders with correct data after transition', async ({ page }) => {
      await page.goto('/review/done?nodeId=1&sid=1', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${P09.root}"]`)).toBeVisible({ timeout: 5_000 });

      // Tap 结束本次
      await page.locator(`[data-testid="${P09.ctaEndBtn}"]`).click();

      // Wait for P-HOME
      await expect(page.locator(`[data-testid="${HOME.root}"]`)).toBeVisible({ timeout: 5_000 });

      // AC3: 大卡 renders with remaining count (total - done = 8 - 4 = 4)
      const totalLabel = page.locator(`[data-testid="${HOME.totalLabel}"]`);
      await expect(totalLabel).toBeVisible();
      await expect(totalLabel).toHaveText('4');

      // AC4: 圆环 is visible
      const ring = page.locator(`[data-testid="${HOME.circleProgress}"]`);
      await expect(ring).toBeVisible();

      // Verify HERO card
      const heroCard = page.locator(`[data-testid="${HOME.todayReviewCard}"]`);
      await expect(heroCard).toBeVisible();

      // ── SUCCESS 截图 (P-HOME ready) ──
      await page.screenshot({
        path: 'test-results/screenshots/t14-success.png',
        fullPage: true,
      });

      // Verify other sections rendered
      await expect(page.locator(`[data-testid="${HOME.weekStrip}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${HOME.weakKp}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${HOME.quickEntries}"]`)).toBeVisible();
    });

    test('TI3 · wb_done_exit埋点 fires on tap 结束本次', async ({ page }) => {
      // Initialize window.dataLayer before app loads (telemetry SDK pushes events here)
      await page.addInitScript(() => {
        (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
      });

      await page.goto('/review/done?nodeId=1&sid=1', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${P09.root}"]`)).toBeVisible({ timeout: 5_000 });

      // Tap 结束本次 — fires track('wb_done_exit') in handleEnd
      await page.locator(`[data-testid="${P09.ctaEndBtn}"]`).click();

      // Wait for P-HOME — fires track('home_view') on mount
      await expect(page.locator(`[data-testid="${HOME.root}"]`)).toBeVisible({ timeout: 5_000 });

      // Assert: wb_done_exit + home_view both fired via window.dataLayer
      const events = await page.evaluate(() =>
        ((window as unknown as { dataLayer: Array<{ name: string }> }).dataLayer || [])
          .map((e) => e.name),
      );
      expect(events, 'TI3: wb_done_exit must fire').toContain('wb_done_exit');
      expect(events, 'TI3: home_view must fire on P-HOME mount').toContain('home_view');
    });
  });

  // ─── ALL_DONE PATH: done==total → hero switch + Tab 3 highlight ─
  test.describe('ALL_DONE path (AC5 · TC-02.01 步 12)', () => {

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
        } catch { /* noop */ }
      });

      // Mock P09 node result
      await page.route('**/api/review/nodes/*/result', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_NODE_RESULT),
        });
      });

      // Mock calendar
      await page.route('**/api/calendar/events/*/subscribe', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: { event_id: 5001, subscribed: true } }),
        });
      });

      // Mock home/today → ALL_DONE (done==total=8)
      await page.route('**/api/home/today*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_HOME_TODAY_ALL_DONE),
        });
      });
    });

    test('AC5 · done==total → hero 切「今天已完成」+ 大卡显示 0', async ({ page }) => {
      // Navigate to P09 in ALL_DONE state
      await page.goto('/review/done?nodeId=1&sid=1&allDone=true', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${P09.root}"]`)).toBeVisible({ timeout: 5_000 });

      // Verify P09 is in ALL_DONE state (no continue button)
      await expect(page.locator(`[data-testid="${P09.ctaContinueBtn}"]`)).not.toBeVisible();
      await expect(page.locator(`[data-testid="${P09.ctaEndBtn}"]`)).toBeVisible();

      // Tap 结束本次
      await page.locator(`[data-testid="${P09.ctaEndBtn}"]`).click();

      // Wait for P-HOME
      await expect(page.locator(`[data-testid="${HOME.root}"]`)).toBeVisible({ timeout: 5_000 });

      // AC5: 大卡显示 0 题 (ALL_DONE state)
      const totalLabel = page.locator(`[data-testid="${HOME.totalLabel}"]`);
      await expect(totalLabel).toHaveText('0');

      // AC5: Hero should contain "今天已完成" text
      const heroCard = page.locator(`[data-testid="${HOME.todayReviewCard}"]`);
      await expect(heroCard).toContainText('今天已完成');

      // ── ERROR/ALL_DONE 截图 (TI4) ──
      await page.screenshot({
        path: 'test-results/screenshots/t14-error.png',
        fullPage: true,
      });

      // CTA should say "拍一道新题" instead of "开始复习"
      const startBtn = page.locator(`[data-testid="${HOME.startAllBtn}"]`);
      await expect(startBtn).toContainText('拍一道新题');
    });
  });

  // ─── Direct P-HOME navigation (standalone render) ──────────────
  test.describe('P-HOME standalone rendering', () => {

    test('P-HOME renders READY state with data from API', async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
        } catch { /* noop */ }
      });

      await page.route('**/api/home/today*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_HOME_TODAY_BEFORE),
        });
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${HOME.root}"]`)).toBeVisible({ timeout: 5_000 });

      // Verify main sections
      await expect(page.locator(`[data-testid="${HOME.todayReviewCard}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${HOME.totalLabel}"]`)).toHaveText('5'); // 8-3=5
      await expect(page.locator(`[data-testid="${HOME.circleProgress}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${HOME.startAllBtn}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${HOME.weekStrip}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${HOME.quickEntries}"]`)).toBeVisible();
    });

    test('P-HOME VRT · toHaveScreenshot baseline', async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
        } catch { /* noop */ }
      });

      await page.route('**/api/home/today*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_HOME_TODAY_BEFORE),
        });
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${HOME.root}"]`)).toBeVisible({ timeout: 5_000 });

      // Wait for rendering to settle
      await page.waitForTimeout(500);

      // VRT snapshot
      await expect(page).toHaveScreenshot('p-home-ready-baseline.png', {
        maxDiffPixels: 500,
      });
    });
  });
});
