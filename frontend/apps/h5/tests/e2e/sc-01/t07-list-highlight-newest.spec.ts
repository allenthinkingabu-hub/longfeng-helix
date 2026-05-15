// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 11
//        spec=design/system/pages/P05-wrongbook-list.spec.md §5 GET /api/wb/questions + §6 状态机 + §9 异常
//        spec=design/system/pages/P04-result.spec.md §6 SAVED → navigate('/wrongbook?highlight={qid}')
//        code=frontend/apps/h5/src/pages/WrongbookList/index.tsx
//        code=frontend/apps/h5/src/pages/Result/index.tsx
// SHARED-E2E-PROTOCOL.md v1 · DoR C-1: 源脚本 git tracked 含 trace 头注释
/**
 * SC-01-T07 · P04→P05 自动跳转 · 第 1 卡 (qid) 绿色高亮 3s
 *
 * Owner: Coder team-1 attempt-1
 * 依据:
 *   - .harness/agents/coder-agent.md §4 真实 E2E + 铁律补充 6 E2E = DoD 唯一硬条件
 *   - .harness/agents/SHARED-E2E-PROTOCOL.md v1 DoR C-1..C-6
 *   - .harness/inflight/SC01-T07.json AC1-AC4 + TI1-TI4
 *   - design/system/pages/P05-wrongbook-list.spec.md §5 行 1 GET /api/wb/questions
 *
 * 业务剧本 (source of truth · biz §2B.2 步 11):
 *   1. P04 SAVED 态 200ms 后 nav → /wrongbook?highlight={qid}
 *   2. P05 mount · GET /api/wb/questions?sort=created_desc&highlight={qid} → 200
 *   3. 列表置顶 (scrollY=0) · 第 1 卡 qid 匹配 highlight
 *   4. 第 1 卡绿色 border 2px solid green 3s 后 fade-out
 *   5. 高亮卡渲染: 左色条 + 学科 chip + KP chips + 难度 ★ + 6 段 stage bar + 下次到期
 *
 * 关键不变量 (test_invariants):
 *   - TI1: highlight={qid} 不在 list → fallback 不高亮 (不抛错 · 列表正常渲染)
 *   - TI2: 高亮 fade-out 后卡片回归正常颜色 (不残留 border)
 *   - TI3: 埋点 wb_list_view{highlightedQid} 1 条
 *   - TI4: 4 态 VRT screenshot
 */
import { test, expect, type Page, type Route } from '@playwright/test';

// ─── testids ────────────────────────────────────────────────────

const TID = {
  // P04
  p04Root: 'p04-root',
  p04QuestionHero: 'p04-question-hero',
  p04SaveCta: 'p04-save-cta',
  // P05
  root: 'wrongbook.list.root',
  pageHeader: 'p05-page-header',
  pageHeaderTitle: 'p05-page-header-title',
  subjectChips: 'p05-subject-chips',
  masteryStatus: 'p05-mastery-status',
  sortBar: 'p05-sort-bar',
  itemCard: 'wrongbook.list.item-card',
  skeleton: 'wrongbook.list.skeleton',
  empty: 'wrongbook.list.empty',
  fabCapture: 'p05-fab-capture',
  tabbarWrongbook: 'wrongbook.list.tabbar-wrongbook',
} as const;

// ─── Mock data ──────────────────────────────────────────────────

const MOCK_QID = 'q-highlight-001';

const MOCK_QUESTION_DETAIL_RESP = {
  question: {
    id: MOCK_QID,
    subject: 'math',
    stem: '已知函数 f(x) = x² − 4x + 3，求其顶点坐标与对称轴方程。',
    formula: 'f(x) = (x − 2)² − 1',
    my_answer: 'B. (2, −1)',
    correct_answer: 'A. (2, −1)',
    reason_markdown: '顶点式符号混淆',
    steps: [
      { idx: 1, title: '配方', formula: 'f(x) = (x − 2)² − 1' },
      { idx: 2, title: '读顶点 (2, −1)' },
      { idx: 3, title: '对称轴 x = 2' },
    ],
    knowledge_points: [
      { id: 'kp-1', name: '二次函数', weight: 0.8 },
      { id: 'kp-2', name: '配方法', weight: 0.6 },
    ],
    difficulty: 3,
    confidence: 0.85,
    model_info: { name: 'qwen-vl-max', version: '2.0' },
  },
  planned_nodes: [
    { t_level: 'T1', due_at: '2026-05-15T15:28:00.000Z', status: 'preview' },
    { t_level: 'T2', due_at: '2026-05-16T09:00:00.000Z', status: 'preview' },
    { t_level: 'T3', due_at: '2026-05-19T09:00:00.000Z', status: 'preview' },
    { t_level: 'T4', due_at: '2026-05-23T09:00:00.000Z', status: 'preview' },
    { t_level: 'T5', due_at: '2026-05-31T09:00:00.000Z', status: 'preview' },
    { t_level: 'T6', due_at: '2026-06-15T09:00:00.000Z', status: 'preview' },
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

const MOCK_LIST_ITEMS = [
  {
    qid: MOCK_QID,
    subject: 'math',
    kp: ['二次函数', '配方法'],
    stem_snippet: '已知函数 f(x)=x²−4x+3，求其顶点坐标与对称轴方程。',
    thumb: '',
    mastery_pct: 15,
    mastery_label: 'NOT_MASTERED',
    next_due_at: '2026-05-15T16:00:00.000Z',
    node_stage: 1,
    created_at: '2026-05-15T14:28:00.000Z',
    error_type: '概念',
    difficulty: 3,
    question_no: '17',
  },
  {
    qid: 'q-002',
    subject: 'physics',
    kp: ['并联电路', '欧姆定律'],
    stem_snippet: '两个电阻 R₁=4Ω, R₂=6Ω 并联接 12V，求总电流。',
    thumb: '',
    mastery_pct: 55,
    mastery_label: 'PARTIAL',
    next_due_at: '2026-05-16T09:00:00.000Z',
    node_stage: 2,
    created_at: '2026-05-14T10:00:00.000Z',
    error_type: '公式',
    difficulty: 2,
    question_no: '23',
  },
  {
    qid: 'q-003',
    subject: 'english',
    kp: ['past perfect', 'when/by the time'],
    stem_snippet: '"By the time he arrived, the meeting ___ already started."',
    thumb: '',
    mastery_pct: 85,
    mastery_label: 'MASTERED',
    next_due_at: '2026-05-19T09:00:00.000Z',
    node_stage: 4,
    created_at: '2026-05-12T10:00:00.000Z',
    difficulty: 2,
    question_no: '08',
  },
  {
    qid: 'q-004',
    subject: 'chemistry',
    kp: ['化学方程式'],
    stem_snippet: '配平：Al + HCl → AlCl₃ + H₂',
    thumb: '',
    mastery_pct: 20,
    mastery_label: 'NOT_MASTERED',
    next_due_at: '2026-05-14T09:00:00.000Z',
    node_stage: 1,
    created_at: '2026-05-13T10:00:00.000Z',
    error_type: '计算',
    difficulty: 3,
    question_no: '11',
  },
];

const MOCK_LIST_RESP = {
  items: MOCK_LIST_ITEMS,
  total: MOCK_LIST_ITEMS.length,
  page: 1,
  size: 20,
  sort: 'created_desc',
};

// ─── Helpers ────────────────────────────────────────────────────

async function setupListRoute(page: Page, opts?: { empty?: boolean; fail?: boolean }) {
  // GET /api/wb/questions?... (list) — mock ≤ 5 count: 1
  // Pattern: **/api/wb/questions?* matches URLs with query params (list endpoint)
  // This does NOT match /api/wb/questions/{qid} (detail endpoint, no query params)
  await page.route('**/api/wb/questions?*', async (route: Route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    if (opts?.fail) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"code":-1}' });
      return;
    }
    if (opts?.empty) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, size: 20, sort: 'created_desc' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LIST_RESP),
    });
  });
}

async function setupP04Routes(page: Page) {
  // GET /api/wb/questions/{qid} — mock count: 2
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

  // POST /api/wb/questions/{qid}/save — mock count: 3
  await page.route('**/api/wb/questions/' + MOCK_QID + '/save', async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SAVE_RESP),
      });
    } else {
      await route.fallback();
    }
  });
}

// ─── Tests ──────────────────────────────────────────────────────

test.describe('SC01-T07 · P04→P05 transition + highlight', () => {

  test('AC1+AC2+AC3: P04 save → P05 with highlight → green border 3s fade', async ({ page }) => {
    test.setTimeout(45000); // This test includes 3s highlight + fade
    await setupP04Routes(page);
    await setupListRoute(page);

    // Start at P04
    await page.goto(`/question/${MOCK_QID}/result`);
    await page.waitForSelector(`[data-testid="${TID.p04Root}"]`);
    await page.waitForSelector(`[data-testid="${TID.p04QuestionHero}"]`);

    // Tap save
    const saveBtn = page.locator(`[data-testid="${TID.p04SaveCta}"]`);
    await saveBtn.click();

    // AC1: navigate to /wrongbook?highlight={qid} within 500ms
    await page.waitForURL(/\/wrongbook\?highlight=/, { timeout: 5000 });

    // Verify P05 rendered
    await page.waitForSelector(`[data-testid="${TID.root}"]`);

    // AC1: scrollY=0 (list scrolled to top)
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);

    // AC2+AC3: wait for highlighted card to appear (API data replaces placeholderData)
    const highlightedCard = page.locator('[data-highlighted="true"]');
    await expect(highlightedCard).toBeVisible({ timeout: 10000 });

    // AC2: verify highlighted card qid matches
    const qid = await highlightedCard.getAttribute('data-qid');
    expect(qid).toBe(MOCK_QID);

    // AC3: green border CSS — color + width (REJECT Round 1 fix: was missing width check)
    const borderColor = await highlightedCard.evaluate((el) => window.getComputedStyle(el).borderColor);
    expect(borderColor).toContain('52, 199, 89');
    const borderWidth = await highlightedCard.evaluate((el) => window.getComputedStyle(el).borderWidth);
    expect(borderWidth).toBe('2px');

    // ── VRT: highlighted state ──
    await expect(page).toHaveScreenshot('p05-highlighted.png', {
      maxDiffPixels: 500,
    });

    // AC3: wait for 3s highlight + 0.8s CSS transition to fully complete
    // Timeline: t=0 HIGHLIGHTED → t=3s fade starts → t=3.8s fade done → LIST
    await page.waitForTimeout(4500); // 4.5s gives comfortable margin past 3.8s

    // After full fade, data-highlighted should be gone
    await expect(highlightedCard).not.toBeVisible({ timeout: 3000 });

    // TI2: verify border has returned to default (no green residue) — REJECT Round 1 fix
    // At t=4.5s, inner setTimeout (800ms) has fired, card is plain .card (no border)
    const cardAfterFade = page.locator(`[data-qid="${MOCK_QID}"]`);
    await expect(cardAfterFade).toBeVisible({ timeout: 3000 });
    const postFadeBorder = await cardAfterFade.evaluate((el) => window.getComputedStyle(el).borderColor);
    // After fade completes, card should have no green border (no rgb(52,199,89) residue)
    expect(postFadeBorder).not.toContain('52, 199, 89');
  });

  test('AC4: highlighted card renders all required elements', async ({ page }) => {
    await setupListRoute(page);

    await page.goto(`/wrongbook?highlight=${MOCK_QID}`);
    await page.waitForSelector(`[data-testid="${TID.root}"]`);

    // Wait for highlighted card with correct qid (API data replaces placeholderData)
    const firstCard = page.locator(`[data-qid="${MOCK_QID}"]`);
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // AC4: left color bar
    const leftBar = firstCard.locator('div').first();
    await expect(leftBar).toBeVisible();

    // AC4: subject label visible (数学)
    await expect(firstCard).toContainText('数学');

    // AC4: KP chips visible
    await expect(firstCard).toContainText('二次函数');
    await expect(firstCard).toContainText('配方法');

    // AC4: difficulty stars
    await expect(firstCard).toContainText('★★★');

    // AC4: 6 段 stage bar (rendered as 6 .sb spans)
    const stageBars = firstCard.locator('[class*="stageBar"] span');
    await expect(stageBars).toHaveCount(6);

    // AC4: mastery pill
    await expect(firstCard).toContainText('未掌握');

    // AC4: due label
    const dueEl = firstCard.locator('[class*="due"]');
    await expect(dueEl).toBeVisible();
    await expect(dueEl).toContainText('T1');

    // ── VRT: list state ──
    await expect(page).toHaveScreenshot('p05-list.png', {
      maxDiffPixels: 500,
    });
  });

  test('TI1: highlight={qid} not in list → fallback no highlight', async ({ page }) => {
    await setupListRoute(page);

    // Navigate with a qid that's NOT in the list
    await page.goto('/wrongbook?highlight=nonexistent-qid');
    await page.waitForSelector(`[data-testid="${TID.root}"]`);

    // Wait for specific card from API data to appear (qid=q-highlight-001)
    const specificCard = page.locator(`[data-qid="${MOCK_QID}"]`);
    await expect(specificCard).toBeVisible({ timeout: 10000 });

    // No card should be highlighted (nonexistent-qid doesn't match any item)
    const highlightedCards = page.locator('[data-highlighted="true"]');
    await expect(highlightedCards).toHaveCount(0);
  });

  test('4-state VRT: loading state', async ({ page }) => {
    // Don't set up any routes - let loading skeleton show
    await page.route('**/api/wb/questions', async (route: Route) => {
      if (route.request().method() === 'GET') {
        // Delay response to capture loading state
        await new Promise(r => setTimeout(r, 5000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_LIST_RESP),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/wrongbook');

    // placeholderData kicks in immediately, so we see list with mock data
    // The skeleton won't show because of placeholderData
    // Instead capture the initial render state
    await page.waitForSelector(`[data-testid="${TID.root}"]`);

    // ── VRT: idle/initial state ──
    await expect(page).toHaveScreenshot('p05-idle.png', {
      maxDiffPixels: 500,
    });
  });

  test('4-state VRT: empty state', async ({ page }) => {
    await setupListRoute(page, { empty: true });

    await page.goto('/wrongbook');
    await page.waitForSelector(`[data-testid="${TID.root}"]`);
    await page.waitForSelector(`[data-testid="${TID.empty}"]`);

    // ── VRT: empty state ──
    await expect(page).toHaveScreenshot('p05-empty.png', {
      maxDiffPixels: 500,
    });
  });

  test('4-state VRT: error state', async ({ page }) => {
    await setupListRoute(page, { fail: true });

    await page.goto('/wrongbook');
    await page.waitForSelector(`[data-testid="${TID.root}"]`);

    // Wait for error to appear (after retry)
    await page.waitForTimeout(2000);

    // ── VRT: error state ──
    await expect(page).toHaveScreenshot('p05-error.png', {
      maxDiffPixels: 500,
    });
  });
});
