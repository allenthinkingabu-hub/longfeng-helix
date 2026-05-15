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

/** GET /api/wb/questions/:qid */
export function getQuestionById(qid: string): Promise<GetQuestionByIdResp> {
  return httpJSON<GetQuestionByIdResp>(
    `${apiBase('wb')}/api/wb/questions/${qid}`,
  );
}

// ── create question (used by P02 capture page) ──────────────────

export interface CreateQuestionReq {
  studentId: number;
  subject: string;
  image_key: string;
  mime: string;
  source_type: number;
}

export interface CreateQuestionResp {
  qid: string;
  status: string;
}

/** POST /api/wb/questions */
export function createQuestion(req: CreateQuestionReq): Promise<CreateQuestionResp> {
  return httpJSON<CreateQuestionResp>(
    `${apiBase('wb')}/api/wb/questions`,
    { method: 'POST', body: req },
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
