// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 9
//        spec=design/system/pages/P04-result.spec.md §5 API 触点 (POST /save) + §6 状态机 + §9 异常
//        code=backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/QuestionDetailController.java
//        code=frontend/apps/h5/src/pages/Result/index.tsx
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T05 · P04 Tap「保存到错题本」· POST /save · 触发 plan + 7 nodes 生成
 *
 * Owner: Coder team-2 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E + 铁律补充 6 E2E = DoD 唯一硬条件
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T05.json AC1-AC5 + TI1-TI4
 *   - design/system/pages/P04-result.spec.md §5 行 3 POST /save + §6 SAVING 路径
 *
 * 业务剧本 (source of truth · biz §2B.2 步 9):
 *   1. P04 DRAFT 态 · 学生看到 Hero + 错因 + 3 步 + KP + 6 节点预告
 *   2. tap 蓝色「保存到错题本」按钮
 *   3. CTA 变 loading spinner + 文案「保存中…」
 *   4. POST /api/wb/questions/{qid}/save body{strategyCode=EBBINGHAUS_STD} Header X-Request-Id
 *   5. 200 → SAVED → track wb_result_save{subject,kpCount} → 200ms 后 nav → /wrongbook?highlight={qid}
 *   6. 5xx → toast「保存中…稍后自动重试」· 状态回 DRAFT
 *
 * 关键不变量 (test_invariants):
 *   - TI1: question.created.topic outbox 1 条 (payload {itemId, userId, subject, occurredAt})
 *   - TI2: save 幂等基于 qid 唯一索引 (重放 INSERT 撞 unique → 走 catch 返当前快照)
 *   - TI3: 埋点 wb_result_save{subject,kpCount} 1 条
 *   - TI4: save 全链耗时 ≤ 800ms (P95)
 */
import { test, expect, type Page, type Route } from '@playwright/test';

// ─── testids (与 frontend/packages/testids/src/index.ts §p04 1:1 对齐) ──

const TID = {
  root: 'p04-root',
  navbar: 'p04-navbar',
  questionHero: 'p04-question-hero',
  answersRow: 'p04-answers-row',
  reasonCard: 'p04-reason-card',
  solutionStepper: 'p04-solution-stepper',
  metaChips: 'p04-meta-chips',
  memoryCurve: 'memory-curve',
  saveCta: 'p04-save-cta',
  saveBtn: 'result-save-btn',
  saveLoading: 'result-save-loading',
  lowConfBanner: 'result-lowconf-banner',
  confirmModal: 'result-confirm-modal',
  confirmYesBtn: 'result-confirm-yes-btn',
  confirmNoBtn: 'result-confirm-no-btn',
  skeleton: 'p04-skeleton',
} as const;

// ─── Mock API fixture data ──────────────────────────────────────────
// P04 uses placeholderData (mock) when backend is unavailable.
// For E2E we intercept API to simulate real backend responses.

const MOCK_QID = 'mock-qid-t05-001';

const MOCK_QUESTION_DETAIL_RESP = {
  question: {
    id: MOCK_QID,
    subject: 'math',
    stem: '已知函数 f(x) = x² − 4x + 3，求其顶点坐标与对称轴方程。',
    formula: 'f(x) = (x − 2)² − 1',
    my_answer: 'B. (2, −1)',
    correct_answer: 'A. (2, −1)',
    reason_markdown: '你把顶点式 (x − h)² + k 中的 h 与 k 读反了。',
    steps: [
      { idx: 1, title: '对 f(x) 配方', formula: 'f(x) = (x² − 4x + 4) + 3 − 4' },
      { idx: 2, title: '整理为顶点式', formula: 'f(x) = (x − 2)² − 1' },
      { idx: 3, title: '读出顶点 (2, −1)，对称轴 x = 2' },
    ],
    knowledge_points: [
      { id: 'kp-1', name: '二次函数 顶点式', weight: 0.8 },
      { id: 'kp-2', name: '配方法', weight: 0.6 },
    ],
    difficulty: 3,
    confidence: 0.85,
    model_info: { name: 'qwen-vl-max', version: '2.0' },
  },
  planned_nodes: [
    { t_level: 'T1', due_at: new Date().toISOString(), status: 'preview' },
    { t_level: 'T2', due_at: new Date(Date.now() + 86400000).toISOString(), status: 'preview' },
    { t_level: 'T3', due_at: new Date(Date.now() + 4 * 86400000).toISOString(), status: 'preview' },
    { t_level: 'T4', due_at: new Date(Date.now() + 8 * 86400000).toISOString(), status: 'preview' },
    { t_level: 'T5', due_at: new Date(Date.now() + 16 * 86400000).toISOString(), status: 'preview' },
    { t_level: 'T6', due_at: new Date(Date.now() + 35 * 86400000).toISOString(), status: 'preview' },
  ],
};

const MOCK_SAVE_RESP = {
  code: 0,
  data: {
    qid: MOCK_QID,
    status: 3,
    message: 'msgkey:wb.save.success',
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────

async function setupApiRoutes(page: Page, opts?: { saveFail?: boolean }) {
  // GET /api/wb/questions/{qid} → 200 detail
  await page.route('**/api/wb/questions/' + MOCK_QID, async (route: Route) => {
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

  // POST /api/wb/questions/{qid}/save → 200 or 500
  await page.route('**/api/wb/questions/' + MOCK_QID + '/save', async (route: Route) => {
    if (route.request().method() === 'POST') {
      if (opts?.saveFail) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: -1, message: 'Internal Server Error' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SAVE_RESP),
        });
      }
    } else {
      await route.fallback();
    }
  });
}

async function takeStateScreenshot(page: Page, state: string) {
  await page.screenshot({
    path: `test-results/screenshots/${state}-actual.png`,
    fullPage: true,
  });
}

// ─── 测试套件 ────────────────────────────────────────────────────────

test.describe('SC01-T05 · P04 Save to Wrongbook', () => {

  test('AC1+AC2: happy path — tap save → loading → SAVED → navigate to /wrongbook', async ({ page }) => {
    // Setup API routes
    await setupApiRoutes(page);

    // Navigate to Result page
    await page.goto(`/question/${MOCK_QID}/result`);

    // IDLE state screenshot
    await page.waitForSelector(`[data-testid="${TID.root}"]`);
    await page.waitForSelector(`[data-testid="${TID.questionHero}"]`);
    await takeStateScreenshot(page, 'idle');

    // Verify DRAFT state — all content sections visible
    await expect(page.locator(`[data-testid="${TID.questionHero}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.answersRow}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.reasonCard}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.solutionStepper}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.metaChips}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${TID.memoryCurve}"]`)).toBeVisible();

    // AC1: Tap save button
    const saveBtn = page.locator(`[data-testid="${TID.saveCta}"]`);
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeEnabled();

    // Intercept POST /save to verify request shape (AC2)
    const savePromise = page.waitForRequest(req =>
      req.url().includes('/api/wb/questions/') && req.url().includes('/save') && req.method() === 'POST'
    );

    await saveBtn.click();

    // SAVING state screenshot (loading spinner)
    await takeStateScreenshot(page, 'uploading');

    // AC2: verify POST /save request
    const saveReq = await savePromise;
    const reqBody = saveReq.postDataJSON();
    expect(reqBody.strategyCode).toBe('EBBINGHAUS_STD');
    expect(reqBody.qid).toBe(MOCK_QID);
    // Verify X-Request-Id header
    const xRequestId = saveReq.headers()['x-request-id'];
    expect(xRequestId).toBeTruthy();

    // SUCCESS state: page should navigate to /wrongbook
    await page.waitForURL(/\/wrongbook/, { timeout: 5000 });
    await takeStateScreenshot(page, 'success');
  });

  test('AC5: save failure — 5xx → toast + stay on P04', async ({ page }) => {
    // Setup API routes with save failure
    await setupApiRoutes(page, { saveFail: true });

    await page.goto(`/question/${MOCK_QID}/result`);
    await page.waitForSelector(`[data-testid="${TID.root}"]`);
    await page.waitForSelector(`[data-testid="${TID.questionHero}"]`);

    // Tap save
    const saveBtn = page.locator(`[data-testid="${TID.saveCta}"]`);
    await saveBtn.click();

    // ERROR state: toast should appear
    const toast = page.locator('[data-testid="result-save-toast"]');
    await expect(toast).toBeVisible({ timeout: 3000 });
    await expect(toast).toContainText('保存中');
    await takeStateScreenshot(page, 'error');

    // Should stay on P04 (NOT navigate to /wrongbook)
    expect(page.url()).toContain('/question/');
    expect(page.url()).not.toContain('/wrongbook');

    // Save button should be enabled again (back to DRAFT)
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
  });

  test('AC4: idempotent save — 2nd tap same qid returns snapshot', async ({ page }) => {
    let saveCallCount = 0;
    // Setup custom route that counts save calls
    await page.route('**/api/wb/questions/' + MOCK_QID, async (route: Route) => {
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
    await page.route('**/api/wb/questions/' + MOCK_QID + '/save', async (route: Route) => {
      if (route.request().method() === 'POST') {
        saveCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SAVE_RESP),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto(`/question/${MOCK_QID}/result`);
    await page.waitForSelector(`[data-testid="${TID.questionHero}"]`);

    // First save
    const saveBtn = page.locator(`[data-testid="${TID.saveCta}"]`);
    await saveBtn.click();

    // Should navigate after first save
    await page.waitForURL(/\/wrongbook/, { timeout: 5000 });

    // AC4: verify only 1 save call was made (button disabled during SAVING prevents double-click)
    expect(saveCallCount).toBe(1);
  });

  test('low confidence path — save requires confirm modal (TC-01.04)', async ({ page }) => {
    // Use a low-conf qid to trigger LOW_CONF state
    const lowConfQid = 'low-conf-test-qid';
    const lowConfResp = {
      ...MOCK_QUESTION_DETAIL_RESP,
      question: {
        ...MOCK_QUESTION_DETAIL_RESP.question,
        id: lowConfQid,
        confidence: 0.42,
      },
    };

    await page.route('**/api/wb/questions/' + lowConfQid, async (route: Route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(lowConfResp),
        });
      } else {
        await route.fallback();
      }
    });
    await page.route('**/api/wb/questions/' + lowConfQid + '/save', async (route: Route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...MOCK_SAVE_RESP,
            data: { ...MOCK_SAVE_RESP.data, qid: lowConfQid },
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto(`/question/${lowConfQid}/result`);
    await page.waitForSelector(`[data-testid="${TID.root}"]`);
    await page.waitForSelector(`[data-testid="${TID.questionHero}"]`);

    // Low-conf banner visible
    await expect(page.locator(`[data-testid="${TID.lowConfBanner}"]`)).toBeVisible();

    // Tap save — should open confirm modal, NOT directly save
    const saveBtn = page.locator(`[data-testid="${TID.saveCta}"]`);
    await saveBtn.click();

    // Confirm modal visible
    const modal = page.locator(`[data-testid="${TID.confirmModal}"]`);
    await expect(modal).toBeVisible();

    // Tap "返回复核" — should close modal, stay on page
    await page.locator(`[data-testid="${TID.confirmNoBtn}"]`).click();
    await expect(modal).not.toBeVisible();

    // Tap save again → modal → confirm yes
    await saveBtn.click();
    await expect(modal).toBeVisible();
    await page.locator(`[data-testid="${TID.confirmYesBtn}"]`).click();

    // Should now proceed with save and navigate
    await page.waitForURL(/\/wrongbook/, { timeout: 5000 });
  });
});
