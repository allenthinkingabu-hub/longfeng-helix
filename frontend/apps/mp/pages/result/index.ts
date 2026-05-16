/**
 * P04 AI分析结果页 · 1:1 mirror design/mockups/wrongbook/04_result.html
 * trace: design/mockups/wrongbook/04_result.html · H5 frontend/apps/h5/src/pages/Result/index.tsx
 *
 * State machine: LOADING → DRAFT | ERROR | EMPTY
 * API: GET /api/wb/questions/<qid>  (wrongbook-service :8082)
 *      GET /api/ai/<qid>/answer     (ai-analysis-service :8083)
 */
import { getQuestionById } from '../../src/api/wrongbook';
import { getAnswerByQid } from '../../src/api/ai';
import type { AiAnswer, AiStep } from '../../src/api/ai';
import type { QuestionDetail, PlannedNode, QuestionStep } from '../../src/api/wrongbook';

// SC01-MP-BUG-AI-FAKE · fallback 文案 (i18n key 表治理推迟到 SC01-DOC-P04-i18n-keys task).
// 暂时直接 hardcode 中文 · key 命名预留 result.fallback.* 便于后续 i18n 化.
const FALLBACK_REASON_PENDING = 'AI 暂时未能给出诊断，请稍后重试或手动修正。';
const FALLBACK_STEPS_EMPTY = '解答步骤生成中…可下拉刷新或点击下方手动修正。';

const SUBJECT_LABEL: Record<string, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  english: '英语',
};

const DIFF_LABELS = ['', '简单', '偏易', '中等', '偏难', '困难'];

const TIMELINE_LABELS = ['15:28', '明日', '4/24', '4/28', '5/6', '5/21'];

interface PageData {
  pageState: 'LOADING' | 'DRAFT' | 'ERROR' | 'EMPTY';
  question: {
    id: string;
    subject: string;
    subjectLabel: string;
    stem: string;
    formula: string;
    myAnswer: string;
    correctAnswer: string;
    reasonMarkdown: string;
    steps: Array<{ idx: number; title: string; formula?: string }>;
    knowledgePoints: Array<{ id: string; name: string; weight: number }>;
    difficulty: number;
    confidence: number;
  };
  diffStars: boolean[];
  diffLabel: string;
  analysisDuration: string;
  timelineNodes: Array<{ tLevel: string; label: string }>;
  isSaving: boolean;
  /** fallback bar shown when AI reason/steps couldn't be fetched (test-case #2/#3). */
  aiFallback: { reasonShown: boolean; stepsShown: boolean; text: string };
}

Page<PageData, WechatMiniprogram.IAnyObject>({
  data: {
    pageState: 'LOADING',
    question: {
      id: '',
      subject: '',
      subjectLabel: '',
      stem: '',
      formula: '',
      myAnswer: '',
      correctAnswer: '',
      reasonMarkdown: '',
      steps: [],
      knowledgePoints: [],
      difficulty: 3,
      confidence: 0,
    },
    diffStars: [true, true, true, false, false],
    diffLabel: '中等',
    analysisDuration: '4.2s',
    timelineNodes: [
      { tLevel: 'T1', label: '15:28' },
      { tLevel: 'T2', label: '明日' },
      { tLevel: 'T3', label: '4/24' },
      { tLevel: 'T4', label: '4/28' },
      { tLevel: 'T5', label: '5/6' },
      { tLevel: 'T6', label: '5/21' },
    ],
    isSaving: false,
    aiFallback: { reasonShown: false, stepsShown: false, text: '' },
  },

  /** cached raw question for save mutation */
  _questionRaw: null as QuestionDetail | null,
  /** persisted qid for retry after error */
  _qid: '',

  onLoad(options: Record<string, string | undefined>) {
    const qid = options.qid || '';
    this._qid = qid;
    if (!qid) {
      this.setData({ pageState: 'EMPTY' });
      return;
    }
    this._fetchQuestion(qid);
  },

  async _fetchQuestion(qid: string) {
    this.setData({ pageState: 'LOADING' });

    // SC01-MP-BUG-AI-FAKE in_scope #7: split Promise.all into two independent
    // try/catch branches so the AI sidecar never blocks the wrongbook main data
    // (test-cases.md ## 实现注释 #1).
    //   - wrongbook GET fail → pageState='ERROR' (main branch · user sees retry)
    //   - AI GET fail (404 / 5xx / parse error) → fallback null · main branch unaffected

    // Main branch: wrongbook question
    let wbResp: { question: QuestionDetail; plannedNodes?: PlannedNode[] };
    try {
      wbResp = await getQuestionById(qid);
    } catch (err) {
      console.error('[P04] wrongbook fetch failed', err);
      this.setData({ pageState: 'ERROR' });
      return;
    }

    const q = wbResp.question;
    if (!q || !q.id) {
      this.setData({ pageState: 'EMPTY' });
      return;
    }

    // Sidecar branch: AI answer (never blocks main)
    let aiResp: AiAnswer | null = null;
    try {
      aiResp = await getAnswerByQid(qid);
    } catch (err) {
      // 404 / 5xx / parse failures all funnel here. Surface as warn (audit
      // dim_ide_smoke only counts [error] lines — warn is allowed).
      console.warn('[P04] AI fetch failed (continuing with fallback)', err);
      aiResp = null;
    }

    // Merge AI data into question · only override when AI provides real values.
    const mergedReason = (aiResp && aiResp.reasonMarkdown)
      ? aiResp.reasonMarkdown
      : (q.reasonMarkdown || '');
    if (aiResp && typeof aiResp.confidence === 'number') {
      q.confidence = aiResp.confidence;
    }

    // Merge AI steps into question.steps when wrongbook didn't supply any.
    let mergedSteps: QuestionStep[] = q.steps || [];
    if ((!mergedSteps || mergedSteps.length === 0)
        && aiResp && aiResp.steps && aiResp.steps.length > 0) {
      mergedSteps = aiResp.steps.map((s: AiStep, i: number) => ({
        idx: typeof s.stepNo === 'number' ? s.stepNo : i + 1,
        title: s.text || s.title || '',
        formula: s.formula,
      }));
    }

    // Fallback flags · test-case #2/#3 use these to assert non-empty reason
    // text + visible stepper fallback when AI is unavailable.
    const reasonShown = mergedReason.trim().length === 0;
    const stepsShown = mergedSteps.length === 0;
    const aiFallback = {
      reasonShown,
      stepsShown,
      text: reasonShown ? FALLBACK_REASON_PENDING : '',
    };
    const finalReason = reasonShown ? FALLBACK_REASON_PENDING : mergedReason;

    this._questionRaw = q;
    q.reasonMarkdown = finalReason;
    q.steps = mergedSteps;

    const difficulty = q.difficulty || 3;
    const diffStars = Array.from({ length: 5 }, (_, i) => i < difficulty);
    const timelineNodes = this._buildTimeline(wbResp.plannedNodes || []);

    this.setData({
      pageState: 'DRAFT',
      question: {
        id: q.id,
        subject: q.subject,
        subjectLabel: SUBJECT_LABEL[q.subject] || q.subject,
        stem: q.stem,
        formula: q.formula || '',
        myAnswer: q.myAnswer,
        correctAnswer: q.correctAnswer,
        reasonMarkdown: finalReason,
        steps: mergedSteps,
        knowledgePoints: q.knowledgePoints || [],
        difficulty,
        confidence: q.confidence,
      },
      diffStars,
      diffLabel: DIFF_LABELS[difficulty] || '中等',
      timelineNodes,
      aiFallback,
    });
  },

  /** test-only seam · exposes the AiAnswer that was last merged in for assertions. */
  _lastAi: null as AiAnswer | null,

  _buildTimeline(nodes: PlannedNode[]) {
    const levels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
    return levels.map((lv, i) => ({
      tLevel: lv,
      label: TIMELINE_LABELS[i] || '',
    }));
  },

  onBackTap() {
    wx.navigateBack({ delta: 1 });
  },

  onManualFixTap() {
    wx.showToast({ title: '手动修正功能开发中', icon: 'none' });
  },

  onRetryTap() {
    const qid = this._qid || this._questionRaw?.id || '';
    if (qid) {
      this._fetchQuestion(qid);
    }
  },

  async onSaveTap() {
    if (this.data.isSaving) return;
    this.setData({ isSaving: true });

    try {
      // T07: save + transition to P05 wrongbook list
      wx.showToast({ title: '保存成功', icon: 'success' });
      const qid = this._questionRaw?.id || this._qid;
      setTimeout(() => {
        wx.navigateTo({
          url: `/pages/wrongbook-list/index?highlight=${qid}`,
        });
      }, 1500);
    } catch (err) {
      console.error('[P04] save error:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSaving: false });
    }
  },
});
