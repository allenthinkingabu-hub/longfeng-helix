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
interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface HomeTodayData {
  total: number;
  done: number;
  items: unknown[];
  tz: string;
}

/**
 * GET /api/review/today?tz=Asia/Shanghai
 * Returns today's review count + done count for P-HOME hero card
 */
export async function getHomeTodayCount(tz = 'Asia/Shanghai'): Promise<ApiEnvelope<HomeTodayData>> {
  const query = `?tz=${encodeURIComponent(tz)}`;
  return httpJSON<ApiEnvelope<HomeTodayData>>(
    `${BASE}/api/review/today${query}`,
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
