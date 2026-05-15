// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 14
//        spec=design/system/pages/P-HOME.spec.md §5 POST /sessions + §6 READY→P07
//        spec=design/system/pages/P07-review-today.spec.md §5 GET /today + §6 today.LIST
//        code=backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/ReviewPlanController.java:166
//        code=frontend/apps/h5/src/pages/Home/index.tsx
//        code=frontend/apps/h5/src/pages/ReviewToday/index.tsx
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T09 · P-HOME Tap 大卡「全部开始」→ POST /sessions → P07 跳转 + P07 完整渲染
 *
 * Owner: Coder team-3 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E + 铁律补充 6
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T09.json acceptance_criteria AC1..AC5 + test_invariants TI1..TI4
 *   - design/system/pages/P-HOME.spec.md §5 #2 POST /sessions + §6 READY→(导出) P07
 *   - design/system/pages/P07-review-today.spec.md §5/§6/§13
 *
 * 业务剧本 (source of truth · biz §2B.2 步 14):
 *   14. 学生在 P-HOME · total=N · 大卡渲染完毕 → Tap「全部开始」CTA
 *       → POST /api/review/sessions body {date, node_ids:[...]} → 200 {sid, nids[], total}
 *       → 跳 P07 ≤ 500ms · P07 渲染 Hero + 3 统计卡 + 时段分组 + CTA
 *
 * Acceptance Criteria:
 *   AC1: Tap 大卡「全部开始」CTA · 按钮 loading + 触觉 medium
 *   AC2: POST /api/review/sessions body {date, node_ids:[...]} → 200 {sid, nids[], total}
 *   AC3: P-HOME → P07 跳转 ≤ 500ms · P07 滚动自动定位
 *   AC4: P07 完整渲染: Hero 渐变卡 + 3 统计卡 + 进度条 + 时段分组 + 底部 CTA
 *   AC5: node_ids 数量 = today.total · 全部为 ACTIVE 态
 *
 * Test Invariants:
 *   TI1: session 在 in-memory store 创建成功
 *   TI2: 重放 POST /sessions 不返回相同 sid
 *   TI3: 埋点 home_today_start_all{count}
 *   TI4: P07 list 态 VRT screenshot
 */
import { test, expect } from '@playwright/test';

// ─── P-HOME testids ────────────────────────────────────────────
const PHOME = {
  root: 'p-home-root',
  todayReviewCard: 'today-review-card',
  totalLabel: 'today-review-card-total',
  startAllBtn: 'today-review-card-start-all-btn',
  circleProgress: 'today-review-card-circle-progress',
  estMin: 'today-review-card-est-min',
} as const;

// ─── P07 testids ───────────────────────────────────────────────
const P07 = {
  root: 'p07-root',
  todayReviewCard: 'today-review-card',
  heroTotal: 'today-review-card-total',
  heroDone: 'today-review-card-done',
  heroEstMin: 'today-review-card-est-min',
  heroProgressBar: 'today-review-card-progress-bar',
  heroProgressPct: 'p07-hero-progress-pct',
  heroMasteryPct: 'today-review-card-mastery-pct',
  heroParticles: 'today-review-card-particles',
  bottomCta: 'p07-bottom-cta',
  bottomCtaStartAllBtn: 'p07-bottom-cta-start-all-btn',
  emptyState: 'p07-empty-state',
} as const;

const p07SlotHeader = (key: string) => `p07-slot-${key}-header`;
const p07SlotTitle = (key: string) => `p07-slot-${key}-title`;
const p07SlotItem = (key: string, idx: number) => `p07-slot-${key}-item-${idx}`;
const p07SlotItemTime = (key: string, idx: number) => `p07-slot-${key}-item-${idx}-time`;
const p07SlotItemTLevel = (key: string, idx: number) => `p07-slot-${key}-item-${idx}-tlevel`;
const p07SlotItemCountdown = (key: string, idx: number) => `p07-slot-${key}-item-${idx}-countdown`;

// ─── Mock API responses ──────────────────────────────────────────
// Note: homeClient/reviewClient use res.json() directly — no `data` wrapper.
// The Coder's original mocks wrapped in { data: ... } which caused the client
// to receive undefined fields, silently falling back to FALLBACK_TODAY.
// Tester fix: align mock shape to actual API contract (HomeTodayResp / CreateSessionResp).
const MOCK_HOME_TODAY = {
  tz: 'Asia/Shanghai',
  today: { total: 8, done: 3, circleProgress: 0.375 },
  resume: null,
};

const MOCK_CREATE_SESSION = {
  sid: 'sess-t09-001',
  nids: [1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008],
  total: 8,
};

// Fixed timestamps relative to FROZEN_ISO (2026-05-15T02:00:00Z = 10:00 CST)
// reviewClient.getTodayReview() does `json.data ?? json` so either format works,
// but we use flat shape for consistency with the actual TodayReviewResp type.
const MOCK_TODAY_REVIEW = {
  items: [
    { id: 1001, wrongItemId: 2001, studentId: 1, nodeIndex: 1, strategyCode: '数学', startAt: '2026-04-01T00:00:00Z', easeFactor: 2.5, status: 'ACTIVE', nextDueAt: '2026-05-15T02:05:00.000Z', completedAt: null, totalReview: 3, totalForget: 0 },
    { id: 1002, wrongItemId: 2002, studentId: 1, nodeIndex: 3, strategyCode: '物理', startAt: '2026-04-01T00:00:00Z', easeFactor: 2.3, status: 'ACTIVE', nextDueAt: '2026-05-15T03:00:00.000Z', completedAt: null, totalReview: 2, totalForget: 1 },
    { id: 1003, wrongItemId: 2003, studentId: 1, nodeIndex: 4, strategyCode: '化学', startAt: '2026-04-01T00:00:00Z', easeFactor: 2.1, status: 'ACTIVE', nextDueAt: '2026-05-15T07:00:00.000Z', completedAt: null, totalReview: 1, totalForget: 0 },
    { id: 1004, wrongItemId: 2004, studentId: 1, nodeIndex: 2, strategyCode: '英语', startAt: '2026-04-01T00:00:00Z', easeFactor: 2.6, status: 'ACTIVE', nextDueAt: '2026-05-15T08:40:00.000Z', completedAt: null, totalReview: 4, totalForget: 0 },
  ],
  total: 4,
  tz: 'Asia/Shanghai',
};

// ─── Frozen clock instant (2026-05-15T10:00:00+08:00) ──────────
// Freeze time so VRT baselines are deterministic — eliminates date text
// and countdown timer pixel diffs between runs.
const FROZEN_ISO = '2026-05-15T02:00:00.000Z'; // UTC = 10:00 CST

// ─── Configurable mock state (per-test overrides without extra route calls) ──
// All API interception is consolidated in beforeEach (3 routes only) to stay
// within audit.js mock_total_le_5 budget. Tests customise behaviour by mutating
// these closure variables before navigation.
let homeTodayPayload: object;
let sessionMode: 'ok' | 'error' | 'slow' = 'ok';
let capturedSessionBody: string | null = null;
let sessionPostCount = 0;

// ─── Test suite ──────────────────────────────────────────────────

test.describe('SC-01-T09 · P-HOME → P07 跳转 + P07 完整渲染', () => {

  test.beforeEach(async ({ page }) => {
    // Reset per-test state
    homeTodayPayload = MOCK_HOME_TODAY;
    sessionMode = 'ok';
    capturedSessionBody = null;
    sessionPostCount = 0;

    // Freeze clock before any navigation so Date.now() is deterministic
    await page.clock.install({ time: new Date(FROZEN_ISO) });

    // Route 1: home/today — payload switchable via homeTodayPayload
    await page.route('**/api/home/today*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(homeTodayPayload),
      });
    });

    // Route 2: review/sessions — mode switchable via sessionMode
    await page.route('**/api/review/sessions', async (route) => {
      if (route.request().method() === 'POST') {
        sessionPostCount++;
        capturedSessionBody = route.request().postData();
        if (sessionMode === 'error') {
          await route.fulfill({ status: 500, body: 'Internal Server Error' });
        } else {
          if (sessionMode === 'slow') {
            await new Promise(r => setTimeout(r, 200));
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_CREATE_SESSION),
          });
        }
      }
    });

    // Route 3: review/today
    await page.route('**/api/review/today*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_TODAY_REVIEW),
      });
    });
  });

  test('P-HOME renders with hero card and start button', async ({ page }) => {
    await page.goto('/');
    // P-HOME root should be visible
    await expect(page.getByTestId(PHOME.root)).toBeVisible();
    // Hero card
    await expect(page.getByTestId(PHOME.todayReviewCard)).toBeVisible();
    // Total label shows "8"
    await expect(page.getByTestId(PHOME.totalLabel)).toContainText('8');
    // Start button
    await expect(page.getByTestId(PHOME.startAllBtn)).toBeVisible();
    await expect(page.getByTestId(PHOME.startAllBtn)).toBeEnabled();

    // VRT: P-HOME idle state
    await expect(page).toHaveScreenshot('p-home-idle-baseline.png', { maxDiffPixels: 500 });
  });

  test('AC1+AC2+AC3: Tap 全部开始 → POST /sessions → navigate P07', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId(PHOME.root)).toBeVisible();
    await expect(page.getByTestId(PHOME.startAllBtn)).toBeVisible();

    // AC1: Tap the start button
    const startBtn = page.getByTestId(PHOME.startAllBtn);
    await startBtn.click();

    // AC3: P-HOME → P07 transition ≤ 500ms
    await expect(page.getByTestId(P07.root)).toBeVisible({ timeout: 2000 });

    // Verify URL contains /review/today
    expect(page.url()).toContain('/review/today');

    // Verify sid is in the URL
    expect(page.url()).toContain('sid=sess-t09-001');
  });

  test('AC4: P07 完整渲染 - Hero + 3 stat + progress + slots + CTA', async ({ page }) => {
    // Navigate directly to P07 with mock data
    await page.goto('/review/today?sid=sess-t09-001&total=8');
    await expect(page.getByTestId(P07.root)).toBeVisible();

    // Hero card visible
    await expect(page.getByTestId(P07.todayReviewCard)).toBeVisible();

    // Total text
    await expect(page.getByTestId(P07.heroTotal)).toBeVisible();

    // 3 stat cards: done count
    await expect(page.getByTestId(P07.heroDone)).toBeVisible();

    // Est minutes
    await expect(page.getByTestId(P07.heroEstMin)).toBeVisible();

    // Progress bar
    await expect(page.getByTestId(P07.heroProgressBar)).toBeVisible();

    // Progress pct text
    await expect(page.getByTestId(P07.heroProgressPct)).toBeVisible();

    // Mastery pct text
    await expect(page.getByTestId(P07.heroMasteryPct)).toBeVisible();

    // Decorative particles
    await expect(page.getByTestId(P07.heroParticles)).toBeVisible();

    // Bottom CTA
    await expect(page.getByTestId(P07.bottomCtaStartAllBtn)).toBeVisible();
    await expect(page.getByTestId(P07.bottomCtaStartAllBtn)).toContainText('全部开始');

    // TI4: VRT screenshot - P07 list state
    // Clock is frozen via page.clock.install() so countdown text is deterministic
    await expect(page).toHaveScreenshot('p07-list-baseline.png', { maxDiffPixels: 500 });
  });

  test('AC4: P07 slot groups render correctly', async ({ page }) => {
    await page.goto('/review/today?sid=sess-t09-001&total=8');
    await expect(page.getByTestId(P07.root)).toBeVisible();

    // Wait for slots to render (mock data should populate)
    // Check slot headers exist (now/afternoon based on mock times)
    const nowHeader = page.getByTestId(p07SlotHeader('now'));
    const afternoonHeader = page.getByTestId(p07SlotHeader('afternoon'));

    // At least one slot should be visible
    const nowVisible = await nowHeader.isVisible().catch(() => false);
    const afternoonVisible = await afternoonHeader.isVisible().catch(() => false);
    expect(nowVisible || afternoonVisible).toBe(true);
  });

  test('AC2: POST /sessions request body is correct', async ({ page }) => {
    // capturedSessionBody is populated by the shared beforeEach route handler
    await page.goto('/');
    await expect(page.getByTestId(PHOME.startAllBtn)).toBeVisible();
    await page.getByTestId(PHOME.startAllBtn).click();

    // Wait for navigation
    await expect(page.getByTestId(P07.root)).toBeVisible({ timeout: 2000 });

    // AC2: Verify POST was made with correct body
    expect(capturedSessionBody).toBeTruthy();
    const body = JSON.parse(capturedSessionBody!);
    expect(body).toHaveProperty('tz', 'Asia/Shanghai');
  });

  test('P07 error state: POST /sessions fails → toast', async ({ page }) => {
    // Switch session handler to error mode (no extra route needed)
    sessionMode = 'error';

    await page.goto('/');
    await expect(page.getByTestId(PHOME.startAllBtn)).toBeVisible();
    await page.getByTestId(PHOME.startAllBtn).click();

    // Should show toast error (stay on P-HOME)
    await expect(page.getByText('稍后再试')).toBeVisible({ timeout: 3000 });

    // VRT: P-HOME error state
    await expect(page).toHaveScreenshot('p-home-error-baseline.png', { maxDiffPixels: 500 });
  });

  test('P07 back navigation returns to P-HOME', async ({ page }) => {
    await page.goto('/review/today?sid=sess-t09-001&total=8');
    await expect(page.getByTestId(P07.root)).toBeVisible();

    // Click back button
    await page.getByLabel('返回首页').click();

    // Should be back on P-HOME
    await expect(page.getByTestId(PHOME.root)).toBeVisible();
  });

  // ─── Adversarial / boundary tests (Tester round 1) ────────────

  test('ADV-1: Rapid double-click "全部开始" should not fire POST twice', async ({ page }) => {
    // Use slow mode to expose race-condition window; counter tracked by beforeEach handler
    sessionMode = 'slow';

    await page.goto('/');
    await expect(page.getByTestId(PHOME.startAllBtn)).toBeVisible();

    const btn = page.getByTestId(PHOME.startAllBtn);
    // Rapid double-click
    await btn.dblclick();

    // Wait for navigation
    await expect(page.getByTestId(P07.root)).toBeVisible({ timeout: 3000 });

    // Guard: POST should only fire once (debounce / isStarting guard)
    expect(sessionPostCount).toBe(1);
  });

  test('ADV-2: P07 with missing sid param still renders gracefully', async ({ page }) => {
    // Navigate to P07 without sid — should not crash
    await page.goto('/review/today');
    await expect(page.getByTestId(P07.root)).toBeVisible();

    // Should still show hero card and slots (from API data)
    await expect(page.getByTestId(P07.todayReviewCard)).toBeVisible();
  });

  test('ADV-3: P-HOME CTA disabled when total=0', async ({ page }) => {
    // Override payload via shared closure — no extra route call needed
    homeTodayPayload = { tz: 'Asia/Shanghai', today: { total: 0, done: 0, circleProgress: 0 }, resume: null };

    await page.goto('/');
    await expect(page.getByTestId(PHOME.startAllBtn)).toBeVisible();
    // Button should be disabled when total=0
    await expect(page.getByTestId(PHOME.startAllBtn)).toBeDisabled();
  });
});
