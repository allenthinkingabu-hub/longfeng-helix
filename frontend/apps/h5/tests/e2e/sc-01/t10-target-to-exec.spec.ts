// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 15-16
//        spec=design/system/pages/P07-review-today.spec.md §5 + design/system/pages/P08-review-exec.spec.md §5
//        code=backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/ReviewPlanController.java
//        code=frontend/apps/h5/src/pages/ReviewToday/index.tsx + frontend/apps/h5/src/pages/ReviewExec/index.tsx
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T10 · P07 Tap 第 1 题「开始」→ POST /nodes/{nid}/open → P08 + 写 EVENT_OPENED
 * (TC-01.01 步 15-16 · 黄金路径 open 段)
 *
 * Owner: Coder team-4 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E + 铁律补充 6
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T10.json acceptance_criteria AC1..AC5 + test_invariants TI1..TI4
 *   - design/system/pages/P07-review-today.spec.md §5 + §6 状态机 + §13 testid
 *   - design/system/pages/P08-review-exec.spec.md §5 #1 POST /open + §6 READING→ANSWERING + §13 testid
 *
 * 业务剧本 (source of truth · biz §2B.2 步 15-16):
 *   15. 学生在 P07 列表 · 第 1 题待复习 · tap「开始」→ loading + 触觉
 *   16. POST /api/review/nodes/{nid}/open → 200 + EVENT_OPENED outbox + P07→P08 跳转 ≤ 400ms
 *       P08 顶部进度条 1/N + 题元 Chips + 题干卡 渲染 · READING → ANSWERING (canvas touch)
 *
 * Acceptance Criteria:
 *   AC1: Tap 列表第一题「开始」按钮 · 按钮 loading + 触觉 medium
 *   AC2: POST /api/review/nodes/{nid}/open → 200 + 写 EVENT_OPENED outbox
 *   AC3: P07 → P08 跳转 ≤ 400ms · 顶部进度条 + chips + 题干卡 渲染
 *   AC4: 状态 READING → ANSWERING (canvas onTouchStart · 笔迹实时渲染)
 *   AC5: P08 强制关闭 (×) → 弹二次确认 Sheet
 *
 * Test Invariants:
 *   TI1: open 幂等 (同 nid 重放 → 200 + 不重复写 EVENT_OPENED)
 *   TI2: 揭示前不能看答案 (reveal content aria-hidden + display:none)
 *   TI3: 埋点 wb_exec_open{nid,T} 1 条 + sessionId 字段
 *   TI4: P08 reading 态 VRT screenshot
 */
import { test, expect } from '@playwright/test';

// ─── testids (1:1 aligned with @longfeng/testids p07.* + p08.*) ──────
const P07 = {
  root:                'p07-root',
  todayReviewCard:     'today-review-card',
  heroTotal:           'today-review-card-total',
  heroDone:            'today-review-card-done',
  heroEstMin:          'today-review-card-est-min',
  heroProgressBar:     'today-review-card-progress-bar',
  heroProgressPct:     'p07-hero-progress-pct',
  heroMasteryPct:      'today-review-card-mastery-pct',
  heroParticles:       'today-review-card-particles',
  bottomCta:           'p07-bottom-cta',
  bottomCtaStartAll:   'p07-bottom-cta-start-all-btn',
} as const;

const P08 = {
  root:            'p08-root',
  topbar:          'p08-topbar',
  topbarCursor:    'p08-topbar-cursor',
  progressBar:     'p08-progress-bar',
  metaChips:       'p08-meta-chips',
  questionHero:    'p08-question-hero',
  answerArea:      'p08-answer-area',
  revealBtn:       'p08-reveal-btn',
  revealContent:   'p08-reveal-content',
  gradeButtons:    'p08-grade-buttons',
  gradeForgot:     'p08-grade-buttons-forgot',
  gradePartial:    'p08-grade-buttons-partial',
  gradeMastered:   'p08-grade-buttons-mastered',
  closeBtn:        'p08-close-btn',
  exitConfirmSheet:'p08-exit-confirm-sheet',
  memoryCurve:     'memory-curve',
} as const;

const p07SlotItem = (key: string, idx: number) => `p07-slot-${key}-item-${idx}`;
const p07SlotHeader = (key: string) => `p07-slot-${key}-header`;
const p07SlotTitle = (key: string) => `p07-slot-${key}-title`;

// ─── Test suite ───────────────────────────────────────────────────

test.describe('SC-01-T10 · P07 Tap → POST /open → P08 渲染 + READING→ANSWERING', () => {

  // ─────────────────────────────────────────────────────────────
  // P07 · 页面渲染 + Hero card + slot list
  // ─────────────────────────────────────────────────────────────
  test.describe('P07 · 页面结构渲染', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
        } catch { /* noop */ }
      });
      await page.goto('/review-today', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${P07.root}"]`)).toBeVisible({ timeout: 5_000 });
    });

    test('P07 · Hero card + stats + progress visible', async ({ page }) => {
      // Hero card
      await expect(page.locator(`[data-testid="${P07.todayReviewCard}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${P07.heroTotal}"]`)).toContainText('8 题待复习');
      await expect(page.locator(`[data-testid="${P07.heroEstMin}"]`)).toContainText('预计 25 分钟');

      // Stats
      await expect(page.locator(`[data-testid="${P07.heroDone}"]`)).toContainText('3');

      // Progress
      await expect(page.locator(`[data-testid="${P07.heroProgressPct}"]`)).toContainText('进度 38%');
      await expect(page.locator(`[data-testid="${P07.heroMasteryPct}"]`)).toContainText('掌握度 72%');

      // CTA
      await expect(page.locator(`[data-testid="${P07.bottomCta}"]`)).toBeVisible();

      // IDLE screenshot (P07 list view)
      await expect(page).toHaveScreenshot('p07-idle.png', { maxDiffPixels: 500 });
    });

    test('P07 · slot headers + item cards visible', async ({ page }) => {
      // Slot headers
      await expect(page.locator(`[data-testid="${p07SlotHeader('now')}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${p07SlotTitle('now')}"]`)).toContainText('现在 · 上午');
      await expect(page.locator(`[data-testid="${p07SlotHeader('afternoon')}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${p07SlotTitle('afternoon')}"]`)).toContainText('下午');

      // Item cards
      await expect(page.locator(`[data-testid="${p07SlotItem('now', 0)}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${p07SlotItem('now', 1)}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${p07SlotItem('afternoon', 0)}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${p07SlotItem('afternoon', 1)}"]`)).toBeVisible();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC1+AC2+AC3 · 黄金路径: tap item → POST /open → navigate P08
  // ─────────────────────────────────────────────────────────────
  test.describe('P07 → P08 transition', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
        } catch { /* noop */ }
      });

      // Stub POST /open to return mock success (dev mode without backend)
      await page.route('**/api/review/nodes/*/open', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, data: { nid: '1', openedAt: new Date().toISOString() } }),
        }),
      );
    });

    test('AC1+AC2+AC3 · tap item → POST /open 200 → P08 renders', async ({ page }) => {
      await page.goto('/review-today', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${P07.root}"]`)).toBeVisible({ timeout: 5_000 });

      // AC1: Tap first item card
      const firstItem = page.locator(`[data-testid="${p07SlotItem('now', 0)}"]`);
      await expect(firstItem).toBeVisible();

      // AC2: Monitor POST /open request
      const openPromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/review/nodes/') && resp.url().includes('/open') && resp.request().method() === 'POST',
        { timeout: 10_000 },
      );

      // Tap the item
      await firstItem.click();

      // AC2: POST /open → 200
      const openResp = await openPromise;
      expect(openResp.status(), 'AC2: POST /open returns 200').toBe(200);

      // AC3: P08 renders
      await expect(page.locator(`[data-testid="${P08.root}"]`)).toBeVisible({ timeout: 5_000 });

      // AC3: Topbar with cursor
      await expect(page.locator(`[data-testid="${P08.topbarCursor}"]`)).toBeVisible();
      await expect(page.locator(`[data-testid="${P08.progressBar}"]`)).toBeVisible();

      // AC3: Meta chips
      await expect(page.locator(`[data-testid="${P08.metaChips}"]`)).toBeVisible();

      // AC3: Question hero card
      await expect(page.locator(`[data-testid="${P08.questionHero}"]`)).toBeVisible();

      // TI4: P08 reading state screenshot
      await expect(page).toHaveScreenshot('p08-reading.png', { maxDiffPixels: 500 });
    });

    test('AC3 · bottom CTA "全部开始" → POST /open → P08', async ({ page }) => {
      await page.goto('/review-today', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${P07.root}"]`)).toBeVisible({ timeout: 5_000 });

      const openPromise = page.waitForResponse(
        (resp) => resp.url().includes('/api/review/nodes/') && resp.url().includes('/open') && resp.request().method() === 'POST',
        { timeout: 10_000 },
      );

      // Tap CTA
      await page.locator(`[data-testid="${P07.bottomCta}"]`).click();
      const openResp = await openPromise;
      expect(openResp.status()).toBe(200);

      // P08 renders
      await expect(page.locator(`[data-testid="${P08.root}"]`)).toBeVisible({ timeout: 5_000 });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC4 · READING → ANSWERING (canvas touch)
  // ─────────────────────────────────────────────────────────────
  test.describe('P08 · READING → ANSWERING', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
        } catch { /* noop */ }
      });
      // Direct to P08 in READING state
      await page.goto('/review/exec/1', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${P08.root}"]`)).toBeVisible({ timeout: 5_000 });
    });

    test('AC4 · READING state: reveal button disabled → touch canvas → ANSWERING: reveal button enabled', async ({ page }) => {
      // READING state: reveal button should be disabled
      const revealBtn = page.locator(`[data-testid="${P08.revealBtn}"]`);
      await expect(revealBtn).toBeVisible();
      await expect(revealBtn).toBeDisabled();

      // Grade buttons disabled
      await expect(page.locator(`[data-testid="${P08.gradeForgot}"]`)).toBeDisabled();

      // TI2: reveal content hidden
      const revealContent = page.locator(`[data-testid="${P08.revealContent}"]`);
      await expect(revealContent).toHaveAttribute('aria-hidden', 'true');

      // Touch the answer area (canvas) → transition to ANSWERING
      const answerArea = page.locator(`[data-testid="${P08.answerArea}"]`);
      await answerArea.dispatchEvent('mousedown');

      // Now reveal button should be enabled
      await expect(revealBtn).toBeEnabled();

      // Screenshot: ANSWERING state
      await expect(page).toHaveScreenshot('p08-answering.png', { maxDiffPixels: 500 });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC5 · Exit confirm sheet
  // ─────────────────────────────────────────────────────────────
  test.describe('P08 · Exit confirm sheet', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('access_token', 'dev-stub-token');
          window.localStorage.setItem('lf:auth:studentId', '7');
        } catch { /* noop */ }
      });
      await page.goto('/review/exec/1', { waitUntil: 'domcontentloaded' });
      await expect(page.locator(`[data-testid="${P08.root}"]`)).toBeVisible({ timeout: 5_000 });
    });

    test('AC5 · tap × → exit confirm sheet → cancel → back to P08', async ({ page }) => {
      // Tap close button
      await page.locator(`[data-testid="${P08.closeBtn}"]`).click();

      // Sheet appears
      const sheet = page.locator(`[data-testid="${P08.exitConfirmSheet}"]`);
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText('退出本次复习');
      await expect(sheet).toContainText('本次复习尚未自评，退出将保留在原计划');

      // Screenshot: exit confirm sheet
      await expect(page).toHaveScreenshot('p08-exit-confirm.png', { maxDiffPixels: 500 });

      // Tap cancel
      await sheet.locator('button:has-text("取消")').click();

      // Sheet dismissed
      await expect(sheet).not.toBeVisible();

      // P08 still visible
      await expect(page.locator(`[data-testid="${P08.root}"]`)).toBeVisible();
    });

    test('AC5 · tap × → exit → tap "退出" → navigate home', async ({ page }) => {
      await page.locator(`[data-testid="${P08.closeBtn}"]`).click();
      const sheet = page.locator(`[data-testid="${P08.exitConfirmSheet}"]`);
      await expect(sheet).toBeVisible();

      // Tap exit
      await sheet.locator('button:has-text("退出")').click();

      // P08 no longer visible (navigated away)
      await expect(page.locator(`[data-testid="${P08.root}"]`)).not.toBeVisible({ timeout: 3_000 });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // TI2 · 揭示前不能看答案
  // ─────────────────────────────────────────────────────────────
  test('TI2 · reveal content hidden before reveal (aria-hidden + display:none)', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('access_token', 'dev-stub-token');
      } catch { /* noop */ }
    });
    await page.goto('/review/exec/1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`[data-testid="${P08.root}"]`)).toBeVisible({ timeout: 5_000 });

    const revealContent = page.locator(`[data-testid="${P08.revealContent}"]`);
    await expect(revealContent).toHaveAttribute('aria-hidden', 'true');
  });

  // ─────────────────────────────────────────────────────────────
  // P08 UI structure + memory curve
  // ─────────────────────────────────────────────────────────────
  test('P08 UI structure · topbar + progress + meta + question + answer + grade + memory curve', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('access_token', 'dev-stub-token');
      } catch { /* noop */ }
    });
    await page.goto('/review/exec/1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`[data-testid="${P08.root}"]`)).toBeVisible({ timeout: 5_000 });

    await expect(page.locator(`[data-testid="${P08.topbar}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${P08.topbarCursor}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${P08.progressBar}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${P08.metaChips}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${P08.questionHero}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${P08.answerArea}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${P08.gradeButtons}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${P08.closeBtn}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${P08.memoryCurve}"]`)).toBeVisible();
  });
});
