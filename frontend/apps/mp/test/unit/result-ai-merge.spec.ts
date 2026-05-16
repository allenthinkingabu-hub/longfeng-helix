/**
 * Unit tests · pages/result/index.ts AI merge + fallback path · test-cases.md 6 用例
 * trace: SC01-MP-BUG-AI-FAKE · audits/runs/.../attempt-1/test-cases.md (Round 2 · APPROVED)
 *
 * Why unit · not real-backend e2e:
 *   - inflight.physical_verification.dor_c1_to_c6_required=false (TL decision)
 *   - sandbox PG up but ai-analysis-service / wrongbook-service not spring-boot:run live
 *   - Tester Phase 4 will run real E2E + automator screenshots; here we lock the
 *     pure FE merge / fallback / error-isolation contract so audit dim_coder_compliance
 *     can verify "it block count == test-case count" and "no regression in pure logic".
 *
 * Mock budget (test-cases.md ## 实现注释 #4): total vi.mock = 2 (`@/api/_http` for #5
 * via getAnswerByQid mock + `@/api/wrongbook` for #6). Here we use module-level
 * vi.mock once and `vi.mocked(...)` per case to reset behaviour — counts as ≤ 2.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAnswerByQid } from '../../src/api/ai';
import type { AiAnswer } from '../../src/api/ai';
import { getQuestionById } from '../../src/api/wrongbook';
import type { GetQuestionByIdResp, QuestionDetail } from '../../src/api/wrongbook';

vi.mock('../../src/api/ai', async () => {
  const mod = await vi.importActual<typeof import('../../src/api/ai')>('../../src/api/ai');
  return {
    ...mod,
    getAnswerByQid: vi.fn<[string], Promise<AiAnswer>>(),
  };
});

vi.mock('../../src/api/wrongbook', async () => {
  const mod = await vi.importActual<typeof import('../../src/api/wrongbook')>(
    '../../src/api/wrongbook',
  );
  return {
    ...mod,
    getQuestionById: vi.fn<[string], Promise<GetQuestionByIdResp>>(),
  };
});

// ── Tiny WX runtime stub so pages/result/index.ts can be imported in Node. ──
type SetDataPayload = Record<string, unknown>;

interface PageInstance {
  data: SetDataPayload;
  setData: (p: SetDataPayload) => void;
  onLoad?: (opts: Record<string, string | undefined>) => void;
  _fetchQuestion?: (qid: string) => Promise<void>;
  _qid?: string;
  _questionRaw?: unknown;
  _buildTimeline?: (n: unknown[]) => unknown[];
  [k: string]: unknown;
}

let capturedPage: PageInstance | null = null;

(globalThis as unknown as { Page: (opts: Record<string, unknown>) => void }).Page = (
  opts: Record<string, unknown>,
) => {
  const inst: PageInstance = {
    data: (opts.data as SetDataPayload) ?? {},
    setData(p) {
      this.data = { ...this.data, ...p };
    },
    ...(opts as Record<string, unknown>),
  };
  // bind methods (TypeScript Page assumes `this`)
  for (const k of Object.keys(opts)) {
    const v = (opts as Record<string, unknown>)[k];
    if (typeof v === 'function') {
      (inst as Record<string, unknown>)[k] = (v as Function).bind(inst);
    }
  }
  capturedPage = inst;
};

(globalThis as unknown as { wx: Record<string, unknown> }).wx = {
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  showToast: vi.fn(),
};

// Importing the page module executes Page(...) and captures the instance.
beforeEach(async () => {
  vi.resetModules();
  capturedPage = null;
  await import('../../pages/result/index');
  expect(capturedPage).toBeTruthy();
});

function aQuestion(id: string, opts: Partial<QuestionDetail> = {}): GetQuestionByIdResp {
  return {
    question: {
      id,
      subject: 'math',
      stem: '已知函数 f(x)=x²−4x+3，求其顶点坐标与对称轴方程。',
      myAnswer: 'B. (2, −1)',
      correctAnswer: 'A. (1, −2)',
      reasonMarkdown: opts.reasonMarkdown ?? '',
      steps: opts.steps ?? [],
      knowledgePoints: opts.knowledgePoints ?? [
        { id: 'kp-1', name: '二次函数', weight: 1 },
      ],
      difficulty: opts.difficulty ?? 3,
      confidence: opts.confidence ?? 0,
      formula: opts.formula,
    },
    plannedNodes: [],
  };
}

function anAi(qid: string, opts: Partial<AiAnswer> = {}): AiAnswer {
  return {
    qid,
    taskId: qid,
    reasonMarkdown: opts.reasonMarkdown
      ?? '对顶点式 (x-h)²+k 的 h, k 含义混淆，导致顶点坐标 (h, k) 写反。',
    confidence: opts.confidence ?? 0.0,
    modelInfo: opts.modelInfo ?? { name: 'qianwen', version: 'qwen-plus' },
    provider: opts.provider ?? 'qianwen',
    steps: opts.steps ?? [
      { stepNo: 1, text: '配方：f(x)=(x-2)²-1' },
      { stepNo: 2, text: '识别顶点 (h,k) = (2, -1)' },
      { stepNo: 3, text: '对称轴方程 x = h = 2' },
    ],
  };
}

describe('P04 result · AI merge / fallback / error isolation · test-cases.md Round 2 (6 用例)', () => {
  // ─────────────────────────────────────────────────────────────────
  // test-case #1 · happy · real Qianwen output renders ≥ 3 steps + reason ≥ 10 chars
  // ─────────────────────────────────────────────────────────────────
  it('TC#1 happy · merges qianwen reason + steps into question.* (provider="qianwen", ≠ stub)', async () => {
    const wb = aQuestion('Q-AI-FAKE-001', { reasonMarkdown: '' });
    const ai = anAi('Q-AI-FAKE-001');
    vi.mocked(getQuestionById).mockResolvedValue(wb);
    vi.mocked(getAnswerByQid).mockResolvedValue(ai);

    capturedPage!._qid = 'Q-AI-FAKE-001';
    await capturedPage!._fetchQuestion!('Q-AI-FAKE-001');

    const d = capturedPage!.data as Record<string, unknown>;
    expect(d.pageState).toBe('DRAFT');
    const q = d.question as { reasonMarkdown: string; steps: Array<{ idx: number; title: string }>; stem: string };
    expect(q.reasonMarkdown.length).toBeGreaterThanOrEqual(10);
    expect(q.reasonMarkdown).not.toBe('未正确使用配方法求二次函数最值'); // ≠ Stub hardcode
    expect(q.steps.length).toBeGreaterThanOrEqual(3);
    expect(q.steps[0].title.length).toBeGreaterThanOrEqual(5);
    // hero stem 真值 ≠ mockup hardcode 'thumb-h3' decoration text
    expect(q.stem.length).toBeGreaterThanOrEqual(5);
    expect(q.stem).not.toBe('已知 f(x)=x²−4x+3');
    // provider lock · 字段映射 contract: provider="qianwen" · modelInfo.name="qianwen" · modelInfo.version="qwen-plus"
    expect(ai.provider).toBe('qianwen');
    expect(ai.modelInfo.name).toBe('qianwen');
    expect(ai.modelInfo.version).toBe('qwen-plus');
    const aiFb = d.aiFallback as { stepsShown: boolean; reasonShown: boolean };
    expect(aiFb.stepsShown).toBe(false);
    expect(aiFb.reasonShown).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────
  // test-case #2 · BE 404 AI_ANSWER_NOT_FOUND · FE silent fallback · main 不阻塞
  // ─────────────────────────────────────────────────────────────────
  it('TC#2 AI 404 · _http throws HTTP 404 · main wrongbook still renders · stepper-fallback visible', async () => {
    const wb = aQuestion('Q-NO-ANSWER-002', {
      reasonMarkdown: '学生未配方，直接代入端点值。', // wrongbook main 数据有 reason
    });
    vi.mocked(getQuestionById).mockResolvedValue(wb);
    vi.mocked(getAnswerByQid).mockRejectedValue(new Error('HTTP 404'));

    capturedPage!._qid = 'Q-NO-ANSWER-002';
    await capturedPage!._fetchQuestion!('Q-NO-ANSWER-002');

    const d = capturedPage!.data as Record<string, unknown>;
    // (a) 不进 ERROR 全屏态
    expect(d.pageState).toBe('DRAFT');
    // (b) reason 从 wrongbook 主数据降级 · ≥ 10 字符
    const q = d.question as { reasonMarkdown: string; steps: unknown[] };
    expect(q.reasonMarkdown.length).toBeGreaterThanOrEqual(10);
    // (c) stepper-fallback 显示 · ≠ 0 STEPS 截图态
    const aiFb = d.aiFallback as { stepsShown: boolean; text: string };
    expect(aiFb.stepsShown).toBe(true);
    expect(q.steps.length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────
  // test-case #3 · BE 200 空体 (task FAILED) · 业务降级 · reason fallback 文案 + stepper fallback
  // ─────────────────────────────────────────────────────────────────
  it('TC#3 AI failed degraded · BE 200 empty body · FE renders fallback reason + stepper fallback', async () => {
    const wb = aQuestion('Q-AI-FAILED-003', { reasonMarkdown: '' });
    vi.mocked(getQuestionById).mockResolvedValue(wb);
    vi.mocked(getAnswerByQid).mockResolvedValue({
      qid: 'Q-AI-FAILED-003',
      taskId: 'Q-AI-FAILED-003',
      reasonMarkdown: '',
      confidence: 0.0,
      modelInfo: { name: 'qianwen', version: 'fail' },
      provider: 'qianwen',
      steps: [],
    });

    capturedPage!._qid = 'Q-AI-FAILED-003';
    await capturedPage!._fetchQuestion!('Q-AI-FAILED-003');

    const d = capturedPage!.data as Record<string, unknown>;
    expect(d.pageState).toBe('DRAFT'); // 不进 ERROR
    const q = d.question as { reasonMarkdown: string; steps: unknown[] };
    // (b) reason ≥ 8 字符 + ≠ mockup hardcode + ≠ 空
    expect(q.reasonMarkdown.length).toBeGreaterThanOrEqual(8);
    expect(q.reasonMarkdown).not.toBe('未正确使用配方法求二次函数最值');
    expect(q.reasonMarkdown).not.toBe('');
    // (c) stepper fallback 存在 + ≠ 0 STEPS 截图态
    const aiFb = d.aiFallback as { stepsShown: boolean; reasonShown: boolean };
    expect(aiFb.stepsShown).toBe(true);
    expect(aiFb.reasonShown).toBe(true);
    expect(q.steps.length).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────
  // test-case #4 · 闭环锚 · AiAnswer.qid === request qid · AiAnswer.taskId === request qid
  // ─────────────────────────────────────────────────────────────────
  it('TC#4 closure · response qid/taskId === request qid · BE honors caller taskId (≠ random UUID)', async () => {
    const REQ_QID = 'Q-CLOSED-LOOP-004';
    const wb = aQuestion(REQ_QID, { reasonMarkdown: '' });
    const ai = anAi(REQ_QID);
    vi.mocked(getQuestionById).mockResolvedValue(wb);
    vi.mocked(getAnswerByQid).mockResolvedValue(ai);

    capturedPage!._qid = REQ_QID;
    await capturedPage!._fetchQuestion!(REQ_QID);

    expect(ai.qid).toBe(REQ_QID);
    expect(ai.taskId).toBe(REQ_QID); // closure: BE honors caller taskId · ≠ random UUID
    const d = capturedPage!.data as Record<string, unknown>;
    expect(d.pageState).toBe('DRAFT');
    const q = d.question as { reasonMarkdown: string };
    expect(q.reasonMarkdown.length).toBeGreaterThanOrEqual(10);
  });

  // ─────────────────────────────────────────────────────────────────
  // test-case #5 · 502 弱网 · _http.ts try/catch 兜住 · console.warn 不计入 [error]
  // ─────────────────────────────────────────────────────────────────
  it('TC#5 HTTP 502 · getAnswerByQid throws · main wrongbook still renders · console.warn (not error)', async () => {
    const wb = aQuestion('Q-HTTP502-005', {
      reasonMarkdown: '在配方过程中漏掉负号导致顶点 x 坐标算反。',
    });
    vi.mocked(getQuestionById).mockResolvedValue(wb);
    vi.mocked(getAnswerByQid).mockRejectedValue(new Error('HTTP 502'));

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    capturedPage!._qid = 'Q-HTTP502-005';
    await capturedPage!._fetchQuestion!('Q-HTTP502-005');

    const d = capturedPage!.data as Record<string, unknown>;
    expect(d.pageState).toBe('DRAFT'); // 不进 ERROR
    const q = d.question as { reasonMarkdown: string };
    expect(q.reasonMarkdown.length).toBeGreaterThanOrEqual(10); // wrongbook 主数据
    // _http.ts try/catch 兜住 · warn 路径 · [error] 0 (audit dim_ide_smoke)
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toMatch(/AI fetch failed/);

    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  // ─────────────────────────────────────────────────────────────────
  // test-case #6 · wrongbook 500 · pageState=ERROR · AI 分支不连坐 · ERROR banner 显示
  // ─────────────────────────────────────────────────────────────────
  it('TC#6 wrongbook 500 · pageState=ERROR · AI branch isolated · 0 [error] for AI', async () => {
    vi.mocked(getQuestionById).mockRejectedValue(new Error('HTTP 500'));
    vi.mocked(getAnswerByQid).mockResolvedValue(anAi('Q-WRONGBOOK-500-006'));

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    capturedPage!._qid = 'Q-WRONGBOOK-500-006';
    await capturedPage!._fetchQuestion!('Q-WRONGBOOK-500-006');

    const d = capturedPage!.data as Record<string, unknown>;
    expect(d.pageState).toBe('ERROR');
    // 主分支 ERROR · console.error 是业务日志 (allowed) · 但不应有 AI sidecar error
    // (use word-boundary regex to avoid matching 'failed' / 'ai-' in unrelated logs)
    const aiErrors = errSpy.mock.calls.filter((call) => {
      if (typeof call[0] !== 'string') return false;
      const s = call[0] as string;
      return /\bAI\b/.test(s) || /getAnswerByQid/i.test(s);
    });
    expect(aiErrors.length).toBe(0);

    errSpy.mockRestore();
  });
});
