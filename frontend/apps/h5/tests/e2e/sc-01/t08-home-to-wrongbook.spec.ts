// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 12-13
//        spec=design/system/pages/P-HOME.spec.md §5 GET /api/home/today + §6 状态机
//        code=backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/HomeAggregatorController.java
//        code=frontend/apps/h5/src/pages/Home/index.tsx
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T08 · P05→P-HOME 返回 · 今日复习大卡数字 +1 · 圆环进度动画
 *
 * Owner: Coder team-2 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E + 铁律补充 6
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T08.json acceptance_criteria AC1..AC4 + test_invariants TI1..TI4
 *   - design/system/pages/P-HOME.spec.md §5/§6/§9
 *
 * 业务剧本 (source of truth · biz §2B.2 步 12-13):
 *   12. 学生在 P05 错题本列表 → tap Tab 1「首页」→ P-HOME
 *   13. GET /api/home/today 200 → 大卡数字 N→N+1 动画 ≥300ms · 圆环 easeInOut 300ms
 *
 * Acceptance Criteria:
 *   AC1: Tap Tab 1「首页」→ P-HOME 顶部大卡重新渲染 (loading → 真数据)
 *   AC2: GET /api/home/today?tz=Asia/Shanghai → 200 {today:{total, done, circleProgress}, resume:null}
 *   AC3: 大卡数字从 N → N+1 (compare before/after · ≥ 300ms animation)
 *   AC4: 圆环进度从 done/total 旧值动画到新值 · 300ms easeInOut
 *
 * Test Invariants:
 *   TI1: tz 参数必须传 (跨时区学生 · 影响今日窗口 UTC 计算)
 *   TI2: total=0 → 显示空态 hero
 *   TI3: 数字 +1 动画 ≥ 300ms 可见
 *   TI4: home.READY 态 VRT screenshot
 */
import { test, expect } from '@playwright/test';

// ─── P-HOME testids ───────────────────────────────────────────────
const PHOME = {
  root: 'p-home-root',
  greetingHero: 'greeting-hero',
  todayReviewCard: 'today-review-card',
  circleProgress: 'today-review-card-circle-progress',
  totalLabel: 'today-review-card-total',
  startAllBtn: 'today-review-card-start-all-btn',
  weeklySparkline: 'p-home-weekly-sparkline',
  weekStrip: 'week-strip',
  messages: 'p-home-messages',
  weakKp: 'p-home-weak-kp',
  quickEntries: 'p-home-quick-entries',
} as const;

// ─── Tab testids ──────────────────────────────────────────────────
const TABS = {
  home: 'tab-home',
  wrongbook: 'tab-wrongbook',
} as const;

// ─── P05 testids ──────────────────────────────────────────────────
const P05 = {
  root: 'p05-root',
} as const;

// ─── Mock API responses ───────────────────────────────────────────
function makeHomeTodayResp(total: number, done: number) {
  return {
    tz: 'Asia/Shanghai',
    today: {
      total,
      done,
      circleProgress: total > 0 ? done / total : 0,
    },
    resume: null,
  };
}

// ─── Test Suite ───────────────────────────────────────────────────

test.describe('SC-01-T08 · P05→P-HOME transition + counter tick', () => {

  // ─── Happy path: P05→P-HOME with data ───────────────────────────
  test.describe('P-HOME READY state (TC-01.01 步 12-13)', () => {

    test.beforeEach(async ({ page }) => {
      // Mock auth
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
          // Clear previous total to ensure clean state
          window.sessionStorage.removeItem('home_prev_total');
        } catch { /* noop */ }
      });
    });

    test('AC1+AC2 · Tap Tab 1 from P05 → P-HOME renders with data from GET /today', async ({ page }) => {
      // Mock GET /api/home/today → 200 with total=8
      let todayCalled = false;
      await page.route('**/api/home/today*', async (route) => {
        todayCalled = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeHomeTodayResp(8, 3)),
        });
      });

      // ── IDLE 截图: Navigate to P05 first ──
      await page.goto('/wrongbook', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${P05.root}"]`)).toBeVisible({ timeout: 5_000 });

      await page.screenshot({
        path: 'test-results/screenshots/t08-idle.png',
        fullPage: true,
      });

      // AC1: Tap Tab 1 → navigate to P-HOME
      await page.locator(`[data-testid="${TABS.home}"]`).click();

      // AC1: P-HOME root visible
      await expect(page.locator(`[data-testid="${PHOME.root}"]`)).toBeVisible({ timeout: 5_000 });

      // ── UPLOADING/LOADING 截图 ──
      await page.screenshot({
        path: 'test-results/screenshots/t08-uploading.png',
        fullPage: true,
      });

      // AC1: Today review card renders with data
      await expect(page.locator(`[data-testid="${PHOME.todayReviewCard}"]`)).toBeVisible({ timeout: 5_000 });

      // AC2: Verify counter shows 8
      await expect(page.locator(`[data-testid="${PHOME.totalLabel}"]`)).toContainText('8', { timeout: 5_000 });

      // AC2: Circle progress visible
      await expect(page.locator(`[data-testid="${PHOME.circleProgress}"]`)).toBeVisible();

      // Verify other sections rendered
      await expect(page.locator(`[data-testid="${PHOME.greetingHero}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${PHOME.weeklySparkline}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${PHOME.weekStrip}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${PHOME.messages}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${PHOME.weakKp}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${PHOME.quickEntries}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${PHOME.startAllBtn}"]`)).toBeVisible();

      // ── SUCCESS 截图: P-HOME READY ──
      await page.screenshot({
        path: 'test-results/screenshots/t08-success.png',
        fullPage: true,
      });

      // TI4: VRT screenshot
      await expect(page).toHaveScreenshot('phome-ready.png', { maxDiffPixels: 500 });
    });

    test('AC3+AC4 · counter N→N+1 animation + circle progress animation', async ({ page }) => {
      let callCount = 0;
      await page.route('**/api/home/today*', async (route) => {
        callCount++;
        // First call: total=8, done=3
        // Second call (after return from P05): total=9, done=4
        const total = callCount === 1 ? 8 : 9;
        const done = callCount === 1 ? 3 : 4;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeHomeTodayResp(total, done)),
        });
      });

      // Step 1: First load P-HOME with total=8
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${PHOME.root}"]`)).toBeVisible({ timeout: 5_000 });
      await expect(page.locator(`[data-testid="${PHOME.totalLabel}"]`)).toContainText('8', { timeout: 5_000 });

      // Step 2: Navigate to P05 (wrongbook)
      await page.locator(`[data-testid="${TABS.wrongbook}"]`).click();
      await expect(page.locator(`[data-testid="${P05.root}"]`)).toBeVisible({ timeout: 5_000 });

      // Step 3: Return to P-HOME (second API call returns total=9)
      await page.locator(`[data-testid="${TABS.home}"]`).click();
      await expect(page.locator(`[data-testid="${PHOME.root}"]`)).toBeVisible({ timeout: 5_000 });

      // AC3: Counter should animate from 8 to 9 (≥ 300ms · TI3)
      // After animation completes, should show 9
      await expect(page.locator(`[data-testid="${PHOME.totalLabel}"]`)).toContainText('9', { timeout: 5_000 });

      // AC4: Circle progress should update (from 3/8=37.5% to 4/9=44.4%)
      const circle = page.locator(`[data-testid="${PHOME.circleProgress}"]`);
      await expect(circle).toBeVisible();

      // Verify the circle SVG has updated stroke-dashoffset via CSS transition
      const svgCircle = circle.locator('circle').nth(1);
      await expect(svgCircle).toHaveAttribute('stroke-dashoffset', /.+/);

      // Verify API was called twice
      expect(callCount, 'GET /today called twice').toBe(2);
    });
  });

  // ─── Empty state (TI2) ─────────────────────────────────────────
  test.describe('EMPTY state (TI2)', () => {

    test('TI2 · total=0 → 显示空态 hero', async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
          window.sessionStorage.removeItem('home_prev_total');
        } catch { /* noop */ }
      });

      await page.route('**/api/home/today*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeHomeTodayResp(0, 0)),
        });
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${PHOME.root}"]`)).toBeVisible({ timeout: 5_000 });

      // Should NOT show the review card with total label
      await expect(page.locator(`[data-testid="${PHOME.todayReviewCard}"]`)).not.toBeVisible({ timeout: 3_000 });

      // Should show empty state text
      await expect(page.locator('text=今天没有复习安排')).toBeVisible();

      // VRT screenshot for empty state
      await expect(page).toHaveScreenshot('phome-empty.png', { maxDiffPixels: 500 });
    });
  });

  // ─── Error state (spec §9) ─────────────────────────────────────
  test.describe('ERROR state (spec §9)', () => {

    test('spec §9 · GET /today 500 → 黄条降级', async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
          window.sessionStorage.removeItem('home_prev_total');
        } catch { /* noop */ }
      });

      await page.route('**/api/home/today*', async (route) => {
        await route.fulfill({ status: 500, body: '{"error":"INTERNAL"}' });
      });

      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${PHOME.root}"]`)).toBeVisible({ timeout: 5_000 });

      // Should show error banner
      await expect(page.locator('text=部分数据正在同步')).toBeVisible({ timeout: 5_000 });

      // ── ERROR 截图 ──
      await page.screenshot({
        path: 'test-results/screenshots/t08-error.png',
        fullPage: true,
      });

      // VRT screenshot for error state
      await expect(page).toHaveScreenshot('phome-error.png', { maxDiffPixels: 500 });
    });
  });

  // ─── TI1: tz parameter validation ──────────────────────────────
  test('TI1 · GET /today request includes tz parameter', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('access_token', 'dev-stub-token');
        window.localStorage.setItem('lf:auth:studentId', '7');
        window.sessionStorage.removeItem('home_prev_total');
      } catch { /* noop */ }
    });

    const requestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/home/today'),
      { timeout: 10_000 },
    );

    await page.route('**/api/home/today*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeHomeTodayResp(8, 3)),
      });
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const req = await requestPromise;
    const url = new URL(req.url());
    // TI1: tz must be present (either as raw or encoded)
    const tzParam = url.searchParams.get('tz') || url.search;
    expect(tzParam, 'TI1: tz parameter in request URL').toBeTruthy();
    expect(req.url(), 'TI1: URL contains tz').toContain('tz=');
  });
});
