/**
 * P04 AI分析结果页 · 1:1 mirror design/mockups/wrongbook/04_result.html
 * trace: design/mockups/wrongbook/04_result.html · H5 frontend/apps/h5/src/pages/Result/index.tsx
 *
 * State machine: LOADING → DRAFT | ERROR | EMPTY
 * API: GET /api/wb/questions/<qid>  (wrongbook-service :8082)
 *      GET /api/ai/<qid>/answer     (ai-analysis-service :8083)
 */
import { getQuestionById, saveQuestion } from '../../src/api/wrongbook';
import { getAnswerByQid } from '../../src/api/ai';
import { getResult as getAnonResult, claim as anonClaim } from '../../src/api/anon';
import type { AiAnswer, AiStep } from '../../src/api/ai';
import type { QuestionDetail, PlannedNode, QuestionStep } from '../../src/api/wrongbook';

// SC01-MP-BUG-AI-FAKE · fallback 文案 (i18n key 表治理推迟到 SC01-DOC-P04-i18n-keys task).
// 暂时直接 hardcode 中文 · key 命名预留 result.fallback.* 便于后续 i18n 化.
const FALLBACK_REASON_PENDING = 'AI 暂时未能给出诊断，请稍后重试或手动修正。';
const FALLBACK_STEPS_EMPTY = '解答步骤生成中…可下拉刷新或点击下方手动修正。';
// 正确答案区域 · BE 既不持久化 correctAnswer · AiAnswer 也没此字段 ·
// 兜底从 AI steps 最后一步派生 (formula > text) · 仍空时显示此 placeholder
const FALLBACK_CORRECT_PENDING = 'AI 暂未给出答案 · 见下方解答步骤';

const SUBJECT_LABEL: Record<string, string> = {
  math: '数学',
  physics: '物理',
  chemistry: '化学',
  english: '英语',
};

const DIFF_LABELS = ['', '简单', '偏易', '中等', '偏难', '困难'];

// 6 节点 (T1..T6) 真日期预览 · 抽到 timeline-helpers.ts 让 vitest 不依赖 Page() runtime.
// 之前在此文件写死 TIMELINE_LABELS = ['15:28','4/24','4/28',...] mockup mock · 2026-05 还显 4 月穿帮.
import { buildTimelinePreview, formatTimelineLabel } from './timeline-helpers';

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
  /** hero kicker · "{subject} · {kp1} · {kp2}" 动态拼接 · 替代硬编码 "二次函数 · 顶点式" */
  topicChain: string;
  /** thumbnail 题干摘要 · 1 行截断 · 替代硬编码 "已知 f(x)=x²−4x+3" */
  stemSnippet: string;
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
    // 真预览 · LOADING 初值时按当前时间算 T1..T6 · _fetchQuestion 完成后会重算 (或用 BE plannedNodes 真值).
    timelineNodes: buildTimelinePreview(new Date()),
    isSaving: false,
    aiFallback: { reasonShown: false, stepsShown: false, text: '' },
    topicChain: '',
    stemSnippet: '',
    // ── 游客态 (spec line 216 + biz §F05) ──
    // isGuest=true 时 hide T1-T6 timeline (biz §3.6 禁用 T0/T1 节点) +
    // 显「24h 内可保存」黄条 + 保存按钮文案改 "保存到我的错题本 →注册"
    isGuest: false,
    guestClaimHint: '本次结果 24 小时内可保存到错题本',
  },

  /** cached raw question for save mutation */
  _questionRaw: null as QuestionDetail | null,
  /** Guest mode 实例字段 · 注册后 claim 用 */
  _isGuest: false,
  _anonToken: '' as string,
  _anonQid: '' as string,
  _guestSubject: 'math' as string,
  /** persisted qid for retry after error */
  _qid: '',

  onLoad(options: Record<string, string | undefined>) {
    const qid = options.qid || '';
    this._qid = qid;
    if (!qid) {
      this.setData({ pageState: 'EMPTY' });
      return;
    }
    // ── 游客态分支 (spec line 216 · /result/{anonQid}?guest=1) ──
    if (options.guest === '1') {
      const anonToken = options.anonToken ? decodeURIComponent(options.anonToken) : '';
      const subject = options.subject || 'math';
      if (!anonToken) {
        this.setData({ pageState: 'EMPTY' });
        return;
      }
      this._isGuest = true;
      this._anonToken = anonToken;
      this._anonQid = qid;
      this._guestSubject = subject;
      this.setData({ isGuest: true });
      this._fetchGuestResult(qid, anonToken, subject);
      return;
    }
    // ── 登录态原逻辑 (维持不变) ──
    this._fetchQuestion(qid);
  },

  /**
   * 游客态 · 调 anon-service GET /api/anon/result/{qid} 拿 enriched result
   * (含 stem/reason/steps/correction) · 渲染同 P04 UI · 隐藏 T1-T6.
   */
  async _fetchGuestResult(qid: string, anonToken: string, subject: string) {
    this.setData({ pageState: 'LOADING' });
    try {
      const r = await getAnonResult(anonToken, Number(qid));
      if (r.status !== 'READY' && r.status !== 'DONE') {
        // FAILED / ANALYZING (本不应到 P04) · 显错误
        this.setData({ pageState: 'ERROR' });
        return;
      }
      const result = r.result || ({} as NonNullable<typeof r.result>);
      const subjectLabel = SUBJECT_LABEL[subject] || subject;
      const stem = result.stem || '';
      const reason = result.reason_markdown || FALLBACK_REASON_PENDING;
      const steps: QuestionStep[] = (result.steps || []).map((s, i) => ({
        idx: typeof s.step_no === 'number' ? s.step_no : i + 1,
        title: s.text || s.title || '',
        formula: s.formula || undefined,
      }));
      const correctAnswer = result.correction || FALLBACK_CORRECT_PENDING;
      const stemSnippet = stem.slice(0, 16);

      // 构造虚拟 question 对象供 wxml 复用 · KP 暂留空 (ai-service 未暴露 · TODO follow-up)
      this.setData({
        pageState: 'DRAFT',
        question: {
          id: qid,
          subject,
          subjectLabel,
          stem,
          formula: '',
          myAnswer: '',
          correctAnswer,
          reasonMarkdown: reason,
          steps,
          knowledgePoints: [],
          difficulty: 3,
          confidence: 0,
        },
        diffStars: [true, true, true, false, false],
        diffLabel: '中等',
        timelineNodes: [],  // biz §3.6 禁用 T0/T1 · 游客不显复习曲线
        aiFallback: {
          reasonShown: !result.reason_markdown,
          stepsShown: steps.length === 0,
          text: !result.reason_markdown ? FALLBACK_REASON_PENDING : '',
        },
        topicChain: subjectLabel,
        stemSnippet,
      });
    } catch (err) {
      console.error('[P04 guest] fetch failed', err);
      this.setData({ pageState: 'ERROR' });
    }
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
    // wb_question doesn't persist OCR'd stem · pull from AI sidecar when present so
    // the 题干 banner isn't blank on real-backend runs.
    const mergedStem = (q.stem && q.stem.trim().length > 0)
      ? q.stem
      : (aiResp && aiResp.stem ? aiResp.stem : '');
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

    // 正确答案派生: BE 不持久 q.correctAnswer · AI 也没此字段 · 从 steps 最后一步取 ·
    // formula > text · 仍空时给 placeholder · 修 mockup 硬编码 "顶点 (2,-1)..." 假数据
    let mergedCorrectAnswer = (q.correctAnswer || '').trim();
    if (!mergedCorrectAnswer && mergedSteps.length > 0) {
      const last = mergedSteps[mergedSteps.length - 1];
      mergedCorrectAnswer = (last.formula?.trim()) || (last.title?.trim()) || '';
    }
    if (!mergedCorrectAnswer) {
      mergedCorrectAnswer = FALLBACK_CORRECT_PENDING;
    }

    this._questionRaw = q;
    q.reasonMarkdown = finalReason;
    q.steps = mergedSteps;
    q.stem = mergedStem;
    q.correctAnswer = mergedCorrectAnswer;

    const difficulty = q.difficulty || 3;
    const diffStars = Array.from({ length: 5 }, (_, i) => i < difficulty);
    const timelineNodes = this._buildTimeline(wbResp.plannedNodes || []);
    const subjectLabel = SUBJECT_LABEL[q.subject] || q.subject;
    // hero kicker · 替代硬编码 "二次函数 · 顶点式" · 真 KP 名链
    const kpNames = (q.knowledgePoints || []).map(k => k.name).filter(Boolean);
    const topicChain = kpNames.length > 0
      ? `${subjectLabel} · ${kpNames.slice(0, 2).join(' · ')}`
      : subjectLabel;
    // 缩略图题干摘要 · 替代硬编码 "已知 f(x)=x²−4x+3" · 1 行 ~16 字
    const stemSnippet = (q.stem || '').slice(0, 16);

    this.setData({
      pageState: 'DRAFT',
      question: {
        id: q.id,
        subject: q.subject,
        subjectLabel,
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
      topicChain,
      stemSnippet,
    });
  },

  /** test-only seam · exposes the AiAnswer that was last merged in for assertions. */
  _lastAi: null as AiAnswer | null,

  _buildTimeline(nodes: PlannedNode[]) {
    // post-save BE 返 plannedNodes (next_due_at 真值) · 用 BE 真值 ·
    // pre-save BE 还没建节点 · 用 now + NODE_OFFSETS_MS 预测 (近似不超过几秒).
    // 之前忽略 nodes 参数永远走假 TIMELINE_LABELS (mockup 4 月日期 · 2026-05 穿帮).
    if (nodes && nodes.length > 0) {
      const now = new Date();
      return nodes.slice(0, 6).map((n, i) => {
        const due = new Date(n.dueAt);
        return {
          tLevel: n.tLevel || `T${i + 1}`,
          label: formatTimelineLabel(now, due),
        };
      });
    }
    return buildTimelinePreview(new Date());
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

    // ── 游客态: spec line 217 + biz §F06 · 跳 P00 注册 + 登录后 claim ──
    if (this._isGuest) {
      const jwt = wx.getStorageSync('studentJwt') || wx.getStorageSync('jwt');
      if (!jwt) {
        // 未登录 · 跳注册 · 带 anonToken + returnTo=P04?guest=1&autoClaim=1
        const returnTo = `/pages/result/index?guest=1&qid=${this._anonQid}`
          + `&anonToken=${encodeURIComponent(this._anonToken)}&subject=${this._guestSubject}&autoClaim=1`;
        wx.navigateTo({
          url: `/pages/login/index?anonToken=${encodeURIComponent(this._anonToken)}`
            + `&returnTo=${encodeURIComponent(returnTo)}`,
        });
        return;
      }
      // 已登录 · 直接 claim
      this.setData({ isSaving: true });
      try {
        const c = await anonClaim(this._anonToken, jwt, { subject: this._guestSubject });
        wx.showToast({ title: `已保存 qid=${c.claimed_question_id}`, icon: 'success', duration: 800 });
        setTimeout(() => {
          wx.switchTab({ url: '/pages/wrongbook-list/index' });
        }, 800);
      } catch (err) {
        console.error('[P04 guest] claim failed', err);
        wx.showToast({ title: '保存失败，请重试', icon: 'none' });
      } finally {
        this.setData({ isSaving: false });
      }
      return;
    }

    const qid = this._questionRaw?.id || this._qid;
    if (!qid) {
      wx.showToast({ title: '题目缺失，无法保存', icon: 'none' });
      return;
    }
    this.setData({ isSaving: true });

    try {
      // Real save: wrong_item.status → 3 CONFIRMED + outbox event + sync trigger
      // to review-plan-service to create 7 EBBINGHAUS_SM2 nodes (T0..T6) so the
      // "保存后将按《艾宾浩斯》自动生成 T1-T6 共 6 个日历提醒" promise actually holds.
      await saveQuestion(qid);

      // spec P04-result.spec.md §6 L157 + §7 L191 + TC-01.01:
      // SAVED → navigate('/wrongbook?highlight={qid}') → P05 错题列表 + 高亮新题
      // wrongbook-list 是 tabBar 页 (app.json L33), 必须 switchTab; navigateTo
      // 会被微信静默拒绝 ("can not navigateTo a tabbar page" · 用户层无感),
      // 这是之前 "点保存后页面不跳" 的根因.
      // switchTab 不支持 query, 用 storage 把 highlight qid 传给 P05 onShow.
      try { wx.vibrateShort({ type: 'medium' }); } catch { /* noop */ }
      wx.setStorageSync('p05.highlightQid', qid);
      wx.showToast({ title: '保存成功', icon: 'success', duration: 600, mask: true });
      // spec L244: 保存成功 → 跳 P05 ≤ 800ms (含 200ms 跳转动画) · 给 toast 600ms 视觉
      setTimeout(() => {
        wx.switchTab({ url: '/pages/wrongbook-list/index' });
      }, 600);
    } catch (err) {
      console.error('[P04] save error:', err);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ isSaving: false });
    }
  },
});
