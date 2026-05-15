// P09 复习完成页 · 1:1 mirror design/mockups/wrongbook/09_review_done.html
// trace: design/mockups/wrongbook/09_review_done.html · @longfeng/testids p09
// State machine: LOADING → RESULT | ALL_DONE | ERROR
// API: POST /api/review/sessions/{sid}/complete via src/api/review.ts

import { TEST_IDS } from '@longfeng/testids';
import { completeSession } from '../../src/api/review';

// ── Types ───────────────────────────────────────────────────
interface NodeResult {
  planId: number;
  wrongItemId: number;
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
  planId: 1001,
  wrongItemId: 2001,
  nodeIndex: 2,
  nodeState: 'MASTERED',
  mastered: true,
  intervalBefore: 1,
  intervalAfter: 3,
  durationMs: 128000,
  easeAfter: 2.6,
  nextDueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
};

const MOCK_KP_DELTA: KpDelta[] = [
  { kp: '顶点式 · 配方法', oldPct: 72, newPct: 86 },
  { kp: '对称轴方程', oldPct: 60, newPct: 74 },
  { kp: '判别式 Δ 应用', oldPct: 45, newPct: 58 },
  { kp: '韦达定理', oldPct: 30, newPct: 42 },
];

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
    questionTitle: 'f(x) = x² − 4x + 3',
    questionSubject: '数学',
    questionTopic: '二次函数',
    questionKpSummary: '顶点式 / 配方法 / 对称轴',
    calendarSubscribed: false,
    toast: '',
  },

  onLoad(options: Record<string, string | undefined>) {
    const result = this.data.result;
    const grade = options.grade;
    const isForgot = grade === 'FORGOT' || (result.nodeState === 'ACTIVE' && !result.mastered);
    const allDone = options.allDone === 'true';

    this.setData({
      pageState: allDone ? 'ALL_DONE' : 'RESULT',
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
    const sid = 'mock-sid-001'; // In production: passed via page options
    try {
      await completeSession(sid);
    } catch {
      // best-effort: navigate home even if API fails
    }
    // T14: P09→P-HOME transition · fallback to capture if home page not yet available (T08)
    wx.reLaunch({
      url: '/pages/home/index',
      fail() {
        wx.reLaunch({ url: '/pages/capture/index' });
      },
    });
  },
});
