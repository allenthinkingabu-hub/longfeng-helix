// S7 · API typed contracts · 手写骨架（后续 openapi-typescript 生成替换）
// 对齐 design/arch/s7-frontend-wrongbook.md §3.1

// ==================== 共享 ====================
export interface Cursor {
  cursor?: string;
  next_cursor?: string;
  has_more?: boolean;
}

export interface ErrorResponse {
  code: string;
  message: string;
  trace_id?: string;
}

// ==================== S3 wrongbook ====================
export type WrongItemStatus = 'pending' | 'analyzing' | 'completed' | 'error';

export interface WrongItemVO {
  id: string;
  subject: string;
  stem_text: string;
  tags: string[];
  status: WrongItemStatus;
  mastery: number; // 0..100
  image_url?: string;
  created_at: string; // ISO 8601
  version: number;
}

export interface WrongItemCreate {
  subject: string;
  stem_text: string;
  tags?: string[];
  image_id?: string; // S6 fileKey
}

export interface WrongItemListParams {
  cursor?: string;
  status?: 'active' | 'mastered';
  subject?: string;
  tags?: string[];
  difficulty?: string;
  limit?: number;
}

export interface WrongItemListResponse extends Cursor {
  items: WrongItemVO[];
}

export interface TagUpdatePayload {
  tags: string[];
  version: number; // If-Match optimistic lock
}

// ==================== S4 ai-analysis ====================
export interface SimilarItem {
  id: string;
  stem_text: string;
  distance: number;
  subject: string;
}

export interface SimilarResponse {
  items: SimilarItem[];
}

// SSE chunk 格式（GET /analysis/{id}）
export interface ExplainChunk {
  chunk: string;
  done?: boolean;
}

// ==================== S6 file-service ====================
export interface PresignRequest {
  mime: string;
  size: number;
  sha256?: string;
}

export interface PresignResponse {
  upload_url: string;
  file_key: string;
  image_url: string;
  ttl_seconds: number;
  bucket: string;
}

export interface FileCompleteResponse {
  file_key: string;
  status: 'READY' | 'QUARANTINED';
  variant_thumb_key?: string;
  variant_medium_key?: string;
}

// ==================== S3 wrongbook · P02 createPending (POST /api/wb/questions) ====================
// Aligns 1:1 with backend dto/CreateQuestionReq.java (wrongbook-service)
export interface CreateQuestionReq {
  studentId: number;
  subject: string;
  image_key?: string;
  mime?: string;
  grade_code?: string;
  source_type?: number;
  /** body field · authoritative source is the X-Idempotency-Key header (set by client) */
  idempotency_key?: string;
}

export interface CreateQuestionResp {
  qid: string;
}

// ==================== SC-01-E04a · P04 Result · GET /api/wb/questions/{qid} ====================
// 1:1 aligned with backend QuestionDetailDto + PlannedNodeDto (C01). Backend uses Jackson
// snake_case for nested keys; the questionsClient camelizes once before reaching FE.
export interface QuestionDetailSolutionStep {
  idx: number;
  title: string;
  detail?: string;
  formula?: string;
}
export interface QuestionDetailKnowledgePoint {
  id: string;
  name: string;
  weight: number;
}
export interface QuestionDetailModelInfo {
  name: string;
  version: string;
}
export interface QuestionDetail {
  id: string;
  subject: 'math' | 'physics' | 'chemistry' | 'english';
  stem: string;
  formula?: string;
  thumbnailUrl?: string;
  myAnswer: string;
  correctAnswer: string;
  reasonMarkdown: string;
  steps: QuestionDetailSolutionStep[];
  knowledgePoints: QuestionDetailKnowledgePoint[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  modelInfo: QuestionDetailModelInfo;
}
export interface QuestionPlannedNode {
  tLevel: 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
  dueAt: string;
  status: 'preview' | 'future' | 'done';
}
export interface QuestionDetailResp {
  question: QuestionDetail;
  plannedNodes: QuestionPlannedNode[];
}

// ==================== P04 Save · POST /api/wb/questions/{qid}/save ====================
// SC-01-E04c · 保存确认 → 触发后端 review-plan 生成 1 plan + 7 nodes（T0..T6）
// 后端 SaveQuestionResp 形如 { qid, planId, nodes:[{nid,tLevel,dueAt}×7] }（spec §4）
export interface SaveQuestionReq {
  qid: string;
  edits?: Partial<QuestionDetail>;
}

export interface SavedReviewNode {
  nid: string;
  tLevel: string;
  dueAt: string;
}

export interface SaveQuestionResp {
  qid: string;
  planId: string;
  nodes: SavedReviewNode[];
}

// ==================== S4 ai-analysis · P02 analyze-by-url (POST /api/ai/analyze) ====================
// SC-01-E02c · 拍完照、跳 P03 前触发 · 立即返 taskId + status=ANALYZING（HTTP 202）
// 对齐 backend AnalyzeController.AnalyzeByUrlRequest (snake_case task_id/image_url)
// 端点路径：网关 rewrite 前为 /api/ai/analyze-by-url，前端在 P02 spec §5 用 "POST /api/ai/analyze"
// 别名指向此异步形态（同步 multipart /analyze 形态仅 IT/debug 私有路径）。
export interface AnalyzeByUrlReq {
  /** Snowflake String · 由前端 P02 启动时生成（推荐复用 qid，保证 qid===taskId 简化日志关联） */
  task_id: string;
  /** 学科枚举 · MATH | PHYSICS | CHEMISTRY | ENGLISH | CHINESE（大写） */
  subject: string;
  /** OSS / MinIO presigned URL 或可访问的图片 URL（由 file_key 解析得到） */
  image_url: string;
}

export interface AnalyzeByUrlResp {
  task_id: string;
  status: 'ANALYZING';
}

// ==================== SC-01-T13 · P09 ReviewDone DTOs ====================
// 对齐 backend review-plan-service NodeResultResp.java + spec P09 §5

export interface NodeResultResp {
  planId: number;
  wrongItemId: number;
  nodeIndex: number;
  nodeState: string;            // "MASTERED" | "COMPLETED" | "ACTIVE"
  quality: number;
  easeBefore: number;
  easeAfter: number;
  intervalBefore: number;
  intervalAfter: number;
  nextDueAt: string;            // ISO 8601
  durationMs: number;
  mastered: boolean;
}

export interface NextInSessionResp {
  nextNid: string | null;
  completed: number;
  total: number;
  done: boolean;
}

export interface CalendarSubscribeResp {
  eventId: number;
  subscribed: boolean;
  subscribedAt: string;
  warningCode?: string;
}

// ==================== SC-01-T12 · POST /api/review/nodes/{nid}/grade ====================
// 对齐 backend GradeReq.java + spec P08 §5 #3

export type GradeValue = 'MASTERED' | 'PARTIAL' | 'FORGOT';

export interface GradeReq {
  grade: GradeValue;
  timeSpentMs: number;
  answerText?: string;
}

/** Response 复用 NodeResultResp (backend CompleteResult maps 1:1) */
export type GradeResp = NodeResultResp;

// ==================== SC-01-T10 · GET /api/review/today · P07 TodayReview ====================
// 对齐 backend ReviewPlanController.today() + spec P07-review-today.spec.md §5 #1
export interface TodaySlotItem {
  nid: string;
  tLevel: 'T0' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';
  hhmm: string;
  nextDueAt: string;
  subject: string;
  kp: string;
  stem: string;
  tags: string[];
  status: 'SCHEDULED' | 'PUSHED' | 'OPEN' | 'GRADED';
}

export interface TodaySlot {
  slotKey: 'now' | 'morning' | 'afternoon' | 'evening';
  slotTitle: string;
  items: TodaySlotItem[];
}

export interface TodayResp {
  date: string;
  tzOffset: string;
  totalCount: number;
  estMinutes: number;
  doneCount: number;
  inProgressCount: number;
  waitCount: number;
  progressPct: number;
  masteryPct: number;
  slots: TodaySlot[];
}

// ==================== S5 review-plan（readonly）====================
export interface ReviewPlanVO {
  id: string;
  wrong_item_id: string;
  user_id: string;
  node_index: number; // 0..6
  next_due_at: string; // ISO 8601
  mastery: number;
  ease_factor: number;
  interval: number;
}

// ==================== SC-01-D01 · home-aggregator · GET /api/home/today ====================
// 对齐 backend/review-plan-service HomeAggregatorController + HomeTodayResp
// spec: design/system/pages/P-HOME.spec.md §5 (主聚合接口 · MVP 子集 today.{total,done,circleProgress})
export interface HomeTodayCard {
  total: number;
  done: number;
  /** 0..1，前端渲染圆环时乘 100 取整 */
  circleProgress: number;
}

export interface HomeTodayResume {
  sid?: string | null;
  nextNid?: string | null;
}

export interface HomeTodayResp {
  tz: string;
  today: HomeTodayCard;
  /** B02 决策：当前阶段恒 null（前端隐藏 Resume Banner） */
  resume?: HomeTodayResume | null;
}

// ==================== SC-01-C05 · review-plan-service · POST /api/review/sessions ====================
// 对齐 backend dto: CreateSessionReq / CreateSessionResp（snake_case node_ids；前端 camelCase）
// spec: design/system/pages/P-HOME.spec.md §5 + P07-review-today.spec.md §5
export interface CreateReviewSessionReq {
  /** YYYY-MM-DD · 缺省后端取今日（按 tz 解释） */
  date?: string;
  /** 指定节点 nid 列表（Snowflake String）；缺省后端按 today due 全量构造 */
  nodeIds?: string[];
  /** IANA tz，可选，缺省 Asia/Shanghai */
  tz?: string;
}

export interface CreateReviewSessionResp {
  /** 会话 ID (Snowflake String) */
  sid: string;
  /** 节点 nid 列表（按 next_due_at asc） */
  nodeIds: string[];
  /** 节点总数 */
  total: number;
}
