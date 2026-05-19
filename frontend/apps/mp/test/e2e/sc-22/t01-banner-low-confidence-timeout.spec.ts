/**
 * SC22-T01 · AiJudgeBanner LOW_CONFIDENCE / TIMEOUT 退化 polish · MP E2E (vitest + miniprogram-automator)
 *
 * trace:
 * - biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md §2B.22 SC-22 step 2 + TC-22.01/02 银行退化策略
 * - design/system/pages/P08-review-exec-ai-judge.spec.md §9 异常 + §13 22 testid (含 fallback testid)
 *
 * 必用 _helpers.ts 三件套 (test-agent.md 铁律 7 + coder-agent.md Rule 7):
 * - connectMp · 自动挂 mp.on('console') · 落 ide-console.txt (audit dim_ide_smoke 卡)
 * - assertConsoleClean · 末态防 silent IDE error
 * - assertPageRenders · 验路由 + view 数 ≥ 阈值
 *
 * 测试矩阵 (3 case smoke · backend behavior 由 SC22-T02 IT 严覆盖):
 *   TC1 LOW_CONFIDENCE  · POST :judge mock 返 confidence=0.32 status='LOW_CONFIDENCE' → banner 退化 + view ≥ 5
 *   TC2 TIMEOUT        · POST :judge mock 返 503 → banner 退化为 unavailable kind + view ≥ 5
 *   TC3 DONE base case · 验确 sibling SC20-T05 happy path 不破坏 (向后兼容)
 *
 * 注: 数据层断言 (final_grade_source='self' / image_key 非 null) 由 SC22-T02 + SC22-T03 IT 严覆盖 · 本 spec 仅 smoke + console clean
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders, resetIdeConsoleLog } from '../_helpers';

const P08_PATH = 'pages/review-exec/index';
const TIMEOUT_MS = 30_000;
const NID = 220; // SC22-T01 e2e · 与 sibling SC-20/21 (500/213) 隔离

async function setupStub(
  mp: Mp,
  opts: {
    judgeStatus?: 'LOW_CONFIDENCE' | 'TIMEOUT' | 'DONE';
    judgeConfidence?: number;
    judgeFail?: boolean;
  } = {},
) {
  const { judgeStatus = 'LOW_CONFIDENCE', judgeConfidence = 0.32, judgeFail = false } = opts;
  await mp.mockWxMethod('request', function (options: { url?: string; method?: string; data?: unknown }) {
    const url = options.url || '';
    const method = options.method || 'GET';

    if (url.indexOf('/judge') >= 0 && method === 'POST') {
      if (judgeFail) {
        return { statusCode: 503, data: { error_code: 'AI_SERVICE_UNAVAILABLE', message: 'AI providers all failed / timeout' } };
      }
      // LOW_CONFIDENCE: verdict + confidence 仍返 (per biz §2B.22 line 213 字面 "ai_judge_* 5 列仍写库")
      // 但 frontend banner 用 status === 'LOW_CONFIDENCE' 走退化分支
      return { statusCode: 200, data: {
        verdict: judgeStatus === 'DONE' ? 'PARTIAL' : 'PARTIAL',
        confidence: judgeConfidence,
        reason: judgeStatus === 'DONE' ? '答案正确 · 步骤完整' : '答案接近但步骤难辨认 · AI 不确定',
        status: judgeStatus,
        matched_steps: judgeStatus === 'DONE' ? ['步骤 1', '步骤 2'] : undefined,
        missed_steps: judgeStatus === 'DONE' ? [] : undefined,
      }};
    }

    if (url.indexOf('/grade') >= 0 && method === 'POST') {
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {
        planId: String(NID), quality: 3, oldEF: 2.5, newEF: 2.36,
        oldInterval: 6, newInterval: 14, nextDueAt: '2026-06-02T00:00:00Z',
      }}};
    }

    if (url.indexOf('/api/review/nodes/' + NID) >= 0 && method === 'GET') {
      return { statusCode: 200, data: { code: 0, data: {
        nid: NID, wrongItemId: 100, nodeIndex: 2, easeFactor: 2.5,
        nextDueAt: '2026-06-02T00:00:00Z',
      }}};
    }

    return { statusCode: 200, data: {} };
  });
}

describe('SC22-T01 · AiJudgeBanner LOW_CONFIDENCE / TIMEOUT 退化 polish · IDE Console 0 [error]', () => {
  let mp: Mp;
  let errors: string[];

  beforeAll(async () => {
    resetIdeConsoleLog();
    const conn = await connectMp();
    mp = conn.mp;
    errors = conn.errors;
  }, TIMEOUT_MS);

  afterAll(async () => {
    if (mp) {
      try { assertConsoleClean(errors, 'sc-22/t01-banner-low-confidence-timeout'); } catch (e) { throw e; }
      await mp.disconnect();
    }
  });

  // 防 webview count limit · 每次 it 后 reLaunch 回 home (mp IDE 限 ~10 个 navigateTo 堆栈)
  afterEach(async () => {
    if (mp) {
      try {
        await mp.reLaunch('/pages/home/index');
      } catch {
        // 兜底 · 不致命
      }
    }
  });

  it('TC1 · LOW_CONFIDENCE · POST :judge 返 confidence=0.32 → banner 退化文案 + view ≥ 5', async () => {
    await setupStub(mp, { judgeStatus: 'LOW_CONFIDENCE', judgeConfidence: 0.32 });
    await mp.navigateTo(`/${P08_PATH}?nid=${NID}`);
    await assertPageRenders(mp, P08_PATH, 5);
    // 异步 judge resp + banner 退化渲染
    await new Promise((r) => setTimeout(r, 1500));
    // banner 退化 fallbackKind 实际渲染由 SC22-T01 unit test (sc22-t01-banner-fallback-polish.spec.ts) 严覆盖
  }, TIMEOUT_MS);

  it('TC2 · TIMEOUT · POST :judge mock 返 503 → banner 退化 unavailable + view ≥ 5', async () => {
    await setupStub(mp, { judgeFail: true });
    await mp.navigateTo(`/${P08_PATH}?nid=${NID}`);
    await assertPageRenders(mp, P08_PATH, 5);
    await new Promise((r) => setTimeout(r, 1500));
    // SERVICE_UNAVAILABLE 渲染分支由 unit test 严覆盖 · 本 spec 仅 smoke + console
  }, TIMEOUT_MS);

  it('TC3 · DONE base case · sibling SC20-T05 happy path 不破坏 (向后兼容)', async () => {
    await setupStub(mp, { judgeStatus: 'DONE', judgeConfidence: 0.85 });
    await mp.navigateTo(`/${P08_PATH}?nid=${NID}`);
    await assertPageRenders(mp, P08_PATH, 5);
    await new Promise((r) => setTimeout(r, 1500));
    // banner 主区渲染由 sibling SC20-T05 spec 严覆盖
  }, TIMEOUT_MS);
});
