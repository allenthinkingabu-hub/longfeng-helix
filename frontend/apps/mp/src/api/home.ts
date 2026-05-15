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
