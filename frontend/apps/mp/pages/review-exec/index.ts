// P08 复习执行 · 1:1 mirror of design/mockups/wrongbook/08_review_exec.html
// trace: design/mockups/wrongbook/08_review_exec.html · @longfeng/testids p08
// 状态机: READING → ANSWERING → REVEALED → GRADED (mirrors H5 ReviewExec)
// API: src/api/review.ts · getNode + revealNode + gradeNode · 真 API · 0 mock

import { TEST_IDS, p08Ids } from '@longfeng/testids';
import { getNode, revealNode, gradeNode } from '../../src/api/review';
import { getQuestionById } from '../../src/api/wrongbook';

// BE wrong_item.subject 是 enum 小写串 (math/physics/...) · 渲染要中文标签
const SUBJECT_LABEL_MAP: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学', english: '英语', chinese: '语文',
};

// ─── Types ──────────────────────────────────────────────────────
type ExecState = 'READING' | 'ANSWERING' | 'REVEALED' | 'GRADED';
type GradeValue = 'FORGOT' | 'PARTIAL' | 'MASTERED';
type AnswerMode = 'handwrite' | 'keyboard' | 'formula';

// spec §3 答题区 3 mode tab · 公式面板常用符号集 (高中数学覆盖度优先)
const FORMULA_SYMBOLS = [
  'x²', 'x³', '√', '÷', '×', '±',
  '≤', '≥', '≠', 'π', '°', '∞',
];

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
  _sid: '' as string,        // P07 createSession 透传 · 用于 P09 onGradeTap 真 sid
  _nid: '' as string,        // 单题深链 / 推送进入时直接给 nid
  data: {
    // test ids
    testIds: TEST_IDS.p08,
    p08Ids: null as unknown,

    // state machine
    execState: 'READING' as ExecState,
    isRevealing: false,
    isGrading: false,
    showExitSheet: false,

    // spec §4.1 answerDraft · 3 mode tab (handwrite/keyboard/formula)
    answerMode: 'handwrite' as AnswerMode,
    userAnswer: '',                          // keyboard / formula 累积输入
    formulaSymbols: FORMULA_SYMBOLS,

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

  onLoad(options: Record<string, string | undefined>) {
    this._openedAt = Date.now();
    // P07 全部开始 (createSession) 透传 sid · P09 onGradeTap 要用
    this._sid = options.sid ?? '';
    // 单题深链 (P07 item tap 或 P02 推送) 直传 nid · 跳过 first nid 探测
    this._nid = options.nid ?? '';

    // Build step testIds (兜底 mock 渲染下 · 真数据回来时 _fetchNodeAndQuestion 再 rebuild)
    const steps = this.data.steps.map((s, i) => ({
      ...s,
      testId: p08Ids.revealStep(i + 1),
    }));
    this.setData({ steps, nodeDots: this._buildNodeDots(this.data.node.nodeIndex) });

    // 真 nid 透传 → 拉 BE 数据 (节点 + 题目). 没 nid (直接打开 P08 dev 路径) 保留 mock.
    // 用户反馈: 点 P07 任意题进 P08, 都显示 "二次函数 f(x)=x²−4x+3" mock · 跟实际拍的题无关.
    // spec §4.1 要求 question.stem/subject/kpName/difficulty/answer/steps 全来自 BE.
    if (this._nid) {
      this._fetchNodeAndQuestion(this._nid);
    }
  },

  _buildNodeDots(currentNodeIndex: number) {
    return Array.from({ length: 7 }, (_, idx) => {
      const isPast = idx < currentNodeIndex;
      const isCurrent = idx === currentNodeIndex;
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
  },

  // 拉真 node + question · 替换 MOCK_QUESTION/MOCK_NODE.
  // 失败时保留 mock (UI 不崩) · console.error · spec §9 降级.
  async _fetchNodeAndQuestion(nid: string) {
    try {
      const node = await getNode(nid);
      const qid = String(node.wrongItemId);
      const resp = await getQuestionById(qid);
      const q = resp.question;

      // BE knowledgePoints[] → 拼 1-3 个 KP 名作为 kpName 字符串
      const kpName = q.knowledgePoints && q.knowledgePoints.length > 0
        ? q.knowledgePoints.slice(0, 3).map((k) => k.name).join(' · ')
        : '';
      const subjectKey = (q.subject ?? '').toLowerCase();
      const subjectLabel = SUBJECT_LABEL_MAP[subjectKey] || (q.subject || '数学');
      const difficulty = typeof q.difficulty === 'number' && q.difficulty > 0 ? q.difficulty : 3;

      // BE QuestionDetail.steps 是 {step, explain, ...} 对象数组 · 取 explain 文本
      const stepTexts: string[] = (q.steps ?? []).map((s) => {
        const obj = s as unknown as { explain?: string; title?: string };
        return obj.explain || obj.title || '';
      }).filter((t) => t.length > 0);

      const newQuestion: QuestionData = {
        qid,
        stem: q.stem || '题干暂未识别 · 等 AI OCR 完成后重新进入',
        subject: subjectLabel,
        kpName,
        difficulty,
        answer: q.correctAnswer || 'AI 暂未给出答案 · 见下方解答步骤',
        steps: stepTexts.length > 0 ? stepTexts : ['AI 暂未生成解答步骤'],
      };
      const newNode: NodeData = {
        nid: String(node.id),
        nodeIndex: node.nodeIndex ?? 0,
        tLevel: `T${node.nodeIndex ?? 0}`,
        easeFactor: typeof node.easeFactor === 'number' ? node.easeFactor : 2.5,
      };

      const steps = newQuestion.steps.map((text, i) => ({
        text, num: i + 1, testId: p08Ids.revealStep(i + 1),
      }));
      this.setData({
        question: newQuestion,
        node: newNode,
        difficultyLabel: DIFFICULTY_MAP[difficulty] || '中等',
        starsLabel: STARS_MAP[difficulty] || '★★★☆☆',
        steps,
        nodeDots: this._buildNodeDots(newNode.nodeIndex),
        nodeLabel: `${newNode.tLevel} · 复习节点`,
      });
    } catch (err) {
      console.error('[P08] _fetchNodeAndQuestion failed · 保留 mock 兜底:', err);
    }
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

  // ── Answer mode tabs (spec §3 AnswerArea 3-mode) ──────────
  // 切换答题输入方式 · 不直接进入 ANSWERING (要真敲键盘 / 点公式 / 触摸 canvas 才进)
  onToolTap(e: WechatMiniprogram.TouchEvent) {
    const mode = e.currentTarget.dataset.mode as AnswerMode;
    if (!mode || mode === this.data.answerMode) return;
    try { wx.vibrateShort({ type: 'light' }); } catch { /* noop */ }
    this.setData({ answerMode: mode });
  },

  // keyboard mode · <textarea> input
  onKeyboardInput(e: WechatMiniprogram.Input) {
    const v = (e.detail.value ?? '') as string;
    const patch: Record<string, unknown> = { userAnswer: v };
    if (this.data.execState === 'READING' && v.length > 0) {
      patch.execState = 'ANSWERING' as ExecState;
      patch.isAnswering = true;
    }
    this.setData(patch);
  },

  // formula mode · 点符号插入 userAnswer
  onFormulaInsert(e: WechatMiniprogram.TouchEvent) {
    const sym = e.currentTarget.dataset.sym as string;
    if (!sym) return;
    try { wx.vibrateShort({ type: 'light' }); } catch { /* noop */ }
    const next = (this.data.userAnswer ?? '') + sym;
    const patch: Record<string, unknown> = { userAnswer: next };
    if (this.data.execState === 'READING') {
      patch.execState = 'ANSWERING' as ExecState;
      patch.isAnswering = true;
    }
    this.setData(patch);
  },

  // formula mode · 退格
  onFormulaBackspace() {
    const cur = this.data.userAnswer ?? '';
    if (cur.length === 0) return;
    try { wx.vibrateShort({ type: 'light' }); } catch { /* noop */ }
    // 注意 · 部分符号 (x² 等) 是 2 char · Array.from 按字素切
    const arr = Array.from(cur);
    arr.pop();
    this.setData({ userAnswer: arr.join('') });
  },

  // formula mode · 清空
  onFormulaClear() {
    if ((this.data.userAnswer ?? '').length === 0) return;
    try { wx.vibrateShort({ type: 'light' }); } catch { /* noop */ }
    this.setData({ userAnswer: '' });
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

    // T12: GRADED → P09 transition (mirrors H5 ReviewExec handleGrade)
    // sid 优先来自 P07 onLoad 透传 · 没有时 fallback mock 以兼容直接打开 P08 的 dev 路径
    const sid = this._sid || 'mock-sid-001';
    const nid = this._nid || this.data.node.nid;
    wx.navigateTo({
      url: `/pages/review-done/index?sid=${encodeURIComponent(sid)}&grade=${grade}&nodeId=${encodeURIComponent(nid)}`,
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
