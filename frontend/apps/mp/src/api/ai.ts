/**
 * AI Analysis API client
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

export interface StartAnalyzeRequest {
  imageUrl: string;
  subject: string;
}

export interface StartAnalyzeResponse {
  taskId: string;
}

/** POST /api/ai/analyze — kick off async AI analysis */
export function startAnalyze(req: StartAnalyzeRequest): Promise<StartAnalyzeResponse> {
  return httpJSON<StartAnalyzeResponse>(
    `${apiBase('ai')}/api/ai/analyze`,
    { method: 'POST', body: req },
  );
}

export interface PollAnalyzeStatusResponse {
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  currentStep?: number;
  result?: unknown;
  error?: string;
}

/** GET /api/ai/analyze/:taskId/status — poll analysis progress */
export function pollAnalyzeStatus(taskId: string): Promise<PollAnalyzeStatusResponse> {
  return httpJSON<PollAnalyzeStatusResponse>(
    `${apiBase('ai')}/api/ai/analyze/${taskId}/status`,
  );
}
