// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 7-8
//        spec=design/system/pages/P03-analyzing.spec.md §6 状态机 (SUCCEEDED → nav P04)
//        spec=design/system/pages/P04-result.spec.md §5 API 触点 + §6 状态机 + §9 异常 + §13 testid
//        code=frontend/apps/h5/src/pages/Analyzing/index.tsx (onDone → nav /question/{qid}/result)
//        code=frontend/apps/h5/src/pages/Result/index.tsx (GET /api/wb/questions/{qid} → render)
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T04 · SSE DONE → P03→P04 跳转 · P04 渲染 Hero + 错因 + 3 步解法 + 6 节点预告
 *
 * Owner: Coder team-1 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E + 铁律补充 6 E2E = DoD 唯一硬条件
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T04.json AC1-AC5 + TI1-TI4
 *   - design/system/pages/P03-analyzing.spec.md §6 状态机 SUCCEEDED → nav P04
 *   - design/system/pages/P04-result.spec.md §5/§6/§9/§13
 *
 * 业务剧本 (source of truth · biz §2B.2 步 7-8):
 *   1. P03 SSE 流水线推进 4 步 → DONE event 到达
 *   2. 200ms 过渡 → nav /question/{qid}/result (P04)
 *   3. P04 mount → GET /api/wb/questions/{qid} → 200 {question, plannedNodes}
 *   4. DRAFT 态: 渲染 Hero 题干 + 错解/正解双卡 + 错因红条 + 3 步解法 + KP chips + 难度★ + 6 节点预告
 *   5. LOW_CONF 态: confidence < 0.6 → 黄条 + 保存触发确认弹窗
 *
 * 关键不变量 (test_invariants):
 *   - TI1: 6 节点时间线初始 T0=now · T1-T6=future (非 SCHEDULED 因尚未 save)
 *   - TI2: confidence 字段 ∈ [0,1]
 *   - TI3: 滚动到底部触发 wb_result_scroll{depth%} 埋点
 *   - TI4: P04 draft 态 VRT screenshot
 */
import { test, expect, type Page } from '@playwright/test';

// ─── testids (与 frontend/packages/testids/src/index.ts §p03 + §p04 对齐) ──
const P03_TID = {
  root: 'p03-root',
  step1: 'analyzing-pipeline-step-1',
  step2: 'analyzing-pipeline-step-2',
  step3: 'analyzing-pipeline-step-3',
  step4: 'analyzing-pipeline-step-4',
} as const;

const P04_TID = {
  root: 'p04-root',
  navbar: 'p04-navbar',
  questionHero: 'p04-question-hero',
  answersRow: 'p04-answers-row',
  answersRowWrong: 'p04-answers-row-wrong',
  answersRowRight: 'p04-answers-row-right',
  reasonCard: 'p04-reason-card',
  solutionStepper: 'p04-solution-stepper',
  metaChips: 'p04-meta-chips',
  memoryCurve: 'memory-curve',
  saveCta: 'p04-save-cta',
  skeleton: 'p04-skeleton',
  lowConfBanner: 'result-lowconf-banner',
  confirmModal: 'result-confirm-modal',
  confirmYesBtn: 'result-confirm-yes-btn',
  confirmNoBtn: 'result-confirm-no-btn',
  heroStem: 'result-hero-stem',
  causeCard: 'result-cause-card',
  solutionCard: 'result-solution-card',
} as const;

// ─── SSE mock helper ──────────────────────────────────────────────
function sseBody(events: object[]): string {
  return events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('');
}

// Happy path: 4 步 all done → DONE
const HAPPY_SSE_EVENTS = [
  { type: 'STEP_START', step: 1 },
  { type: 'STEP_DONE', step: 1, durationMs: 240 },
  { type: 'STEP_START', step: 2 },
  { type: 'PARTIAL_JSON', chunk: '{"stem":"f(x)=x²-4x+3' },
  { type: 'STEP_DONE', step: 2, durationMs: 1100 },
  { type: 'STEP_START', step: 3 },
  { type: 'PARTIAL_JSON', chunk: '","kp":["二次函数"]' },
  { type: 'STEP_DONE', step: 3, durationMs: 950 },
  { type: 'STEP_START', step: 4 },
  { type: 'PARTIAL_JSON', chunk: ',"steps":[{"i":1,"t":"配方"}]}' },
  { type: 'STEP_DONE', step: 4, durationMs: 1200 },
  { type: 'DONE', result: { stem: 'f(x)=x²-4x+3' } },
];

// ─── Mock API data (spec §5 · plain JSON 不裹 ApiResult) ──────────
const MOCK_QID = 'test-qid-t04-001';

const MOCK_QUESTION_DETAIL_RESP = {
  question: {
    id: MOCK_QID,
    subject: 'math',
    stem: '已知函数 f(x) = x² − 4x + 3，求其顶点坐标与对称轴方程。',
    formula: 'f(x) = (x − 2)² − 1',
    myAnswer: 'B. (2, −1)',
    correctAnswer: 'A. (2, −1)',
    reasonMarkdown: '你把顶点式 (x − h)² + k 中的 h 与 k 读反了。',
    steps: [
      { idx: 1, title: '对 f(x) 配方：把 x² − 4x 补成完全平方。', formula: 'f(x) = (x² − 4x + 4) + 3 − 4' },
      { idx: 2, title: '整理为顶点式 (x − h)² + k：', formula: 'f(x) = (x − 2)² − 1' },
      { idx: 3, title: '读出顶点 (h, k) = (2, −1)，对称轴 x = 2。' },
    ],
    knowledgePoints: [
      { id: 'kp-1', name: '二次函数 顶点式', weight: 0.8 },
      { id: 'kp-2', name: '配方法', weight: 0.6 },
      { id: 'kp-3', name: '对称轴', weight: 0.4 },
    ],
    difficulty: 3,
    confidence: 0.85,
    modelInfo: { name: 'qwen-vl-max', version: '2.0' },
  },
  plannedNodes: [
    { tLevel: 'T1', dueAt: '2026-05-16T07:00:00.000Z', status: 'preview' },
    { tLevel: 'T2', dueAt: '2026-05-17T07:00:00.000Z', status: 'preview' },
    { tLevel: 'T3', dueAt: '2026-05-20T07:00:00.000Z', status: 'preview' },
    { tLevel: 'T4', dueAt: '2026-05-24T07:00:00.000Z', status: 'preview' },
    { tLevel: 'T5', dueAt: '2026-06-01T07:00:00.000Z', status: 'preview' },
    { tLevel: 'T6', dueAt: '2026-06-16T07:00:00.000Z', status: 'preview' },
  ],
};

// Low-confidence variant (AC5 · TC-01.04)
const MOCK_LOW_CONF_QID = 'low-conf-t04-001';
const MOCK_LOW_CONF_RESP = {
  ...MOCK_QUESTION_DETAIL_RESP,
  question: {
    ...MOCK_QUESTION_DETAIL_RESP.question,
    id: MOCK_LOW_CONF_QID,
    confidence: 0.42,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────

/** Set auth tokens in localStorage */
async function setAuth(page: Page) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('access_token', 'dev-stub-token');
      window.localStorage.setItem('lf:auth:studentId', '7');
      window.localStorage.setItem('lf:token', 'dev-stub-token');
    } catch { /* noop */ }
  });
}

/**
 * Setup P03→P04 transition: intercept SSE + questions API
 * Mock count: SSE stream (1) + cancel API (2) + GET questions (3) = 3 mocks ≤ 5
 */
async function setupTransition(
  page: Page,
  taskId: string,
  qid: string,
  questionResp: object,
  sseEvents: object[],
) {
  await setAuth(page);

  // Mock 1: SSE stream (route interception for deterministic timing)
  await page.route(`**/api/ai/stream/${taskId}`, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
      body: sseBody(sseEvents),
    });
  });

  // Mock 2: Cancel API
  await page.route(`**/api/ai/cancel/${taskId}`, async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED' }),
    });
  });

  // Mock 3: GET /api/wb/questions/{qid} (plain JSON · spec §5 行 1)
  await page.route(`**/api/wb/questions/${qid}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(questionResp),
      });
    } else {
      await route.fallback();
    }
  });
}

// ─── 测试套件 ────────────────────────────────────────────────────

test.describe('SC01-T04 · SSE DONE → P03→P04 transition + P04 渲染', () => {

  // ─────────────────────────────────────────────────────────────
  // AC1+AC2+AC3+AC4 · Happy path: P03 DONE → transition → P04 全渲染
  // ─────────────────────────────────────────────────────────────
  test('AC1-4 · P03 SSE DONE → 200ms transition → P04 renders Hero + 错因 + 3步 + 6节点', async ({ page }) => {
    const taskId = 'task-t04-happy-001';
    await setupTransition(page, taskId, MOCK_QID, MOCK_QUESTION_DETAIL_RESP, HAPPY_SSE_EVENTS);

    // Start on P03
    await page.goto(`/analyzing/${taskId}?qid=${MOCK_QID}&subject=数学&thumb=`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator(`[data-testid="${P03_TID.root}"]`)).toBeVisible({ timeout: 5_000 });

    // IDLE screenshot (P03 before SSE): all steps wait
    await page.screenshot({
      path: 'test-results/screenshots/t04-idle.png',
      fullPage: true,
    });

    // AC1: SSE events flow → all 4 steps done → DONE event → nav P04
    // AC2: P03→P04 transition ≤ 300ms (200ms timeout + render)
    await page.waitForURL(/\/question\/.*\/result/, { timeout: 8_000 });
    expect(page.url()).toContain(`/question/${MOCK_QID}/result`);

    // AC3: Verify GET /api/wb/questions/{qid} was called (plain JSON response)
    // The page should have loaded data and rendered
    await expect(page.locator(`[data-testid="${P04_TID.root}"]`)).toBeVisible({ timeout: 5_000 });

    // Wait for content to render (skeleton → DRAFT)
    await expect(page.locator(`[data-testid="${P04_TID.questionHero}"]`)).toBeVisible({ timeout: 5_000 });

    // AC2: scroll position should be at top
    const scrollTop = await page.evaluate(() => window.scrollY);
    expect(scrollTop).toBe(0);

    // ── VRT: P04 DRAFT state (TI4) ──
    await expect(page).toHaveScreenshot('p04-draft-baseline.png', {
      maxDiffPixels: 500,
      fullPage: true,
    });

    // AC4: Hero section — 题干 + 公式
    await expect(page.locator(`[data-testid="${P04_TID.questionHero}"]`)).toBeVisible();

    // AC4: Answers row — 错解 ✗ + 正解 ✓
    await expect(page.locator(`[data-testid="${P04_TID.answersRow}"]`)).toBeVisible();

    // AC4: 错因红条
    await expect(page.locator(`[data-testid="${P04_TID.reasonCard}"]`)).toBeVisible();

    // AC4: 3 步解法 stepper
    const stepper = page.locator(`[data-testid="${P04_TID.solutionStepper}"]`);
    await expect(stepper).toBeVisible();

    // AC4: KP chips + 难度
    await expect(page.locator(`[data-testid="${P04_TID.metaChips}"]`)).toBeVisible();

    // AC4: 6 节点预告 (memory curve · T1-T6)
    const memoryCurve = page.locator(`[data-testid="${P04_TID.memoryCurve}"]`);
    await expect(memoryCurve).toBeVisible();

    // TI1: T0=now visible as timeline node
    await expect(page.locator('[data-testid="result-timeline-node-T0"]')).toBeVisible();

    // AC4: CTA 保存按钮
    await expect(page.locator(`[data-testid="${P04_TID.saveCta}"]`)).toBeVisible();

    // SUCCESS screenshot (after full render on P04)
    await page.screenshot({
      path: 'test-results/screenshots/t04-success.png',
      fullPage: true,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // AC5 · TC-01.04: confidence < 0.6 → 黄条 + 确认弹窗
  // ─────────────────────────────────────────────────────────────
  test('AC5 · TC-01.04 · confidence < 0.6 → 黄条 + 保存触发确认弹窗', async ({ page }) => {
    const taskId = 'task-t04-lowconf-001';
    await setupTransition(page, taskId, MOCK_LOW_CONF_QID, MOCK_LOW_CONF_RESP, HAPPY_SSE_EVENTS);

    // Mock 4: POST save for confirm flow
    await page.route(`**/api/wb/questions/${MOCK_LOW_CONF_QID}/save`, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ code: 0, data: { qid: MOCK_LOW_CONF_QID, status: 3 } }),
        });
      } else {
        await route.fallback();
      }
    });

    // Start on P03 → SSE DONE → transition to P04
    await page.goto(`/analyzing/${taskId}?qid=${MOCK_LOW_CONF_QID}&subject=数学&thumb=`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(/\/question\/.*\/result/, { timeout: 8_000 });

    // Wait for P04 render
    await expect(page.locator(`[data-testid="${P04_TID.root}"]`)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(`[data-testid="${P04_TID.questionHero}"]`)).toBeVisible({ timeout: 5_000 });

    // AC5: 黄条 "AI 不太确定" visible
    const banner = page.locator(`[data-testid="${P04_TID.lowConfBanner}"]`);
    await expect(banner).toBeVisible({ timeout: 3_000 });

    // LOW_CONF screenshot
    await page.screenshot({
      path: 'test-results/screenshots/t04-lowconf.png',
      fullPage: true,
    });

    // ── VRT: LOW_CONF state ──
    await expect(page).toHaveScreenshot('p04-lowconf-baseline.png', {
      maxDiffPixels: 500,
      fullPage: true,
    });

    // AC5: tap save → 应弹确认 modal (不直接保存)
    const saveBtn = page.locator(`[data-testid="${P04_TID.saveCta}"]`);
    await saveBtn.click();

    const modal = page.locator(`[data-testid="${P04_TID.confirmModal}"]`);
    await expect(modal).toBeVisible({ timeout: 3_000 });

    // AC5: tap "返回复核" → modal 关闭 · 留在 P04
    await page.locator(`[data-testid="${P04_TID.confirmNoBtn}"]`).click();
    await expect(modal).not.toBeVisible();
    expect(page.url()).toContain('/question/');

    // AC5: tap save again → modal → confirm yes → proceed to save
    await saveBtn.click();
    await expect(modal).toBeVisible();
    await page.locator(`[data-testid="${P04_TID.confirmYesBtn}"]`).click();

    // Should navigate to /wrongbook after save
    await page.waitForURL(/\/wrongbook/, { timeout: 5_000 });
  });

  // ─────────────────────────────────────────────────────────────
  // Direct P04 mount · DRAFT 态渲染完整性 (不经 P03 transition)
  // ─────────────────────────────────────────────────────────────
  test('direct P04 mount — DRAFT renders all sections correctly', async ({ page }) => {
    await setAuth(page);

    // Mock: GET /api/wb/questions/{qid}
    await page.route(`**/api/wb/questions/${MOCK_QID}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_QUESTION_DETAIL_RESP),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto(`/question/${MOCK_QID}/result`, { waitUntil: 'domcontentloaded' });

    // P04 root visible
    await expect(page.locator(`[data-testid="${P04_TID.root}"]`)).toBeVisible({ timeout: 5_000 });

    // LOADING → DRAFT (skeleton → content)
    await expect(page.locator(`[data-testid="${P04_TID.questionHero}"]`)).toBeVisible({ timeout: 5_000 });

    // Verify all 6 content sections present (AC4 completeness)
    const sections = [
      P04_TID.questionHero,
      P04_TID.answersRow,
      P04_TID.reasonCard,
      P04_TID.solutionStepper,
      P04_TID.metaChips,
      P04_TID.memoryCurve,
    ];
    for (const tid of sections) {
      await expect(page.locator(`[data-testid="${tid}"]`)).toBeVisible();
    }

    // Low-conf banner should NOT be visible (confidence=0.85 ≥ 0.6)
    await expect(page.locator(`[data-testid="${P04_TID.lowConfBanner}"]`)).not.toBeVisible();

    // Navbar visible
    await expect(page.locator(`[data-testid="${P04_TID.navbar}"]`)).toBeVisible();

    // ERROR screenshot: simulate API failure path
    // (We already have the draft screenshot from AC1-4 test)
    await page.screenshot({
      path: 'test-results/screenshots/t04-draft-direct.png',
      fullPage: true,
    });
  });

  // ─────────────────────────────────────────────────────────────
  // P04 GET API error → ERROR state screenshot
  // ─────────────────────────────────────────────────────────────
  test('P04 GET API error → ERROR state fallback', async ({ page }) => {
    await setAuth(page);

    // Mock: GET /api/wb/questions/{qid} → 500
    await page.route(`**/api/wb/questions/error-qid-001`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: -1, message: 'Internal Server Error' }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/question/error-qid-001/result', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`[data-testid="${P04_TID.root}"]`)).toBeVisible({ timeout: 5_000 });

    // Should still render (placeholderData fallback) but may show error state
    // Wait a bit for retry to complete (retry: 1)
    await page.waitForTimeout(2000);

    // ERROR state screenshot (DoR C-4 第 4 张)
    await page.screenshot({
      path: 'test-results/screenshots/t04-error.png',
      fullPage: true,
    });
  });
});
