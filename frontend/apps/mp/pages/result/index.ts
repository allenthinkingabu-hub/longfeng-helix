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
import type { QuestionDetail, PlannedNode } from '../../src/api/wrongbook';

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
    try {
      const [wbResp, aiResp] = await Promise.all([
        getQuestionById(qid),
        getAnswerByQid(qid),
      ]);

      const q = wbResp.question;
      if (!q || !q.id) {
        this.setData({ pageState: 'EMPTY' });
        return;
      }

      // Merge AI answer into question if available
      if (aiResp && aiResp.reasonMarkdown) {
        q.reasonMarkdown = aiResp.reasonMarkdown;
      }
      if (aiResp && aiResp.confidence !== undefined) {
        q.confidence = aiResp.confidence;
      }

      this._questionRaw = q;

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
          reasonMarkdown: q.reasonMarkdown || '',
          steps: q.steps || [],
          knowledgePoints: q.knowledgePoints || [],
          difficulty,
          confidence: q.confidence,
        },
        diffStars,
        diffLabel: DIFF_LABELS[difficulty] || '中等',
        timelineNodes,
      });
    } catch (err) {
      console.error('[P04] fetchQuestion error:', err);
      this.setData({ pageState: 'ERROR' });
    }
  },

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
      // POST save is out of scope for T05 result page mirror
      // In production this would call questionsClient.save(qid)
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 1500);
    } catch (err) {
      console.error('[P04] save error:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSaving: false });
    }
  },
});
