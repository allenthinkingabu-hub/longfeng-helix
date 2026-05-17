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
  // P07 卡片状态徽章 · 与 hero 计数同口径 (mastered/!mastered+completedAt/!mastered+!completedAt)
  // 之前卡片无 progress 标识 · hero 显 "1 进行中 / 1 未开始" 但用户分不清是哪条 ·
  // 现加 progress + progressLabel 标到每张卡 · 一眼对齐 hero 计数.
  progress: 'done' | 'inprogress' | 'wait';
  progressLabel: string;
}

// ─── Pure helpers ───────────────────────────────────────────────

/**
 * "本次到期已 grade" 判定 · 用于 P07/P-HOME doneCount/progress 计算.
 *
 * 业务真相: review_plan 是 cyclic 的 · 每次 grade 把 completedAt 更新为该时刻 +
 * next_due_at 推到下一个 T 级未来. 同一行被反复 grade.
 *
 * 因此 completedAt != null 仅代表 "曾经 grade 过", 不代表 "本次到期已完成".
 * 正确判定: completedAt 落在今日窗口 (用户本地时区 today_start) 才算今日已 grade.
 *
 * 示例:
 *   - 昨晚 22:50 grade → completedAt = 昨晚 + next_due_at 推到今晚 22:50
 *   - 今日打开 P07 看到该节点: completedAt < today_start → "未开始" (正确)
 *   - 今晚 22:50 再 grade → completedAt = 今晚 + next_due_at 推到 +2d
 *   - 此时 completedAt >= today_start → "已完成" (正确)
 */
export function isCompletedToday(completedAt: string | null | undefined, now: Date): boolean {
  if (!completedAt) return false;
  const c = new Date(completedAt);
  if (isNaN(c.getTime())) return false;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return c.getTime() >= todayStart.getTime();
}

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

// BE wrong_item.subject 是 enum 字符串 ('math'/'physics'/...) · FE 渲染要中文标签
const SUBJECT_LABEL_MAP: Record<string, string> = {
  math: '数学', physics: '物理', chemistry: '化学', english: '英语', chinese: '语文',
};
const SUBJECT_COLOR_MAP: Record<string, string> = {
  math: 'red', physics: 'orange', chemistry: 'indigo', english: 'green', chinese: 'blue',
};

// P07-D · 桶内 sort 模式 · time = nextDueAt ASC (默认, 与 BE 返序一致) ·
// tlevel = nodeIndex ASC · subject = subject 字母序.
// 桶分组本身 (上午/下午/晚上) 不动 · 仅桶内排序变.
export type SortMode = 'time' | 'tlevel' | 'subject';

function compareItems(a: ItemData, b: ItemData, mode: SortMode): number {
  if (mode === 'tlevel') {
    // 'T1' < 'T2' < ... < 'T10' · slice(1) parseInt
    return parseInt(a.tLevel.slice(1), 10) - parseInt(b.tLevel.slice(1), 10);
  }
  if (mode === 'subject') {
    return a.subject.localeCompare(b.subject, 'zh-CN');
  }
  // time: hhmm 字面序就够 (HH:MM zero-padded · 24h)
  return a.hhmm.localeCompare(b.hhmm);
}

export function buildSlotsFromItems(items: ReviewPlanDto[], now: Date, sortMode: SortMode = 'time'): SlotData[] {
  const buckets: Record<string, ItemData[]> = {};

  for (const item of items) {
    const dueDate = new Date(item.nextDueAt);
    const hh = dueDate.getHours();
    const hhmm = formatHHMM(dueDate);
    const diffMs = dueDate.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);
    const cd = buildCountdown(diffMin);

    // BE today 接口现在返 subject + stem (单库 join wrong_item 拿) ·
    // 之前 fallback 拿 strategyCode (= "EBBINGHAUS_SM2" 算法常量) 当学科 +
    // 拿 nodeId 当题干, 是因为 BE 那时不返这俩字段, FE 没东西可显示 (用户截图所见).
    const subjectKey = (item.subject ?? '').toLowerCase();
    const subjectLabel = SUBJECT_LABEL_MAP[subjectKey] || '数学';
    const color = SUBJECT_COLOR_MAP[subjectKey] || 'blue';
    const stem = (item.stem && item.stem.trim()) || '题干暂未识别 · OCR 待补';

    // Progress · "今日已 grade" 才算 done · 不是"曾经 grade 过".
    // review_plan cyclic 模型: 昨晚 grade 留下 completedAt=昨晚 + next_due_at=今晚 ·
    // 今天看到这一条 → 该是 "未开始" (今天还没 grade), 不是 "已完成" (昨晚那次).
    let progress: 'done' | 'inprogress' | 'wait';
    let progressLabel: string;
    if (isCompletedToday(item.completedAt, now)) {
      progress = 'done';
      progressLabel = '已完成';
    } else {
      progress = 'wait';
      progressLabel = '未开始';
    }

    const itemData: ItemData = {
      nid: String(item.id),
      tLevel: `T${item.nodeIndex}`,
      hhmm,
      subject: subjectLabel,
      kp: '',  // followup: BE 再 join knowledge_points 表 (现在 wrong_item 没存 kp)
      stem,
      tags: [`T${item.nodeIndex}`],
      countdownState: cd.state,
      countdownLabel: cd.label,
      sideColor: color,
      progress,
      progressLabel,
    };

    const slotKey = getSlotKey(hh);
    if (!buckets[slotKey]) buckets[slotKey] = [];
    buckets[slotKey].push(itemData);
  }

  const order = ['now', 'afternoon', 'evening'];
  const slots: SlotData[] = [];
  for (const key of order) {
    if (buckets[key] && buckets[key].length > 0) {
      // 桶内 sort · P07-D · time 模式时桶内 hhmm 已自然有序但仍跑一次稳定 sort
      const sortedItems = [...buckets[key]].sort((a, b) => compareItems(a, b, sortMode));
      slots.push({
        key,
        title: getSlotTitle(key),
        iconClass: getSlotIconClass(key),
        items: sortedItems,
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
    sideColor: 'red', progress: 'inprogress', progressLabel: '进行中',
  },
  {
    nid: '1002', tLevel: 'T3', hhmm: '11:00', subject: '物理', kp: '欧姆定律 · 并联',
    stem: 'R₁=4Ω, R₂=6Ω 并联接 12V，求总电流。公式错误。',
    tags: ['并联电路', '★★'], countdownState: 'soon', countdownLabel: '1 h',
    sideColor: 'orange', progress: 'wait', progressLabel: '未开始',
  },
  {
    nid: '1003', tLevel: 'T4', hhmm: '14:30', subject: '化学', kp: '方程配平',
    stem: 'Al + HCl → AlCl₃ + H₂，系数 2:6:2:3。',
    tags: ['化学方程', '★★★'], countdownState: 'wait', countdownLabel: '5 h',
    sideColor: 'indigo', progress: 'wait', progressLabel: '未开始',
  },
  {
    nid: '1004', tLevel: 'T2', hhmm: '16:00', subject: '英语', kp: 'past perfect',
    stem: 'By the time he arrived, the meeting ___ already started.',
    tags: ['时态一致', '★★'], countdownState: 'wait', countdownLabel: '6 h 15 m',
    sideColor: 'green', progress: 'wait', progressLabel: '未开始',
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
