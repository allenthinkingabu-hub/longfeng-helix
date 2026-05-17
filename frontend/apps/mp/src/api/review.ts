/**
 * Review API client · MP
 * trace: backend/review-plan-service ReviewPlanController.java → /api/review/* → localhost:8085
 *
 * 完整覆盖 SC-01-C05 8 端点 + completeSession (T13)
 * T06: 补齐缺失函数 · 与 backend Controller 1:1 对齐
 */

import { apiBase, httpJSON } from './_http';

const BASE = apiBase('review');

// ── Envelope ─────────────────────────────────────────────────
interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

// ── Types ────────────────────────────────────────────────────

export interface ReviewPlanDto {
  id: number;
  wrongItemId: number;
  studentId: number;
  nodeIndex: number;
  easeFactor: number;
  intervalDays: number;
  nextDueAt: string;
  completedAt: string | null;
  mastered: boolean;
  // P07 单库 enrich · BE today join wrong_item 注入 · 其他端点为 null
  subject?: string | null;
  stem?: string | null;
}

export interface CreateSessionResp {
  sid: string;
  nids: number[];
  total: number;
}

export interface TodayResp {
  items: ReviewPlanDto[];
  total: number;
  tz: string;
}

export interface CompleteResult {
  planId: number;
  quality: number;
  oldEF: number;
  newEF: number;
  oldInterval: number;
  newInterval: number;
  nextDueAt: string;
  mastered: boolean;
}

export interface NextInSessionResp {
  nextNid: number | null;
  completed: number;
  total: number;
  done: boolean;
}

export interface NodeResultResp {
  nid: number;
  wrongItemId: number;
  nodeIndex: number;
  nodeState: string;
  quality: number | null;
  easeFactorBefore: number | null;
  easeFactorAfter: number | null;
  intervalDaysBefore: number | null;
  intervalDaysAfter: number | null;
  nextDueAt: string | null;
  durationMs: number | null;
  mastered: boolean;
}

export interface RevealResp {
  nid: number;
  revealedAt: string;
}

// ── T13 · completeSession ───────────────────────────────────
export interface CompleteSessionResp {
  sessionId: string;
  status: string;
  completedAt: string;
  stats: {
    mastered: number;
    partial: number;
    forgot: number;
    total: number;
  };
}

/**
 * POST /api/review/sessions/{sid}/complete
 * 标记一个 review session 完成 · H5 sibling: ReviewDone handleEnd
 */
export async function completeSession(sid: string): Promise<CompleteSessionResp> {
  return httpJSON<CompleteSessionResp>(
    `${BASE}/api/review/sessions/${sid}/complete`,
    { method: 'POST' },
  );
}

// ── SC-01-C05 #1 · createSession ────────────────────────────
export interface CreateSessionReq {
  node_ids?: number[];
  tz?: string;
  date?: string;
}

// NOTE: `httpJSON` 内置 unwrapApiResult · 自动剥外层 {code,message,data}
// 所以所有返回类型 = inner data shape · 调用方直接读字段, 不要写 resp.data.X
export async function createSession(req?: CreateSessionReq): Promise<CreateSessionResp> {
  return httpJSON<CreateSessionResp>(
    `${BASE}/api/review/sessions`,
    { method: 'POST', body: req ?? {} },
  );
}

// ── SC-01-C05 #2 · getToday ─────────────────────────────────
export async function getToday(tz?: string): Promise<TodayResp> {
  const query = tz ? `?tz=${encodeURIComponent(tz)}` : '';
  return httpJSON<TodayResp>(
    `${BASE}/api/review/today${query}`,
  );
}

// ── SC-01-C05 #3 · getNode ──────────────────────────────────
export async function getNode(nid: number | string): Promise<ReviewPlanDto> {
  return httpJSON<ReviewPlanDto>(
    `${BASE}/api/review/nodes/${nid}`,
  );
}

// ── SC-01-C05 #4 · openNode ─────────────────────────────────
export async function openNode(nid: number | string): Promise<null> {
  return httpJSON<null>(
    `${BASE}/api/review/nodes/${nid}/open`,
    { method: 'POST' },
  );
}

// ── SC-01-C05 #5 · revealNode ───────────────────────────────
export async function revealNode(nid: number | string): Promise<RevealResp> {
  return httpJSON<RevealResp>(
    `${BASE}/api/review/nodes/${nid}/reveal`,
    { method: 'POST' },
  );
}

// ── SC-01-C05 #6 · gradeNode ────────────────────────────────
export interface GradeReq {
  grade: 'MASTERED' | 'PARTIAL' | 'FORGOT';
  timeSpentMs?: number;
}

export async function gradeNode(nid: number | string, req: GradeReq): Promise<CompleteResult> {
  return httpJSON<CompleteResult>(
    `${BASE}/api/review/nodes/${nid}/grade`,
    { method: 'POST', body: req },
  );
}

// ── SC-01-C05 #7 · nextInSession ────────────────────────────
export async function nextInSession(sid: string): Promise<NextInSessionResp> {
  return httpJSON<NextInSessionResp>(
    `${BASE}/api/review/sessions/${sid}/next`,
    { method: 'POST' },
  );
}

// ── SC-01-C05 #8 · nodeResult ───────────────────────────────
export async function nodeResult(nid: number | string): Promise<NodeResultResp> {
  return httpJSON<NodeResultResp>(
    `${BASE}/api/review/nodes/${nid}/result`,
  );
}
