// P03 AI 分析中 · 1:1 mirror design/mockups/wrongbook/03_analyzing.html
// trace: H5 sibling → frontend/apps/h5/src/pages/Analyzing/index.tsx
// State machine: init → analyzing → success | error
// API: src/api/ai.ts (startAnalyze + pollAnalyzeStatus via httpJSON · apiBase('ai'))

import { startAnalyze, pollAnalyzeStatus } from '../../src/api/ai';
import type { PollAnalyzeStatusResponse } from '../../src/api/ai';

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

const STEP_DESCS: Record<number, { wait: string; now: string; done: string }> = {
  1: { wait: '等待中', now: '正在预处理图像…', done: '已提取 132 字符，置信度 99.4%' },
  2: { wait: '等待中', now: '正在识别题干文本…', done: '数学 · 二次函数 · 顶点式 · Bloom: APPLY' },
  3: { wait: '将输出 JSON Schema · 含公式 LaTeX', now: '正在比对学生作答与正确解法的差异', done: '错因诊断完成' },
  4: { wait: '将输出 JSON Schema · 含公式 LaTeX', now: '正在生成解答步骤…', done: '解答生成完成' },
};

const STREAM_PLACEHOLDER = `{
  "stem": "已知函数 f(x)=x²−4x+3，求其顶点坐标与对称轴方程。",
  "studentAnswer": "B. (2, −1)",
  "correctAnswer": "A. (1, −2)",
  "errorType": "CONCEPT",
  "errorReason": "对顶点式 (x−h)²+k 的 h, k 含义混淆",
  "solutionSteps": [
    { "step": 1, "explain": "配方：f(x)=(x−2)²−1" }█`;

function buildSteps(currentStep: number, pageState: PageState): StepData[] {
  return [1, 2, 3, 4].map((n) => {
    let state: StepState = 'wait';
    if (pageState === 'error' && n <= currentStep) {
      state = n === currentStep ? 'fail' : 'done';
    } else if (n < currentStep) {
      state = 'done';
    } else if (n === currentStep && pageState === 'analyzing') {
      state = 'now';
    }
    const descKey = state === 'fail' ? 'wait' : state;
    return {
      step: n,
      label: STEP_LABELS[n],
      desc: state === 'fail' ? '失败' : STEP_DESCS[n][descKey as 'wait' | 'now' | 'done'],
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
    streamOutput: STREAM_PLACEHOLDER,
    taskId: '',
  },

  _pollTimer: 0 as unknown as number,
  _pollCount: 0,

  onLoad(options: Record<string, string | undefined>) {
    const imageUrl = options.imageUrl || '';
    const subject = options.subject || '数学';
    this.setData({ subjectLabel: subject });

    if (imageUrl) {
      this._startAnalysis(imageUrl, subject);
    } else {
      // Demo mode: simulate analyzing state
      this.setData({
        pageState: 'analyzing',
        steps: buildSteps(3, 'analyzing'),
        doneCount: 2,
      });
    }
  },

  onUnload() {
    this._clearPoll();
  },

  async _startAnalysis(imageUrl: string, subject: string) {
    try {
      this.setData({ pageState: 'analyzing', steps: buildSteps(1, 'analyzing'), doneCount: 0 });
      const resp = await startAnalyze({ imageUrl, subject });
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
        this.setData({
          pageState: 'success',
          statusText: 'AI 分析完成',
          doneCount: 4,
          steps: buildSteps(5, 'analyzing'),
          streamOutput: resp.result ? JSON.stringify(resp.result, null, 2) : this.data.streamOutput,
        });
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
        this.setData({
          doneCount,
          steps: buildSteps(step, 'analyzing'),
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
});
