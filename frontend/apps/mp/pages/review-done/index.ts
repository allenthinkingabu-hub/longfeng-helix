// P09 复习完成页 · 1:1 mirror design/mockups/wrongbook/09_review_done.html
// trace: design/mockups/wrongbook/09_review_done.html · @longfeng/testids p09
// State machine: LOADING → RESULT | ALL_DONE | ERROR
// API (spec §5):
//   #1 GET  /api/review/nodes/{nid}/result      → nodeResult (Hero + 曲线)
//   #2 POST /api/review/sessions/{sid}/next     → sessionStats + RESULT/ALL_DONE
//   #3 POST /api/review/sessions/{sid}/complete → 兜底 stats (mastered/partial/forgot)
// + GET /api/wb/questions/{qid} → 题干 / 学科 / KP 名 (mockup 显示用)

import { TEST_IDS } from '@longfeng/testids';
import { completeSession, nodeResult, nextInSession } from '../../src/api/review';
import { getQuestionById } from '../../src/api/wrongbook';

// ── Types ───────────────────────────────────────────────────
interface NodeResult {
  // Snowflake ID 走字符串 · 否则 JS 精度截尾 184→200 (FE 拿错 qid 调 getQuestionById 404)
  planId: string;
  wrongItemId: string;
  nodeIndex: number;
  nodeState: string;
  mastered: boolean;
  intervalBefore: number;
  intervalAfter: number;
  durationMs: number;
  easeAfter: number;
  nextDueAt: string;
}

interface KpDelta {
  kp: string;
  oldPct: number;
  newPct: number;
}

interface SessionStats {
  mastered: number;
  partial: number;
  forgot: number;
  total: number;
  done: number;
}

type PageState = 'LOADING' | 'RESULT' | 'ALL_DONE' | 'ERROR';

// ── Mock data (matching H5 sibling) ─────────────────────────
const MOCK_NODE_RESULT: NodeResult = {
  planId: '1001',
  wrongItemId: '2001',
  nodeIndex: 2,
  nodeState: 'MASTERED',
  mastered: true,
  intervalBefore: 1,
  intervalAfter: 3,
  durationMs: 128000,
  easeAfter: 2.6,
  nextDueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
};

// spec §3 <KpChart> 组件接 rows[{kp,oldPct,newPct}] · 但 §5 API 触点 没对应端点 ·
// review_outcome 表没存 KP 维度的 ease 历史 · BE 短期内出不来真值.
// 不再硬塞 4 行假 KP · 留空 · wxml wx:if 隐藏整块 · 等 BE 加端点再开 (followup).
const MOCK_KP_DELTA: KpDelta[] = [];

const KP_COLORS = ['#34C759', '#007AFF', '#FF9500', '#FF3B30'];
const KP_GRADIENTS = [
  'linear-gradient(90deg,#34C759,#22A24A)',
  'linear-gradient(90deg,#5AA3FF,#0062E1)',
  'linear-gradient(90deg,#FFB84D,#E08100)',
  'linear-gradient(90deg,#FF6B60,#D72B22)',
];

const T_LEVELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] as const;
const T_INTERVALS = ['1h', '1d', '3d', '7d', '15d', '30d'];

// ── Helpers ─────────────────────────────────────────────────
function getNodeState(tLevel: string, currentNodeIndex: number): 'done' | 'now' | 'future' {
  const idx = parseInt(tLevel.replace('T', ''), 10);
  if (idx < currentNodeIndex) return 'done';
  if (idx === currentNodeIndex) return 'now';
  return 'future';
}

function formatNextDue(iso: string): string {
  try {
    const d = new Date(iso);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const wd = weekdays[d.getDay()];
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${month} 月 ${day} 日 · ${wd} · ${hh}:${mm}`;
  } catch {
    return '即将安排';
  }
}

function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function buildTLevels(nodeIndex: number) {
  return T_LEVELS.map((tl, i) => {
    const state = getNodeState(tl, nodeIndex);
    return {
      label: tl,
      interval: T_INTERVALS[i],
      dotClass: state === 'done' ? 'node-dot--done' : state === 'now' ? 'node-dot--now' : '',
      labelClass: state === 'done' ? 'node-label--done' : state === 'now' ? 'node-label--now' : '',
    };
  });
}

// ── Confetti particles (matching mockup L137-L148) ──────────
const CONFETTI_PARTICLES = [
  { left: '10%', top: '18%', bg: '#FFD166', rotate: 20 },
  { left: '22%', top: '62%', bg: '#EF476F', rotate: -18 },
  { left: '34%', top: '30%', bg: '#118AB2', rotate: 40 },
  { left: '68%', top: '18%', bg: '#FFD166', rotate: -30 },
  { left: '82%', top: '44%', bg: '#06D6A0', rotate: 12 },
  { left: '90%', top: '72%', bg: '#EF476F', rotate: -40 },
  { left: '6%', top: '80%', bg: '#06D6A0', rotate: 60 },
  { left: '58%', top: '78%', bg: '#118AB2', rotate: -10 },
];

Page({
  // P08 透传 sid · onEnd → completeSession 用 · 不放 data 防 setData 序列化噪声
  _sid: '' as string,
  _nid: '' as string,
  data: {
    testIds: TEST_IDS.p09,
    pageState: 'LOADING' as PageState,
    result: MOCK_NODE_RESULT,
    sessionStats: { mastered: 4, partial: 1, forgot: 0, total: 8, done: 5 } as SessionStats,
    kpDelta: MOCK_KP_DELTA,
    kpColors: KP_COLORS,
    kpGradients: KP_GRADIENTS,
    tLevels: buildTLevels(MOCK_NODE_RESULT.nodeIndex),
    confetti: CONFETTI_PARTICLES,
    isForgot: false,
    prevT: 'T2',
    nextT: 'T3',
    masteryPct: 83,
    nextDueFormatted: '',
    durationFormatted: '',
    // 初值留空 · _fetchAndRender 拉真数据填. wxml wx:if 兜底空态展示 "—" 或 hide.
    // 之前 mock "f(x)=x²−4x+3 / 顶点式 / 配方法 / 对称轴" 是用户红圈反复出现的"假数据"根因.
    questionTitle: '',
    questionSubject: '',
    questionTopic: '',
    questionKpSummary: '',
    calendarSubscribed: false,
    toast: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    this._sid = options.sid ?? '';
    this._nid = options.nodeId ?? '';
    const grade = options.grade;

    // 1) 无 nid → 直接 mock (dev 直开 / 兜底); 有 nid → 真 API
    if (!this._nid || this._nid === 'mock' || this._nid === '0') {
      this._renderMock(grade);
      return;
    }

    // 真 API 路径 · LOADING 骨架已显示 (pageState 初值)
    this._fetchAndRender(this._nid, this._sid, grade).catch(err => {
      console.error('[P09] fetch failed:', err);
      // spec §9: GET /result 5xx → Hero 退化中性态 + Toast "结果同步中"
      wx.showToast({ title: '结果同步中', icon: 'none' });
      this._renderMock(grade);
    });
  },

  // 真 API 数据装配 · spec §5 三端点串联
  async _fetchAndRender(nid: string, sid: string, grade: string | undefined) {
    // #1 nodeResult — Hero / 曲线 / nextDueAt 主数据
    const r = await nodeResult(nid);
    const result: NodeResult = {
      planId: r.planId || '0',                                // NodeResultResp.planId 字符串 · 老 mock fallback '0'
      wrongItemId: r.wrongItemId,
      nodeIndex: r.nodeIndex,
      nodeState: r.nodeState,
      mastered: r.mastered,
      intervalBefore: r.intervalDaysBefore ?? 0,
      intervalAfter: r.intervalDaysAfter ?? 0,
      durationMs: r.durationMs ?? 0,
      easeAfter: r.easeFactorAfter ?? 2.5,
      nextDueAt: r.nextDueAt ?? new Date(Date.now() + 86400000).toISOString(),
    };
    const isForgot = grade === 'FORGOT' || (!result.mastered && result.nodeState !== 'GRADED');

    // #2 nextInSession — 决定 RESULT / ALL_DONE · sessionStats.done/total
    // 并行触发但允许失败: 直接打开 P09 / sid 缺失 时跳过
    let sessionStats: SessionStats = { mastered: 0, partial: 0, forgot: 0, total: 0, done: 0 };
    let isAllDone = false;
    if (sid && sid !== 'mock-sid-001') {
      try {
        const peek = await nextInSession(sid);
        sessionStats = {
          mastered: 0,                                        // 由 #3 completeSession 填
          partial: 0,
          forgot: 0,
          total: peek.total,
          done: peek.completed,
        };
        isAllDone = peek.done === true;
      } catch (e) {
        // spec §9: 404 → "已在另一设备完成" + 回 P-HOME · 这里只 toast · 不强制路由(用户可能想留页面)
        console.warn('[P09] nextInSession failed:', e);
      }
    }

    // #3 completeSession (仅 ALL_DONE) — mastered/partial/forgot 真值
    if (isAllDone && sid) {
      try {
        const c = await completeSession(sid);
        sessionStats = {
          mastered: c.stats.mastered,
          partial: c.stats.partial,
          forgot: c.stats.forgot,
          total: c.stats.total,
          done: c.stats.mastered + c.stats.partial + c.stats.forgot,
        };
      } catch (e) {
        console.warn('[P09] completeSession failed:', e);
      }
    }

    // 题干元信息 (Subject / KP 名) · 失败不阻塞主流程
    // ❗去掉 mock fallback (|| this.data.questionTitle 等) · 真数据空就显空态 ·
    //   spec 没要 mock 假数据 · 之前混进 "f(x)=x²−4x+3" 误导用户
    const qPatch: Record<string, unknown> = {};
    let realKpNames: string[] = [];
    try {
      const q = await getQuestionById(String(result.wrongItemId));
      qPatch.questionTitle = q.question.stem || '';
      // BE wrong_item.subject 是 'math'/'physics'/... 小写 · 映射中文标签
      const subjectKey = (q.question.subject ?? '').toLowerCase();
      const SUBJECT_LABEL: Record<string, string> = {
        math: '数学', physics: '物理', chemistry: '化学', english: '英语', chinese: '语文',
      };
      qPatch.questionSubject = SUBJECT_LABEL[subjectKey] || q.question.subject || '';
      realKpNames = (q.question.knowledgePoints ?? []).map(k => k.name).filter(Boolean);
      qPatch.questionKpSummary = realKpNames.length > 0 ? realKpNames.join(' / ') : '';
      qPatch.questionTopic = realKpNames[0] ?? '';
    } catch (e) {
      console.warn('[P09] getQuestionById failed:', e);
    }

    // P09-FOLLOWUP-#3 · KpChart 真 delta · 用 review_outcome ease before/after 派生 ·
    // 同一道题的每个 KP 都套同 delta (BE 没存 KP 维度 ease 历史 · 短期最诚实可行方案).
    // ease 1.3→0%, 3.0→100% 线性映射 · 没 outcome (没复习过) 则 KpChart 空.
    let computedKpDelta: KpDelta[] = [];
    if (r.easeFactorBefore != null && r.easeFactorAfter != null && realKpNames.length > 0) {
      const easeToPct = (e: number) => Math.max(0, Math.min(100, Math.round((e - 1.3) / 1.7 * 100)));
      const oldPct = easeToPct(r.easeFactorBefore);
      const newPct = easeToPct(r.easeFactorAfter);
      computedKpDelta = realKpNames.slice(0, 4).map(kp => ({ kp, oldPct, newPct }));
    }

    this.setData({
      pageState: isAllDone ? 'ALL_DONE' : 'RESULT',
      result,
      sessionStats,
      isForgot,
      prevT: `T${Math.max(0, result.nodeIndex)}`,
      nextT: `T${result.nodeIndex + 1}`,
      // P09-MASTERY: 优先用 BE review_plan.mastery_score 真值 · 没有时 (老节点 / 没复习过)
      // 退到原 easeAfter*32 派生公式. 真做完一次 MASTERED 才会有 >0 值.
      masteryPct: typeof r.masteryScore === 'number' && r.masteryScore > 0
        ? r.masteryScore
        : Math.round(result.easeAfter * 32),
      nextDueFormatted: formatNextDue(result.nextDueAt),
      durationFormatted: formatDuration(result.durationMs),
      tLevels: buildTLevels(result.nodeIndex),
      kpDelta: computedKpDelta,
      ...qPatch,
    });
  },

  // dev 直开 / 真 API 失败 兜底 · 不变更 result/sessionStats/kpDelta 的 MOCK 初值
  _renderMock(grade: string | undefined) {
    const result = this.data.result;
    const isForgot = grade === 'FORGOT' || (result.nodeState === 'ACTIVE' && !result.mastered);
    this.setData({
      pageState: 'RESULT',
      isForgot,
      prevT: `T${Math.max(0, result.nodeIndex)}`,
      nextT: `T${result.nodeIndex + 1}`,
      masteryPct: Math.round(result.easeAfter * 32),
      nextDueFormatted: formatNextDue(result.nextDueAt),
      durationFormatted: formatDuration(result.durationMs),
      tLevels: buildTLevels(result.nodeIndex),
    });
  },

  // ── Handlers ──────────────────────────────────────────────
  onAddCalendar() {
    if (this.data.calendarSubscribed) return;
    this.setData({ calendarSubscribed: true });
    wx.showToast({ title: '已同步到日历', icon: 'success' });
  },

  onContinue() {
    wx.navigateBack();
  },

  async onEnd() {
    // sid 来自 P08 透传 · 缺失时跳过 completeSession (避免 mock-sid-001 撞 BE 404)
    const sid = this._sid;
    if (sid && sid !== 'mock-sid-001') {
      try {
        await completeSession(sid);
      } catch {
        // best-effort: 即便 API 失败也回首页
      }
    }
    // T14: P09→P-HOME transition · fallback to capture if home page not yet available
    wx.reLaunch({
      url: '/pages/home/index',
      fail() {
        wx.reLaunch({ url: '/pages/capture/index' });
      },
    });
  },
});
