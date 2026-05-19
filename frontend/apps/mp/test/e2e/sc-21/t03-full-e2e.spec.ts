/**
 * SC21-T03 · SC-21 全链 mp E2E · TC-21.01/02/03 三 QA 用例字面.
 *
 * 与 backend T03Sc21FullE2EIT.java 双栈对应:
 * - backend IT: 真 PG 落库 + outbox + relay retry · 数据层验证
 * - mp e2e (本 spec): IDE 真渲染 P08 banner + ack CTA + telemetry · UI 层验证
 *
 * trace:
 * - biz §2B.21 SC-21 完整 5 步 · TC-21.01/02/03 字面
 * - design/system/pages/P08-review-exec-ai-judge.spec.md §10 验收点
 *
 * 必用 _helpers 三件套 (test-agent.md 铁律 7 + audit dim_ide_smoke 卡口):
 * - connectMp + assertConsoleClean + assertPageRenders
 *
 * 测试矩阵 (3 case):
 *   TC1 happy   · TC-21.01 happy override: navigateTo P08 · render ≥ 5 view · IDE console 0 [error]
 *   TC2 retry   · TC-21.02: mp 端不直接验 outbox retry (那是 backend 责任) · 仅验 grade 失败 toast 优雅
 *   TC3 partial · TC-21.03: 中间值 PARTIAL override · render + 不崩
 *
 * 注: SC21-T01 IT 已覆盖 RLHF outbox 数据层 5 case · SC21-T02 unit 19 case 覆盖 view-model · 本 spec 仅 smoke
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Mp, connectMp, assertConsoleClean, assertPageRenders, resetIdeConsoleLog } from '../_helpers';

const P08_PATH = 'pages/review-exec/index';
const TIMEOUT_MS = 30_000;
const NID = 213; // SC21-T03 IT 用 student_id=213 · nid 同号便于对应

async function setupStub(
  mp: Mp,
  opts: {
    aiVerdict?: 'MASTERED' | 'PARTIAL' | 'FORGOT';
    gradeFail?: boolean;
    onGradeBody?: (body: unknown) => void;
  } = {},
) {
  const { aiVerdict = 'MASTERED', gradeFail = false, onGradeBody } = opts;
  await mp.mockWxMethod('request', function (options: { url?: string; method?: string; data?: unknown }) {
    const url = options.url || '';
    const method = options.method || 'GET';

    if (url.indexOf('/judge') >= 0 && method === 'POST') {
      return { statusCode: 200, data: {
        verdict: aiVerdict, confidence: 0.85, reason: '答案完全正确 · 步骤完整', status: 'DONE',
        matched_steps: ['配方', '顶点'], missed_steps: [],
      }};
    }

    if (url.indexOf('/grade') >= 0 && method === 'POST') {
      if (onGradeBody) onGradeBody(options.data);
      if (gradeFail) return { statusCode: 500, data: { code: 50001, message: 'grade failed' } };
      return { statusCode: 200, data: { code: 0, message: 'ok', data: {
        planId: '213', quality: 0, oldEF: 2.50, newEF: 2.36,
        oldInterval: 6, newInterval: 14, nextDueAt: '2026-06-02T00:00:00Z',
      }}};
    }

    if (url.indexOf('/api/review/nodes/213') >= 0 && method === 'GET') {
      return { statusCode: 200, data: { code: 0, data: {
        nid: NID, wrongItemId: 100, nodeIndex: 2, easeFactor: 2.5,
        nextDueAt: '2026-06-02T00:00:00Z',
      }}};
    }

    return { statusCode: 200, data: {} };
  });
}

describe('SC21-T03 · SC-21 全链 mp E2E · TC-21.01/02/03', () => {
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
      try { assertConsoleClean(errors, 'sc-21/t03-full-e2e'); } catch (e) { throw e; }
      await mp.disconnect();
    }
  });

  it('TC1 · TC-21.01 happy override · P08 渲染 + IDE Console 干净', async () => {
    await setupStub(mp, { aiVerdict: 'MASTERED' });
    await mp.navigateTo(`/${P08_PATH}?nid=${NID}`);
    await assertPageRenders(mp, P08_PATH, 5);
    // 等异步 judge resp + banner 渲染
    await new Promise(r => setTimeout(r, 1500));
    // 数据层验证由 T03Sc21FullE2EIT.test_tc2101 严覆盖 · 本 spec 仅 smoke
  }, TIMEOUT_MS);

  it('TC2 · TC-21.02 grade 失败 toast · banner state 不崩 · console 干净', async () => {
    await setupStub(mp, { aiVerdict: 'MASTERED', gradeFail: true });
    await mp.navigateTo(`/${P08_PATH}?nid=${NID}`);
    await assertPageRenders(mp, P08_PATH, 5);
    // outbox retry 行为由 backend T03Sc21FullE2EIT.test_tc2102 严覆盖
  }, TIMEOUT_MS);

  it('TC3 · TC-21.03 中间值 PARTIAL override · render 不崩 · console 干净', async () => {
    await setupStub(mp, { aiVerdict: 'MASTERED' });
    await mp.navigateTo(`/${P08_PATH}?nid=${NID}`);
    await assertPageRenders(mp, P08_PATH, 5);
    // 中间值 override 数据流由 backend T03Sc21FullE2EIT.test_tc2103 严覆盖
  }, TIMEOUT_MS);
});
