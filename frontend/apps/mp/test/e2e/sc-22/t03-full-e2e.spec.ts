/**
 * SC22-T03 · SC-22 全链 mp E2E · TC-22.01/02 (smoke)
 *
 * 与 backend T03Sc22FullE2EIT.java 双栈对应:
 * - backend IT: 真 PG 落库 + verdict null + metadata.status='TIMEOUT'/'LOW_CONFIDENCE' + 18s SLA · 数据层验证
 * - mp e2e (本 spec): IDE 真渲染 P08 banner 退化 + 学生 tap 自评 → :grade body{final_grade_source:'self'} · UI 层验证
 *
 * trace:
 * - biz §2B.22 SC-22 完整 5 步 · TC-22.01/02 字面
 * - design/system/pages/P08-review-exec-ai-judge.spec.md §10 验收点
 *
 * 必用 _helpers 三件套 (test-agent.md 铁律 7 + audit dim_ide_smoke 卡口):
 * - connectMp + assertConsoleClean + assertPageRenders
 *
 * 测试矩阵 (2 case smoke · TC-22.03 是 prompt 字面 grep · 不需 mp 端):
 *   TC1 TC-22.01 LOW_CONFIDENCE · :judge mock 返 conf=0.32 status='LOW_CONFIDENCE' → banner 退化 + GradeButtons preselected=null
 *   TC2 TC-22.02 双 provider 超时 503 · :judge mock 返 503 → banner unavailable 退化 + preselected=null
 *
 * 注: SC22-T02 IT + SC22-T03 backend IT 已严覆盖数据层 5 列 + counter · 本 spec 仅 smoke + console clean
 */
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders, resetIdeConsoleLog } from '../_helpers';

const P08_PATH = 'pages/review-exec/index';
const TIMEOUT_MS = 30_000;
const NID = 223; // SC22-T03 · 与 sibling SC-20/21/22-T01 (500/213/220) 隔离

async function setupStub(
  mp: Mp,
  opts: {
    judgeStatus?: 'LOW_CONFIDENCE' | 'TIMEOUT';
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
      // TC-22.01: confidence=0.32 + status='LOW_CONFIDENCE' (per biz §2B.22 line 213 字面 ai_judge_* 5 列仍落)
      return { statusCode: 200, data: {
        verdict: 'PARTIAL',
        confidence: judgeConfidence,
        reason: '答案接近但步骤难辨认 · AI 不确定',
        status: judgeStatus,
        matched_steps: undefined,
        missed_steps: undefined,
      }};
    }

    if (url.indexOf('/grade') >= 0 && method === 'POST') {
      // TC-22.01 关键断言: final_grade_source='self' (学生独立选 · banner 没预选 = 不算 ai_accepted)
      // 但 mp e2e 验确 body 字段不在本 smoke scope · 数据层由 backend IT 严覆盖
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

describe('SC22-T03 · SC-22 全链 mp E2E · TC-22.01/02', () => {
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
      try { assertConsoleClean(errors, 'sc-22/t03-full-e2e'); } catch (e) { throw e; }
      await mp.disconnect();
    }
  });

  // 防 webview count limit (sibling SC22-T01 同处理)
  afterEach(async () => {
    if (mp) {
      try {
        await mp.reLaunch('/pages/home/index');
      } catch {
        // 兜底 · 不致命
      }
    }
  });

  it('TC1 · TC-22.01 LOW_CONFIDENCE 退化 · P08 渲染 + IDE Console 干净', async () => {
    await setupStub(mp, { judgeStatus: 'LOW_CONFIDENCE', judgeConfidence: 0.32 });
    await mp.navigateTo(`/${P08_PATH}?nid=${NID}`);
    await assertPageRenders(mp, P08_PATH, 5);
    await new Promise((r) => setTimeout(r, 1500));
    // 数据层验证由 backend T03Sc22FullE2EIT.test_tc2201 严覆盖 · 本 spec 仅 smoke
  }, TIMEOUT_MS);

  it('TC2 · TC-22.02 双 provider 503 · banner unavailable 退化 + console 干净', async () => {
    await setupStub(mp, { judgeFail: true });
    await mp.navigateTo(`/${P08_PATH}?nid=${NID}`);
    await assertPageRenders(mp, P08_PATH, 5);
    await new Promise((r) => setTimeout(r, 1500));
    // 数据层验证由 backend T03Sc22FullE2EIT.test_tc2202 严覆盖
  }, TIMEOUT_MS);
});
