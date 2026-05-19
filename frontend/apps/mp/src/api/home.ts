/**
 * Home API client · MP
 * trace: backend review-plan-service → GET /api/review/today → localhost:8085
 *
 * P-HOME 首页用 getHomeTodayCount 获取今日复习数量/进度
 * 复用 review service 的 /api/review/today 端点
 *
 * SC-16-T02 (2026-05-16): 新增 getHomeTodayAggregate · GET /api/home/today 含 weekSummary 4 字段
 * - INV-6: P-HOME 4 数字 (masteryRate / sparkline / streak / newCount) 仅从此投影消费
 * - 严禁 P-HOME 调用 GET /api/home/weekly (audit grep 验证 0 命中)
 */

import { apiBase, httpJSON } from './_http';

const BASE = apiBase('review');

// ── Types ────────────────────────────────────────────────────

/**
 * BE wire shape · trace: review-plan-service ReviewPlanController L226
 * `TodayResp(items, items.size(), tz)` · 注意 BE 不返 `done` 字段 ·
 * FE 必须从 items.filter(completedAt!=null) 自己派生 (Fix-2026-05-16)
 */
export interface HomeTodayItem {
  id: number;                    // = nid · 节点 id
  wrongItemId: number;           // 关联 wb_question.id · 用于反查学科
  studentId: number;
  nodeIndex: number;             // T0..T6
  status: 'ACTIVE' | 'MASTERED';
  nextDueAt: string;
  completedAt: string | null;    // 非 null = 当日已 grade · spec L94 doneCount=GRADED 口径用这个
  // ⚠️ BE ReviewPlanDto 不返 mastered 字段 (只返 status: ACTIVE|MASTERED) ·
  // 进度/角标 done 口径走 completedAt · mastery 维度由 BE TodayResp.masteryPct 单独反映.
  // 保留 optional 让前期 mastered=done 误用代码静默兼容 · 任何新代码都读 completedAt.
  mastered?: boolean;
  easeFactor: number;
  totalReview: number;
  totalForget: number;
  // BE today endpoint single-DB join wrong_item · 'math'/'physics'/'chemistry'/'english'/'chinese' ·
  // FE 自己 i18n 映射 + chip 渲染 (替代之前 MVP_SUBJECTS 写死 3/2/3).
  subject?: string | null;
}

export interface HomeTodayData {
  items: HomeTodayItem[];
  total: number;
  tz: string;
  /** BE 当前不返 · 见 FE 兼容: 缺失时 ?? 0 兜底 + 由 items.completedAt 派生 */
  done?: number;
  /**
   * P-HOME hero "掌握 N 题" chip · 累计已掌握题数.
   * 来源: backend HomeAggregatorController 跨服务调 wrongbook-service /internal/students/{id}/mastered-count
   * (mastery=2 OR status=ARCHIVED, deleted_at IS NULL).
   * 缺失/降级时 ?? 0 兜底 (BE wrongbook 不可用时降级返 0).
   */
  masteredTotal?: number;
}

/**
 * GET /api/review/today?tz=Asia/Shanghai
 * Returns today's review count + done count for P-HOME hero card.
 * 必带 X-User-Id Header (backend default 0 时所有人共看 student#0 数据 · 隔离 bug).
 */
export async function getHomeTodayCount(
  studentId: string,
  tz = 'Asia/Shanghai',
): Promise<HomeTodayData> {
  const query = `?tz=${encodeURIComponent(tz)}`;
  return httpJSON<HomeTodayData>(
    `${BASE}/api/review/today${query}`,
    { method: 'GET', headers: { 'X-User-Id': studentId } },
  );
}

// ── SC-16-T02 · /api/home/today (含 weekSummary 投影) ─────────────
// trace: backend HomeAggregatorController + HomeTodayResp + WeekSummaryDto
// spec: design/system/pages/P-HOME.spec.md §5 + §5.2 weekSummary 字段集

export interface HomeWeekSummaryDto {
  /** ISO 8601 week e.g. "2026-W20" · 永不为 null */
  week: string;
  /** null = 空周 (0 GRADED · "没复习" ≠ "掌握 0%") */
  masteryRate: number | null;
  /** 长度恒 7 · null 索引 = 该日 0 复习 (不 forward-fill 不打底 0) */
  sparkline: Array<number | null>;
  /** Streak yesterday-back · integer ≥ 0 · 0 时 chip 整体隐藏 */
  streak: number;
  /** 本周新增错题数 · integer ≥ 0 · 0 也渲染 ("+0") */
  newCount: number;
}

export interface HomeTodayCard {
  total: number;
  done: number;
  /** 0..1 · 前端乘 100 取整 */
  circleProgress: number;
  /**
   * P-HOME hero "掌握 N 题" chip · 累计已掌握题数 (mastery=2 OR ARCHIVED).
   * 来源: HomeAggregatorController 跨服务调 wrongbook-service · 失败降级 0.
   * 缺失时 ?? 0 兜底.
   */
  masteredTotal?: number;
}

export interface HomeTodayAggregate {
  tz: string;
  today: HomeTodayCard;
  resume: { sid?: string | null; nextNid?: string | null } | null;
  weekSummary: HomeWeekSummaryDto | null;
}

/**
 * SC-16-T02 · GET /api/home/today · 完整聚合 (含 weekSummary)
 * P-HOME 必带 X-User-Id Header (MVP 鉴权 · INV-7)
 */
export async function getHomeTodayAggregate(
  studentId: string,
  tz = 'Asia/Shanghai',
): Promise<HomeTodayAggregate> {
  const query = `?tz=${encodeURIComponent(tz)}`;
  const headers: Record<string, string> = {
    'X-User-Id': studentId,
    'X-User-Timezone': tz,
  };
  return httpJSON<HomeTodayAggregate>(
    `${BASE}/api/home/today${query}`,
    { method: 'GET', headers },
  );
}

// ── 本周回顾 4 stat · 替代 MVP_WEEK_STATS ───────────────────────
export interface WeeklyStatsResp {
  mastered: number;
  newItems: number;
  forgotten: number;
  masteryRate: number;
}

export async function getWeeklyStats(
  studentId: string,
  tz = 'Asia/Shanghai',
): Promise<WeeklyStatsResp> {
  return httpJSON<WeeklyStatsResp>(
    `${BASE}/api/home/weekly-stats?tz=${encodeURIComponent(tz)}`,
    { method: 'GET', headers: { 'X-User-Id': studentId } },
  );
}

// ── 本周日程 dots · 替代 PLACEHOLDER_DOTS_BY_WEEKDAY ──────────────
export interface WeekDotsResp {
  days: Array<{ date: string; dots: string[] }>;
}

export async function getWeekDots(
  studentId: string,
  tz = 'Asia/Shanghai',
): Promise<WeekDotsResp> {
  return httpJSON<WeekDotsResp>(
    `${BASE}/api/home/week-dots?tz=${encodeURIComponent(tz)}`,
    { method: 'GET', headers: { 'X-User-Id': studentId } },
  );
}

// ── 最近消息 (≤3 · 派生自现有数据) · 替代 MVP_MESSAGES ──────────
export interface MessageItem {
  title: string;
  subtitle: string;
  time: string;
  icon: string;
  iconColor: string;
  theme: string;
}
export interface MessagesResp {
  messages: MessageItem[];
}

export async function getRecentMessages(
  studentId: string,
  tz = 'Asia/Shanghai',
): Promise<MessagesResp> {
  return httpJSON<MessagesResp>(
    `${BASE}/api/home/messages/recent?tz=${encodeURIComponent(tz)}`,
    { method: 'GET', headers: { 'X-User-Id': studentId } },
  );
}
