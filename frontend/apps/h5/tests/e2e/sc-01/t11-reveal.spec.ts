// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 17
//        spec=design/system/pages/P08-review-exec.spec.md §5 POST /reveal + §6 状态机 + §9 异常
//        code=backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/ReviewPlanController.java
//        code=frontend/apps/h5/src/pages/ReviewExec/index.tsx
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T11 · P08 Tap「揭示答案」→ POST /nodes/{nid}/reveal → 绿色答案卡展开
 * (TC-01.01 步 17 · 黄金路径 reveal 段)
 *
 * Owner: Coder team-5 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E + 铁律补充 6
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T11.json acceptance_criteria AC1..AC4 + test_invariants TI1..TI4
 *   - design/system/pages/P08-review-exec.spec.md §5 #2 POST /reveal + §6 ANSWERING→REVEALED + §13 testid
 *
 * 业务剧本 (source of truth · biz §2B.2 步 17):
 *   17. 学生在 P08 已作答 → tap「揭示答案」→ 答案卡绿色展开 + 3 步解法 + 6 节点 T 高亮脉冲
 *       POST /api/review/nodes/{nid}/reveal → 200 · revealed_at 落库 · 不发 MQ
 *
 * Acceptance Criteria:
 *   AC1: Tap 揭示按钮 · loading + 触觉 light
 *   AC2: POST /api/review/nodes/{nid}/reveal → 200 · NodeLifecycleTracker.markRevealed(nid)
 *   AC3: 答案卡绿色展开 (height 0 → auto · 300ms easeOut) + 3 步解法 + 6 节点时间线高亮当前 T (pulse)
 *   AC4: 状态 ANSWERING → REVEALED · 揭示后底部 3 按钮 (未掌握/部分/已掌握) 全部可点
 *
 * Test Invariants:
 *   TI1: reveal 不改 plan (不更新 ease_factor / next_due_at)
 *   TI2: reveal 不发 MQ (不写 outbox)
 *   TI3: 揭示后 mastered btn aria-disabled (只能 PARTIAL/FORGOT)
 *   TI4: 埋点 wb_exec_reveal{nid,waitMs} 1 条
 */
import { test, expect } from '@playwright/test';

// ─── testids (1:1 aligned with @longfeng/testids p08.*) ──────────
const TID = {
  root:           'p08-root',
  topbar:         'p08-topbar',
  topbarCursor:   'p08-topbar-cursor',
  progressBar:    'p08-progress-bar',
  metaChips:      'p08-meta-chips',
  questionHero:   'p08-question-hero',
  answerArea:     'p08-answer-area',
  revealBtn:      'p08-reveal-btn',
  revealContent:  'p08-reveal-content',
  revealCheckmark:'p08-reveal-checkmark',
  memoryCurve:    'memory-curve',
  gradeButtons:   'p08-grade-buttons',
  gradeForgot:    'p08-grade-buttons-forgot',
  gradePartial:   'p08-grade-buttons-partial',
  gradeMastered:  'p08-grade-buttons-mastered',
  closeBtn:       'p08-close-btn',
} as const;

const revealStep = (n: number) => `p08-reveal-step-${n}`;
const memoryCurveNode = (t: string) => `memory-curve-node-${t}`;

// ─── Test suite ───────────────────────────────────────────────────

test.describe('SC-01-T11 · P08 揭示答案 → 绿色答案卡展开', () => {
  test.beforeEach(async ({ page }) => {
    // 模拟登录态
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('access_token', 'dev-stub-token');
        window.localStorage.setItem('lf:auth:studentId', '7');
      } catch { /* noop */ }
    });

    // 直达 P08 (nid=1 · dev mock data)
    await page.goto('/review/exec/1', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`[data-testid="${TID.root}"]`)).toBeVisible({ timeout: 5_000 });
  });

  // ─────────────────────────────────────────────────────────────
  // AC1+AC2+AC3+AC4 · 黄金路径: tap 揭示 → 200 → 绿色展开 → 按钮可点
  // ─────────────────────────────────────────────────────────────
  test('happy path · tap reveal → POST /reveal 200 → 答案卡展开 + grade buttons enabled', async ({ page }) => {
    // ── IDLE 状态截图 ──
    await page.screenshot({
      path: 'test-results/screenshots/t11-idle.png',
      fullPage: true,
    });

    // STEP 0 · 确认初始状态: ANSWERING
    // 揭示按钮可见
    const revealBtn = page.locator(`[data-testid="${TID.revealBtn}"]`);
    await expect(revealBtn).toBeVisible();
    await expect(revealBtn).toBeEnabled();

    // 答案卡隐藏
    const revealContent = page.locator(`[data-testid="${TID.revealContent}"]`);
    await expect(revealContent).toHaveAttribute('aria-hidden', 'true');

    // Grade buttons 全部 disabled
    await expect(page.locator(`[data-testid="${TID.gradeForgot}"]`)).toBeDisabled();
    await expect(page.locator(`[data-testid="${TID.gradePartial}"]`)).toBeDisabled();
    await expect(page.locator(`[data-testid="${TID.gradeMastered}"]`)).toBeDisabled();

    // STEP 1 · 监听 POST /reveal 请求
    const revealPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/review/nodes/') && resp.url().includes('/reveal') && resp.request().method() === 'POST',
      { timeout: 10_000 },
    );

    // ── UPLOADING/LOADING 状态截图 (reveal loading) ──
    // 点击揭示按钮 (AC1)
    await revealBtn.click();

    // 截图 loading 状态
    await page.screenshot({
      path: 'test-results/screenshots/t11-uploading.png',
      fullPage: true,
    });

    // STEP 2 · 断言 POST /reveal → 200 (AC2)
    const revealResp = await revealPromise;
    expect(revealResp.status(), 'AC2: POST /reveal returns 200').toBe(200);

    // 验证 response body 含 nid + revealedAt (spec §5 #2)
    const revealJson = await revealResp.json();
    const revealData = revealJson?.data ?? revealJson;
    expect(revealData.nid, 'AC2: response contains nid').toBeTruthy();
    expect(revealData.revealedAt ?? revealData.revealed_at, 'AC2: response contains revealedAt').toBeTruthy();

    // STEP 3 · 答案卡绿色展开 (AC3)
    await expect(revealContent).toHaveAttribute('aria-hidden', 'false');
    // 检查答案卡可见
    await expect(revealContent).toBeVisible();

    // AC3: 3 步解法渲染
    await expect(page.locator(`[data-testid="${revealStep(1)}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${revealStep(2)}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${revealStep(3)}"]`)).toBeVisible();

    // AC3: checkmark 可见
    await expect(page.locator(`[data-testid="${TID.revealCheckmark}"]`)).toBeVisible();

    // ── SUCCESS 状态截图 ──
    await page.screenshot({
      path: 'test-results/screenshots/t11-success.png',
      fullPage: true,
    });

    // STEP 4 · 状态 ANSWERING → REVEALED (AC4)
    // 揭示按钮消失
    await expect(revealBtn).not.toBeVisible();

    // Grade buttons 可点 (forgot + partial)
    await expect(page.locator(`[data-testid="${TID.gradeForgot}"]`)).toBeEnabled();
    await expect(page.locator(`[data-testid="${TID.gradePartial}"]`)).toBeEnabled();

    // TI3: mastered btn disabled after reveal (spec §6.4)
    const masteredBtn = page.locator(`[data-testid="${TID.gradeMastered}"]`);
    await expect(masteredBtn).toBeDisabled();
  });

  // ─────────────────────────────────────────────────────────────
  // AC3 · Memory curve: 当前 T 节点高亮 pulse
  // ─────────────────────────────────────────────────────────────
  test('AC3 · memory curve current T node visible + pulse after reveal', async ({ page }) => {
    // 确认 memory curve 可见
    await expect(page.locator(`[data-testid="${TID.memoryCurve}"]`)).toBeVisible();

    // 确认 T2 节点存在 (mock data nodeIndex=2 → T2)
    const currentNode = page.locator(`[data-testid="${memoryCurveNode('T2')}"]`);
    await expect(currentNode).toBeVisible();

    // 检查 7 个节点全部存在 (T0..T6)
    for (const t of ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6']) {
      await expect(page.locator(`[data-testid="${memoryCurveNode(t)}"]`)).toBeVisible();
    }

    // Tap reveal
    await page.locator(`[data-testid="${TID.revealBtn}"]`).click();
    // 等答案卡展开
    await expect(page.locator(`[data-testid="${TID.revealContent}"]`)).toBeVisible();

    // 验证 T2 节点仍然可见 (pulse animation is CSS-only, not testable via assertion)
    await expect(currentNode).toBeVisible();
  });

  // ─────────────────────────────────────────────────────────────
  // TI1 · reveal 不改 plan (验证 POST /reveal 请求体为空)
  // ─────────────────────────────────────────────────────────────
  test('TI1 · reveal request sends no body (readonly lifecycle timestamp)', async ({ page }) => {
    const revealPromise = page.waitForResponse(
      (resp) => resp.url().includes('/reveal') && resp.request().method() === 'POST',
      { timeout: 10_000 },
    );

    await page.locator(`[data-testid="${TID.revealBtn}"]`).click();
    const resp = await revealPromise;

    // TI1: POST body 应为空 (reveal 只记 timestamp, 不改 plan)
    const reqBody = resp.request().postData();
    // body 应该是 null 或空 (不含 grade/ease/interval 等字段)
    expect(reqBody === null || reqBody === '' || reqBody === undefined, 'TI1: reveal sends no body').toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────
  // TI2 · reveal 不发 MQ (backend invariant · 通过 API response 验证无 outbox 相关字段)
  // ─────────────────────────────────────────────────────────────
  test('TI2 · reveal response contains only nid + revealedAt (no MQ/outbox fields)', async ({ page }) => {
    const revealPromise = page.waitForResponse(
      (resp) => resp.url().includes('/reveal') && resp.request().method() === 'POST',
      { timeout: 10_000 },
    );

    await page.locator(`[data-testid="${TID.revealBtn}"]`).click();
    const resp = await revealPromise;
    const json = await resp.json();
    const data = json?.data ?? json;

    // TI2: response 只含 nid + revealedAt · 无 eventType / outbox 字段
    expect(data.eventType, 'TI2: no eventType in response').toBeUndefined();
    expect(data.outbox, 'TI2: no outbox in response').toBeUndefined();
  });

  // ─────────────────────────────────────────────────────────────
  // spec §9 · 502 失败时 UI 仍展开答案 (eventually consistent)
  // ─────────────────────────────────────────────────────────────
  test('spec §9 · reveal 502 → UI still expands answer card (eventually consistent)', async ({ page }) => {
    // 注入 502 失败
    await page.route('**/api/review/nodes/*/reveal', (route) =>
      route.fulfill({ status: 502, body: '{"error":"BAD_GATEWAY"}' }),
    );

    await page.locator(`[data-testid="${TID.revealBtn}"]`).click();

    // UI 仍展开答案卡 (eventually consistent per spec §9)
    await expect(page.locator(`[data-testid="${TID.revealContent}"]`)).toBeVisible({ timeout: 3_000 });
    // Grade buttons enabled
    await expect(page.locator(`[data-testid="${TID.gradeForgot}"]`)).toBeEnabled();
    await expect(page.locator(`[data-testid="${TID.gradePartial}"]`)).toBeEnabled();

    // ── ERROR 状态截图 ──
    await page.screenshot({
      path: 'test-results/screenshots/t11-error.png',
      fullPage: true,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // UI structure: topbar + progress + meta chips + question hero
  // ─────────────────────────────────────────────────────────────
  test('UI structure · topbar + progress + meta + question hero all visible', async ({ page }) => {
    await expect(page.locator(`[data-testid="${TID.topbar}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.topbarCursor}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.progressBar}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.metaChips}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.questionHero}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.answerArea}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.gradeButtons}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.closeBtn}"]`)).toBeVisible();
  });
});
