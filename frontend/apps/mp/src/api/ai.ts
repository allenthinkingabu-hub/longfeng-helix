/**
 * AI analysis API client · MP runtime
 * trace: design/mockups/wrongbook/03_analyzing.html · H5 sibling: frontend/apps/h5/src/pages/Analyzing/
 * Backend: ai-analysis-service → http://localhost:8083
 *
 * Uses httpJSON + apiBase('ai') from _http.ts (wx.request in MP, fetch in vitest).
 * No mock, no MSW — integration tests hit real backend port 8083.
 */

import { httpJSON, apiBase } from './_http';

const AI_BASE = `${apiBase('ai')}/api/ai`;

/** POST /api/ai/analyze — kick off analysis for an uploaded image */
export interface StartAnalyzeRequest {
  imageUrl: string;
  subject?: string;
  model?: string;
}

export interface StartAnalyzeResponse {
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
}

export function startAnalyze(req: StartAnalyzeRequest): Promise<StartAnalyzeResponse> {
  return httpJSON<StartAnalyzeResponse>(`${AI_BASE}/analyze`, {
    method: 'POST',
    body: req,
  });
}

/** GET /api/ai/analyze/:taskId — poll analysis status */
export interface PollAnalyzeStatusResponse {
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  currentStep?: number;
  totalSteps?: number;
  result?: Record<string, unknown>;
  error?: string;
}

export function pollAnalyzeStatus(taskId: string): Promise<PollAnalyzeStatusResponse> {
  return httpJSON<PollAnalyzeStatusResponse>(`${AI_BASE}/analyze/${taskId}`);
}
