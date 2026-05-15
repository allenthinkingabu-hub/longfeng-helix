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

// ── T11 · getNode / revealNode / gradeNode ──────────────────

export interface NodeResponse {
  nid: string;
  question: {
    qid: string;
    stem: string;
    subject: string;
    kpName: string;
    difficulty: number;
    answer: string;
    steps: string[];
  };
  nodeIndex: number;
  tLevel: string;
  easeFactor: number;
}

/** GET /api/review/sessions/{sid}/nodes/{nid} */
export async function getNode(sid: string, nid: string): Promise<NodeResponse> {
  return httpJSON<NodeResponse>(
    `${BASE}/api/review/sessions/${sid}/nodes/${nid}`,
  );
}

export interface RevealResponse {
  revealedAt: string;
}

/** POST /api/review/nodes/{nid}/reveal */
export async function revealNode(nid: string): Promise<RevealResponse> {
  return httpJSON<RevealResponse>(
    `${BASE}/api/review/nodes/${nid}/reveal`,
    { method: 'POST' },
  );
}

export interface GradeRequest {
  grade: 'FORGOT' | 'PARTIAL' | 'MASTERED';
  timeSpentMs: number;
}

export interface GradeResponse {
  nodeId: string;
  newNodeIndex: number;
  newEase: number;
  nextDueAt: string;
}

/** POST /api/review/nodes/{nid}/grade */
export async function gradeNode(nid: string, body: GradeRequest): Promise<GradeResponse> {
  return httpJSON<GradeResponse>(
    `${BASE}/api/review/nodes/${nid}/grade`,
    { method: 'POST', body },
  );
}

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
