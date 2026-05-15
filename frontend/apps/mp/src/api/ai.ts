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
