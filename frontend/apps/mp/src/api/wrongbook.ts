/**
 * Wrongbook API client
 * Port: 8082 (wrongbook-service)
 * Uses shared _http.ts dual-runtime adapter (wx.request in MP, fetch in vitest)
 */
import { apiBase, httpJSON } from './_http';

export interface QuestionStep {
  idx: number;
  title: string;
  formula?: string;
}

export interface KnowledgePoint {
  id: string;
  name: string;
  weight: number;
}

export interface PlannedNode {
  tLevel: string;
  dueAt: string;
  status: string;
}

export interface QuestionDetail {
  id: string;
  subject: string;
  stem: string;
  formula?: string;
  myAnswer: string;
  correctAnswer: string;
  reasonMarkdown: string;
  steps: QuestionStep[];
  knowledgePoints: KnowledgePoint[];
  difficulty: number;
  confidence: number;
  modelInfo?: { name: string; version: string };
}

export interface GetQuestionByIdResp {
  question: QuestionDetail;
  plannedNodes: PlannedNode[];
}

/**
 * BE wire shape from QuestionDetailController.get — snake_case keys + `qid`
 * (DB column). FE pages consume the camelCase {@link QuestionDetail} shape with
 * `id`, so this client maps the wire response into the FE-facing form. Fields
 * that BE doesn't supply today (myAnswer / correctAnswer / reasonMarkdown /
 * steps / formula) default to empty values — the AI sidecar branch in P04
 * fills `reasonMarkdown` + `steps` when the answer is available.
 */
// BE analysis_result.steps jsonb 实际 shape · AI prompt 直出 ·
// 之前误标 QuestionStep[] · 导致 normalizeQuestion 不映射字段 ·
// FE wxml 渲染 {{item.idx}} / {{item.title}} 全 undefined → 圆点空 + 文字空.
interface RawStepWire {
  stepNo?: number;
  step_no?: number;  // 兼容 snake_case
  idx?: number;       // 兼容已经是 FE 形态
  text?: string;
  title?: string;
  formula?: string;
}

interface QuestionDetailWire {
  qid?: string;
  id?: string;
  subject?: string;
  stem_text?: string | null;
  stem?: string | null;
  ocr_text?: string | null;
  difficulty?: number | null;
  mastery?: number | null;
  formula?: string | null;
  my_answer?: string | null;
  correct_answer?: string | null;
  reason_markdown?: string | null;
  steps?: RawStepWire[] | null;
  knowledge_points?: KnowledgePoint[] | null;
  confidence?: number | null;
  model_info?: { name: string; version: string } | null;
}

interface GetQuestionByIdRespWire {
  question?: QuestionDetailWire | null;
  planned_nodes?: PlannedNode[] | null;
  plannedNodes?: PlannedNode[] | null;
}

function normalizeQuestion(w: QuestionDetailWire | null | undefined): QuestionDetail {
  const src = w || {};
  // BE 给的 step 是 {stepNo, text, formula?} (AI prompt 输出 jsonb 直存) ·
  // FE wxml 渲染 {idx, title, formula?} · 这里做字段映射 · 之前漏映射 → 圆点空.
  const stepsIn = src.steps ?? [];
  const steps: QuestionStep[] = stepsIn.map((s, i) => ({
    idx: typeof s.stepNo === 'number' ? s.stepNo
       : typeof s.step_no === 'number' ? s.step_no
       : typeof s.idx === 'number' ? s.idx
       : i + 1,
    title: (s.text ?? s.title ?? '').toString(),
    formula: s.formula,
  }));
  return {
    id: src.id ?? src.qid ?? '',
    subject: src.subject ?? '',
    stem: src.stem ?? src.stem_text ?? src.ocr_text ?? '',
    formula: src.formula ?? '',
    myAnswer: src.my_answer ?? '',
    correctAnswer: src.correct_answer ?? '',
    reasonMarkdown: src.reason_markdown ?? '',
    steps,
    knowledgePoints: src.knowledge_points ?? [],
    difficulty: typeof src.difficulty === 'number' ? src.difficulty : 3,
    confidence: typeof src.confidence === 'number' ? src.confidence : 0,
    modelInfo: src.model_info ?? undefined,
  };
}

/** GET /api/wb/questions/:qid */
export async function getQuestionById(qid: string): Promise<GetQuestionByIdResp> {
  const raw = await httpJSON<GetQuestionByIdRespWire>(
    `${apiBase('wb')}/api/wb/questions/${qid}`,
  );
  return {
    question: normalizeQuestion(raw.question),
    plannedNodes: raw.plannedNodes ?? raw.planned_nodes ?? [],
  };
}

// ── create question (used by P02 capture page) ──────────────────

export interface CreateQuestionReq {
  studentId: number;
  subject: string;
  /** OSS object key returned by file-service presign(). */
  image_key: string;
  mime: string;
  source_type: number;
  /**
   * Required by backend (QuestionDetailController.create). Pass the same key
   * used for file-service presign so a weak-network retry of the whole
   * capture chain dedupes on a single wb_question row (TC-01.02 invariant).
   */
  idempotencyKey: string;
}

export interface CreateQuestionResp {
  qid: string;
  status?: string;
}

/** POST /api/wb/questions */
export function createQuestion(req: CreateQuestionReq): Promise<CreateQuestionResp> {
  // Backend CreateQuestionReq uses snake_case via @JsonProperty: camelCase
  // fields like `studentId` get dropped → @NotNull violation → HTTP 400.
  const body: Record<string, unknown> = {
    student_id: req.studentId,
    subject: req.subject,
    origin_image_key: req.image_key,
    mime: req.mime,
    source_type: req.source_type,
  };
  return httpJSON<CreateQuestionResp>(
    `${apiBase('wb')}/api/wb/questions`,
    {
      method: 'POST',
      body,
      headers: { 'X-Idempotency-Key': req.idempotencyKey },
    },
  );
}

// ── save / confirm question (P04 "保存并开启复习" button) ───────

export interface SaveQuestionResp {
  /** Echoed qid (DB primary key as string). */
  qid: string;
  /** wrong_item.status after save · 3 == CONFIRMED. */
  status: number;
  /** Optional msgkey for FE toast (e.g. "msgkey:wb.save.success"). */
  message?: string;
}

/**
 * POST /api/wb/questions/{qid}/save
 *
 * <p>Transitions wrong_item.status → 3 (CONFIRMED), writes question.created.topic
 * outbox event, and (in local dev) synchronously triggers review-plan-service to
 * create the 7 SM-2 / Ebbinghaus review nodes. Production path also publishes the
 * event via RocketMQ for downstream consumers; review-plan-service de-dupes by
 * wrongItemId so the sync + async paths can coexist.
 */
export function saveQuestion(qid: string): Promise<SaveQuestionResp> {
  return httpJSON<SaveQuestionResp>(
    `${apiBase('wb')}/api/wb/questions/${qid}/save`,
    { method: 'POST', body: {} },
  );
}

// ── list wrong questions (P05 wrongbook list page) ───────────

export interface WrongQuestionListItem {
  qid: string;
  subject: string;
  kp: string[];
  stemSnippet: string;
  thumb: string;
  masteryPct: number;
  masteryLabel: 'NOT_MASTERED' | 'PARTIAL' | 'MASTERED';
  nextDueAt: string;
  nodeStage: number;
  createdAt: string;
  errorType?: string;
  difficulty: number;
  questionNo: string;
}

export interface ListWrongQuestionsResp {
  items: WrongQuestionListItem[];
  total: number;
  page: number;
  size: number;
}

export interface ListWrongQuestionsParams {
  page?: number;
  size?: number;
  subject?: string;
  mastery?: string;
}

// BE 实际 wire shape (snake_case + 字段缺失) · 跟 FE 类型对不上
// 真实 curl 探的:
// { source_type, stem_text(可 null), origin_image_key, created_at, qid,
//   subject, status, mastery(数值 0..2), difficulty(可 null) }
// FE WrongQuestionListItem 期待 camelCase + kp[] / stemSnippet / masteryLabel /
// nextDueAt / nodeStage / questionNo · 之前 0c7e0b8 之前是直接 cast ·
// 跑到 helpers.enrichItem(stemSnippet.slice) 时 TypeError 整页 ERROR.
interface WrongQuestionListItemWire {
  qid?: string;
  subject?: string;
  stem_text?: string | null;
  stemSnippet?: string | null;
  origin_image_key?: string | null;
  thumb?: string | null;
  mastery?: number | null;
  masteryLabel?: string;
  difficulty?: number | null;
  created_at?: string;
  createdAt?: string;
  next_due_at?: string | null;
  nextDueAt?: string | null;
  node_stage?: number | null;
  nodeStage?: number | null;
  knowledge_points?: string[] | null;
  kp?: string[] | null;
  question_no?: string | null;
  questionNo?: string | null;
  error_type?: string | null;
  errorType?: string | null;
  status?: number;
}

function masteryLabelFromNum(m: number | null | undefined): 'NOT_MASTERED' | 'PARTIAL' | 'MASTERED' {
  // BE wrong_item.mastery: 0=未掌握 1=部分 2=已掌握 · 缺/null 当未掌握
  if (m == null) return 'NOT_MASTERED';
  if (m >= 2) return 'MASTERED';
  if (m === 1) return 'PARTIAL';
  return 'NOT_MASTERED';
}

function normalizeListItem(w: WrongQuestionListItemWire): WrongQuestionListItem {
  const stemRaw = w.stemSnippet ?? w.stem_text ?? '';
  return {
    qid: w.qid ?? '',
    subject: w.subject ?? '',
    kp: w.kp ?? w.knowledge_points ?? [],
    // stem_text 可为 null (OCR 未跑完时) · 走空串 · enrichItem.slice 安全
    stemSnippet: stemRaw ?? '',
    thumb: w.thumb ?? w.origin_image_key ?? '',
    masteryPct: typeof w.mastery === 'number' ? w.mastery : 0,
    masteryLabel: (w.masteryLabel as 'NOT_MASTERED' | 'PARTIAL' | 'MASTERED') ?? masteryLabelFromNum(w.mastery),
    nextDueAt: w.nextDueAt ?? w.next_due_at ?? '',
    nodeStage: typeof w.nodeStage === 'number' ? w.nodeStage : (typeof w.node_stage === 'number' ? w.node_stage : 1),
    createdAt: w.createdAt ?? w.created_at ?? '',
    errorType: w.errorType ?? w.error_type ?? undefined,
    difficulty: typeof w.difficulty === 'number' ? w.difficulty : 0,
    questionNo: w.questionNo ?? w.question_no ?? '',
  };
}

interface ListWrongQuestionsRespWire {
  items?: WrongQuestionListItemWire[] | null;
  total?: number;
  page?: number;
  size?: number;
}

/** GET /api/wb/questions */
export async function listWrongQuestions(
  params: ListWrongQuestionsParams = {},
): Promise<ListWrongQuestionsResp> {
  const parts: string[] = [];
  if (params.page !== undefined) parts.push(`page=${params.page}`);
  if (params.size !== undefined) parts.push(`size=${params.size}`);
  if (params.subject) parts.push(`subject=${params.subject}`);
  if (params.mastery) parts.push(`mastery=${params.mastery}`);
  const query = parts.join('&');
  const url = `${apiBase('wb')}/api/wb/questions${query ? `?${query}` : ''}`;
  const raw = await httpJSON<ListWrongQuestionsRespWire>(url);
  return {
    items: (raw.items ?? []).map(normalizeListItem),
    total: typeof raw.total === 'number' ? raw.total : 0,
    page: typeof raw.page === 'number' ? raw.page : (params.page ?? 1),
    size: typeof raw.size === 'number' ? raw.size : (params.size ?? 50),
  };
}
