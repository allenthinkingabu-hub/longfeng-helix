/**
 * AI Analysis API client
 * Port: 8083 (ai-analysis-service)
 * Uses shared _http.ts dual-runtime adapter (wx.request in MP, fetch in vitest)
 *
 * Backend AnalyzeController + AiAnswerController:
 *   POST /api/ai/analyze            → ApiResult.ok({ task_id, status }) · honors caller taskId
 *   GET  /api/ai/result/{taskId}    → { status: 'ANALYZING'|'DONE'|'FAILED'|... }
 *   GET  /api/ai/{qid}/answer       → AiAnswer body (200 or 404 AI_ANSWER_NOT_FOUND)
 *   GET  /api/ai/stream/{taskId}    → SSE (not used by MP)
 *
 * SC01-MP-BUG-AI-FAKE · BE 字段映射 contract (see test-cases.md ## 字段映射 contract):
 *   modelInfo.name    ←  AnalysisResult.provider  (e.g. "qianwen")
 *   modelInfo.version ←  AnalysisResult.model     (e.g. "qwen-plus" · "fail" when degraded)
 *   qid               ←  request path · BE echoes back
 *   taskId            ←  AnalysisResult.taskId    (== qid when closure works)
 *   reasonMarkdown    ←  AnalysisResult.errorReason
 *   steps[]           ←  AnalysisResult.steps JSON · parsed to {stepNo, text, ...}
 *   provider          ←  AnalysisResult.provider  (kept top-level for "≠ stub" assertions)
 */
import { apiBase, httpJSON } from './_http';

export interface AiStep {
  stepNo: number;
  text: string;
  title?: string;
  formula?: string;
}

export interface AiAnswer {
  qid: string;
  /** Echo of analysis_result.task_id · should equal request qid when BE honors caller taskId. */
  taskId?: string;
  reasonMarkdown: string;
  confidence: number;
  modelInfo: { name: string; version: string };
  /** Top-level provider name (e.g. "qianwen") · kept distinct from modelInfo for ≠ "stub" assertions. */
  provider?: string;
  /** Parsed steps from BE analysis_result.steps JSON. */
  steps?: AiStep[];
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
  /**
   * SC01-MP-BUG-AI-FAKE in_scope #5 + #6: FE passes qid as taskId so that BE
   * persists analysis_result.task_id == qid, enabling the closing GET
   * /api/ai/{qid}/answer to find a row.
   */
  taskId?: string;
}

export interface StartAnalyzeResp {
  taskId: string;
  status: string;
}

/** POST /api/ai/analyze */
export async function startAnalyze(req: StartAnalyzeReq): Promise<StartAnalyzeResp> {
  // Backend AnalyzeByUrlReq accepts {taskId?, subject, imageUrl} (camelCase).
  // When taskId is passed, BE honors it; otherwise BE generates UUID.
  const body: Record<string, unknown> = {
    subject: req.subject,
    imageUrl: req.imageUrl,
  };
  if (req.taskId && req.taskId.length > 0) {
    body.taskId = req.taskId;
  }
  const raw = await httpJSON<{ task_id?: string; taskId?: string; status?: string }>(
    `${apiBase('ai')}/api/ai/analyze`,
    {
      method: 'POST',
      body,
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
