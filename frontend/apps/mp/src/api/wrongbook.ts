/**
 * Wrongbook API client · GET /api/wb/questions/<qid>
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
