/**
 * AI Analysis API client
 * Port: 8083 (ai-analysis-service)
 * Uses shared _http.ts dual-runtime adapter (wx.request in MP, fetch in vitest)
 *
 * Backend AnalyzeController:
 *   POST /api/ai/analyze            → ApiResult.ok({ task_id, status })
 *   GET  /api/ai/result/{taskId}    → { status: 'ANALYZING'|'DONE'|'FAILED'|... }
 *   GET  /api/ai/stream/{taskId}    → SSE (not used by MP)
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
export async function startAnalyze(req: StartAnalyzeReq): Promise<StartAnalyzeResp> {
  const raw = await httpJSON<{ task_id?: string; taskId?: string; status?: string }>(
    `${apiBase('ai')}/api/ai/analyze`,
    {
      method: 'POST',
      // Backend AnalyzeByUrlReq requires `subject` + `imageUrl` (camelCase).
      body: { subject: req.subject, imageUrl: req.imageUrl },
    },
  );
  return {
    taskId: raw.taskId ?? raw.task_id ?? '',
    status: raw.status ?? 'ANALYZING',
  };
}

export interface PollAnalyzeStatusResponse {
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  currentStep?: number;
  result?: Record<string, unknown>;
  error?: string;
}

/** Backend statuses → MP page state machine. */
function normalizeStatus(
  raw: string | undefined,
): PollAnalyzeStatusResponse['status'] {
  switch (raw) {
    case 'DONE':
    case 'SUCCEEDED':
      return 'SUCCEEDED';
    case 'FAILED':
    case 'CANCELLED':
      return 'FAILED';
    case 'PENDING':
      return 'PENDING';
    default:
      return 'RUNNING';
  }
}

/** GET /api/ai/result/:taskId */
export async function pollAnalyzeStatus(taskId: string): Promise<PollAnalyzeStatusResponse> {
  if (!taskId) {
    throw new Error('pollAnalyzeStatus: taskId is required');
  }
  const raw = await httpJSON<{
    status?: string;
    currentStep?: number;
    current_step?: number;
    result?: Record<string, unknown>;
    error?: string;
  }>(
    `${apiBase('ai')}/api/ai/result/${taskId}`,
  );
  return {
    taskId,
    status: normalizeStatus(raw.status),
    currentStep: raw.currentStep ?? raw.current_step,
    result: raw.result,
    error: raw.error,
  };
}
