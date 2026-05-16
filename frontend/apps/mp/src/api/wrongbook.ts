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
  steps?: QuestionStep[] | null;
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
  return {
    id: src.id ?? src.qid ?? '',
    subject: src.subject ?? '',
    stem: src.stem ?? src.stem_text ?? src.ocr_text ?? '',
    formula: src.formula ?? '',
    myAnswer: src.my_answer ?? '',
    correctAnswer: src.correct_answer ?? '',
    reasonMarkdown: src.reason_markdown ?? '',
    steps: src.steps ?? [],
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

/** GET /api/wb/questions */
export function listWrongQuestions(
  params: ListWrongQuestionsParams = {},
): Promise<ListWrongQuestionsResp> {
  const parts: string[] = [];
  if (params.page !== undefined) parts.push(`page=${params.page}`);
  if (params.size !== undefined) parts.push(`size=${params.size}`);
  if (params.subject) parts.push(`subject=${params.subject}`);
  if (params.mastery) parts.push(`mastery=${params.mastery}`);
  const query = parts.join('&');
  const url = `${apiBase('wb')}/api/wb/questions${query ? `?${query}` : ''}`;
  return httpJSON<ListWrongQuestionsResp>(url);
}
