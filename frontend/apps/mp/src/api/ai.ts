/**
 * AI Analysis API client · GET /api/ai/<qid>/answer
 * Port: 8083 (ai-analysis-service)
 * Uses shared _http.ts dual-runtime adapter (wx.request in MP, fetch in vitest)
 */
import { apiBase, httpJSON } from './_http';

export interface AiAnswer {
  qid: string;
  reasonMarkdown: string;
  confidence: number;
  modelInfo: { name: string; version: string };
}

/** GET /api/ai/:qid/answer */
export function getAnswerByQid(qid: string): Promise<AiAnswer> {
  return httpJSON<AiAnswer>(
    `${apiBase('ai')}/api/ai/${qid}/answer`,
  );
}

// ── analyze lifecycle (used by P03 analyzing page) ──────────────

export interface StartAnalyzeReq {
  imageUrl: string;
  subject: string;
}

export interface StartAnalyzeResp {
  taskId: string;
  status: string;
}

/** POST /api/ai/analyze */
export function startAnalyze(req: StartAnalyzeReq): Promise<StartAnalyzeResp> {
  return httpJSON<StartAnalyzeResp>(
    `${apiBase('ai')}/api/ai/analyze`,
    { method: 'POST', body: req },
  );
}

export interface PollAnalyzeStatusResponse {
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  currentStep?: number;
  result?: Record<string, unknown>;
  error?: string;
}

/** GET /api/ai/tasks/:taskId/status */
export function pollAnalyzeStatus(taskId: string): Promise<PollAnalyzeStatusResponse> {
  return httpJSON<PollAnalyzeStatusResponse>(
    `${apiBase('ai')}/api/ai/tasks/${taskId}/status`,
  );
}
