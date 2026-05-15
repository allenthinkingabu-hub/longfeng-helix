// P07 今日复习 · pure helper functions (testable without wx runtime)
// trace: design/mockups/wrongbook/07_review_today.html

import type { ReviewPlanDto } from '../../src/api/review';

// ─── Types ──────────────────────────────────────────────────────

export interface SlotData {
  key: string;
  title: string;
  iconClass: string;
  items: ItemData[];
}

export interface ItemData {
  nid: string;
  tLevel: string;
  hhmm: string;
  subject: string;
  kp: string;
  stem: string;
  tags: string[];
  countdownState: 'now' | 'soon' | 'wait';
  countdownLabel: string;
  sideColor: string;
}

// ─── Pure helpers ───────────────────────────────────────────────

export function buildCountdown(diffMin: number): { state: 'now' | 'soon' | 'wait'; label: string } {
  if (diffMin <= 15) {
    return { state: 'now', label: `${Math.max(0, diffMin)} 分钟` };
  }
  if (diffMin <= 120) {
    return { state: 'soon', label: `${Math.round(diffMin / 60)} h` };
  }
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return { state: 'wait', label: m > 0 ? `${h} h ${m} m` : `${h} h` };
}

export function formatHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function getSlotKey(hh: number): 'now' | 'afternoon' | 'evening' {
  if (hh < 12) return 'now';
  if (hh < 18) return 'afternoon';
  return 'evening';
}

export function getSlotTitle(key: string): string {
  if (key === 'now') return '现在 · 上午';
  if (key === 'afternoon') return '下午';
  return '晚上';
}

export function getSlotIconClass(key: string): string {
  if (key === 'now') return 'slotIconYellow';
  if (key === 'afternoon') return 'slotIconBlue';
  return 'slotIconIndigo';
}

const SUBJECT_COLOR_MAP: Record<string, string> = {
  '数学': 'red', '物理': 'orange', '化学': 'indigo', '英语': 'green',
};

export function buildSlotsFromItems(items: ReviewPlanDto[], now: Date): SlotData[] {
  const buckets: Record<string, ItemData[]> = {};

  for (const item of items) {
    const dueDate = new Date(item.nextDueAt);
    const hh = dueDate.getHours();
    const hhmm = formatHHMM(dueDate);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);
    const cd = buildCountdown(diffMin);

    const raw = item as unknown as Record<string, unknown>;
    const strategyCode = typeof raw.strategyCode === 'string' ? raw.strategyCode : '';
    const color = SUBJECT_COLOR_MAP[strategyCode] || 'blue';

    const itemData: ItemData = {
      nid: String(item.id),
      tLevel: `T${item.nodeIndex}`,
      hhmm,
      subject: strategyCode || '数学',
      kp: '',
      stem: `节点 #${item.id} · 第 ${item.nodeIndex + 1} 次复习`,
      tags: [`T${item.nodeIndex}`],
      countdownState: cd.state,
      countdownLabel: cd.label,
      sideColor: color,
    };

    const slotKey = getSlotKey(hh);
    if (!buckets[slotKey]) buckets[slotKey] = [];
    buckets[slotKey].push(itemData);
  }

  const order = ['now', 'afternoon', 'evening'];
  const slots: SlotData[] = [];
  for (const key of order) {
    if (buckets[key] && buckets[key].length > 0) {
      slots.push({
        key,
        title: getSlotTitle(key),
        iconClass: getSlotIconClass(key),
        items: buckets[key],
      });
    }
  }
  return slots;
}

// ─── Mock data (frontend dev fallback) ──────────────────────────

export const MOCK_ITEMS: ItemData[] = [
  {
    nid: '1001', tLevel: 'T1', hhmm: '09:45', subject: '数学', kp: '二次函数 · 顶点式',
    stem: '已知 f(x)=x²−4x+3，求顶点坐标与对称轴。错因：h k 混淆。',
    tags: ['顶点式', '配方法', '★★★'], countdownState: 'now', countdownLabel: '4 分钟',
    sideColor: 'red',
  },
  {
    nid: '1002', tLevel: 'T3', hhmm: '11:00', subject: '物理', kp: '欧姆定律 · 并联',
    stem: 'R₁=4Ω, R₂=6Ω 并联接 12V，求总电流。公式错误。',
    tags: ['并联电路', '★★'], countdownState: 'soon', countdownLabel: '1 h',
    sideColor: 'orange',
  },
  {
    nid: '1003', tLevel: 'T4', hhmm: '14:30', subject: '化学', kp: '方程配平',
    stem: 'Al + HCl → AlCl₃ + H₂，系数 2:6:2:3。',
    tags: ['化学方程', '★★★'], countdownState: 'wait', countdownLabel: '5 h',
    sideColor: 'indigo',
  },
  {
    nid: '1004', tLevel: 'T2', hhmm: '16:00', subject: '英语', kp: 'past perfect',
    stem: 'By the time he arrived, the meeting ___ already started.',
    tags: ['时态一致', '★★'], countdownState: 'wait', countdownLabel: '6 h 15 m',
    sideColor: 'green',
  },
];

export const MOCK_SLOTS: SlotData[] = [
  { key: 'now', title: '现在 · 上午', iconClass: 'slotIconYellow', items: MOCK_ITEMS.slice(0, 2) },
  { key: 'afternoon', title: '下午', iconClass: 'slotIconBlue', items: MOCK_ITEMS.slice(2, 4) },
];

// ─── T10 · tap → exec transition helpers (extracted for unit testability) ──

/**
 * Extract nid from a tap event's dataset.
 * Returns the string nid or null if missing.
 */
export function extractNidFromTap(e: WechatMiniprogram.TouchEvent): string | null {
  const nid = e?.currentTarget?.dataset?.nid;
  if (nid === undefined || nid === null || nid === '') return null;
  return String(nid);
}

/**
 * Build the transition URL for review-exec.
 * Mirrors H5 sibling: nav(`/review/exec/0?sid=${sid}`)
 */
export function buildExecUrl(sid: string, nid: string): string {
  return `/pages/review-exec/index?sid=${encodeURIComponent(sid)}&nid=${encodeURIComponent(nid)}`;
}
