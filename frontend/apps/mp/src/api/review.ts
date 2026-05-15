/**
 * Review API client · MP
 * trace: frontend/apps/h5/vite.config.ts → /api/review → localhost:8085
 *
 * 函数按 task 分：
 * - T11: gradeNode (由 T11 task 实现)
 * - T13: completeSession (本文件)
 */

import { apiBase, httpJSON } from './_http';

const BASE = apiBase('review');

// ── T13 · completeSession ───────────────────────────────────
export interface CompleteSessionResp {
  sessionId: string;
  status: string;
  completedAt: string;
  stats: {
    mastered: number;
    partial: number;
    forgot: number;
    total: number;
  };
}

/**
 * POST /api/review/sessions/{sid}/complete
 * 标记一个 review session 完成 · H5 sibling: ReviewDone handleEnd
 */
export async function completeSession(sid: string): Promise<CompleteSessionResp> {
  return httpJSON<CompleteSessionResp>(
    `${BASE}/api/review/sessions/${sid}/complete`,
    { method: 'POST' },
  );
}
