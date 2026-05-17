/**
 * Home API client · MP
 * trace: backend review-plan-service → GET /api/review/today → localhost:8085
 *
 * P-HOME 首页用 getHomeTodayCount 获取今日复习数量/进度
 * 复用 review service 的 /api/review/today 端点
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
}

export interface HomeTodayData {
  items: HomeTodayItem[];
  total: number;
  tz: string;
  /** BE 当前不返 · 见 FE 兼容: 缺失时 ?? 0 兜底 + 由 items.completedAt 派生 */
  done?: number;
}

/**
 * GET /api/review/today?tz=Asia/Shanghai
 * Returns today's review count + done count for P-HOME hero card.
 * httpJSON 自动 unwrapApiResult · 直接拿 inner shape · 不要再 .data
 */
export async function getHomeTodayCount(tz = 'Asia/Shanghai'): Promise<HomeTodayData> {
  const query = `?tz=${encodeURIComponent(tz)}`;
  return httpJSON<HomeTodayData>(
    `${BASE}/api/review/today${query}`,
  );
}
