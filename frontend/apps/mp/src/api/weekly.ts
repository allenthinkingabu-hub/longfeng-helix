/**
 * SC-16-T02 · Weekly API client · MP
 * trace: backend review-plan-service WeeklyController · GET /api/home/weekly
 *
 * 必带 X-User-Id Header (MVP 鉴权 · 与 /api/home/today 一致 · 登录 SC-00 上线时升 JWT)
 * 返回完整 WeeklyReviewResp (含 hero / subjectRadar / weakKPs / stats / failedTop / aiInsight)
 */

import { apiBase, httpJSON } from './_http';

const BASE = apiBase('review');

// ─── Types · 字符级对齐 backend WeeklyReviewResp record ─────────────
export interface WeeklyRangeDto {
  from: string;
  to: string;
}

export interface WeeklyHeroDto {
  masteryRate: number | null;
  masteryDelta: number | null;
  sparkline: Array<number | null>;
}

export interface WeeklySubjectRadarDto {
  subject: string;
  masteryRate: number;
  sampleSize: number;
}

export interface WeeklyWeakKpDto {
  kpId: string;
  kpName: string;
  subject: string;
  recentMissCount: number;
  totalMissCount: number;
}

export interface WeeklyStatsDto {
  reviewedCount: number;
  reviewedDurationMin: number;
  newCount: number;
}

export interface WeeklyFailedQDto {
  /** backend WeeklyReviewResp.FailedQ.questionId */
  questionId: string;
  subject: string;
  missCount: number;
}

export interface WeeklyAiInsightDto {
  insightId: string;
  text: string;
  generatedAt: string;
}

export interface WeeklyReviewData {
  week: string;
  range: WeeklyRangeDto;
  hero: WeeklyHeroDto;
  subjectRadar: WeeklySubjectRadarDto[];
  weakKPs: WeeklyWeakKpDto[];
  stats: WeeklyStatsDto;
  failedTop: WeeklyFailedQDto[];
  aiInsight: WeeklyAiInsightDto | null;
}

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * SC-16-T02 · GET /api/home/weekly
 * 返完整 WeeklyReviewResp · 调用方按 §6 状态机切 LOADING/READY/EMPTY/ERROR
 * - stats.reviewedCount === 0 → EMPTY
 * - 5xx → ERROR (调用方 try/catch)
 *
 * MVP 鉴权 · 调用方传 studentId (e.g. '1') · 必带 X-User-Id Header
 */
export async function getWeeklyReview(
  studentId: string,
  tz = 'Asia/Shanghai',
): Promise<WeeklyReviewData> {
  const query = `?tz=${encodeURIComponent(tz)}`;
  const headers: Record<string, string> = {
    'X-User-Id': studentId,
    'X-User-Timezone': tz,
  };
  // httpJSON 自动 unwrap ApiResult envelope (code/message/data → data)
  return httpJSON<WeeklyReviewData>(
    `${BASE}/api/home/weekly${query}`,
    { method: 'GET', headers },
  );
}

/**
 * 类型 export 给 unit test 复用
 */
export type { ApiEnvelope };
