// P03 AI 分析中 · 1:1 mirror design/mockups/wrongbook/03_analyzing.html
// trace: H5 sibling → frontend/apps/h5/src/pages/Analyzing/index.tsx
// State machine: init → analyzing → success | error
// API: src/api/ai.ts (startAnalyze + pollAnalyzeStatus via httpJSON · apiBase('ai'))
// Guest mode (spec P-GUEST-CAPTURE.spec.md line 215): src/api/anon.ts (getResult)

import { startAnalyze, pollAnalyzeStatus } from '../../src/api/ai';
import type { PollAnalyzeStatusResponse } from '../../src/api/ai';
import { getResult as getAnonResult } from '../../src/api/anon';

type StepState = 'wait' | 'now' | 'done' | 'fail';
type PageState = 'init' | 'analyzing' | 'success' | 'error';

interface StepData {
  step: number;
  label: string;
  desc: string;
  state: StepState;
  duration: string;
}

const STEP_LABELS: Record<number, string> = {
  1: 'OCR 识别题干',
  2: '学科 / 知识点判断',
  3: '错因分析中…',
  4: '生成解答步骤',
};

// 红框预览卡的动态标题 · 按 currentStep 滚 · 替代硬编码 "第 17 题 · 顶点与对称轴"
const PREVIEW_TITLE_BY_STEP: Record<number, string> = {
  1: 'OCR 识别题干中…',
  2: '判断学科与知识点…',
  3: '诊断错因中…',
  4: '生成解答步骤…',
};

function formatTimeChip(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd} ${hh}:${mi}`;
}

// Step descs · "done" is a function so we can substitute real BE values (stem length /
// subject / model name) once the poll response lands. The old hard-coded mockup strings
// ("已提取 132 字符，置信度 99.4%" / "数学 · 二次函数 · 顶点式 · Bloom: APPLY") were obvious
// fake content surfaced to the user — see screenshot 2026-05-16 16:13.
interface StepFacts {
  stemLength?: number;
  subjectLabel?: string;
  ocrModel?: string;
}

const SUBJECT_LABELS: Record<string, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  english: '英语',
  chinese: '语文',
};

const STEP_DESCS: Record<number, { wait: string; now: string; done: (f: StepFacts) => string }> = {
  1: {
    wait: '等待中',
    now: '正在预处理图像…',
    done: (f) => (typeof f.stemLength === 'number' && f.stemLength > 0
      ? `已提取 ${f.stemLength} 字符`
      : '题干提取完成'),
  },
  2: {
    wait: '等待中',
    now: '正在识别题干文本…',
    done: (f) => {
      const subj = f.subjectLabel || '';
      const model = f.ocrModel || '';
      if (subj && model) return `${subj} · ${model}`;
      return subj || model || '识别完成';
    },
  },
  3: {
    wait: '将输出 JSON Schema · 含公式 LaTeX',
    now: '正在比对学生作答与正确解法的差异',
    done: () => '错因诊断完成',
  },
  4: {
    wait: '将输出 JSON Schema · 含公式 LaTeX',
    now: '正在生成解答步骤…',
    done: () => '解答生成完成',
  },
};

// STREAM_PLACEHOLDER 已删 · 配套 wxml/wxss 的 .stream SSE 终端卡 已删除 ·
// 原 placeholder 永远显示假 "顶点 (2,−1) 配方" 数据 · 跟 P04 旧 mockup 同根 ·
// 改成 .afterview "完成后将看到" 引导卡 · 不再需要 stream 文本

function buildSteps(currentStep: number, pageState: PageState, facts: StepFacts = {}): StepData[] {
  return [1, 2, 3, 4].map((n) => {
    let state: StepState = 'wait';
    if (pageState === 'error' && n <= currentStep) {
      state = n === currentStep ? 'fail' : 'done';
    } else if (n < currentStep) {
      state = 'done';
    } else if (n === currentStep && pageState === 'analyzing') {
      state = 'now';
    }
    let desc: string;
    if (state === 'fail') {
      desc = '失败';
    } else if (state === 'done') {
      desc = STEP_DESCS[n].done(facts);
    } else if (state === 'now') {
      desc = STEP_DESCS[n].now;
    } else {
      desc = STEP_DESCS[n].wait;
    }
    return {
      step: n,
      label: STEP_LABELS[n],
      desc,
      state,
      duration: state === 'done' ? `${(Math.random() * 1.5 + 0.4).toFixed(1)}s` : '',
    };
  });
}

Page({
  data: {
    pageState: 'init' as PageState,
    statusText: '准备分析…',
    doneCount: 0,
    currentModel: 'qwen-vl-max',
    backupModel: 'gpt-4o-mini',
    subjectLabel: '数学',
    showBanner: false,
    errorMsg: '',
    steps: buildSteps(0, 'init'),
    taskId: '',
    // 红框预览卡 · 用户视角 "OCR 还没跑就显示题号 17" 反 bug ·
    // 这些字段按 pageState/currentStep 动态滚 · 不再写死 mockup 文案
    previewTitle: '准备分析…',
    previewSubtitle: '正在上传图像 · 等待 AI 模型响应',
    timeChip: '',
  },

  _pollTimer: 0 as unknown as number,
  _pollCount: 0,

  /** qid received from capture page (P02) for result page transition */
  _qid: '',

  onLoad(options: Record<string, string | undefined>) {
    const subject = options.subject || 'math';
    const subjectLabel = SUBJECT_LABELS[subject] || subject;
    this.setData({ subjectLabel, timeChip: formatTimeChip(new Date()) });

    // ── 游客态分支 (spec line 215 · /analyzing/{anonQid}?guest=1) ──
    if (options.guest === '1') {
      const anonQid = options.anonQid || '';
      const anonToken = options.anonToken ? decodeURIComponent(options.anonToken) : '';
      if (!anonQid || !anonToken) {
        this.setData({
          pageState: 'error',
          statusText: '参数缺失',
          errorMsg: '游客分析会话参数不全, 请回上一页重试',
          showBanner: true,
          steps: buildSteps(1, 'error'),
        });
        return;
      }
      this._qid = anonQid;
      this._isGuest = true;
      this._anonToken = anonToken;
      this._startGuestFlow(anonQid, anonToken, subject);
      return;
    }

    // ── 登录态原逻辑 (维持不变) ──
    // capture page does encodeURIComponent(presignResp.image_url) before navigateTo so
    // the embedded MinIO `?X-Amz-...&sig=...` doesn't collide with the route's own
    // query string. WeChat's options parser does NOT auto-decode here, so we get the
    // %3A%2F%2F-laden literal back and have to undo it once. Without this the BE sees
    // a malformed URL → DashScope returns "URL does not appear to be valid" → OCR fails.
    const rawImageUrl = options.imageUrl || '';
    const imageUrl = rawImageUrl ? decodeURIComponent(rawImageUrl) : '';
    this._qid = options.qid || '';

    if (imageUrl) {
      this._startAnalysis(imageUrl, subject);
    } else {
      // Demo mode: simulate analyzing state
      this.setData({
        pageState: 'analyzing',
        statusText: 'AI 正在分析…',
        steps: buildSteps(3, 'analyzing'),
        doneCount: 2,
        previewTitle: PREVIEW_TITLE_BY_STEP[3],
        previewSubtitle: '正在与 AI 模型通信中',
      });
    }
  },

  // ── Guest 态实例字段 ──
  _isGuest: false,
  _anonToken: '' as string,
  _guestFakeStepTimer: 0 as ReturnType<typeof setInterval> | 0,
  _guestPollTimer: 0 as ReturnType<typeof setInterval> | 0,
  _guestPollStart: 0,

  /**
   * 游客态分析流程 (spec line 215 · biz §F04).
   * - 假装 4 步动画 (前端定时器 · 每 1.5s 推进 1 步) · UX 与登录态一致
   * - 真后端 polling anon-service /api/anon/result/{qid} (1Hz · 30s 上限)
   * - DONE → navigateTo /pages/result/index?guest=1&qid=...
   * - FAILED / timeout → 显错误条
   */
  _startGuestFlow(anonQid: string, anonToken: string, subject: string) {
    this.setData({
      pageState: 'analyzing',
      statusText: 'AI 正在分析…',
      steps: buildSteps(1, 'analyzing'),
      doneCount: 0,
      previewTitle: PREVIEW_TITLE_BY_STEP[1],
      previewSubtitle: '正在与 AI 模型通信中',
    });

    // 假步动画 · 每 1.5s 推一步, 上限到 step 4 hold 住
    let fakeStep = 1;
    this._guestFakeStepTimer = setInterval(() => {
      if (fakeStep >= 4) return;
      fakeStep++;
      const previewTitle = PREVIEW_TITLE_BY_STEP[fakeStep] || 'AI 分析中…';
      this.setData({
        steps: buildSteps(fakeStep, 'analyzing'),
        doneCount: Math.max(0, fakeStep - 1),
        previewTitle,
      });
    }, 1500);

    // 真 polling · 1Hz, 30s 上限
    this._guestPollStart = Date.now();
    this._guestPollTimer = setInterval(async () => {
      const elapsed = Math.floor((Date.now() - this._guestPollStart) / 1000);
      if (elapsed > 30) {
        this._clearGuestTimers();
        this.setData({
          pageState: 'error',
          statusText: 'AI 分析超时',
          errorMsg: '分析超时（30s），请重试',
          showBanner: true,
          steps: buildSteps(fakeStep, 'error'),
        });
        return;
      }
      try {
        const r = await getAnonResult(anonToken, Number(anonQid));
        if (r.status === 'READY' || r.status === 'DONE') {
          this._clearGuestTimers();
          // 推到 step 4 完成态 + 短停顿后跳 P04
          this.setData({
            pageState: 'success',
            statusText: 'AI 分析完成',
            doneCount: 4,
            steps: buildSteps(5, 'analyzing'),
            previewTitle: r.result?.stem
              ? (r.result.stem.length > 20 ? r.result.stem.slice(0, 20) + '…' : r.result.stem)
              : 'AI 分析完成',
            previewSubtitle: `${SUBJECT_LABELS[subject] || subject} · ${r.result?.ocr_model || ''}`,
          });
          setTimeout(() => {
            wx.navigateTo({
              url: `/pages/result/index?guest=1`
                + `&qid=${anonQid}`
                + `&anonToken=${encodeURIComponent(anonToken)}`
                + `&subject=${subject}`,
            });
          }, 300);
        } else if (r.status === 'FAILED') {
          this._clearGuestTimers();
          this.setData({
            pageState: 'error',
            statusText: 'AI 分析失败',
            errorMsg: r.error_code || 'AI 暂时帮不上忙，请稍后重试',
            showBanner: true,
            steps: buildSteps(fakeStep, 'error'),
          });
        }
        // ANALYZING · 不动 · 假步动画继续
      } catch (e) {
        // 单次轮询失败不立即终结 · 等下一轮 · timeout 兜底
        console.warn('[P03 guest] poll error · will retry', e);
      }
    }, 1000);
  },

  _clearGuestTimers() {
    if (this._guestFakeStepTimer) {
      clearInterval(this._guestFakeStepTimer);
      this._guestFakeStepTimer = 0;
    }
    if (this._guestPollTimer) {
      clearInterval(this._guestPollTimer);
      this._guestPollTimer = 0;
    }
  },

  onUnload() {
    this._clearPoll();
    this._clearGuestTimers();
  },

  async _startAnalysis(imageUrl: string, subject: string) {
    try {
      this.setData({
        pageState: 'analyzing',
        statusText: 'AI 正在分析…',
        steps: buildSteps(1, 'analyzing'),
        doneCount: 0,
        previewTitle: PREVIEW_TITLE_BY_STEP[1],
        previewSubtitle: '正在与 AI 模型通信中',
      });
      // SC01-MP-BUG-AI-FAKE in_scope #6: pass qid as taskId so BE persists
      // analysis_result.task_id == qid (closure anchor · GET /api/ai/{qid}/answer
      // on P04 can find a row).
      const resp = await startAnalyze({
        imageUrl,
        subject,
        taskId: this._qid || undefined,
      });
      // Guard: backend must hand back a non-empty task id. Setting an undefined
      // data field triggers a WX warning AND would seed the poller with
      // `tasks/undefined/status` — surface this as an error instead.
      if (!resp.taskId) {
        throw new Error('startAnalyze: backend returned empty taskId');
      }
      this.setData({ taskId: resp.taskId });
      this._startPolling(resp.taskId);
    } catch {
      this.setData({
        pageState: 'error',
        statusText: 'AI 分析失败',
        errorMsg: '网络异常，请重试',
        showBanner: true,
        steps: buildSteps(1, 'error'),
      });
    }
  },

  _startPolling(taskId: string) {
    this._pollCount = 0;
    this._pollTimer = setInterval(() => {
      this._pollOnce(taskId);
    }, 2000) as unknown as number;
  },

  async _pollOnce(taskId: string) {
    this._pollCount++;
    if (this._pollCount > 60) {
      this._clearPoll();
      this.setData({
        pageState: 'error',
        statusText: 'AI 分析超时',
        errorMsg: '分析超时，请重试',
        showBanner: true,
        steps: buildSteps(this.data.doneCount + 1, 'error'),
      });
      return;
    }

    try {
      const resp: PollAnalyzeStatusResponse = await pollAnalyzeStatus(taskId);
      const step = resp.currentStep || 1;
      const doneCount = Math.max(0, step - 1);

      if (resp.status === 'SUCCEEDED') {
        this._clearPoll();
        // Real-value facts from BE poll response (subject defaults to whatever the user
        // picked on P02; ocrModel is wire-time from QianwenAiProvider config).
        const facts: StepFacts = {
          stemLength: resp.stemLength,
          subjectLabel: SUBJECT_LABELS[resp.subject || ''] || this.data.subjectLabel,
          ocrModel: resp.ocrModel || this.data.currentModel,
        };
        // 真分析结果到手 · 用 OCR 出的 stem 当预览标题 (前 20 字截断) ·
        // 仍空时 fallback "已识别 N 字符" · 给用户一瞬间真实反馈 再跳 P04
        const resultObj = (resp.result ?? {}) as Record<string, unknown>;
        const realStem = typeof resultObj.stem === 'string' ? resultObj.stem.trim() : '';
        const previewTitle = realStem
          ? (realStem.length > 20 ? realStem.slice(0, 20) + '…' : realStem)
          : (resp.stemLength ? `已识别 ${resp.stemLength} 字符` : 'AI 分析完成');
        const previewSubtitle = `${facts.subjectLabel} · ${facts.ocrModel} · ${resp.stemLength ?? 0} 字符`;
        this.setData({
          pageState: 'success',
          statusText: 'AI 分析完成',
          doneCount: 4,
          steps: buildSteps(5, 'analyzing', facts),
          // streamOutput 已删 · 配套 .stream SSE 终端卡已替换成 .afterview 引导卡
          previewTitle,
          previewSubtitle,
        });
        // Transition P03→P04: navigate to result page after brief delay
        const qid = this._qid || this.data.taskId;
        if (qid) {
          setTimeout(() => {
            wx.navigateTo({ url: `/pages/result/index?qid=${qid}` });
          }, 300);
        }
      } else if (resp.status === 'FAILED') {
        this._clearPoll();
        this.setData({
          pageState: 'error',
          statusText: 'AI 分析失败',
          errorMsg: resp.error || 'AI 暂时帮不上忙，请稍后重试',
          showBanner: true,
          steps: buildSteps(step, 'error'),
          doneCount,
        });
      } else {
        // 分析进行中 · 红框预览卡按 currentStep 滚动文案 · 真实进度反馈
        const previewTitle = PREVIEW_TITLE_BY_STEP[step] || 'AI 分析中…';
        const previewSubtitle = step >= 2 && resp.stemLength
          ? `${this.data.subjectLabel} · 已识别 ${resp.stemLength} 字符`
          : '正在与 AI 模型通信中';
        this.setData({
          doneCount,
          steps: buildSteps(step, 'analyzing'),
          previewTitle,
          previewSubtitle,
        });
      }
    } catch {
      // network blip — keep polling
    }
  },

  _clearPoll() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = 0 as unknown as number;
    }
  },

  onBackTap() {
    this._clearPoll();
    wx.navigateBack();
  },

  onCancelTap() {
    this._clearPoll();
    wx.navigateBack();
  },

  // ── Bottom tabbar handlers ────────────────────────────────────
  // P03 is a mid-flow page reached via wx.navigateTo, so the system tabBar
  // (configured in app.json) doesn't render. The custom tabbar in the wxml
  // gives the page the visual continuity of having one — but until this fix
  // the icons had no bindtap, so tapping anywhere did nothing. Use switchTab
  // which jumps to the tabBar page and resets the navigation stack.
  onTabHome() {
    this._clearPoll();
    wx.switchTab({ url: '/pages/home/index' });
  },
  onTabWrongbook() {
    this._clearPoll();
    wx.switchTab({ url: '/pages/wrongbook-list/index' });
  },
  onTabCapture() {
    // Already on the capture→analyze flow · go back to capture page.
    this._clearPoll();
    wx.switchTab({ url: '/pages/capture/index' });
  },
  onTabReview() {
    this._clearPoll();
    wx.switchTab({ url: '/pages/review-today/index' });
  },
  onTabMe() {
    this._clearPoll();
    wx.switchTab({ url: '/pages/me/index' });
  },
});
