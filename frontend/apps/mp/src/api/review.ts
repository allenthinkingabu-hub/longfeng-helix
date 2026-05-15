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

// ── T11 · node-level review APIs ────────────────────────────────

export interface ReviewNodeResp {
  nid: string;
  status: string;
}

/** GET /api/review/nodes/:nid */
export function getNode(nid: string): Promise<ReviewNodeResp> {
  return httpJSON<ReviewNodeResp>(`${BASE}/api/review/nodes/${nid}`);
}

/** POST /api/review/nodes/:nid/reveal */
export function revealNode(nid: string): Promise<ReviewNodeResp> {
  return httpJSON<ReviewNodeResp>(
    `${BASE}/api/review/nodes/${nid}/reveal`,
    { method: 'POST' },
  );
}

/** POST /api/review/nodes/:nid/grade */
export function gradeNode(
  nid: string,
  body: { grade: string; timeSpentMs: number },
): Promise<ReviewNodeResp> {
  return httpJSON<ReviewNodeResp>(
    `${BASE}/api/review/nodes/${nid}/grade`,
    { method: 'POST', body },
  );
}
