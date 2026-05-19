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
  // Snowflake ID 19 位 > 2^53 · BE 用 @JsonSerialize(ToStringSerializer)
  // 把 Long 序列化成字符串发出来 · 不然 JS Number 精度只到 9e15 · 后 3 位被截.
  id: string;
  wrongItemId: string;
  studentId: string;
  nodeIndex: number;
  easeFactor: number;
  intervalDays: number;
  nextDueAt: string;
  completedAt: string | null;
  // BE 真返 status 字符串 ("ACTIVE"|"MASTERED") · FE 想判 "真掌握" 时读这个 ·
  // 进度/已完成走 completedAt 口径 (spec L94 GRADED · 任务完成度).
  status?: 'ACTIVE' | 'MASTERED';
  // ⚠️ BE ReviewPlanDto.java 不返 mastered 字段 (只返 status). FE 旧代码读这个永远 undefined.
  // 保留 optional 让旧调用点静默兼容 · 任何新代码都应该读 completedAt 或 status === 'MASTERED'.
  mastered?: boolean;
  // P07 单库 enrich · BE today join wrong_item 注入 · 其他端点为 null
  subject?: string | null;
  stem?: string | null;
}

export interface CreateSessionResp {
  sid: string;
  // BE @JsonSerialize(contentUsing=ToStringSerializer) · 每个 Long nid 是字符串
  nids: string[];
  total: number;
}

export interface TodayResp {
  items: ReviewPlanDto[];
  total: number;
  tz: string;
  // P07 spec L98 · 0-100 · BE 算 latest ease_factor_after avg → mastery 映射 ·
  // 0 = 今日所有题目全新没复习过 (诚实 · 不是 hard-code 假死值).
  masteryPct?: number | null;
}

export interface CompleteResult {
  // Snowflake ID 19 位 → BE ToStringSerializer 输出字符串 · 避免 JS 精度截尾
  planId: string;
  quality: number;
  oldEF: number;
  newEF: number;
  oldInterval: number;
  newInterval: number;
  nextDueAt: string;
  mastered: boolean;
}

export interface NextInSessionResp {
  nextNid: string | null;
  completed: number;
  total: number;
  done: boolean;
}

export interface NodeResultResp {
  // Snowflake ID 走 ToStringSerializer · FE 必须 string · 否则精度截尾 184 → 200
  nid?: string;
  planId?: string;
  wrongItemId: string;
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
  // P09-MASTERY · BE review_plan.mastery_score · 真值 0..100 · 没复习过 = 0 (诚实).
  masteryScore?: number | null;
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

// ── SC-01-C05 #6 · gradeNode (SC20-T05 · 加 finalGradeSource 字段 · 向后兼容) ──
// 后端 SC20-T03 已落地: ReviewPlanController.java POST :grade body 接受 final_grade_source
// (default 'self' · 旧客户端不传行为 100% 一致 · spec §5 改 2 字面)
// satellite §10.18 + design/system/pages/P08-review-exec-ai-judge.spec.md §5 改 2
export interface GradeReq {
  grade: 'MASTERED' | 'PARTIAL' | 'FORGOT';
  timeSpentMs?: number;
  /** SC20-T05 · A.2 双信源溯源宪法 · 缺省 'self' · 见 P08-ai-judge spec §6.3 */
  final_grade_source?: 'self' | 'ai_accepted' | 'ai_overridden';
}

export async function gradeNode(
  nid: number | string,
  req: GradeReq,
  idempotencyKey?: string,
): Promise<CompleteResult> {
  return httpJSON<CompleteResult>(
    `${BASE}/api/review/nodes/${nid}/grade`,
    {
      method: 'POST',
      body: req,
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
    },
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

// ── SC20-T04 · M-AI-ANSWER-JUDGE §10.17 · POST /api/review/nodes/{nid}/judge ──
// trace: biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md §10.17 + spec §5 #1
//        SC20-T02 backend AnswerJudgeService 已实装 · 接收 user_answer_image_key 返 verdict/confidence/reason
// 5-8s sync REST · Sonnet 主 · GPT-4o 备 · 503 AI_SERVICE_UNAVAILABLE 时前端走 banner 降级
// 本 task (SC20-T04 mp frontend photo tab) 只调本接口 · 不解析 verdict 字段 (那是 T05 banner 的事)
export interface JudgeReq {
  user_answer_image_key: string;
}

export interface JudgeResp {
  verdict: 'MASTERED' | 'PARTIAL' | 'FORGOT';
  confidence: number;
  reason: string;
  status: 'DONE' | 'LOW_CONFIDENCE' | 'TIMEOUT';
  matched_steps?: string[];
  missed_steps?: string[];
}

export async function judgeNode(
  nid: number | string,
  req: JudgeReq,
  idempotencyKey: string,
): Promise<JudgeResp> {
  return httpJSON<JudgeResp>(
    `${BASE}/api/review/nodes/${nid}/judge`,
    { method: 'POST', body: req, headers: { 'X-Idempotency-Key': idempotencyKey } },
  );
}
