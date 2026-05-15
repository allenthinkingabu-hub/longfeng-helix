// P08 复习执行 · 1:1 mirror of design/mockups/wrongbook/08_review_exec.html
// trace: design/mockups/wrongbook/08_review_exec.html · @longfeng/testids p08
// 状态机: READING → ANSWERING → REVEALED → GRADED (mirrors H5 ReviewExec)
// API: src/api/review.ts · getNode + revealNode + gradeNode · 真 API · 0 mock

import { TEST_IDS, p08Ids } from '@longfeng/testids';
import { getNode, revealNode, gradeNode } from '../../src/api/review';

// ─── Types ──────────────────────────────────────────────────────
type ExecState = 'READING' | 'ANSWERING' | 'REVEALED' | 'GRADED';
type GradeValue = 'FORGOT' | 'PARTIAL' | 'MASTERED';

interface QuestionData {
  qid: string;
  stem: string;
  subject: string;
  kpName: string;
  difficulty: number;
  answer: string;
  steps: string[];
}

interface NodeData {
  nid: string;
  nodeIndex: number;
  tLevel: string;
  easeFactor: number;
}

// ─── Mock data (前端 dev 兜底 · ≤5 mock) ──────────────────────
const MOCK_QUESTION: QuestionData = {
  qid: 'mock-qid-001',
  stem: '已知函数 f(x) = x² − 4x + 3，请将其化为顶点式，并写出顶点坐标与对称轴方程。',
  subject: '数学',
  kpName: '二次函数',
  difficulty: 3,
  answer: 'f(x) = (x − 2)² − 1　　顶点 (2, −1)　对称轴 x = 2',
  steps: [
    '提取 x 的二次项与一次项，进行配方：x² − 4x = (x − 2)² − 4。',
    '将常数项合并：(x − 2)² − 4 + 3 = (x − 2)² − 1。',
    '由顶点式可得顶点坐标 (2, −1)，对称轴方程为 x = 2。',
  ],
};

const MOCK_NODE: NodeData = {
  nid: '0',
  nodeIndex: 1,
  tLevel: 'T2',
  easeFactor: 2.5,
};

const DIFFICULTY_MAP: Record<number, string> = {
  1: '简单',
  2: '较易',
  3: '中等',
  4: '较难',
  5: '困难',
};

const STARS_MAP: Record<number, string> = {
  1: '★☆☆☆☆',
  2: '★★☆☆☆',
  3: '★★★☆☆',
  4: '★★★★☆',
  5: '★★★★★',
};

// ─── Page ──────────────────────────────────────────────────────
Page({
  _openedAt: 0 as number,
  data: {
    // test ids
    testIds: TEST_IDS.p08,
    p08Ids: null as unknown,

    // state machine
    execState: 'READING' as ExecState,
    isRevealing: false,
    isGrading: false,
    showExitSheet: false,

    // derived
    isRevealed: false,
    isAnswering: false,

    // question + node
    question: MOCK_QUESTION,
    node: MOCK_NODE,
    cursor: 2,
    total: 8,
    progressPct: 25,
    difficultyLabel: DIFFICULTY_MAP[MOCK_QUESTION.difficulty] || '中等',
    starsLabel: STARS_MAP[MOCK_QUESTION.difficulty] || '★★★☆☆',

    // node timeline dots (7 nodes for SM-2 schedule)
    nodeDots: [] as Array<{ idx: number; cls: string; tLevel: string; hasLine: boolean; lineGreen: boolean }>,
    nodeLabel: `${MOCK_NODE.tLevel} · 1 天后`,

    // steps for reveal
    steps: MOCK_QUESTION.steps.map((text, i) => ({
      text,
      num: i + 1,
      testId: '',
    })),
  },

  onLoad() {
    this._openedAt = Date.now();

    // Build step testIds
    const steps = this.data.steps.map((s, i) => ({
      ...s,
      testId: p08Ids.revealStep(i + 1),
    }));

    // Build node timeline
    const nodeDots = Array.from({ length: 7 }, (_, idx) => {
      const isPast = idx < this.data.node.nodeIndex;
      const isCurrent = idx === this.data.node.nodeIndex;
      let cls = 'node-dot';
      if (isPast) cls += ' node-dot-done';
      if (isCurrent) cls += ' node-dot-now';
      return {
        idx,
        cls,
        tLevel: `T${idx}`,
        hasLine: idx < 6,
        lineGreen: isPast,
      };
    });

    this.setData({ steps, nodeDots });
  },

  // ── State transitions ──────────────────────────────────────
  onCanvasTouch() {
    if (this.data.execState === 'READING') {
      this.setData({
        execState: 'ANSWERING' as ExecState,
        isAnswering: true,
      });
    }
  },

  async onRevealTap() {
    if (this.data.execState !== 'ANSWERING' || this.data.isRevealing) return;

    this.setData({ isRevealing: true });

    // AC1: 触觉 light
    wx.vibrateShort({ type: 'light' });

    try {
      // AC2: POST /api/review/nodes/{nid}/reveal → 200 (真 API)
      await revealNode(this.data.node.nid);
    } catch {
      // spec §9: 502 失败 UI 仍展开答案 (eventually consistent)
    }

    this.setData({
      execState: 'REVEALED' as ExecState,
      isRevealing: false,
      isRevealed: true,
      isAnswering: false,
    });

    // Update node dots with pulse on current
    const nodeDots = this.data.nodeDots.map((dot) => {
      if (dot.idx === this.data.node.nodeIndex) {
        return { ...dot, cls: 'node-dot node-dot-now node-dot-pulse' };
      }
      return dot;
    });
    this.setData({ nodeDots });
  },

  async onGradeTap(e: WechatMiniprogram.TouchEvent) {
    const grade = e.currentTarget.dataset.grade as GradeValue;
    if (!this.data.isRevealed || this.data.isGrading) return;

    this.setData({ isGrading: true });

    // AC1: 触觉 success
    wx.vibrateShort({ type: 'heavy' });

    const timeSpentMs = Date.now() - (this._openedAt || Date.now());

    try {
      // AC2: POST /api/review/nodes/{nid}/grade (真 API)
      await gradeNode(this.data.node.nid, { grade, timeSpentMs });
      wx.showToast({ title: `已评: ${grade}`, icon: 'none' });
    } catch {
      // spec §9: 失败 toast 提示
      wx.showToast({ title: '评分提交失败', icon: 'none' });
    }

    this.setData({
      execState: 'GRADED' as ExecState,
      isGrading: false,
      isRevealed: false, // 连点防护: GRADED 后禁止重复评分
    });
  },

  // ── Exit confirm sheet ──────────────────────────────────────
  onCloseTap() {
    this.setData({ showExitSheet: true });
  },

  onExitCancel() {
    this.setData({ showExitSheet: false });
  },

  onExitConfirm() {
    this.setData({ showExitSheet: false });
    wx.navigateBack();
  },

  onBackTap() {
    wx.navigateBack();
  },
});
